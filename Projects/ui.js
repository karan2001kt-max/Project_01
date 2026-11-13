/**
 * ui.js
 * User Interface Controller:
 * - Reactive DOM Diffing & Caching (Avoids layout thrashing)
 * - Event Throttling & Coalescing via requestAnimationFrame
 * - Optimistic UI Updates (Zero latency feel)
 * - Comprehensive Keyboard First & Accessibility (A11y)
 */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  let elements = {};
  let callbacks = {};
  let activePointer = null;
  let rafDragId = null;
  let latestPointerEvent = null;

  // DOM Diff Cache to prevent redundant writes
  const domCache = {
    percent: null,
    pace: null,
    terrain: null,
    stateText: null,
    dotColor: null,
    message: null,
    playHtml: null,
    thumbTop: null,
    fillHeight: null
  };

  function initUI(handlers) {
    callbacks = handlers || {};

    elements = {
      scene: $("scene"),
      track: $("track"),
      thumb: $("thumb"),
      fill: $("fill"),
      play: $("play"),
      reset: $("reset"),
      progress: $("progress"),
      pace: $("pace"),
      terrain: $("terrain"),
      state: $("state"),
      dot: $("dot"),
      message: $("message"),
      liveAnnouncer: $("live-announcer")
    };

    setupSliderEvents();
    setupWheelEvent();
    setupGlobalKeyboardEvents();
    setupButtonEvents();
  }

  /* ==========================================================================
     Event Throttling & Dragging (RAF Coalesced)
     ========================================================================== */
  function setupSliderEvents() {
    const { track, thumb } = elements;
    if (!track || !thumb) return;
    const { clamp, totalLength } = window.Trail;

    function processPointerMovement() {
      if (!latestPointerEvent) return;
      const rect = track.getBoundingClientRect();
      const rawProgress = 1 - clamp((latestPointerEvent.clientY - rect.top) / rect.height, 0, 1);
      const targetDistance = rawProgress * totalLength;

      // Optimistic visual update on thumb before physics catch up
      const visualPercent = Math.round(rawProgress * 100);
      optimisticThumbUpdate(rawProgress, visualPercent);

      if (callbacks.onScrub) {
        callbacks.onScrub(targetDistance, true);
      }
      latestPointerEvent = null;
      rafDragId = null;
    }

    function queuePointerUpdate(event) {
      latestPointerEvent = event;
      if (!rafDragId) {
        rafDragId = requestAnimationFrame(processPointerMovement);
      }
    }

    track.addEventListener("pointerdown", event => {
      if (event.button !== 0 || activePointer !== null) return;
      event.preventDefault();
      activePointer = event.pointerId;
      track.setPointerCapture(event.pointerId);
      thumb.focus({ preventScroll: true });

      if (callbacks.onDragStart) callbacks.onDragStart();
      queuePointerUpdate(event);
    });

    track.addEventListener("pointermove", event => {
      if (event.pointerId === activePointer) {
        queuePointerUpdate(event);
      }
    });

    function finishDrag(event) {
      if (event.pointerId !== activePointer) return;
      if (rafDragId) {
        cancelAnimationFrame(rafDragId);
        rafDragId = null;
      }
      activePointer = null;
      latestPointerEvent = null;
      if (callbacks.onDragEnd) callbacks.onDragEnd();
    }

    track.addEventListener("pointerup", finishDrag);
    track.addEventListener("pointercancel", finishDrag);
    track.addEventListener("lostpointercapture", finishDrag);
  }

  /* ==========================================================================
     Wheel Scrubbing (Throttled)
     ========================================================================== */
  function setupWheelEvent() {
    const { scene } = elements;
    if (!scene) return;
    const { clamp } = window.Trail;
    let wheelRafId = null;
    let accumulatedDelta = 0;

    scene.addEventListener("wheel", event => {
      if (event.ctrlKey) return; // Leave pinch/zoom untouched
      event.preventDefault();

      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scene.clientHeight : 1;
      const delta = clamp(event.deltaY * unit, -220, 220);
      accumulatedDelta += delta * 0.65;

      if (!wheelRafId) {
        wheelRafId = requestAnimationFrame(() => {
          if (callbacks.onWheelScrub) {
            callbacks.onWheelScrub(accumulatedDelta);
          }
          accumulatedDelta = 0;
          wheelRafId = null;
        });
      }
    }, { passive: false });
  }

  /* ==========================================================================
     Keyboard First Navigation (Accessible & Global Shortcuts)
     ========================================================================== */
  function setupGlobalKeyboardEvents() {
    const { totalLength } = window.Trail;

    window.addEventListener("keydown", event => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      if (activeTag === "input" || activeTag === "textarea") return;

      // Spacebar toggles Play/Pause globally
      if (event.code === "Space" && event.target !== elements.play && event.target !== elements.reset) {
        event.preventDefault();
        if (callbacks.onPlayToggle) callbacks.onPlayToggle();
        return;
      }

      // 'R' or 'r' resets animation
      if (event.code === "KeyR" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        if (callbacks.onReset) callbacks.onReset();
        return;
      }

      // Numeric keys 1 - 9 jump to fractions of the trail (10% to 90%)
      if (event.key >= "1" && event.key <= "9" && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        const fraction = parseInt(event.key, 10) / 10;
        const target = fraction * totalLength;
        announce(`Jumped to ${Math.round(fraction * 100)}% of trail`);
        if (callbacks.onKeyNav) {
          callbacks.onKeyNav({ absoluteTarget: target });
        }
        return;
      }
    });

    if (!elements.thumb) return;

    // Slider specific navigation keys
    elements.thumb.addEventListener("keydown", event => {
      const step = totalLength * (event.shiftKey ? 0.1 : 0.025);
      let nextDelta = 0;
      let absoluteTarget = null;

      switch (event.key) {
        case "ArrowUp":
        case "ArrowRight":
          nextDelta = step;
          break;
        case "ArrowDown":
        case "ArrowLeft":
          nextDelta = -step;
          break;
        case "PageUp":
          nextDelta = totalLength * 0.1;
          break;
        case "PageDown":
          nextDelta = -totalLength * 0.1;
          break;
        case "Home":
          absoluteTarget = 0;
          break;
        case "End":
          absoluteTarget = totalLength;
          break;
        default:
          return;
      }

      event.preventDefault();
      if (callbacks.onKeyNav) {
        callbacks.onKeyNav({ nextDelta, absoluteTarget });
      }
    });
  }

  /* ==========================================================================
     Button Interactions (Optimistic Feedback)
     ========================================================================== */
  function setupButtonEvents() {
    if (elements.play) {
      elements.play.addEventListener("click", () => {
        if (callbacks.onPlayToggle) callbacks.onPlayToggle();
      });
    }

    if (elements.reset) {
      elements.reset.addEventListener("click", () => {
        announce("Trail reset to beginning");
        if (callbacks.onReset) callbacks.onReset();
      });
    }
  }

  function announce(text) {
    if (elements.liveAnnouncer) {
      elements.liveAnnouncer.textContent = text;
    }
  }

  /* ==========================================================================
     Optimistic Updates & Reactive Diffing
     ========================================================================== */
  function optimisticThumbUpdate(fraction, percent) {
    if (!elements.thumb || !elements.fill || !elements.progress) return;
    const topVal = `${(1 - fraction) * 100}%`;
    const fillVal = `${fraction * 100}%`;

    elements.thumb.style.top = topVal;
    elements.fill.style.height = fillVal;
    elements.thumb.setAttribute("aria-valuenow", percent);
    elements.thumb.setAttribute("aria-valuetext", `${percent}% of trail`);
    elements.progress.textContent = `${percent}%`;

    domCache.thumbTop = topVal;
    domCache.fillHeight = fillVal;
    domCache.percent = percent;
  }

  function updatePlayButton(paused) {
    if (!elements.play) return;
    const nextHtml = paused ? "▶ &nbsp; Start" : "Ⅱ &nbsp; Pause";
    if (domCache.playHtml !== nextHtml) {
      elements.play.innerHTML = nextHtml;
      elements.play.setAttribute("aria-label", paused ? "Start animation (Space)" : "Pause animation (Space)");
      domCache.playHtml = nextHtml;
    }
  }

  /**
   * updateDisplay(state)
   * Diff-driven rendering: ONLY mutates DOM nodes whose values have changed.
   */
  function updateDisplay(state) {
    if (!elements.thumb) return;
    const { distance, totalLength, speed, baseSpeed, angle, paused, sliding } = state;
    const { thumb, fill, progress, pace, terrain, state: stateText, dot, message } = elements;

    const progressFraction = distance / totalLength;
    const percent = Math.round(progressFraction * 100);

    // Diff thumb position
    const topVal = `${(1 - progressFraction) * 100}%`;
    if (domCache.thumbTop !== topVal) {
      thumb.style.top = topVal;
      domCache.thumbTop = topVal;
    }

    const fillVal = `${progressFraction * 100}%`;
    if (domCache.fillHeight !== fillVal) {
      fill.style.height = fillVal;
      domCache.fillHeight = fillVal;
    }

    // Diff progress
    if (domCache.percent !== percent) {
      progress.textContent = `${percent}%`;
      thumb.setAttribute("aria-valuenow", percent);
      thumb.setAttribute("aria-valuetext", `${percent}% of trail`);
      domCache.percent = percent;
    }

    // Diff pace
    const paceVal = `${(paused ? 0 : speed / baseSpeed).toFixed(1)}×`;
    if (domCache.pace !== paceVal) {
      pace.textContent = paceVal;
      domCache.pace = paceVal;
    }

    // Diff terrain
    const terrainVal = angle > 0.07 ? "Downhill" : angle < -0.07 ? "Uphill" : "Flat";
    if (domCache.terrain !== terrainVal) {
      terrain.textContent = terrainVal;
      domCache.terrain = terrainVal;
    }

    // Diff state badge
    const badgeVal = paused ? "PAUSED" : sliding ? "SLIDING" : "RUNNING";
    if (domCache.stateText !== badgeVal) {
      stateText.textContent = badgeVal;
      domCache.stateText = badgeVal;
    }

    const dotVal = paused ? "#b59e72" : sliding ? "#4a9bc1" : "#40977a";
    if (domCache.dotColor !== dotVal) {
      dot.style.background = dotVal;
      domCache.dotColor = dotVal;
    }

    // Diff message
    const msgVal = paused
      ? "Take a breath. The hills can wait."
      : sliding
        ? "Wheee! Let gravity do the work."
        : angle < -0.07
          ? "Steady steps up the hillside."
          : "Little steps, big adventures.";

    if (domCache.message !== msgVal) {
      message.textContent = msgVal;
      domCache.message = msgVal;
    }
  }

  // Export to global namespace
  window.UI = {
    initUI,
    updatePlayButton,
    updateDisplay,
    announce
  };
})();
