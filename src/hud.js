// =====================================================
// HUD - lives, score, progress bar, milestone banners
// and "+120" popups.
// Uses the Renderer's helpers so the style matches the rest of the game.
// =====================================================

import { CONFIG } from "./config.js";
import { view } from "./view.js";

const COLORS = CONFIG.COLORS;
const H = CONFIG.CANVAS_HEIGHT;

// Life heart with outline (9x8): o = outline, x = fill, h = shine
const LIFE_HEART = [
  ".oo...oo.",
  "oxxo.oxxo",
  "oxhxoxxxo",
  "oxxxxxxxo",
  ".oxxxxxo.",
  "..oxxxo..",
  "...oxo...",
  "....o....",
];

const HEART_SCALE = 2;
const HEART_SPACING = 20;
const HEART_TOP = 6;
const FULL_COLORS = {
  o: COLORS.TEXT_SHADOW,
  x: COLORS.PETAL_WHITE,
  h: COLORS.STAR,
};
const EMPTY_COLORS = {
  o: COLORS.TEXT_SHADOW,
  x: "rgba(61, 12, 25, 0.75)",
  h: "rgba(61, 12, 25, 0.75)",
};

// Progress bar (top center, under the desktop key hint)
const BAR_WIDTH = 180;
const BAR_HEIGHT = 6;
const BAR_Y = 15;

// "+120" popups and milestone banners
export const POPUP_DURATION = 0.7; // seconds
const POPUP_RISE = 16; // pixels
const MILESTONE_DURATION = 2.2; // seconds
const MILESTONE_FADE = 0.3; // seconds to fade in / out

export class Hud {
  constructor(renderer) {
    this.renderer = renderer;
    this.ctx = renderer.ctx;
  }

  // ---------- Lives ----------

  // lostBlink = true while the heart that was just lost should flash
  drawLives(lives, lostBlink) {
    const total = CONFIG.STARTING_LIVES;
    const width =
      (total - 1) * HEART_SPACING + LIFE_HEART[0].length * HEART_SCALE;
    const left = view.width - width - 8;

    for (let i = 0; i < total; i++) {
      const x = left + i * HEART_SPACING;
      const isFull = i < lives;
      const isJustLost = i === lives && lostBlink;
      this.drawHeart(
        x,
        HEART_TOP,
        isFull || isJustLost ? FULL_COLORS : EMPTY_COLORS,
      );
    }
  }

  drawHeart(x, y, colors) {
    const ctx = this.ctx;
    LIFE_HEART.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const color = colors[row[dx]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(
          x + dx * HEART_SCALE,
          y + dy * HEART_SCALE,
          HEART_SCALE,
          HEART_SCALE,
        );
      }
    });
  }

  // ---------- Score & progress ----------

  drawProgress(score) {
    const r = this.renderer;
    const progress = Math.min(1, score / CONFIG.TARGET_SCORE);
    const fillWidth = Math.round((BAR_WIDTH - 2) * progress);
    const barX = Math.round((view.width - BAR_WIDTH) / 2);

    // Dark panel behind the bar and the score so both are easy to read
    r.pixelBox(
      barX - 8,
      BAR_Y - 5,
      BAR_WIDTH + 26,
      BAR_HEIGHT + 21,
      "rgba(30, 7, 16, 0.65)",
      "rgba(30, 7, 16, 0.65)",
    );

    // Frame and empty track
    r.rect(
      barX - 1,
      BAR_Y - 1,
      BAR_WIDTH + 2,
      BAR_HEIGHT + 2,
      COLORS.TEXT_SHADOW,
    );
    r.rect(barX, BAR_Y, BAR_WIDTH, BAR_HEIGHT, COLORS.GOLD_DARK);
    r.rect(
      barX + 1,
      BAR_Y + 1,
      BAR_WIDTH - 2,
      BAR_HEIGHT - 2,
      "rgba(61, 12, 25, 0.9)",
    );

    // Filled part (pink with a light top line)
    if (fillWidth > 0) {
      r.rect(barX + 1, BAR_Y + 1, fillWidth, BAR_HEIGHT - 2, COLORS.PETAL);
      r.rect(barX + 1, BAR_Y + 1, fillWidth, 1, COLORS.STAR);
    }

    // Milestone ticks (the last milestone is the end of the bar)
    for (const milestone of CONFIG.MILESTONES) {
      if (milestone.score >= CONFIG.TARGET_SCORE) continue;
      const x =
        barX + Math.round((BAR_WIDTH * milestone.score) / CONFIG.TARGET_SCORE);
      const passed = score >= milestone.score;
      r.rect(
        x,
        BAR_Y - 2,
        1,
        BAR_HEIGHT + 4,
        passed ? COLORS.GOLD_LIGHT : COLORS.GOLD,
      );
    }

    // Heart waiting at the finish
    r.drawPixelHeart(barX + BAR_WIDTH + 4, BAR_Y, COLORS.PETAL_WHITE);

    // Score as days: "1,234 / 4,380 DAYS"
    const shown = Math.floor(
      Math.min(score, CONFIG.TARGET_SCORE),
    ).toLocaleString("en-US");
    const target = CONFIG.TARGET_SCORE.toLocaleString("en-US");
    r.text(
      `${shown} / ${target} DAYS`,
      view.width / 2,
      BAR_Y + BAR_HEIGHT + 8,
      8,
      COLORS.TEXT,
      { bold: true },
    );
  }

  // popups = [{ x, y, age, text }]
  drawPopups(popups) {
    const ctx = this.ctx;
    for (const popup of popups) {
      const t = popup.age / POPUP_DURATION;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      this.renderer.text(
        popup.text,
        popup.x,
        popup.y - t * POPUP_RISE,
        8,
        COLORS.GOLD_LIGHT,
        { bold: true },
      );
      ctx.restore();
    }
  }

  // Banner in the middle of the screen, e.g. "3 Years Together!"
  drawMilestone(text, age) {
    if (age >= MILESTONE_DURATION) return;
    const ctx = this.ctx;
    const fadeIn = Math.min(1, age / MILESTONE_FADE);
    const fadeOut = Math.min(1, (MILESTONE_DURATION - age) / MILESTONE_FADE);

    ctx.save();
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    this.renderer.setFont(14, true);
    const width = Math.ceil(ctx.measureText(text).width) + 28;
    const x = Math.round((view.width - width) / 2);
    const y = 52 + Math.round((1 - fadeIn) * -6); // slides down a little as it appears
    this.renderer.pixelBox(
      x,
      y,
      width,
      26,
      "rgba(61, 12, 25, 0.9)",
      COLORS.GOLD,
    );
    this.renderer.drawPixelHeart(x + 6, y + 10, COLORS.PETAL);
    this.renderer.drawPixelHeart(x + width - 13, y + 10, COLORS.PETAL);
    this.renderer.text(text, view.width / 2, y + 14, 14, COLORS.TEXT, {
      bold: true,
    });
    ctx.restore();
  }

  // ---------- Hit feedback ----------

  // Short red flash over the whole screen when the groom is hit
  drawHurtFlash(strength) {
    if (strength <= 0) return;
    this.ctx.fillStyle = `rgba(217, 70, 106, ${0.3 * strength})`;
    this.ctx.fillRect(0, 0, view.width, H);
  }
}
