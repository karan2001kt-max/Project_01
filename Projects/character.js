/**
 * character.js
 * Procedural skeletal animation and rendering for the running and sliding child.
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

  function drawChild(ctx, p, angle, slideBlend, phase) {
    ctx.save();

    // Exact road position and local tangent define the character transform.
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);

    // Ground contact shadow
    ellipse(ctx, 0, 4, 19, 4, "#65503b30");

    const run = 1 - slideBlend;
    const swing = Math.sin(phase) * 13 * run;
    const bounce = Math.sin(phase * 2) * 1.6 * run;
    const crouch = slideBlend * 7;
    const hip = [-slideBlend * 4, -28 + crouch + bounce];

    // Far arm and leg
    line(ctx, [
      [-2, -48 + crouch + bounce],
      [-12 - swing * 0.45, -37 + crouch],
      [-17 - swing * 0.6, -31 + crouch]
    ], "#df986e", 6);

    const farFoot = swing + slideBlend * 18;
    line(ctx, [hip, [-8 + swing * 0.45, -15], [farFoot, -3]], "#345975", 7);
    line(ctx, [[farFoot - 2, -3], [farFoot + 7, -3]], "#fff2d8", 6);

    // Backpack
    line(ctx, [
      [-8 - slideBlend * 4, -45 + crouch + bounce],
      [-10 - slideBlend * 4, -31 + crouch + bounce]
    ], "#d9844d", 13);

    // Shirt with slight lean back during the slide
    const shoulder = [-slideBlend * 9, -48 + crouch + bounce];
    line(ctx, [hip, shoulder], "#efbc4b", 20);
    line(ctx, [
      [shoulder[0] + 3, shoulder[1] + 6],
      [hip[0] + 4, hip[1] - 3]
    ], "#f7cf66", 8);

    // Near leg: both feet extend forward in the sliding pose
    const nearFoot = -swing + slideBlend * 27;
    line(ctx, [hip, [7 - swing * 0.4, -14], [nearFoot, -2]], "#46718c", 8);
    line(ctx, [[nearFoot - 2, -2], [nearFoot + 9, -2]], "#faf6e8", 6);
    line(ctx, [[nearFoot + 3, 1], [nearFoot + 10, 1]], "#697d82", 2);

    // Near arm moves forward for balance downhill
    line(ctx, [
      [shoulder[0] + 4, shoulder[1] + 2],
      [9 + swing * 0.5 + slideBlend * 6, -37 + crouch],
      [14 + swing * 0.65 + slideBlend * 10, -41 + crouch]
    ], "#efaf80", 6);
    ellipse(ctx,
      14 + swing * 0.65 + slideBlend * 10,
      -41 + crouch, 3.5, 3.5, "#f5bb8e"
    );

    // Face, hair, cap, and tiny smile
    const hx = shoulder[0] + 1;
    const hy = shoulder[1] - 16;
    ellipse(ctx, hx, hy, 13, 15, "#f4b889");
    ellipse(ctx, hx + 12, hy + 2, 4, 3.5, "#f4b889");
    ellipse(ctx, hx - 9, hy + 3, 4, 5, "#eaa677");
    ellipse(ctx, hx - 4, hy - 9, 12, 7, "#5d493a");

    // Cap
    ctx.fillStyle = "#448d8b";
    ctx.beginPath();
    ctx.arc(hx, hy - 8, 14, Math.PI, Math.PI * 2);
    ctx.fill();
    line(ctx, [[hx - 9, hy - 8], [hx + 18, hy - 8]], "#33777b", 5);

    // Eye and smile
    ellipse(ctx, hx + 7, hy - 1, 1.7, 2, "#384444");
    line(ctx, [[hx + 6, hy + 7], [hx + 10, hy + 6]], "#b36b51", 1.3);

    ctx.restore();
  }

  // Export to global namespace
  window.Character = {
    drawChild
  };
})();
