// =====================================================
// Renderer - draws everything on the canvas.
// Wedding hall background with parallax, menu screen and help text.
// =====================================================

import { CONFIG } from "./config.js";
import { view } from "./view.js";

const COLORS = CONFIG.COLORS;
const H = CONFIG.CANVAS_HEIGHT;
const GROUND_Y = CONFIG.GROUND_Y;

// Parallax speeds (1 = moves with the floor)
const WALL_PARALLAX = 0.3;
const CHANDELIER_PARALLAX = 0.55;

// Wall layout
const CEILING_HEIGHT = 14;
const WAINSCOT_TOP = 182;
const WALL_TILE = 160; // one window + one lamp repeats every 160px
const PANEL_WIDTH = 40;

// Chandeliers repeat every 240px
const CHANDELIER_TILE = 240;

// Floor layout
const CARPET_HEIGHT = 24;
const FLOOR_TILE = 16;
const PETAL_SPACING = 14;

// Chinese banquet tables with guests, between the wall and the aisle carpet
const BANQUET_PARALLAX = 0.6;
const BANQUET_TILE = 200; // one table every 200px
const TABLE_WIDTH = 64;
const TABLE_TOP = 207; // top of the tablecloth
const TABLE_BOTTOM = GROUND_Y - 4; // tables stand behind the aisle, on the wall's floor line
const GUEST_SPACING = 12;
const BANQUET_SHADE = 0.28; // mix this much dark into every table color, so it reads as scenery
const GUEST_FRAME_TIME = 0.35; // seconds per eating / toasting frame

// Seated guest seen from the front, behind the table (7x10).
// h = hair, s = skin, e = eyes, c = clothes
const GUEST_SHORT_HAIR = [
  ".hhhhh.",
  "hhhhhhh",
  "hsssssh",
  ".seses.",
  ".sssss.",
  "..sss..",
  ".ccccc.",
  "ccccccc",
  "ccccccc",
  "ccccccc",
];
const GUEST_LONG_HAIR = [
  ".hhhhh.",
  "hhhhhhh",
  "hsssssh",
  "hsesesh",
  "hssssh.",
  "hhsssh.",
  "hccccch",
  "ccccccc",
  "ccccccc",
  "ccccccc",
];
// Each seat: hair style, hair, skin, clothes, and what the guest is doing
const GUESTS = [
  {
    map: GUEST_SHORT_HAIR,
    h: "#22202e",
    s: "#f2c39b",
    c: "#3b4a66",
    act: "eat",
  },
  {
    map: GUEST_LONG_HAIR,
    h: "#4a2c22",
    s: "#efc6a4",
    c: "#d9607a",
    act: "toast",
  },
  {
    map: GUEST_SHORT_HAIR,
    h: "#9a9aa6",
    s: "#e8b48e",
    c: "#5b4b9a",
    act: "nod",
  },
  {
    map: GUEST_LONG_HAIR,
    h: "#16131c",
    s: "#c68a5e",
    c: "#e8c26a",
    act: "eat",
  },
  {
    map: GUEST_SHORT_HAIR,
    h: "#3a3330",
    s: "#f2c39b",
    c: "#2e2b36",
    act: "toast",
  },
];

// On-screen JUMP / SLIDE buttons are only drawn on touch devices
const IS_TOUCH_DEVICE = window.matchMedia("(pointer: coarse)").matches;
const TOUCH_BUTTON_WIDTH = 72;
const TOUCH_BUTTON_HEIGHT = 30;
const TOUCH_BUTTON_MARGIN = 8;
const JUMP_ON_LEFT = CONFIG.TOUCH_JUMP_SIDE !== "right";

// Start button on the menu screen, in the centered 480px area (add view.offsetX)
export const START_BUTTON = Object.freeze({
  x: 180,
  y: 136,
  width: 120,
  height: 30,
});

// Sound on/off button (top-left corner, every screen)
export const SOUND_BUTTON = Object.freeze({
  x: 4,
  y: 4,
  width: 22,
  height: 18,
});

// Speaker icons for the sound button (10x8)
const SOUND_ON_SHAPE = [
  "...x......",
  "..xx...x..",
  "xxxx.x..x.",
  "xxxx..x.x.",
  "xxxx..x.x.",
  "xxxx.x..x.",
  "..xx...x..",
  "...x......",
];
const SOUND_OFF_SHAPE = [
  "...x......",
  "..xx......",
  "xxxx.x...x",
  "xxxx..x.x.",
  "xxxx...x..",
  "xxxx..x.x.",
  "..xx.x...x",
  "...x......",
];

// Arrow icons for the touch buttons (7x6)
const ARROW_UP_SHAPE = [
  "...x...",
  "..xxx..",
  ".xxxxx.",
  "xxxxxxx",
  "..xxx..",
  "..xxx..",
];
const ARROW_DOWN_SHAPE = [...ARROW_UP_SHAPE].reverse();

// Small pixel heart (7x6)
const HEART_SHAPE = [
  ".xx.xx.",
  "xxxxxxx",
  "xxxxxxx",
  ".xxxxx.",
  "..xxx..",
  "...x...",
];

// Wraps a value into the range [0, length)
function wrap(value, length) {
  return ((value % length) + length) % length;
}

// Full years and total days from RELATIONSHIP_START_DATE to WEDDING_DAY,
// so every guest sees the same numbers on any day they play
function getTimeTogether() {
  const [startYear, startMonth, startDay] =
    CONFIG.RELATIONSHIP_START_DATE.split("-").map(Number);
  const [year, month, day] = CONFIG.WEDDING_DAY.split("-").map(Number);

  // Compare calendar dates in UTC so daylight saving time never shifts the count
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round(
    (Date.UTC(year, month - 1, day) -
      Date.UTC(startYear, startMonth - 1, startDay)) /
      msPerDay,
  );

  let years = year - startYear;
  const beforeAnniversary =
    month < startMonth || (month === startMonth && day < startDay);
  if (beforeAnniversary) years -= 1;

  return { years: Math.max(0, years), days: Math.max(0, days) };
}

// Fills {years} and {days} in the subtitle, e.g. "12 Years, 4,629 Days, One Love."
function getSubtitle() {
  const { years, days } = getTimeTogether();
  return CONFIG.GAME_SUBTITLE.replace(
    "{years}",
    years.toLocaleString("en-US"),
  ).replace("{days}", days.toLocaleString("en-US"));
}

// Darkens a '#rrggbb' color toward the deep wine shadow (for background scenery)
const shadeCache = new Map();
function shade(color) {
  if (!shadeCache.has(color)) {
    const dark = [30, 7, 16];
    const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    const mixed = rgb.map((v, i) =>
      Math.round(v + (dark[i] - v) * BANQUET_SHADE),
    );
    shadeCache.set(color, `rgb(${mixed.join(", ")})`);
  }
  return shadeCache.get(color);
}

// Deterministic pseudo-random number 0..1 for a given integer
function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.subtitle = getSubtitle();
    this.setScale(1);
  }

  // The canvas is drawn at a higher resolution (scale) for sharp results,
  // but all drawing code keeps using 480x270 logical coordinates.
  setScale(scale) {
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  clear() {
    this.ctx.clearRect(0, 0, view.width, H);
  }

  // Draws the full background. scrollX = distance the world has moved.
  drawBackground(scrollX) {
    const wallOffset = scrollX * WALL_PARALLAX;
    this.drawWall(wallOffset);
    this.drawWainscot(wallOffset);
    this.drawWallTiles(wallOffset);
    this.drawCeiling();
    this.drawChandeliers(scrollX * CHANDELIER_PARALLAX);
    this.drawBanquet(scrollX * BANQUET_PARALLAX);
    this.drawFloor(scrollX);
  }

  // ---------- Helpers ----------

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  }

  // Soft round pixel glow made of stacked transparent octagons
  glow(cx, cy, radius, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.06;
    for (let r = radius; r > 4; r -= 5) {
      const c = Math.floor(r * 0.4); // cut corners
      const x = Math.floor(cx - r);
      const y = Math.floor(cy - r);
      ctx.fillRect(x + c, y, r * 2 - c * 2, r * 2);
      ctx.fillRect(x, y + c, r * 2, r * 2 - c * 2);
    }
    ctx.restore();
  }

  // Calls draw(x) for every repeat of a tile that is visible on screen
  forEachTile(offset, tileWidth, draw) {
    const shift = wrap(offset, tileWidth);
    for (
      let x = -shift - tileWidth;
      x < view.width + tileWidth;
      x += tileWidth
    ) {
      draw(Math.floor(x));
    }
  }
  // ---------- Wall ----------

  drawWall(offset) {
    this.rect(0, 0, view.width, WAINSCOT_TOP, COLORS.WALL);

    // Small damask diamond pattern
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.WALL_PATTERN;
    const shift = Math.floor(wrap(offset, 16));
    for (let y = CEILING_HEIGHT + 8; y < WAINSCOT_TOP - 4; y += 16) {
      const rowShift = (y / 16) % 2 === 0 ? 0 : 8;
      for (let x = -shift - 16 + rowShift; x < view.width; x += 16) {
        ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x, y + 1, 3, 1);
        ctx.fillRect(x + 1, y + 2, 1, 1);
      }
    }
  }

  drawWainscot(offset) {
    // Lower wall with gold trim and raised panels
    this.rect(
      0,
      WAINSCOT_TOP,
      view.width,
      GROUND_Y - WAINSCOT_TOP,
      COLORS.WAINSCOT,
    );
    this.rect(0, WAINSCOT_TOP, view.width, 2, COLORS.GOLD);
    this.rect(0, WAINSCOT_TOP + 2, view.width, 1, COLORS.GOLD_DARK);
    this.rect(0, GROUND_Y - 4, view.width, 4, COLORS.GOLD_DARK);
    this.rect(0, GROUND_Y - 4, view.width, 1, COLORS.GOLD);

    this.forEachTile(offset, PANEL_WIDTH, (x) => {
      const top = WAINSCOT_TOP + 9;
      const height = GROUND_Y - 4 - 6 - top;
      this.rect(x + 5, top, PANEL_WIDTH - 10, height, COLORS.WAINSCOT_PANEL);
      this.rect(x + 5, top, PANEL_WIDTH - 10, 1, COLORS.GOLD_DARK);
    });
  }

  drawWallTiles(offset) {
    this.forEachTile(offset, WALL_TILE, (x) => {
      this.drawWindowWithDrapes(x + 20);
      this.drawSconce(x + 132);
    });
  }

  // Tall arched window (night sky) framed by white drapes
  drawWindowWithDrapes(x) {
    const top = 34;
    const width = 72;
    const bottom = WAINSCOT_TOP - 6;
    const ctx = this.ctx;

    // Gold frame
    this.rect(x - 2, top + 8, width + 4, bottom - top - 6, COLORS.GOLD_DARK);
    this.rect(x + 6, top - 2, width - 12, 12, COLORS.GOLD_DARK);
    this.rect(x + 16, top - 6, width - 32, 6, COLORS.GOLD_DARK);

    // Glass (stepped arch)
    this.rect(x, top + 10, width, bottom - top - 10, COLORS.WINDOW);
    this.rect(x + 8, top, width - 16, 12, COLORS.WINDOW);
    this.rect(x + 18, top - 4, width - 36, 6, COLORS.WINDOW);
    this.rect(x, top + 50, width, bottom - top - 50, COLORS.WINDOW_LIGHT);

    // Window bars
    this.rect(
      x + width / 2 - 1,
      top - 4,
      2,
      bottom - top + 4,
      COLORS.GOLD_DARK,
    );
    this.rect(x, top + 48, width, 2, COLORS.GOLD_DARK);

    // Stars
    ctx.fillStyle = COLORS.STAR;
    ctx.fillRect(x + 14, top + 18, 1, 1);
    ctx.fillRect(x + 26, top + 30, 1, 1);
    ctx.fillRect(x + 48, top + 14, 1, 1);
    ctx.fillRect(x + 58, top + 36, 1, 1);
    ctx.fillRect(x + 22, top + 6, 1, 1);

    // Drapes on both sides
    this.drawDrape(x - 12, top - 14, bottom, false);
    this.drawDrape(x + width - 8, top - 14, bottom, true);

    // Valance (top swag) with gold rod
    this.rect(x - 14, top - 15, width + 28, 7, COLORS.DRAPE);
    for (let i = 0; i < 4; i++) {
      const sx = x - 14 + i * 25;
      this.rect(sx + 2, top - 8, 21, 3, COLORS.DRAPE);
      this.rect(sx + 6, top - 5, 13, 2, COLORS.DRAPE);
      this.rect(sx + 6, top - 9, 13, 1, COLORS.DRAPE_SHADOW);
    }
    this.rect(x - 16, top - 18, width + 32, 3, COLORS.GOLD);
  }

  // One white drape gathered with a gold tie-back
  drawDrape(x, top, bottom, flip) {
    const tieY = top + 92;
    const width = 20;
    for (let y = top; y < bottom; y += 2) {
      // Narrow at the tie-back, wide at top and bottom
      let w = width;
      if (y > tieY - 30 && y < tieY + 20) {
        const t = Math.abs(y - tieY) / 30;
        w = Math.floor(10 + 10 * Math.min(1, t));
      }
      const dx = flip ? width - w : 0;
      this.rect(x + dx, y, w, 2, COLORS.DRAPE);
      // Folds
      this.rect(x + dx + Math.floor(w * 0.3), y, 2, 2, COLORS.DRAPE_SHADOW);
      this.rect(x + dx + Math.floor(w * 0.7), y, 2, 2, COLORS.DRAPE_SHADOW);
    }
    // Gold tie-back
    this.rect(x + (flip ? 8 : 2), tieY - 2, 10, 4, COLORS.GOLD);
    this.rect(x + (flip ? 10 : 4), tieY - 1, 6, 2, COLORS.GOLD_DARK);
  }

  // Gold wall lamp with a warm glow
  drawSconce(x) {
    const y = 96;
    this.glow(x, y - 6, 26, COLORS.GLOW);

    // Wall plate and arm
    this.rect(x - 2, y + 4, 4, 12, COLORS.GOLD_DARK);
    this.rect(x - 8, y + 6, 16, 2, COLORS.GOLD);
    // Two candle cups
    for (const cx of [x - 8, x + 6]) {
      this.rect(cx - 1, y + 2, 4, 4, COLORS.GOLD);
      this.rect(cx, y - 6, 2, 8, COLORS.DRAPE);
      this.rect(cx, y - 9, 2, 3, COLORS.FLAME);
      this.rect(cx, y - 10, 2, 1, COLORS.GOLD_LIGHT);
    }
    // Lamp shade in the middle
    this.rect(x - 4, y - 8, 8, 2, COLORS.GOLD);
    this.rect(x - 5, y - 6, 10, 6, COLORS.GLOW);
    this.rect(x - 5, y, 10, 1, COLORS.GOLD);
  }

  // ---------- Ceiling & chandeliers ----------

  drawCeiling() {
    this.rect(0, 0, view.width, CEILING_HEIGHT, COLORS.CEILING);
    this.rect(0, CEILING_HEIGHT, view.width, 2, COLORS.GOLD);
    this.rect(0, CEILING_HEIGHT + 2, view.width, 1, COLORS.GOLD_DARK);
  }

  drawChandeliers(offset) {
    this.forEachTile(offset, CHANDELIER_TILE, (x) => {
      this.drawChandelier(x + 120);
    });
  }

  drawChandelier(cx) {
    const ctx = this.ctx;
    const top = CEILING_HEIGHT + 3;
    const bodyY = 40;

    this.glow(cx, bodyY + 4, 40, COLORS.GLOW);

    // Chain
    for (let y = top; y < bodyY - 6; y += 3) {
      this.rect(cx - 1, y, 2, 2, COLORS.GOLD_DARK);
    }
    // Top crown
    this.rect(cx - 4, bodyY - 8, 8, 3, COLORS.GOLD);

    // Arms (two tiers)
    this.rect(cx - 26, bodyY, 52, 2, COLORS.GOLD);
    this.rect(cx - 16, bodyY - 6, 32, 2, COLORS.GOLD);
    this.rect(cx - 2, bodyY - 6, 4, 16, COLORS.GOLD);
    this.rect(cx - 3, bodyY + 10, 6, 3, COLORS.GOLD_DARK);

    // Candles on the arms
    const candles = [
      [cx - 26, bodyY],
      [cx - 13, bodyY],
      [cx + 11, bodyY],
      [cx + 24, bodyY],
      [cx - 16, bodyY - 6],
      [cx + 14, bodyY - 6],
    ];
    for (const [x, y] of candles) {
      this.rect(x - 1, y - 2, 4, 2, COLORS.GOLD_DARK);
      this.rect(x, y - 7, 2, 5, COLORS.DRAPE);
      this.rect(x, y - 10, 2, 3, COLORS.FLAME);
    }

    // Hanging crystals
    ctx.fillStyle = COLORS.CRYSTAL;
    const drops = [-24, -18, -10, -4, 4, 10, 18, 24];
    drops.forEach((dx, i) => {
      const length = 4 + (i % 3) * 2;
      ctx.fillRect(cx + dx, bodyY + 2, 1, length);
      ctx.fillRect(cx + dx - 1, bodyY + 2 + length, 3, 2);
    });
    // Center crystal
    ctx.fillRect(cx - 1, bodyY + 13, 2, 4);
    ctx.fillRect(cx - 2, bodyY + 17, 4, 2);
  }

  // ---------- Banquet tables ----------

  drawBanquet(offset) {
    // Guests move on their own clock, so they keep eating on every screen
    const frame = Math.floor(performance.now() / 1000 / GUEST_FRAME_TIME);
    let tableIndex = Math.floor(offset / BANQUET_TILE);
    this.forEachTile(offset, BANQUET_TILE, (x) => {
      this.drawBanquetTable(x + 60, frame + tableIndex * 3);
      tableIndex += 1;
    });
  }

  // One round table (left edge at x) with five guests behind it
  drawBanquetTable(x, frame) {
    const ctx = this.ctx;
    const rect = (rx, ry, w, h, color) => this.rect(rx, ry, w, h, shade(color));
    const left =
      x +
      Math.floor((TABLE_WIDTH - GUEST_SPACING * (GUESTS.length - 1) - 7) / 2);

    // Guests (their lower half is hidden by the table)
    GUESTS.forEach((guest, i) => {
      const gx = left + i * GUEST_SPACING;
      const step = (frame + i * 2) % 4; // each guest is on a different beat
      const bob = guest.act === "nod" && step % 2 === 0 ? 1 : 0;
      const gy = TABLE_TOP - guest.map.length + 2 + bob;
      this.drawPixelMap(guest.map, gx, gy, {
        h: shade(guest.h),
        s: shade(guest.s),
        e: shade("#22202e"),
        c: shade(guest.c),
      });

      if (guest.act === "eat") {
        // Chopsticks go up to the mouth and back down to the bowl
        const up = step < 2;
        ctx.fillStyle = shade(guest.s);
        ctx.fillRect(gx + 6, gy + (up ? 5 : 8), 2, 2); // hand
        ctx.fillStyle = shade("#6b4a2e");
        ctx.fillRect(gx + (up ? 4 : 6), gy + (up ? 4 : 10), 3, 1); // chopsticks
      } else if (guest.act === "toast") {
        // Glass raised high now and then
        const up = step === 0;
        const hy = gy + (up ? 2 : 7);
        ctx.fillStyle = shade(guest.s);
        ctx.fillRect(gx - 1, hy + 2, 2, 2); // hand
        ctx.fillStyle = shade("#dff3ff");
        ctx.fillRect(gx - 1, hy - 1, 2, 3); // glass
        ctx.fillStyle = shade("#e8c26a");
        ctx.fillRect(gx - 1, hy, 2, 1); // drink
      }
    });

    // Round table with a red cloth, gold band and folds
    const skirtTop = TABLE_TOP + 4;
    rect(x + 2, TABLE_TOP - 1, TABLE_WIDTH - 4, 1, "#b02a40");
    rect(x, TABLE_TOP, TABLE_WIDTH, 4, "#b02a40");
    rect(x, skirtTop, TABLE_WIDTH, 1, COLORS.GOLD_DARK);
    rect(
      x + 1,
      skirtTop + 1,
      TABLE_WIDTH - 2,
      TABLE_BOTTOM - skirtTop - 1,
      "#9a2036",
    );
    ctx.fillStyle = shade("#7a1428");
    for (let fx = x + 5; fx < x + TABLE_WIDTH - 2; fx += 8) {
      ctx.fillRect(fx, skirtTop + 2, 1, TABLE_BOTTOM - skirtTop - 2);
    }

    // Lazy susan with dishes, a teapot and a little flower centerpiece
    const cx = x + TABLE_WIDTH / 2;
    rect(cx - 14, TABLE_TOP, 28, 2, "#d8c09a");
    const dishes = [
      [cx - 24, "#f2a64a"],
      [cx - 16, "#6fa35a"],
      [cx + 9, "#b5525e"],
      [cx + 17, "#f6ead0"],
    ];
    for (const [dx, food] of dishes) {
      rect(dx, TABLE_TOP, 6, 2, "#fbf7f2"); // plate
      rect(dx + 1, TABLE_TOP - 1, 4, 1, food); // food
    }
    rect(cx - 9, TABLE_TOP - 3, 4, 3, "#fbf7f2"); // teapot
    rect(cx - 10, TABLE_TOP - 2, 1, 1, "#fbf7f2");
    rect(cx - 8, TABLE_TOP - 4, 2, 1, "#e3d8d0");
    rect(cx + 2, TABLE_TOP - 2, 4, 2, COLORS.GOLD_DARK); // vase
    rect(cx + 1, TABLE_TOP - 5, 2, 2, COLORS.PETAL);
    rect(cx + 4, TABLE_TOP - 6, 2, 2, COLORS.PETAL_WHITE);
    rect(cx + 3, TABLE_TOP - 4, 1, 2, "#6fa35a");
  }

  // Draws a pixel map using a palette (unknown letters are skipped)
  drawPixelMap(map, x, y, palette) {
    const ctx = this.ctx;
    map.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const color = palette[row[dx]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(x) + dx, Math.floor(y) + dy, 1, 1);
      }
    });
  }
  // ---------- Floor ----------

  drawFloor(scrollX) {
    const ctx = this.ctx;
    const carpetBottom = GROUND_Y + CARPET_HEIGHT;

    // Marble floor (checkered)
    this.rect(0, GROUND_Y, view.width, H - GROUND_Y, COLORS.MARBLE);
    const shift = Math.floor(wrap(scrollX, FLOOR_TILE * 2));
    ctx.fillStyle = COLORS.MARBLE_DARK;
    for (let x = -shift; x < view.width; x += FLOOR_TILE * 2) {
      ctx.fillRect(x, carpetBottom + 2, FLOOR_TILE, 10);
      ctx.fillRect(x + FLOOR_TILE, carpetBottom + 12, FLOOR_TILE, 10);
    }

    // Aisle carpet with gold edges
    this.rect(0, GROUND_Y, view.width, CARPET_HEIGHT, COLORS.CARPET);
    this.rect(0, GROUND_Y, view.width, 2, COLORS.GOLD);
    this.rect(0, carpetBottom - 2, view.width, 2, COLORS.GOLD);
    this.rect(0, carpetBottom, view.width, 2, COLORS.GOLD_DARK);

    // Carpet pattern
    const patternShift = Math.floor(wrap(scrollX, 24));
    ctx.fillStyle = COLORS.CARPET_DARK;
    for (let x = -patternShift; x < view.width; x += 24) {
      ctx.fillRect(x, GROUND_Y + 5, 24, 1);
      ctx.fillRect(x, carpetBottom - 6, 24, 1);
      ctx.fillRect(x + 11, GROUND_Y + 9, 2, 1);
      ctx.fillRect(x + 10, GROUND_Y + 10, 4, 2);
      ctx.fillRect(x + 11, GROUND_Y + 12, 2, 1);
    }

    // Rose petals scattered on the carpet (move with the floor)
    const first = Math.floor(scrollX / PETAL_SPACING);
    const count = Math.ceil(view.width / PETAL_SPACING) + 2;
    for (let i = first; i < first + count; i++) {
      const r = hash(i);
      if (r < 0.55) continue;
      const x = Math.floor(i * PETAL_SPACING - scrollX + r * 6);
      const y = GROUND_Y + 4 + Math.floor(hash(i + 1000) * (CARPET_HEIGHT - 9));
      ctx.fillStyle = r > 0.8 ? COLORS.PETAL_WHITE : COLORS.PETAL;
      ctx.fillRect(x, y, 2, 1);
      ctx.fillRect(x + 1, y + 1, 2, 1);
    }
  }

  // ---------- Text & UI helpers ----------

  // Text with a 1px dark shadow so it is readable on any background
  text(value, x, y, size, color, { bold = false, align = "center" } = {}) {
    const ctx = this.ctx;
    this.setFont(size, bold);
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.TEXT_SHADOW;
    ctx.fillText(value, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }

  // Sets the pixel font, e.g. setFont(12, true) = bold 12px
  setFont(size, bold = false) {
    this.ctx.font = `${bold ? "bold " : ""}${size}px ${CONFIG.FONT_FAMILY}`;
  }

  drawPixelHeart(x, y, color) {
    this.drawShape(HEART_SHAPE, x, y, color);
  }

  // Draws a small pixel map where 'x' = filled pixel (scale = size of each pixel)
  drawShape(shape, x, y, color, scale = 1) {
    this.ctx.fillStyle = color;
    shape.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        if (row[dx] === "x") {
          this.ctx.fillRect(
            Math.floor(x) + dx * scale,
            Math.floor(y) + dy * scale,
            scale,
            scale,
          );
        }
      }
    });
  }

  // Box with cut (pixel-rounded) corners
  pixelBox(x, y, w, h, fill, border) {
    this.rect(x + 2, y, w - 4, h, border);
    this.rect(x, y + 2, w, h - 4, border);
    this.rect(x + 1, y + 1, w - 2, h - 2, border);
    this.rect(x + 2, y + 2, w - 4, h - 4, fill);
  }

  // ---------- Menu screen ----------

  drawMenu(time) {
    const ctx = this.ctx;
    const cx = view.width / 2;
    const ox = view.offsetX; // the panel stays in the middle on wide screens

    // Dim the hall a little so the menu stands out
    ctx.fillStyle = "rgba(30, 7, 16, 0.35)";
    ctx.fillRect(0, 0, view.width, H);

    // Panel
    this.pixelBox(ox + 96, 40, 288, 176, "rgba(61, 12, 25, 0.9)", COLORS.GOLD);
    this.rect(ox + 101, 45, 278, 1, COLORS.GOLD_DARK);
    this.rect(ox + 101, 210, 278, 1, COLORS.GOLD_DARK);

    // Title with floating hearts on both sides (placed from the title's real width)
    const float = Math.round(Math.sin(time * 3) * 1.5);
    this.text(CONFIG.GAME_TITLE, cx, 68, 24, COLORS.TEXT, { bold: true });
    const titleHalf = Math.ceil(ctx.measureText(CONFIG.GAME_TITLE).width / 2);
    this.drawPixelHeart(cx - titleHalf - 16, 64 + float, COLORS.PETAL);
    this.drawPixelHeart(cx + titleHalf + 9, 64 - float, COLORS.PETAL);

    // Subtitle (years and days from RELATIONSHIP_START_DATE to WEDDING_DAY)
    this.text(this.subtitle, cx, 90, 10, COLORS.GOLD_LIGHT);

    // Couple names: GROOM <heart> BRIDE
    this.setFont(12, true);
    const groomWidth = ctx.measureText(CONFIG.GROOM_NAME).width;
    const brideWidth = ctx.measureText(CONFIG.BRIDE_NAME).width;
    const gap = 10;
    const total = groomWidth + gap * 2 + 7 + brideWidth;
    const left = cx - total / 2;
    this.text(CONFIG.GROOM_NAME, left, 114, 12, COLORS.TEXT, {
      bold: true,
      align: "left",
    });
    this.drawPixelHeart(left + groomWidth + gap, 111, COLORS.PETAL);
    this.text(
      CONFIG.BRIDE_NAME,
      left + groomWidth + gap * 2 + 7,
      114,
      12,
      COLORS.TEXT,
      {
        bold: true,
        align: "left",
      },
    );

    // Start button (gently pulsing)
    const b = { ...START_BUTTON, x: START_BUTTON.x + ox };
    const pulse = Math.sin(time * 4) > 0 ? COLORS.GOLD_LIGHT : COLORS.GOLD;
    this.pixelBox(b.x, b.y, b.width, b.height, pulse, COLORS.GOLD_DARK);
    this.setFont(12, true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.CEILING;
    ctx.fillText("START GAME", b.x + b.width / 2, b.y + b.height / 2 + 1);

    // Controls
    this.text("HOW TO PLAY", cx, 176, 8, COLORS.GOLD, { bold: true });
    if (IS_TOUCH_DEVICE) {
      const jumpSide = JUMP_ON_LEFT ? "LEFT" : "RIGHT";
      const slideSide = JUMP_ON_LEFT ? "RIGHT" : "LEFT";
      this.text(`Tap ${jumpSide} side = JUMP`, cx, 187, 8, COLORS.GOLD_LIGHT);
      this.text(
        "Tap again in the air = DOUBLE JUMP",
        cx,
        196,
        8,
        COLORS.GOLD_LIGHT,
      );
      this.text(`Tap ${slideSide} side = SLIDE`, cx, 205, 8, COLORS.GOLD_LIGHT);
    } else {
      this.text("JUMP: SPACE / ARROW UP", cx, 187, 8, COLORS.GOLD_LIGHT);
      this.text(
        "DOUBLE JUMP: JUMP again in the air",
        cx,
        196,
        8,
        COLORS.GOLD_LIGHT,
      );
      this.text("SLIDE: ARROW DOWN", cx, 205, 8, COLORS.GOLD_LIGHT);
    }
  }

  // ---------- Sound button ----------

  drawSoundButton(muted) {
    const b = SOUND_BUTTON;
    this.pixelBox(
      b.x,
      b.y,
      b.width,
      b.height,
      "rgba(61, 12, 25, 0.6)",
      COLORS.GOLD,
    );
    const color = muted ? COLORS.GOLD_DARK : COLORS.TEXT;
    this.drawShape(
      muted ? SOUND_OFF_SHAPE : SOUND_ON_SHAPE,
      b.x + 6,
      b.y + 5,
      color,
    );
  }

  // ---------- Touch buttons (Cookie Run style) ----------

  // pressed = { jump: boolean, slide: boolean }
  drawTouchButtons(pressed) {
    if (!IS_TOUCH_DEVICE) return;
    const y = H - TOUCH_BUTTON_HEIGHT - TOUCH_BUTTON_MARGIN;
    const leftX = TOUCH_BUTTON_MARGIN;
    const rightX = view.width - TOUCH_BUTTON_WIDTH - TOUCH_BUTTON_MARGIN;
    const jumpX = JUMP_ON_LEFT ? leftX : rightX;
    const slideX = JUMP_ON_LEFT ? rightX : leftX;

    this.drawTouchButton(jumpX, y, "JUMP", ARROW_UP_SHAPE, pressed.jump);
    this.drawTouchButton(slideX, y, "SLIDE", ARROW_DOWN_SHAPE, pressed.slide);
  }

  drawTouchButton(x, y, label, icon, isPressed) {
    const ctx = this.ctx;
    const w = TOUCH_BUTTON_WIDTH;
    const h = TOUCH_BUTTON_HEIGHT;

    // Pressed buttons sink 2px and turn gold
    const offsetY = isPressed ? 2 : 0;
    const fill = isPressed
      ? "rgba(232, 194, 106, 0.85)"
      : "rgba(61, 12, 25, 0.6)";
    const border = isPressed ? COLORS.GOLD_LIGHT : COLORS.GOLD;
    const textColor = isPressed ? COLORS.CEILING : COLORS.TEXT;

    ctx.save();
    if (!isPressed)
      this.pixelBox(
        x,
        y + 2,
        w,
        h,
        "rgba(30, 7, 16, 0.5)",
        "rgba(30, 7, 16, 0.5)",
      );
    this.pixelBox(x, y + offsetY, w, h, fill, border);

    // Arrow icon drawn at 2x so it is easy to see on a phone
    const iconX = x + 8;
    const iconY = y + offsetY + Math.floor((h - 12) / 2);
    this.drawShape(icon, iconX, iconY, textColor, 2);

    this.setFont(11, true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = textColor;
    ctx.fillText(label, x + w / 2 + 8, y + offsetY + h / 2 + 1);
    ctx.restore();
  }

  // ---------- Help text while playing (real HUD comes in later phases) ----------

  drawHint(fps) {
    if (!IS_TOUCH_DEVICE) {
      this.text(
        "JUMP: SPACE / ARROW UP    SLIDE: ARROW DOWN",
        view.width / 2,
        7,
        8,
        COLORS.TEXT,
      );
    }

    if (CONFIG.SHOW_FPS) {
      this.text(`FPS: ${fps}`, 32, 8, 8, COLORS.TEXT, { align: "left" });
    }
  }
}
