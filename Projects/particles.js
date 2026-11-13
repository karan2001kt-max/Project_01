/**
 * particles.js
 * Particle system for running dust trails and high-speed downhill slide streaks.
 */

(() => {
  "use strict";

  let particles = [];

  function emitDust(p) {
    particles.push({
      x: p.x - 7,
      y: p.y + 1,
      vx: -18 - Math.random() * 24,
      vy: -10 - Math.random() * 16,
      life: 0.6 + Math.random() * 0.25,
      maxLife: 0.85,
      r: 2 + Math.random() * 3
    });
    if (particles.length > 90) particles.shift();
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 24 * dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function drawEffects(ctx, p, angle, slideBlend, time) {
    const { clamp } = window.Trail;

    // Dust particles
    for (const particle of particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1) * 0.48;
      ctx.fillStyle = "#f4dfba";
      ctx.beginPath();
      ctx.ellipse(particle.x, particle.y, particle.r, particle.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (slideBlend < 0.02) return;

    // Sliding speed lines
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.globalAlpha = slideBlend * 0.65;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    for (let i = 0; i < 5; i++) {
      const shift = (time * 170 + i * 19) % 50;
      const x = -26 - shift;
      const y = -15 - i * 9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 13 - i * 2, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function resetParticles() {
    particles = [];
  }

  // Export to global namespace
  window.Particles = {
    emitDust,
    updateParticles,
    drawEffects,
    resetParticles
  };
})();
