/**
 * landscape.js
 * Renders environment background, hills, sky, sun, animated clouds,
 * trees, layered road surface, road decorations, and signs.
 */

(() => {
  "use strict";

  function ellipse(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function line(ctx, points, color, thickness) {
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(...points[i]);
    }
    ctx.stroke();
  }

  function cloud(ctx, x, y, s, opacity = 0.96) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;

    // Exact cloud silhouette matching user reference image
    ctx.beginPath();
    // Start at left rim
    ctx.moveTo(-32, 8);
    // Bottom left curve to base
    ctx.quadraticCurveTo(-33, 11, -28, 14);
    // Bottom base curve across to right
    ctx.bezierCurveTo(-18, 18.2, 18, 18.2, 28, 14);
    // Bottom right curve
    ctx.quadraticCurveTo(33, 11, 32, 8);
    // Right rim up
    ctx.quadraticCurveTo(30, 4, 27, 2);
    // Right slope up to right dome peak
    ctx.bezierCurveTo(24, -8, 18, -18, 10, -18);
    // Dip between right and left dome
    ctx.bezierCurveTo(2, -18, -2, -14, -6, -13);
    // Left dome peak
    ctx.bezierCurveTo(-10, -12, -16, -13, -20, -10);
    // Left slope down to left rim
    ctx.bezierCurveTo(-25, -6, -28, 3, -32, 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function tree(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    line(ctx, [[0, 0], [0, -65]], "#648059", 7);
    ellipse(ctx, -15, -68, 24, 30, "#6ea67c");
    ellipse(ctx, 10, -81, 26, 31, "#86b88d");
    ellipse(ctx, 27, -57, 21, 25, "#76ac81");
    ctx.restore();
  }

  function drawLandscape(ctx, time) {
    const { WORLD_W, WORLD_H, traceRoad } = window.Trail;

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    sky.addColorStop(0, "#c8eafa");
    sky.addColorStop(0.7, "#eff6dc");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Sun
    ellipse(ctx, 1005, 100, 62, 62, "#fff7c733");
    ellipse(ctx, 1005, 100, 42, 42, "#fff5c5");

    // Exact Cartoon Clouds (50% reduced quantity - exactly 2 clouds like reference image)
    // 1. Top-left cloud
    cloud(ctx, 160 + Math.sin(time * 0.04) * 25, 95, 1.75, 0.98);
    // 2. Lower-right cloud below sun
    cloud(ctx, 1070 + Math.sin(time * 0.035) * 22, 195, 1.6, 0.98);

    // Background Hills
    ctx.fillStyle = "#c0d8ae";
    ctx.beginPath();
    ctx.moveTo(0, 355);
    ctx.bezierCurveTo(170, 170, 345, 220, 535, 330);
    ctx.bezierCurveTo(745, 160, 1010, 205, 1200, 300);
    ctx.lineTo(1200, 600);
    ctx.lineTo(0, 600);
    ctx.fill();

    // Foreground Hills
    ctx.fillStyle = "#9ec48f";
    ctx.beginPath();
    ctx.moveTo(0, 390);
    ctx.bezierCurveTo(140, 250, 330, 250, 490, 370);
    ctx.bezierCurveTo(755, 290, 930, 220, 1200, 360);
    ctx.lineTo(1200, 600);
    ctx.lineTo(0, 600);
    ctx.fill();

    // Grass fill below the road
    traceRoad(ctx);
    ctx.lineTo(1260, 620);
    ctx.lineTo(-60, 620);
    ctx.closePath();

    const grass = ctx.createLinearGradient(0, 315, 0, 600);
    grass.addColorStop(0, "#8cbd79");
    grass.addColorStop(1, "#70a267");
    ctx.fillStyle = grass;
    ctx.fill();

    // Trees
    tree(ctx, 132, 357, 0.63);
    tree(ctx, 831, 357, 0.7);
    tree(ctx, 882, 325, 0.45);
    tree(ctx, 1100, 398, 0.75);

    // Layered Road Bed
    traceRoad(ctx);
    ctx.strokeStyle = "#6c985b";
    ctx.lineWidth = 43;
    ctx.stroke();

    traceRoad(ctx);
    ctx.strokeStyle = "#ad8968";
    ctx.lineWidth = 31;
    ctx.stroke();

    traceRoad(ctx);
    ctx.strokeStyle = "#d6b691";
    ctx.lineWidth = 24;
    ctx.stroke();

    traceRoad(ctx);
    ctx.strokeStyle = "#f9e2c180";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 15]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Stable roadside grass and flower decorations
    for (let i = 0; i < 82; i++) {
      const x = (i * 173) % 1200;
      const y = 508 + (i * 31) % 86;
      line(ctx, [[x - 3, y], [x, y - 9], [x + 2, y]], "#63945c", 1.5);
      if (i % 4 === 0) {
        ellipse(ctx, x, y - 10, 3, 3, i % 8 === 0 ? "#fff1b4" : "#f2f1df");
      }
    }

    // Signboard Texts
    ctx.font = "bold 10px system-ui";
    ctx.fillStyle = "#6b8967";
    ctx.fillText("TAKE IT EASY", 275, 284);
    ctx.fillText("WHEEE!", 522, 376);
  }

  // Export to global namespace
  window.Landscape = {
    drawLandscape,
    ellipse,
    line,
    cloud,
    tree
  };
})();
