// =====================================================
// Screens - Game Over, Winning and Ending.
// Uses the Renderer's helpers so the style matches the rest of the game.
// =====================================================

import { CONFIG } from "./config.js";
import { view } from "./view.js";

const COLORS = CONFIG.COLORS;
const H = CONFIG.CANVAS_HEIGHT;
const IS_TOUCH_DEVICE = window.matchMedia("(pointer: coarse)").matches;

// Game Over buttons, in the centered 480px area (add view.offsetX)
export const RETRY_BUTTON = Object.freeze({
  x: 148,
  y: 158,
  width: 86,
  height: 26,
});
export const MENU_BUTTON = Object.freeze({
  x: 246,
  y: 158,
  width: 86,
  height: 26,
});

// "Poof" sparkles when obstacles disappear at the win
export const POOF_DURATION = 0.4; // seconds
const POOF_RADIUS = 10;

// Hearts that float up when the groom meets the bride
const MEET_HEART_COUNT = 10;
const MEET_HEART_INTERVAL = 0.25; // seconds between hearts
const MEET_HEART_LIFE = 1.6; // seconds each heart floats
const MEET_HEART_RISE = 40; // pixels

// Falling petals on the Ending screen
const PETAL_COUNT = 40;
const PETAL_COLORS = [COLORS.PETAL, COLORS.PETAL_WHITE, COLORS.STAR];

// Deterministic pseudo-random number 0..1 for a given integer
function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export class Screens {
  constructor(renderer) {
    this.renderer = renderer;
    this.ctx = renderer.ctx;
  }

  // ---------- Shared helpers ----------

  dim(alpha) {
    this.ctx.fillStyle = `rgba(30, 7, 16, ${alpha})`;
    this.ctx.fillRect(0, 0, view.width, H);
  }

  // filled = gold button, otherwise dark button with a gold border
  drawButton(rect, label, filled, enabled) {
    const r = this.renderer;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = enabled ? 1 : 0.45;
    const fill = filled ? COLORS.GOLD : "rgba(61, 12, 25, 0.95)";
    const x = rect.x + view.offsetX;
    r.pixelBox(
      x,
      rect.y,
      rect.width,
      rect.height,
      fill,
      filled ? COLORS.GOLD_DARK : COLORS.GOLD,
    );
    r.setFont(11, true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = filled ? COLORS.CEILING : COLORS.TEXT;
    ctx.fillText(label, x + rect.width / 2, rect.y + rect.height / 2 + 1);
    ctx.restore();
  }

  // "GROOM <heart> BRIDE" centered at (cx, y)
  drawNames(cx, y, size) {
    const r = this.renderer;
    const ctx = this.ctx;
    r.setFont(size, true);
    const groomWidth = ctx.measureText(CONFIG.GROOM_NAME).width;
    const brideWidth = ctx.measureText(CONFIG.BRIDE_NAME).width;
    const gap = 10;
    const left = cx - (groomWidth + gap * 2 + 7 + brideWidth) / 2;
    r.text(CONFIG.GROOM_NAME, left, y, size, COLORS.TEXT, {
      bold: true,
      align: "left",
    });
    r.drawPixelHeart(left + groomWidth + gap, y - 3, COLORS.PETAL);
    r.text(
      CONFIG.BRIDE_NAME,
      left + groomWidth + gap * 2 + 7,
      y,
      size,
      COLORS.TEXT,
      {
        bold: true,
        align: "left",
      },
    );
  }

  // Blinking call to action, e.g. "TAP or SPACE to continue"
  drawPrompt(text, y, time) {
    if (Math.sin(time * 5) > -0.3)
      this.renderer.text(text, view.width / 2, y, 8, COLORS.GOLD, {
        bold: true,
      });
  }

  // ---------- Game Over ----------

  drawGameOver(time, score, heartsCollected, canRetry) {
    const r = this.renderer;
    this.dim(0.55);

    const ox = view.offsetX; // the panel stays in the middle on wide screens
    r.pixelBox(ox + 120, 58, 240, 150, "rgba(61, 12, 25, 0.94)", COLORS.GOLD);
    r.rect(ox + 125, 63, 230, 1, COLORS.GOLD_DARK);
    r.rect(ox + 125, 202, 230, 1, COLORS.GOLD_DARK);

    r.text("GAME OVER", view.width / 2, 82, 20, COLORS.TEXT, { bold: true });
    r.text("Don't give up on love!", view.width / 2, 102, 8, COLORS.GOLD_LIGHT);

    const days = Math.floor(score).toLocaleString("en-US");
    const target = CONFIG.TARGET_SCORE.toLocaleString("en-US");
    r.text(
      `Days together: ${days} / ${target}`,
      view.width / 2,
      122,
      8,
      COLORS.TEXT,
    );
    // Heart icon right before the text, so it stays close with any font
    const heartsText = `Hearts collected: ${heartsCollected}`;
    r.setFont(8);
    const heartsLeft = Math.round(
      view.width / 2 + 5 - this.ctx.measureText(heartsText).width / 2,
    );
    r.drawPixelHeart(heartsLeft - 10, 133, COLORS.PETAL);
    r.text(heartsText, view.width / 2 + 5, 136, 8, COLORS.TEXT);

    this.drawButton(RETRY_BUTTON, "RETRY", true, canRetry);
    this.drawButton(MENU_BUTTON, "MENU", false, canRetry);

    if (!IS_TOUCH_DEVICE) {
      r.text(
        "SPACE = Retry    ESC = Menu",
        view.width / 2,
        194,
        8,
        COLORS.GOLD_DARK,
      );
    }
  }

  // ---------- Winning ----------

  // Sparkle ring where an obstacle vanished. poofs = [{ x, y, age }]
  drawPoofs(poofs) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.GOLD_LIGHT;
    for (const poof of poofs) {
      const t = poof.age / POOF_DURATION;
      const radius = 2 + t * POOF_RADIUS;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x = Math.round(poof.x + Math.cos(angle) * radius);
        const y = Math.round(poof.y + Math.sin(angle) * radius);
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
    }
  }

  // Hearts floating up from between the couple. age = seconds since they met
  drawMeetHearts(cx, groundY, age) {
    const ctx = this.ctx;
    for (let i = 0; i < MEET_HEART_COUNT; i++) {
      const t = age - i * MEET_HEART_INTERVAL;
      if (t < 0 || t > MEET_HEART_LIFE) continue;
      const progress = t / MEET_HEART_LIFE;
      const x = cx + Math.sin(i * 1.7 + t * 3) * 8 - 3;
      const y = groundY - 32 - progress * MEET_HEART_RISE;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      this.renderer.drawPixelHeart(
        x,
        y,
        i % 2 === 0 ? COLORS.PETAL : COLORS.PETAL_WHITE,
      );
      ctx.restore();
    }
  }

  drawWinBanner(time, canContinue) {
    const r = this.renderer;
    const last = CONFIG.MILESTONES[CONFIG.MILESTONES.length - 1];
    const ctx = this.ctx;
    r.setFont(16, true);
    const width = Math.ceil(ctx.measureText(last.text).width) + 36;
    const x = Math.round((view.width - width) / 2);

    r.pixelBox(x, 52, width, 52, "rgba(61, 12, 25, 0.92)", COLORS.GOLD);
    r.drawPixelHeart(x + 8, 64, COLORS.PETAL);
    r.drawPixelHeart(x + width - 15, 64, COLORS.PETAL);
    r.text(last.text, view.width / 2, 68, 16, COLORS.TEXT, { bold: true });
    r.text(
      `${CONFIG.TARGET_SCORE.toLocaleString("en-US")} days of love`,
      view.width / 2,
      88,
      8,
      COLORS.GOLD_LIGHT,
    );

    if (canContinue) {
      this.drawPrompt(
        IS_TOUCH_DEVICE ? "TAP to continue" : "TAP or SPACE to continue",
        118,
        time,
      );
    }
  }

  // ---------- Ending ----------

  drawPetals(time) {
    const ctx = this.ctx;
    for (let i = 0; i < PETAL_COUNT; i++) {
      const speed = 14 + hash(i) * 18;
      const x = Math.round(
        hash(i + 100) * view.width + Math.sin(time * 1.5 + i) * 8,
      );
      const y = Math.round(((time * speed + hash(i + 200) * H) % (H + 10)) - 5);
      ctx.fillStyle = PETAL_COLORS[i % PETAL_COLORS.length];
      ctx.fillRect(x, y, 2, 1);
      ctx.fillRect(x + 1, y + 1, 2, 1);
    }
  }

  drawEnding(time, subtitle, canRestart) {
    const r = this.renderer;
    const ox = view.offsetX; // the panel stays in the middle on wide screens
    r.pixelBox(ox + 100, 16, 280, 116, "rgba(61, 12, 25, 0.92)", COLORS.GOLD);
    r.rect(ox + 105, 21, 270, 1, COLORS.GOLD_DARK);
    r.rect(ox + 105, 126, 270, 1, COLORS.GOLD_DARK);

    this.drawNames(view.width / 2, 40, 16);
    r.text(CONFIG.ENDING_TITLE, view.width / 2, 62, 10, COLORS.GOLD_LIGHT);
    r.text(CONFIG.WEDDING_DATE, view.width / 2, 80, 12, COLORS.GOLD, {
      bold: true,
    });
    r.text(subtitle, view.width / 2, 98, 8, COLORS.GOLD_LIGHT);
    r.text(CONFIG.ENDING_MESSAGE, view.width / 2, 114, 8, COLORS.TEXT);

    r.drawCredit(time);

    if (canRestart) {
      this.drawPrompt(
        IS_TOUCH_DEVICE ? "TAP to play again" : "TAP or SPACE to play again",
        256,
        time,
      );
    }
  }
}
