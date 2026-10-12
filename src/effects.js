// =====================================================
// Effects - small pixel particles that make actions feel good.
//   dust    = cream puffs at the groom's feet (run, jump, land, slide)
//   spark   = tiny gold / pink dots that fly and fall (double jump, hearts)
//   star    = yellow stars that burst out when the groom is hit
// Particles live in world space: "anchored" ones (dust on the carpet,
// sparkles where a heart was) scroll away with the floor.
// =====================================================

import { CONFIG } from "./config.js";

const COLORS = CONFIG.COLORS;
const GROUND_Y = CONFIG.GROUND_Y;

const MAX_PARTICLES = 240; // oldest ones are dropped past this
const RUN_DUST_INTERVAL = 0.14; // seconds between running puffs
const SLIDE_DUST_INTERVAL = 0.05; // seconds between sliding puffs

const DUST_COLORS = ["#fbf7f2", "#e8d6bb", "#d8c09a"];
const HEART_SPARK_COLORS = [
  COLORS.PETAL,
  COLORS.PETAL_WHITE,
  COLORS.GOLD_LIGHT,
  COLORS.STAR,
];
const JUMP_SPARK_COLORS = [COLORS.GOLD, COLORS.GOLD_LIGHT, COLORS.STAR];
const STAR_COLORS = ["#ffe066", COLORS.GOLD_LIGHT];

// 5x5 star for hits, and a 3x3 twinkle for sparkles
const STAR_SHAPE = ["..x..", ".xxx.", "xxxxx", ".xxx.", "..x.."];
const TWINKLE_SHAPE = [".x.", "xxx", ".x."];

function random(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export class Effects {
  constructor() {
    this.reset();
  }

  reset() {
    this.particles = [];
    this.runDustTimer = 0;
  }

  add(particle) {
    this.particles.push({ age: 0, gravity: 0, anchored: true, ...particle });
    if (this.particles.length > MAX_PARTICLES) this.particles.shift();
  }

  // ---------- Emitters (x, y = world position) ----------

  // A few puffs kicked back from the feet while running / sliding
  // (called every frame, it times itself)
  trail(dt, footX, sliding) {
    this.runDustTimer -= dt;
    if (this.runDustTimer > 0) return;
    this.runDustTimer = sliding ? SLIDE_DUST_INTERVAL : RUN_DUST_INTERVAL;
    this.add({
      type: "dust",
      x: footX + random(-2, 1),
      y: GROUND_Y - random(1, 3),
      vx: random(-25, -5),
      vy: random(-14, -4),
      life: random(0.3, 0.45),
      size: sliding ? 3 : 2,
      color: pick(DUST_COLORS),
    });
  }

  // Puffs to both sides when leaving or touching the floor
  footPuff(centerX, count, strength) {
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.add({
        type: "dust",
        x: centerX + side * random(2, 6),
        y: GROUND_Y - random(1, 3),
        vx: side * random(15, 45) * strength,
        vy: random(-22, -6) * strength,
        gravity: 40,
        life: random(0.35, 0.5),
        size: 3,
        color: pick(DUST_COLORS),
      });
    }
  }

  // Gold ring of sparks under the feet for the double jump (moves with the groom)
  doubleJump(centerX, feetY) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * (i / (count - 1)); // half circle, opening downwards
      this.add({
        type: "spark",
        x: centerX,
        y: feetY,
        vx: Math.cos(angle) * 90,
        vy: Math.sin(angle) * 55,
        gravity: 60,
        life: random(0.35, 0.45),
        size: 2,
        color: pick(JUMP_SPARK_COLORS),
        anchored: false,
      });
    }
  }

  // Pink and gold burst where a heart was picked up
  heartBurst(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = random(0, Math.PI * 2);
      const speed = random(40, 95);
      this.add({
        type: "spark",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        gravity: 120,
        life: random(0.4, 0.65),
        size: 2,
        color: pick(HEART_SPARK_COLORS),
      });
    }
    for (let i = 0; i < 4; i++) {
      this.add({
        type: "twinkle",
        x: x + random(-10, 10),
        y: y + random(-10, 6),
        vx: 0,
        vy: -10,
        life: random(0.3, 0.5),
        delay: i * 0.08,
        color: COLORS.STAR,
      });
    }
  }

  // Stars bursting out of the groom when he gets hit (they stay with him)
  hitStars(centerX, centerY) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle =
        -Math.PI / 2 + ((i - (count - 1) / 2) / count) * Math.PI * 1.6;
      const speed = random(70, 100);
      this.add({
        type: "star",
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 260,
        life: 0.6,
        color: pick(STAR_COLORS),
        anchored: false,
      });
    }
    // White "impact" puff in the middle
    for (let i = 0; i < 6; i++) {
      const angle = random(0, Math.PI * 2);
      this.add({
        type: "dust",
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * 40,
        vy: Math.sin(angle) * 40,
        life: 0.2,
        size: 3,
        color: COLORS.STAR,
        anchored: false,
      });
    }
  }

  // ---------- Update & draw ----------

  // scrollStep = how far the floor moved this frame (anchored particles follow it)
  update(dt, scrollStep) {
    for (const p of this.particles) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt - (p.anchored ? scrollStep : 0);
      p.y += p.vy * dt;
      // Dust and sparks settle on the carpet instead of sinking through it
      if (p.y > GROUND_Y - 1 && p.type !== "star") {
        p.y = GROUND_Y - 1;
        p.vy = 0;
        p.vx *= 0.8;
      }
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  draw(ctx) {
    for (const p of this.particles) {
      if (p.delay > 0) continue;
      const t = p.age / p.life; // 0 -> 1
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      ctx.fillStyle = p.color;

      if (p.type === "dust") {
        // Shrinks and fades
        ctx.globalAlpha = 0.85 * (1 - t);
        const size = Math.max(1, Math.round(p.size * (1 - t * 0.7)));
        ctx.fillRect(x, y, size, size);
      } else if (p.type === "spark") {
        // Solid, shrinks to 1px, then blinks out at the end
        ctx.globalAlpha = t > 0.7 && Math.floor(p.age * 30) % 2 === 0 ? 0 : 1;
        const size = t > 0.5 ? 1 : (p.size ?? 1);
        ctx.fillRect(x, y, size, size);
      } else if (p.type === "twinkle") {
        // Grows, then shrinks back to a dot
        ctx.globalAlpha = 1;
        if (t < 0.25 || t > 0.75) ctx.fillRect(x, y, 1, 1);
        else drawShape(ctx, TWINKLE_SHAPE, x - 1, y - 1);
      } else if (p.type === "star") {
        // Big star that blinks while it falls away
        ctx.globalAlpha = t > 0.6 && Math.floor(p.age * 20) % 2 === 0 ? 0.3 : 1;
        drawShape(ctx, t < 0.5 ? STAR_SHAPE : TWINKLE_SHAPE, x - 2, y - 2);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// Draws a small pixel map where 'x' = filled pixel, in the current fillStyle
function drawShape(ctx, shape, x, y) {
  shape.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === "x") ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  });
}
