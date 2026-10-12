// =====================================================
// Obstacles - things that get in the groom's way.
//   FRIEND_GROUND = crouching photographer       -> JUMP over
//   MAGNUM        = giant chocolate ice cream    -> JUMP over
//   FRIEND_HIGH   = friend floating with balloons -> SLIDE under
//   GTA_VI        = game case hanging on a ribbon -> SLIDE under
//   BLINK_DEVIL   = chubby flying devil, trident on its back -> DOUBLE JUMP over
// =====================================================

import { CONFIG } from "./config.js";
import { view } from "./view.js";

const GROUND_Y = CONFIG.GROUND_Y;

export const ObstacleType = Object.freeze({
  FRIEND_GROUND: "FRIEND_GROUND",
  MAGNUM: "MAGNUM",
  FRIEND_HIGH: "FRIEND_HIGH",
  GTA_VI: "GTA_VI",
  BLINK_DEVIL: "BLINK_DEVIL",
});

// High obstacles float this many pixels above the floor.
// Standing groom is 26px tall (hit), sliding groom is 19px tall (safe).
const HIGH_CLEARANCE = 22;

// The GTA VI ribbon hangs from just under the ceiling trim
const RIBBON_TOP = 17;

// Distance between obstacles = speed x interval x random(MIN..MAX)
const SPAWN_GAP_MIN = 0.85;
const SPAWN_GAP_MAX = 1.4;
const FIRST_SPAWN_DELAY = 1.2; // seconds of free running at the start
const SPAWN_MARGIN = 8; // new things appear just off the right edge of the view

const PALETTE = {
  k: "#22202e", // hair
  s: "#f2c39b", // skin
  e: "#22202e", // eye
  m: "#b5525e", // mouth
  w: "#fbf7f2", // white shirt
  v: "#5b4b9a", // high friend: purple suit
  V: "#463a7a", // high friend: suit shadow
  p: "#2b2840", // trousers
  o: "#151320", // shoes
  c: "#3a3a44", // camera body
  C: "#9fd3ff", // camera lens
  f: "#fff1b8", // camera flash
  z: "#3a3330", // high friend: hair at the back
  Z: "#8a7262", // high friend: thin wisps on top
  l: "#ffe2c8", // high friend: shine on the bald forehead
  G: "#5a5d70", // high friend: square glasses
  b: "#a8866e", // high friend: stubble
  q: "#e05a8a", // high friend: bow tie
  H: "#1d1b22", // ground friend: black hoodie
  J: "#2e2b36", // ground friend: hoodie shadow
  M: "#0e0d12", // ground friend: face mask
  j: "#3b4a66", // ground friend: jeans
  Q: "#2a3550", // ground friend: jeans shadow (round butt)
  R: "#52668e", // ground friend: jeans highlight on the butt
  n: "#c68a5e", // ground friend: tan skin
};

// ---------- Friend 1: crouching photographer (22x23, faces left) ----------
// Tan skin, thick black hair with a fringe, black hoodie with white drawstrings,
// black face mask hanging at the neck, camera up to his eye, and a big round butt.

const GROUND_FRIEND_MAP = [
  "......kkkkkkk.........",
  "....kkkkkkkkkkk.......",
  "...kkkkkkkkkkkkk......",
  "...kkkkkkkkkkkkk......",
  "..f.kkkkkkkkkkkk......",
  ".ccccccknnnnkkkk......",
  "cCCcccnnnnnnnkk.......",
  "cCCccccnnnnnnnk.......",
  "cccccccnnnnnnnn.......",
  ".cccc.nnnmnnnnn.......",
  "..nn...nnnnnnn........",
  "...nnHHHMMMMHHH.......",
  "...HHHHwHMMHwHHJ......",
  "....HHHwHHHHwHHJJ.....",
  "....HHHHHHHHHHHJJJ....",
  ".....HHHHHHHHHHJJJJ...",
  ".....HHHHHHHHHHHJJJJ..",
  "....jjjjjjjjjjjjjjjjQ.",
  "...jjjjjjjjjjjjjRRRjjQ",
  "...jjjj....jjjjjjjjjjQ",
  "...jjj......jjjjjjjjjQ",
  "..ooo.......ooooQQQQQ.",
  ".oooo.......ooooo.....",
];

// ---------- Friend 2: floating with heart balloons (20x27, faces left) ----------
// Same height as the groom. Receding hairline (shiny forehead, thin wisps,
// hair only at the back), square glasses, stubble, big build, big laugh, pink bow tie.

const HIGH_FRIEND_MAP = [
  "..s..............s..",
  "..v..............v..",
  "..v...slssZzzz...v..",
  "..v..sllssZsZzzz.v..",
  "..v.sssssssZszzz.v..",
  "..v.sssssssssszz.v..",
  "..v.GGGGsGGGGssz.v..",
  "..v.GesGsGesGsss.v..",
  "..v.GGGGsGGGGsss.v..",
  "..v.ssssssssssss.v..",
  "..v.bssmmmmssbbb.v..",
  "..v.bbsmwwmsbbbb.v..",
  "..v..bbbbbbbbbb..v..",
  "..vvvvvwqqqwvvvvVV..",
  "..vvvvvvwwwvvvvvVV..",
  "..vvvvvvvwvvvvvvVV..",
  ".vvvvvvvvvvvvvvvVVV.",
  ".vvvvvvvvvvvvvvvVVV.",
  "..vvvvvvvvvvvvvvVV..",
  "...pppppppppppppp...",
  "...pppppppppppppp...",
  "...ppppp....ppppp...",
  "....pppp....pppp....",
  "....ppp......ppp....",
  "...pppp......pppp...",
  "...oooo......oooo...",
  "..ooo..........ooo..",
];

// Heart balloon (9x8)
const BALLOON_MAP = [
  ".xx...xx.",
  "xxxx.xxxx",
  "xHxxxxxxx",
  "xxxxxxxxx",
  ".xxxxxxx.",
  "..xxxxx..",
  "...xxx...",
  "....x....",
];
const BALLOON_COLORS = ["#f28bb0", "#e8c26a", "#d9466a"];

// A tower of balloons from just under the ceiling trim down to the friend's
// hands, so even a double jump can't get over him (slide under instead)
const HIGH_SPRITE_WIDTH = 26;
const BALLOON_AREA_HEIGHT =
  GROUND_Y - HIGH_CLEARANCE - RIBBON_TOP - HIGH_FRIEND_MAP.length; // 160
const BALLOON_ROW_STEP = 7; // pixels between balloon rows (they overlap a little)
const BALLOON_STRING_LENGTH = 22; // free strings between the lowest balloons and the hands

// [x, y, colorIndex] of each balloon inside the sprite, top to bottom
const BALLOONS = [];
for (
  let row = 0;
  row * BALLOON_ROW_STEP <= BALLOON_AREA_HEIGHT - BALLOON_STRING_LENGTH;
  row++
) {
  const xs = row % 2 === 0 ? [0, 8, 17] : [4, 13];
  xs.forEach((x, i) =>
    BALLOONS.push([
      x,
      row * BALLOON_ROW_STEP,
      (row + i) % BALLOON_COLORS.length,
    ]),
  );
}
const HIGH_BODY_X = 3; // friend body offset inside the sprite
const HIGH_HANDS_X = [2, 17]; // hands inside the friend's map

// ---------- Magnum: giant chocolate ice cream with a bite (12x22) ----------

const MAGNUM_MAP = [
  ".cccccc.....",
  "cclcccc.....",
  "clccccvv....",
  "clcccccvvv..",
  "clccccccvvvc",
  "clcccDcccccc",
  "clccccccccDc",
  "clcccccccccc",
  "clccDccccccc",
  "clcccccccccc",
  "clccccccDccc",
  "clcccccccccc",
  "clcccDcccccc",
  "clcccccccccc",
  "cclccccccccD",
  ".DDDDDDDDDD.",
  "....sssS....",
  "....sssS....",
  "....sssS....",
  "....sssS....",
  "....sssS....",
  "...ssssSS...",
];
const MAGNUM_PALETTE = {
  c: "#7a4528", // chocolate
  l: "#a8693f", // chocolate shine
  D: "#4a2616", // dark chocolate crack / shadow
  v: "#f6ead0", // vanilla inside the bite
  s: "#d9b27c", // wooden stick
  S: "#b8925e", // stick shadow
};

// ---------- GTA VI: game case (18x24) hanging on a gold ribbon ----------

const CASE_WIDTH = 18;
const CASE_HEIGHT = 24;

// Big "VI" letters (white, 5 rows tall)
const VI_MAP = [
  "x...x.xxx",
  "x...x..x.",
  ".x.x...x.",
  ".x.x...x.",
  "..x...xxx",
];

// Sunset stripes for the cover art, top to bottom
const SUNSET = [
  "#3b1f6e",
  "#5b2a86",
  "#8a2f8f",
  "#c23a8a",
  "#e0457b",
  "#f2705e",
  "#f59e4c",
];

// Palm tree silhouette (7x8)
const PALM_MAP = [
  "xx...xx",
  ".xx.xx.",
  "x.xxx.x",
  "...x...",
  "...x...",
  "..x....",
  "..x....",
  "..x....",
];

// ---------- Blink devil: chubby flying devil with a trident on its back (26x80) ----------
// It hovers just above the carpet (too low to slide under) and the trident
// strapped to its back is taller than a single jump, so it needs a double jump.

const DEVIL_SPRITE_WIDTH = 26;
const DEVIL_SPRITE_HEIGHT = 80;
const DEVIL_FLY_HEIGHT = 12; // gap between the carpet and the devil
const DEVIL_TRIDENT_X = 11; // trident shaft sticks up from the devil's back
const DEVIL_GAP_AFTER = 1.4; // extra space after it, because a double jump lands far away
const DEVIL_FLAP_TIME = 0.12; // seconds per wing frame
const DEVIL_BOB_SPEED = 6;
const DEVIL_BOB_HEIGHT = 2; // pixels (looks only, the hitbox stays still)

// 14x19: bowl haircut with a heavy fringe, round chubby face, black tee
const DEVIL_MAP = [
  "..r........r..",
  "..rr......rr..",
  "..rRhhhhhhRr..",
  "..hhhhhhhhhh..",
  ".hhhhhhhhhhhh.",
  ".hhhhhhhhhhhh.",
  ".hhhhhhhhhhhh.",
  ".hhhhhhhhhhhh.",
  "hhsshhshhsshhh",
  "hbbbsssssbbbsh",
  ".sseesssseess.",
  ".ssssssssssss.",
  ".scssmmmmsscs.",
  "..ssssssssss..",
  "...SssssssS...",
  "skkkkkkkkkkkks",
  "skkwkwkwkwkkks",
  "..kkkkkkkkkkrr",
  "...KK..KK...rt",
];
const DEVIL_PALETTE = {
  h: "#16131c", // hair
  r: "#d93a4a", // horns and tail
  R: "#a8243a", // horn base
  s: "#efc6a4", // skin
  S: "#d6a885", // chin shadow
  b: "#5a3e34", // eyebrows
  e: "#22202e", // eyes
  c: "#f0a0a0", // cheeks
  m: "#b86a6e", // mouth
  k: "#1c1a22", // black tee
  w: "#d8d4dc", // tiny print on the tee
  K: "#2e2b36", // legs
  t: "#5e1226", // tail tip
};

// Bat wing on the back, 2 frames (x = edge, m = membrane)
const WING_UP_MAP = [
  "..........xx",
  "........xxmx",
  "......xxmmmx",
  ".....xmmmmx.",
  "....xmmmmmx.",
  "...xmmmmx.x.",
  "..xmmx.x....",
  ".xmx........",
  "xx..........",
];
const WING_DOWN_MAP = [
  "xx..........",
  ".xmx........",
  "..xmmmx.....",
  "...xmmmmmx..",
  "....xmmmmmmx",
  ".....xmmmxxx",
  "......x.x...",
];
const WING_PALETTE = { x: "#1e0a14", m: "#6b2a8a" };

// Small dark trident head (x = iron, l = highlight)
const TRIDENT_HEAD_MAP = ["x.x.x", "x.l.x", "xxlxx", "..l.."];
const TRIDENT_PALETTE = { x: "#3a3140", l: "#6a5f72" };
// ---------- Sprite building ----------

function newCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawMap(ctx, map, offsetX, offsetY, palette) {
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + x, offsetY + y, 1, 1);
    }
  });
}

function makeGroundFriendSprite() {
  const canvas = newCanvas(
    GROUND_FRIEND_MAP[0].length,
    GROUND_FRIEND_MAP.length,
  );
  drawMap(canvas.getContext("2d"), GROUND_FRIEND_MAP, 0, 0, PALETTE);
  return canvas;
}

function makeHighFriendSprite() {
  const height = BALLOON_AREA_HEIGHT + HIGH_FRIEND_MAP.length;
  const canvas = newCanvas(HIGH_SPRITE_WIDTH, height);
  const ctx = canvas.getContext("2d");

  // Strings from both hands up to the lowest row of balloons
  const hands = HIGH_HANDS_X.map((x) => HIGH_BODY_X + x);
  const lowestY = BALLOONS[BALLOONS.length - 1][1];
  const lowestRow = BALLOONS.filter(([, by]) => by === lowestY);
  ctx.fillStyle = "#fbf7f2";
  lowestRow.forEach(([bx, by], i) => {
    const hand = hands[i % 2];
    const topX = bx + 4;
    const topY = by + 8;
    const bottomY = BALLOON_AREA_HEIGHT;
    for (let y = topY; y < bottomY; y++) {
      const t = (y - topY) / (bottomY - topY);
      ctx.fillRect(Math.round(topX + (hand - topX) * t), y, 1, 1);
    }
  });

  // Balloons (lower rows drawn on top of higher ones)
  BALLOONS.forEach(([bx, by, color]) => {
    drawMap(ctx, BALLOON_MAP, bx, by, {
      x: BALLOON_COLORS[color],
      H: "#fff8ef",
    });
  });

  // Friend
  drawMap(ctx, HIGH_FRIEND_MAP, HIGH_BODY_X, BALLOON_AREA_HEIGHT, PALETTE);
  return canvas;
}

function makeMagnumSprite() {
  const canvas = newCanvas(MAGNUM_MAP[0].length, MAGNUM_MAP.length);
  drawMap(canvas.getContext("2d"), MAGNUM_MAP, 0, 0, MAGNUM_PALETTE);
  return canvas;
}

function makeGtaSprite() {
  const caseTop = GROUND_Y - HIGH_CLEARANCE - CASE_HEIGHT - RIBBON_TOP;
  const canvas = newCanvas(CASE_WIDTH, caseTop + CASE_HEIGHT);
  const ctx = canvas.getContext("2d");
  const centerX = CASE_WIDTH / 2;

  // Gold ribbon from the ceiling, with a small bow on top of the case
  ctx.fillStyle = CONFIG.COLORS.GOLD;
  ctx.fillRect(centerX - 1, 0, 2, caseTop);
  ctx.fillStyle = CONFIG.COLORS.GOLD_DARK;
  ctx.fillRect(centerX, 0, 1, caseTop);
  drawMap(ctx, ["xx..xx", "xxxxxx", ".xxxx."], centerX - 3, caseTop - 3, {
    x: CONFIG.COLORS.GOLD,
  });

  // Case outline and dark top band
  ctx.fillStyle = "#1a1626";
  ctx.fillRect(0, caseTop, CASE_WIDTH, CASE_HEIGHT);
  ctx.fillStyle = "#2c2838";
  ctx.fillRect(1, caseTop + 1, CASE_WIDTH - 2, 3);
  // Tiny "label" dots on the top band
  ctx.fillStyle = "#fbf7f2";
  for (let x = 3; x < CASE_WIDTH - 3; x += 2)
    ctx.fillRect(x, caseTop + 2, 1, 1);

  // Sunset cover art
  const artTop = caseTop + 4;
  const artHeight = CASE_HEIGHT - 5;
  for (let y = 0; y < artHeight; y++) {
    const band = Math.min(
      SUNSET.length - 1,
      Math.floor((y / artHeight) * SUNSET.length),
    );
    ctx.fillStyle = SUNSET[band];
    ctx.fillRect(1, artTop + y, CASE_WIDTH - 2, 1);
  }
  // Sun
  ctx.fillStyle = "#ffd36b";
  ctx.fillRect(10, artTop + 11, 5, 3);
  ctx.fillRect(11, artTop + 10, 3, 1);

  // Palm tree and ground line
  drawMap(ctx, PALM_MAP, 2, artTop + artHeight - PALM_MAP.length, {
    x: "#2a1036",
  });
  ctx.fillStyle = "#2a1036";
  ctx.fillRect(1, artTop + artHeight - 1, CASE_WIDTH - 2, 1);

  // "VI" with a pink shadow underneath
  drawMap(ctx, VI_MAP, 4, artTop + 3, { x: "#ff4f9a" });
  drawMap(ctx, VI_MAP, 4, artTop + 2, { x: "#ffffff" });
  return canvas;
}

// wingUp = true for the "wings up" frame
function makeDevilSprite(wingUp) {
  const canvas = newCanvas(DEVIL_SPRITE_WIDTH, DEVIL_SPRITE_HEIGHT);
  const ctx = canvas.getContext("2d");
  const devilTop = DEVIL_SPRITE_HEIGHT - DEVIL_MAP.length;

  // Trident strapped to the back, in muted iron so it doesn't steal the show
  ctx.fillStyle = TRIDENT_PALETTE.x;
  ctx.fillRect(
    DEVIL_TRIDENT_X,
    TRIDENT_HEAD_MAP.length,
    1,
    devilTop + 8 - TRIDENT_HEAD_MAP.length,
  );
  ctx.fillStyle = TRIDENT_PALETTE.l;
  ctx.fillRect(
    DEVIL_TRIDENT_X + 1,
    TRIDENT_HEAD_MAP.length,
    1,
    devilTop + 8 - TRIDENT_HEAD_MAP.length,
  );
  drawMap(ctx, TRIDENT_HEAD_MAP, DEVIL_TRIDENT_X - 2, 0, TRIDENT_PALETTE);

  // Wing behind the body, then the devil
  if (wingUp)
    drawMap(
      ctx,
      WING_UP_MAP,
      12,
      devilTop + 9 - WING_UP_MAP.length,
      WING_PALETTE,
    );
  else drawMap(ctx, WING_DOWN_MAP, 12, devilTop + 10, WING_PALETTE);
  drawMap(ctx, DEVIL_MAP, 0, devilTop, DEVIL_PALETTE);
  return canvas;
}

// Everything that differs between obstacle types lives in this table
const TYPES = {
  [ObstacleType.FRIEND_GROUND]: {
    sprite: makeGroundFriendSprite(),
    high: false,
    hitbox: (o) => ({
      x: o.x + 2,
      y: o.y + 3,
      width: o.width - 4,
      height: o.height - 3,
    }),
  },
  [ObstacleType.MAGNUM]: {
    sprite: makeMagnumSprite(),
    high: false,
    hitbox: (o) => ({
      x: o.x + 1,
      y: o.y + 1,
      width: o.width - 2,
      height: o.height - 1,
    }),
  },
  [ObstacleType.FRIEND_HIGH]: {
    sprite: makeHighFriendSprite(),
    high: true,
    // Balloon tower + body, ceiling to knees, so it cannot be jumped over
    hitbox: (o) => ({
      x: o.x + HIGH_BODY_X + 2,
      y: o.y,
      width: 16,
      height: o.height,
    }),
  },
  [ObstacleType.GTA_VI]: {
    sprite: makeGtaSprite(),
    high: true,
    // Ribbon + case, so it cannot be jumped over
    hitbox: (o) => ({
      x: o.x + 1,
      y: o.y,
      width: o.width - 2,
      height: o.height,
    }),
  },
  [ObstacleType.BLINK_DEVIL]: {
    frames: [makeDevilSprite(true), makeDevilSprite(false)],
    high: false,
    lift: DEVIL_FLY_HEIGHT,
    flying: true,
    gapAfter: DEVIL_GAP_AFTER,
    // Devil + trident, full height (wings and tail are left out to be kind)
    hitbox: (o) => ({
      x: o.x + 1,
      y: o.y + 1,
      width: 12,
      height: o.height - 1,
    }),
  },
};

const ALL_TYPES = Object.values(ObstacleType);

export class Obstacle {
  constructor(type) {
    this.type = type;
    this.config = TYPES[type];
    this.sprite = this.config.sprite ?? this.config.frames[0];
    this.width = this.sprite.width;
    this.height = this.sprite.height;
    this.x = view.width + SPAWN_MARGIN;
    this.age = 0; // seconds alive (for animation)

    // Ground obstacles stand on the floor (or hover `lift` pixels above it);
    // high ones end HIGH_CLEARANCE above it
    const lift = this.config.high ? HIGH_CLEARANCE : (this.config.lift ?? 0);
    this.y = GROUND_Y - lift - this.height;
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.age += dt;
  }

  isOffScreen() {
    return this.x + this.width < 0;
  }

  // Slightly smaller than the picture so near misses feel fair
  getHitbox() {
    return this.config.hitbox(this);
  }

  draw(ctx) {
    if (!this.config.flying) {
      ctx.drawImage(this.sprite, Math.round(this.x), Math.round(this.y));
      return;
    }

    // Shadow on the carpet so it reads as flying
    ctx.fillStyle = "rgba(30, 7, 16, 0.35)";
    ctx.fillRect(Math.round(this.x) + 1, GROUND_Y - 2, 12, 2);

    // Flapping wings and a gentle up/down hover
    const frames = this.config.frames;
    const frame =
      frames[Math.floor(this.age / DEVIL_FLAP_TIME) % frames.length];
    const bob = Math.round(
      Math.sin(this.age * DEVIL_BOB_SPEED) * DEVIL_BOB_HEIGHT,
    );
    ctx.drawImage(frame, Math.round(this.x), Math.round(this.y) + bob);
  }
}

export class ObstacleManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.obstacles = [];
    this.distanceToNext = CONFIG.OBSTACLE_SPEED * FIRST_SPAWN_DELAY;
    this.bag = []; // obstacle types still to come in this round
    this.lastType = null;
  }

  // spawnScale < 1 puts obstacles closer together (used by the difficulty levels)
  update(dt, speed, spawnScale = 1) {
    // Spawn by distance, so spacing stays fair at any speed
    this.distanceToNext -= speed * dt;
    if (this.distanceToNext <= 0) {
      const obstacle = this.spawn();
      const gapAfter = obstacle.config.gapAfter ?? 1;
      const gap =
        SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
      this.distanceToNext +=
        speed * CONFIG.OBSTACLE_SPAWN_INTERVAL * gap * spawnScale * gapAfter;
    }

    for (const obstacle of this.obstacles) obstacle.update(dt, speed);
    this.obstacles = this.obstacles.filter(
      (obstacle) => !obstacle.isOffScreen(),
    );
  }

  // "Shuffle bag": every type comes once per round in a random order,
  // so the same obstacle never shows up many times in a row. Returns the new obstacle.
  spawn() {
    if (this.bag.length === 0) this.refillBag();
    const type = this.bag.pop();
    this.lastType = type;
    const obstacle = new Obstacle(type);
    this.obstacles.push(obstacle);
    return obstacle;
  }

  refillBag() {
    this.bag = shuffle([...ALL_TYPES]);
    // The next one out is the last item; don't repeat the end of the previous round
    const last = this.bag.length - 1;
    if (this.bag[last] === this.lastType) {
      [this.bag[0], this.bag[last]] = [this.bag[last], this.bag[0]];
    }
  }

  // Returns the first obstacle touching the given box, or null
  findCollision(box) {
    for (const obstacle of this.obstacles) {
      if (intersects(box, obstacle.getHitbox())) return obstacle;
    }
    return null;
  }

  draw(ctx) {
    for (const obstacle of this.obstacles) obstacle.draw(ctx);
  }
}

// Fisher-Yates shuffle (in place), returns the same array
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Axis-aligned bounding box (AABB) overlap test
export function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
