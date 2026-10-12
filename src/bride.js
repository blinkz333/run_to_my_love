// =====================================================
// Bride - Bee in a Thai traditional dress: silver sequined sabai,
// pale blue silk, hair in a bun and a gold necklace. Faces left toward the groom.
// Also draws the flower arch used on the Ending screen.
// =====================================================

import { CONFIG } from "./config.js";

const COLORS = CONFIG.COLORS;

const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 27;

const HOP_HEIGHT = 3; // little happy hop when she meets the groom
const HOP_SPEED = 10;

const PALETTE = {
  h: "#15110f", // hair (black, in a bun)
  k: "#e8b48e", // skin
  e: "#2a1a14", // eye
  i: "#ffffff", // sparkle in the eye
  b: "#f2a0b0", // blush
  m: "#d9607a", // lips
  S: "#ece5d3", // silver sequined sabai / skirt
  D: "#c9bfa8", // sabai shadow
  d: "#ffffff", // sequin sparkle
  u: "#b9c6d6", // pale blue silk
  U: "#94a3b8", // blue silk shadow
  g: "#e8c26a", // gold (necklace, bracelet, hem)
  j: "#2b4aa0", // sapphire pendant
};

// 16x27, faces left. Eyelashes use the hair color.
const BRIDE_MAP = [
  "..........hhh...",
  ".....hhhhhhhhhh.",
  "...hhhhhhhhhhhh.",
  "..hhhhhhhhhhhhh.",
  "..hhhhhkkhhhhh..",
  "..hhkkkkkkkhhh..",
  "..hkhhkkhhkhh...",
  "..hkeikkeikhh...",
  "..kbkkkkkbkhh...",
  "...kkmmkkkh.....",
  "....kkkkk.......",
  "......kk........",
  "....SgSSSgSS....",
  "...SSSgSgSSSu...",
  "...kSSSjSSSDuu..",
  "...kSSgjgSSDuu..",
  "...kSdSgSdSDUu..",
  "...gSSSSSSSDUu..",
  "....SSSSSSSDDU..",
  "....SSSdSSSSDU..",
  "....SSSSSSSSSD..",
  "...SSSSdSSSSSD..",
  "...SSSSSSSSSSDD.",
  "...SSSdSSSSdSSD.",
  "..SSSSSSSSSSSSDD",
  "..SSSSSSSSSSSSDD",
  "..gggggggggggggg",
];

function makeBrideSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_WIDTH;
  canvas.height = SPRITE_HEIGHT;
  const ctx = canvas.getContext("2d");
  BRIDE_MAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

const BRIDE_SPRITE = makeBrideSprite();

export class Bride {
  constructor() {
    this.width = SPRITE_WIDTH;
    this.height = SPRITE_HEIGHT;
    this.x = 0;
    this.y = CONFIG.GROUND_Y - SPRITE_HEIGHT;
    this.hopTime = -1; // < 0 = not hopping
  }

  // Starts a few happy hops
  hop() {
    this.hopTime = 0;
  }

  update(dt) {
    if (this.hopTime < 0) return;
    this.hopTime += dt;
    if (this.hopTime * HOP_SPEED > Math.PI * 3) this.hopTime = -1; // 3 hops
  }

  draw(ctx) {
    let offset = 0;
    if (this.hopTime >= 0)
      offset = Math.round(
        Math.abs(Math.sin(this.hopTime * HOP_SPEED)) * HOP_HEIGHT,
      );
    ctx.drawImage(
      BRIDE_SPRITE,
      Math.round(this.x),
      Math.round(this.y) - offset,
    );
  }
}

// Flower arch for the Ending screen. (cx, groundY) = bottom center.
const ROSE_COLORS = [COLORS.PETAL, COLORS.PETAL_WHITE, COLORS.STAR];
const LEAF_COLOR = "#4f8a4a";
const ARCH_HALF_WIDTH = 30;
const ARCH_PILLAR_HEIGHT = 40;

export function drawFlowerArch(ctx, cx, groundY) {
  const pillarTop = groundY - ARCH_PILLAR_HEIGHT;
  const left = cx - ARCH_HALF_WIDTH;
  const right = cx + ARCH_HALF_WIDTH;

  // Gold pillars
  ctx.fillStyle = COLORS.GOLD_DARK;
  ctx.fillRect(left - 2, pillarTop, 4, ARCH_PILLAR_HEIGHT);
  ctx.fillRect(right - 2, pillarTop, 4, ARCH_PILLAR_HEIGHT);
  ctx.fillStyle = COLORS.GOLD;
  ctx.fillRect(left - 2, pillarTop, 1, ARCH_PILLAR_HEIGHT);
  ctx.fillRect(right - 2, pillarTop, 1, ARCH_PILLAR_HEIGHT);

  // Half-circle on top, drawn pixel by pixel
  const arcPoints = [];
  for (let a = 0; a <= 180; a += 3) {
    const rad = (a * Math.PI) / 180;
    arcPoints.push([
      Math.round(cx - Math.cos(rad) * ARCH_HALF_WIDTH),
      Math.round(pillarTop - Math.sin(rad) * ARCH_HALF_WIDTH),
    ]);
  }
  ctx.fillStyle = COLORS.GOLD;
  for (const [x, y] of arcPoints) ctx.fillRect(x - 1, y - 1, 3, 3);

  // Leaves and roses along the arch and down the pillars
  arcPoints.forEach(([x, y], i) => {
    if (i % 2 === 0) {
      ctx.fillStyle = LEAF_COLOR;
      ctx.fillRect(x - 2, y + 1, 2, 1);
    }
    if (i % 4 === 0)
      drawRose(ctx, x - 1, y - 2, ROSE_COLORS[(i / 4) % ROSE_COLORS.length]);
  });
  for (let y = pillarTop + 4; y < groundY - 10; y += 9) {
    drawRose(ctx, left - 3, y, ROSE_COLORS[y % 3]);
    drawRose(ctx, right - 1, y + 4, ROSE_COLORS[(y + 1) % 3]);
  }
}

function drawRose(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 3, 3);
  ctx.fillStyle = "rgba(61, 12, 25, 0.35)";
  ctx.fillRect(x + 1, y + 1, 1, 1);
}
