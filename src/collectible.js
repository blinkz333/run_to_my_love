// =====================================================
// Collectible hearts - each one gives HEART_SCORE points.
// LOW hearts float just above the carpet (run or slide through them).
// HIGH hearts float in the air (jump to catch them).
// =====================================================

import { CONFIG } from "./config.js";
import { view } from "./view.js";
import { intersects } from "./obstacle.js";

const GROUND_Y = CONFIG.GROUND_Y;
const SPAWN_MARGIN = 8; // new things appear just off the right edge of the view

// Distance between hearts = speed x interval x random(MIN..MAX)
const SPAWN_GAP_MIN = 1.2;
const SPAWN_GAP_MAX = 1.8;
const FIRST_SPAWN_DELAY = 2; // seconds before the first heart
const HIGH_CHANCE = 0.45; // chance that a heart floats high (needs a jump)

// Keep hearts away from obstacles so they never sit inside one
const OBSTACLE_SAFE_DISTANCE = 36;
const RETRY_DISTANCE = 20; // if blocked, try again a little later

// Heart top positions
const LOW_Y = GROUND_Y - 16;
const HIGH_Y = 150;

const BOB_SPEED = 5; // gentle up/down floating
const BOB_HEIGHT = 1.5;
const SPARKLE_SPEED = 8;
const SPARKLE_COLOR = "#fff1b8";

// Collectible heart (9x8): o = outline, x = fill, h = shine
const HEART_MAP = [
  ".oo...oo.",
  "oxxo.oxxo",
  "oxhxoxxxo",
  "oxxxxxxxo",
  ".oxxxxxo.",
  "..oxxxo..",
  "...oxo...",
  "....o....",
];
const HEART_COLORS = { o: "#8c1d3a", x: "#f28bb0", h: "#fff8ef" };

function makeHeartSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = HEART_MAP[0].length;
  canvas.height = HEART_MAP.length;
  const ctx = canvas.getContext("2d");
  HEART_MAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = HEART_COLORS[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

const HEART_SPRITE = makeHeartSprite();

class Heart {
  constructor(high) {
    this.x = view.width + SPAWN_MARGIN;
    this.baseY = high ? HIGH_Y : LOW_Y;
    this.y = this.baseY;
    this.width = HEART_SPRITE.width;
    this.height = HEART_SPRITE.height;
    this.age = Math.random() * 10; // so hearts do not bob in sync
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.age += dt;
    this.y = this.baseY + Math.sin(this.age * BOB_SPEED) * BOB_HEIGHT;
  }

  // A little bigger than the picture so hearts are easy to grab
  getHitbox() {
    return {
      x: this.x - 2,
      y: this.baseY - 3,
      width: this.width + 4,
      height: this.height + 6,
    };
  }

  draw(ctx) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    ctx.drawImage(HEART_SPRITE, x, y);

    // Two tiny sparkles that twinkle in turn
    ctx.fillStyle = SPARKLE_COLOR;
    if (Math.sin(this.age * SPARKLE_SPEED) > 0) {
      ctx.fillRect(x - 2, y - 1, 1, 1);
      ctx.fillRect(x + this.width + 1, y + this.height - 2, 1, 1);
    } else {
      ctx.fillRect(x + this.width, y - 2, 1, 1);
      ctx.fillRect(x - 2, y + this.height - 1, 1, 1);
    }
  }
}

export class HeartManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.hearts = [];
    this.distanceToNext = CONFIG.OBSTACLE_SPEED * FIRST_SPAWN_DELAY;
  }

  // obstacleManager is used to keep hearts a safe distance from obstacles
  update(dt, speed, obstacleManager) {
    this.distanceToNext -= speed * dt;
    if (this.distanceToNext <= 0) {
      if (this.isBlocked(obstacleManager)) {
        this.distanceToNext += RETRY_DISTANCE;
      } else {
        this.hearts.push(new Heart(Math.random() < HIGH_CHANCE));
        const gap =
          SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
        this.distanceToNext += speed * CONFIG.OBSTACLE_SPAWN_INTERVAL * gap;
      }
    }

    for (const heart of this.hearts) heart.update(dt, speed);
    this.hearts = this.hearts.filter((heart) => heart.x + heart.width > 0);
  }

  // True if an obstacle is near the spawn point, or is about to appear there
  isBlocked(obstacleManager) {
    if (obstacleManager.distanceToNext < OBSTACLE_SAFE_DISTANCE) return true;
    return obstacleManager.obstacles.some((obstacle) => {
      const center = obstacle.x + obstacle.width / 2;
      return (
        Math.abs(center - (view.width + SPAWN_MARGIN)) < OBSTACLE_SAFE_DISTANCE
      );
    });
  }

  // Removes and returns every heart touching the box
  collect(box) {
    const collected = this.hearts.filter((heart) =>
      intersects(box, heart.getHitbox()),
    );
    if (collected.length > 0) {
      this.hearts = this.hearts.filter((heart) => !collected.includes(heart));
    }
    return collected;
  }

  draw(ctx) {
    for (const heart of this.hearts) heart.draw(ctx);
  }
}
