/**
 * cloudTransition.js
 * Full-screen cinematic cloud gathering and expansion effect.
 * Completely independent from the boy trail simulation.
 * Ensures 100% screen coverage during peak gathering.
 */

(() => {
  "use strict";

  const canvas = document.createElement("canvas");
  canvas.id = "cloudOverlayCanvas";
  canvas.className = "cloud-overlay-canvas";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  window.addEventListener("resize", resize);
  resize();

  // Cloud particle definition
  class FluffyCloud {
    constructor(gridX, gridY, index, total) {
      this.gridX = gridX;
      this.gridY = gridY;
      this.index = index;
      this.total = total;
      this.reset();
    }

    reset() {
      // Pick spawn point from outside the viewport
      const angle = (this.index / this.total) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
      const distance = Math.max(width, height) * (0.95 + Math.random() * 0.45);

      this.startX = width / 2 + Math.cos(angle) * distance;
      this.startY = height / 2 + Math.sin(angle) * distance;

      // Target position covers the entire screen grid
      this.targetX = this.gridX + (Math.random() - 0.5) * (width * 0.08);
      this.targetY = this.gridY + (Math.random() - 0.5) * (height * 0.08);

      // Expansion vector (exploding outward from center when dispersing)
      const outAngle = Math.atan2(this.targetY - height / 2, this.targetX - width / 2) + (Math.random() * 0.35 - 0.17);
      const expandDist = Math.max(width, height) * (1.15 + Math.random() * 0.55);
      this.endX = width / 2 + Math.cos(outAngle) * expandDist;
      this.endY = height / 2 + Math.sin(outAngle) * expandDist;

      this.currentX = this.startX;
      this.currentY = this.startY;

      // Generous scale to ensure complete screen coverage
      const screenDim = Math.max(width, height);
      this.baseScale = (screenDim / 260) * (1.35 + Math.random() * 0.45);
      this.scale = 0.35;
      this.alpha = 0;
      this.color = Math.random() > 0.3 ? "#ffffff" : (Math.random() > 0.5 ? "#f6fbfe" : "#fffdf8");
    }

    update(phase, t) {
      if (phase === "gather") {
        // Cubic ease out towards center grid
        const easeT = 1 - Math.pow(1 - t, 3);
        this.currentX = this.startX + (this.targetX - this.startX) * easeT;
        this.currentY = this.startY + (this.targetY - this.startY) * easeT;
        this.scale = 0.35 + easeT * 1.15;
        this.alpha = Math.min(1, easeT * 1.4);
      } else if (phase === "expand") {
        // Quadratic ease in expanding outward
        const easeT = Math.pow(t, 2);
        this.currentX = this.targetX + (this.endX - this.targetX) * easeT;
        this.currentY = this.targetY + (this.endY - this.targetY) * easeT;
        this.scale = 1.5 + easeT * 2.8; // Zoom towards viewer
        this.alpha = Math.max(0, 1 - Math.pow(t, 1.25));
      }
    }

    draw(ctx) {
      if (this.alpha <= 0.005) return;

      ctx.save();
      ctx.translate(this.currentX, this.currentY);
      const s = this.scale * this.baseScale;
      ctx.scale(s, s);
      ctx.globalAlpha = this.alpha;

      // Soft ambient cartoon shadow
      ctx.shadowColor = "rgba(40, 85, 70, 0.1)";
      ctx.shadowBlur = 22;

      // Exact cartoon cloud silhouette matching reference image
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(-32, 8);
      ctx.quadraticCurveTo(-33, 11, -28, 14);
      ctx.bezierCurveTo(-18, 18.2, 18, 18.2, 28, 14);
      ctx.quadraticCurveTo(33, 11, 32, 8);
      ctx.quadraticCurveTo(30, 4, 27, 2);
      ctx.bezierCurveTo(24, -8, 18, -18, 10, -18);
      ctx.bezierCurveTo(2, -18, -2, -14, -6, -13);
      ctx.bezierCurveTo(-10, -12, -16, -13, -20, -10);
      ctx.bezierCurveTo(-25, -6, -28, 3, -32, 8);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  // Animation Controller
  let isAnimating = false;
  let startTime = null;
  const GATHER_DURATION = 1150; // ms
  const PAUSE_DURATION = 350;   // ms (Hold for complete screen blanket)
  const EXPAND_DURATION = 1250; // ms
  const TOTAL_DURATION = GATHER_DURATION + PAUSE_DURATION + EXPAND_DURATION;

  const clouds = [];

  function initClouds() {
    clouds.length = 0;
    // 5 columns x 4 rows grid covering the full viewport
    const cols = 5;
    const rows = 4;
    let idx = 0;
    const total = cols * rows + 6;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gx = ((c + 0.5) / cols) * width;
        const gy = ((r + 0.5) / rows) * height;
        clouds.push(new FluffyCloud(gx, gy, idx++, total));
      }
    }

    // Additional 6 center accent overlapping clouds
    for (let i = 0; i < 6; i++) {
      const gx = width / 2 + (Math.random() - 0.5) * (width * 0.35);
      const gy = height / 2 + (Math.random() - 0.5) * (height * 0.35);
      clouds.push(new FluffyCloud(gx, gy, idx++, total));
    }
  }

  function render(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (elapsed < GATHER_DURATION) {
      // 1. Gathering phase
      const t = elapsed / GATHER_DURATION;
      const mistAlpha = Math.max(0, (t - 0.35) / 0.65);

      // Background soft cloud mist blanket
      if (mistAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${mistAlpha * 0.98})`;
        ctx.fillRect(0, 0, width, height);
      }

      for (const cloud of clouds) {
        cloud.update("gather", t);
        cloud.draw(ctx);
      }
    } else if (elapsed < GATHER_DURATION + PAUSE_DURATION) {
      // 2. Full screen 100% blanketed cloud cover hold (Zero gaps)
      ctx.fillStyle = "rgba(255, 255, 255, 0.99)";
      ctx.fillRect(0, 0, width, height);

      for (const cloud of clouds) {
        cloud.update("gather", 1);
        cloud.draw(ctx);
      }
    } else if (elapsed < TOTAL_DURATION) {
      // 3. Expanding / dispersing phase
      const t = (elapsed - GATHER_DURATION - PAUSE_DURATION) / EXPAND_DURATION;
      const mistAlpha = Math.max(0, 1 - t * 1.6);

      if (mistAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${mistAlpha * 0.99})`;
        ctx.fillRect(0, 0, width, height);
      }

      for (const cloud of clouds) {
        cloud.update("expand", t);
        cloud.draw(ctx);
      }
    } else {
      // Finished
      isAnimating = false;
      startTime = null;
      ctx.clearRect(0, 0, width, height);
      if (window.onCloudEffectComplete) {
        window.onCloudEffectComplete();
      }
      return;
    }

    requestAnimationFrame(render);
  }

  function triggerCloudSpectacle() {
    if (isAnimating) return;
    isAnimating = true;
    startTime = null;
    resize();
    initClouds();
    requestAnimationFrame(render);
  }

  // Bind to the Start button once DOM is loaded
  function setupButton() {
    const startBtn = document.getElementById("cloudStartBtn");
    if (!startBtn) return;

    startBtn.addEventListener("click", () => {
      startBtn.classList.add("pulse");
      triggerCloudSpectacle();

      setTimeout(() => {
        startBtn.classList.remove("pulse");
      }, 500);
    });

    window.onCloudEffectComplete = () => {
      startBtn.focus();
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupButton);
  } else {
    setupButton();
  }

  // Export to global namespace
  window.CloudEffect = {
    trigger: triggerCloudSpectacle
  };
})();
