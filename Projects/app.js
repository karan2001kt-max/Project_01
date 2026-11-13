/**
 * app.js
 * Main Orchestration Engine:
 * - 1. State-First Architecture (Centralized Reactive State Store)
 * - 2. Precision Delta Time (dt) & Frame-Rate Independence
 * - 3. Smart Lifecycle & Background Tab Handling (visibilitychange, blur/focus)
 * - 4. Render Pipeline (Landscape -> Effects -> Character)
 */

(() => {
  "use strict";

  const {
    WORLD_W,
    WORLD_H,
    BASE_SPEED,
    totalLength,
    clamp,
    lerp,
    ease,
    pointAt,
    slopeAt
  } = window.Trail;

  const { drawLandscape } = window.Landscape;
  const { drawChild } = window.Character;
  const { emitDust, updateParticles, drawEffects, resetParticles } = window.Particles;
  const { initUI, updatePlayButton, updateDisplay, announce } = window.UI;

  /* ==========================================================================
     1. State-First Architecture: Single Source of Truth Store
     ========================================================================== */
  class StateStore {
    constructor(initialState) {
      this._state = { ...initialState };
      this._subscribers = new Set();
    }

    getState() {
      return this._state;
    }

    setState(patch) {
      let changed = false;
      for (const key in patch) {
        if (this._state[key] !== patch[key]) {
          this._state[key] = patch[key];
          changed = true;
        }
      }
      if (changed) {
        this._notify();
      }
    }

    subscribe(callback) {
      this._subscribers.add(callback);
      return () => this._subscribers.delete(callback);
    }

    _notify() {
      for (const subscriber of this._subscribers) {
        subscriber(this._state);
      }
    }
  }

  const store = new StateStore({
    distance: 105,
    speed: BASE_SPEED * 0.8,
    paused: false,
    dragging: false,
    scrubTarget: null,
    sliding: false,
    slideBlend: 0,
    angle: 0
  });

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  // Engine Sizing & Camera Variables
  let width = 800;
  let height = 450;
  let scale = 1;
  let cameraX = 0;
  let cameraReady = false;
  let phase = 0;
  let time = 0;
  let dustTimer = 0;
  let lastTimestamp = null;

  /* ==========================================================================
     2. Canvas ResizeObserver (Viewport Scaling)
     ========================================================================== */
  function handleResize() {
    const bounds = canvas.getBoundingClientRect();
    const w = bounds.width || canvas.clientWidth || 800;
    const h = bounds.height || canvas.clientHeight || 450;

    if (w <= 0 || h <= 0) return;

    width = w;
    height = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    scale = Math.max(width / WORLD_W, height / WORLD_H);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    cameraReady = false;
  }

  /* ==========================================================================
     3. Delta Time (dt) & Physics Loop
     ========================================================================== */
  function updateSlopeState(angle, currentSliding) {
    // Hysteresis prevents rapid RUNNING/SLIDING flicker near level ground
    if (currentSliding && angle < 0.04) return false;
    if (!currentSliding && angle > 0.11) return true;
    return currentSliding;
  }

  function frame(timestamp) {
    try {
      const state = store.getState();

      // Calculate precision dt with safe clamp (max 40ms to avoid physics explosions)
      const rawDt = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
      const dt = Math.min(Math.max(0, rawDt), 0.04);
      lastTimestamp = timestamp;

      let {
        distance,
        speed,
        paused,
        dragging,
        scrubTarget,
        sliding,
        slideBlend
      } = state;

      const oldDistance = distance;

      // Handle user scrubbing / dragging
      if (scrubTarget !== null) {
        distance = lerp(distance, scrubTarget, ease(16, dt));
        if (Math.abs(distance - scrubTarget) < 0.12) {
          distance = scrubTarget;
          if (!dragging) scrubTarget = null;
        }
      } else if (!paused) {
        distance += speed * dt;
        if (distance > totalLength) {
          distance %= totalLength;
          resetParticles();
          cameraReady = false;
        }
      }

      const p = pointAt(distance);
      const angle = slopeAt(distance);
      sliding = updateSlopeState(angle, sliding);

      if (!paused) {
        time += dt;

        // Exponential gravity response on downhill / uphill slopes
        const downhill = Math.max(0, Math.sin(angle));
        const uphill = Math.max(0, -Math.sin(angle));
        const targetSpeed = BASE_SPEED * (1 + downhill * 3.1 - uphill * 0.55);

        speed = lerp(speed, targetSpeed, ease(targetSpeed > speed ? 2.2 : 3.3, dt));
        slideBlend = lerp(slideBlend, sliding ? 1 : 0, ease(9, dt));
        phase += dt * (7 + speed / BASE_SPEED * 5);

        const moved = Math.abs(distance - oldDistance);
        if (moved > 0.02 && moved < 100) {
          dustTimer += dt;
          const interval = sliding ? 0.035 : 0.085;
          if (dustTimer > interval) {
            dustTimer = 0;
            emitDust(p);
          }
        }
        updateParticles(dt);
      }

      // Gentle camera tracking for mobile/narrow viewports
      const safeScale = scale > 0 ? scale : 1;
      const visibleWorldWidth = width / safeScale;
      const cameraTarget = clamp(
        p.x - visibleWorldWidth * 0.43,
        0,
        Math.max(0, WORLD_W - visibleWorldWidth)
      );

      if (!cameraReady || isNaN(cameraX)) {
        cameraX = isNaN(cameraTarget) ? 0 : cameraTarget;
        cameraReady = true;
      } else {
        cameraX = lerp(cameraX, isNaN(cameraTarget) ? 0 : cameraTarget, ease(6, dt));
      }

      // Commit updated simulation state back to store
      store.setState({
        distance,
        speed,
        scrubTarget,
        sliding,
        slideBlend,
        angle
      });

      // Canvas Render Pipeline
      const pixelRatio = canvas.width / (width || 1);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(-cameraX * safeScale, (height - WORLD_H * safeScale) / 2);
      ctx.scale(safeScale, safeScale);

      drawLandscape(ctx, time);
      drawEffects(ctx, p, angle, slideBlend, time);
      drawChild(ctx, p, angle, slideBlend, phase);

      ctx.restore();

      // Update UI displays
      updateDisplay({
        distance,
        totalLength,
        speed,
        baseSpeed: BASE_SPEED,
        angle,
        paused,
        sliding
      });
    } catch (err) {
      console.error("Animation frame error:", err);
    }

    requestAnimationFrame(frame);
  }

  /* ==========================================================================
     4. Initialize UI Controls & Action Dispatchers
     ========================================================================== */
  initUI({
    onScrub: (target, isDrag) => {
      store.setState({
        dragging: isDrag,
        scrubTarget: clamp(target, 0, totalLength)
      });
    },
    onDragStart: () => {
      store.setState({ dragging: true });
    },
    onDragEnd: () => {
      store.setState({ dragging: false });
    },
    onWheelScrub: delta => {
      const current = store.getState().scrubTarget ?? store.getState().distance;
      store.setState({
        scrubTarget: clamp(current + delta, 0, totalLength)
      });
    },
    onKeyNav: ({ nextDelta, absoluteTarget }) => {
      const current = store.getState().scrubTarget ?? store.getState().distance;
      const target = absoluteTarget !== null && absoluteTarget !== undefined
        ? absoluteTarget
        : clamp(current + nextDelta, 0, totalLength);

      store.setState({ scrubTarget: target });
    },
    onPlayToggle: () => {
      const nextPaused = !store.getState().paused;
      store.setState({ paused: nextPaused });
      updatePlayButton(nextPaused);
      announce(nextPaused ? "Animation paused" : "Animation resumed");
    },
    onReset: () => {
      store.setState({
        distance: 105,
        speed: BASE_SPEED * 0.8,
        paused: true,
        dragging: false,
        scrubTarget: null,
        sliding: false,
        slideBlend: 0
      });
      phase = 0;
      time = 0;
      dustTimer = 0;
      cameraReady = false;
      resetParticles();
      updatePlayButton(true);
    }
  });

  /* ==========================================================================
     5. Resilient Background Tab & Window Focus Lifecycle
     ========================================================================== */
  document.addEventListener("visibilitychange", () => {
    lastTimestamp = null;
  });

  window.addEventListener("blur", () => {
    lastTimestamp = null;
  });

  window.addEventListener("focus", () => {
    lastTimestamp = null;
  });

  // Respect system prefers-reduced-motion
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    store.setState({ paused: true });
  }

  // Start Engine
  new ResizeObserver(handleResize).observe(canvas);
  handleResize();
  updatePlayButton(store.getState().paused);
  requestAnimationFrame(frame);
})();
