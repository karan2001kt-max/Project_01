/**
 * trail.js
 * Mathematical calculations for Bezier curves, arc-length parameterization,
 * road tracing, and tangent/slope calculations.
 */

(() => {
  "use strict";

  const WORLD_W = 1200;
  const WORLD_H = 600;
  const BASE_SPEED = 72;

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

  /*
   * Smooth cubic Bezier segments.
   * Adjacent segments share horizontal tangents at crests and troughs.
   * Positive screen-space slope means downhill.
   */
  const curves = [
    [[-60, 450], [75, 450], [125, 320], [255, 320]],
    [[255, 320], [300, 320], [335, 320], [380, 320]],
    [[380, 320], [475, 320], [510, 455], [630, 455]],
    [[630, 455], [665, 455], [705, 455], [740, 455]],
    [[740, 455], [825, 455], [860, 345], [955, 345]],
    [[955, 345], [1075, 345], [1090, 460], [1260, 460]]
  ];

  function bezier(c, t) {
    const u = 1 - t;
    return {
      x: u * u * u * c[0][0] + 3 * u * u * t * c[1][0]
        + 3 * u * t * t * c[2][0] + t * t * t * c[3][0],
      y: u * u * u * c[0][1] + 3 * u * u * t * c[1][1]
        + 3 * u * t * t * c[2][1] + t * t * t * c[3][1]
    };
  }

  /*
   * Build an arc-length lookup.
   * Movement is measured in world units, not raw Bezier t, so speed
   * remains consistent across segments of different lengths.
   */
  const samples = [];
  let totalLength = 0;
  let previousPoint = null;

  curves.forEach((curve, index) => {
    for (let i = index ? 1 : 0; i <= 220; i++) {
      const p = bezier(curve, i / 220);
      if (previousPoint) {
        totalLength += Math.hypot(
          p.x - previousPoint.x,
          p.y - previousPoint.y
        );
      }
      samples.push({ ...p, d: totalLength });
      previousPoint = p;
    }
  });

  function pointAt(distance) {
    const d = clamp(distance, 0, totalLength);
    let low = 0;
    let high = samples.length - 1;

    while (low < high) {
      const mid = (low + high) >> 1;
      if (samples[mid].d < d) low = mid + 1;
      else high = mid;
    }

    const b = samples[low];
    const a = samples[Math.max(0, low - 1)];
    const t = (d - a.d) / (b.d - a.d || 1);

    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  }

  function slopeAt(distance) {
    const a = pointAt(distance - 3);
    const b = pointAt(distance + 3);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  function traceRoad(ctx) {
    ctx.beginPath();
    ctx.moveTo(...curves[0][0]);
    for (const c of curves) {
      ctx.bezierCurveTo(...c[1], ...c[2], ...c[3]);
    }
  }

  // Export to global namespace
  window.Trail = {
    WORLD_W,
    WORLD_H,
    BASE_SPEED,
    curves,
    totalLength,
    clamp,
    lerp,
    ease,
    pointAt,
    slopeAt,
    traceRoad
  };
})();
