// =====================================================
// Player - the groom: physics, animation and drawing.
// =====================================================

import { CONFIG } from "./config.js";

// Where the groom stands on screen (he runs in place, the world scrolls)
const PLAYER_X = 72;
const RUN_FRAME_DURATION = 0.06; // seconds per running frame (8 frames)
const JUMP_BUFFER_TIME = 0.12; // a jump pressed just before landing still counts
const IDLE_FRAME_DURATION = 0.6; // seconds per "breathing" frame while waiting
const SLIDE_FRAME_DURATION = 0.08; // seconds per slide "spark" frame
const MAX_JUMPS = 2; // ground jump + one jump in the air
const FLIP_DURATION = 0.45; // seconds for one full front flip

// ---------- Pixel art ----------
// The head and body are drawn from pixel maps (one character = one pixel).
// Arms and legs are drawn as 2-pixel lines between joints, so each
// animation frame is just a list of joint positions.

const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 27;
const SLIDE_HEIGHT = 20; // the groom is this tall while sliding

const PALETTE = {
  h: "#15110f", // hair (black, swept up)
  s: "#f0c49c", // skin
  e: "#2a1a14", // eye
  g: "#e8c26a", // gold glasses frame
  m: "#8c3a3a", // mouth
  w: "#ffffff", // shirt / teeth
  v: "#b9bcc4", // grey vest
  V: "#9a9ea8", // vest shadow
  n: "#1f2a52", // navy cravat
  N: "#2c3a6e", // cravat knot
  l: "#3a3d48", // near leg (trousers)
  o: "#0b0a0f", // shoe
  a: "#f4f1ea", // white shirt sleeve
};

const COLORS = {
  NEAR_LEG: "#3a3d48",
  FAR_LEG: "#5a5e6c",
  NEAR_SHOE: "#0b0a0f",
  FAR_SHOE: "#4a4752",
  NEAR_SLEEVE: "#f4f1ea",
  FAR_SLEEVE: "#d8d3c8",
  NEAR_HAND: "#f0c49c",
  FAR_HAND: "#d4a77f",
  ROSE: "#d9466a",
  ROSE_PINK: "#f28bb0",
  ROSE_WHITE: "#fff8ef",
  LEAF: "#4f8a4a",
  WRAP: "#f3e3c8",
  WRAP_SHADOW: "#d9c4a3",
  SPARK: "#f6ead0",
};

// Small flower bouquet held upright. [dx, dy, color] relative to the hand;
// the hand itself is at (0, 0) and (0, 1).
const BOUQUET = [
  [0, -6, COLORS.ROSE],
  [2, -6, COLORS.ROSE_PINK],
  [-1, -5, COLORS.ROSE_PINK],
  [0, -5, COLORS.ROSE],
  [1, -5, COLORS.ROSE_WHITE],
  [2, -5, COLORS.ROSE_PINK],
  [-1, -4, COLORS.LEAF],
  [0, -4, COLORS.ROSE_WHITE],
  [1, -4, COLORS.ROSE],
  [2, -4, COLORS.LEAF],
  [-1, -3, COLORS.WRAP_SHADOW],
  [0, -3, COLORS.WRAP],
  [1, -3, COLORS.WRAP],
  [2, -3, COLORS.WRAP_SHADOW],
  [0, -2, COLORS.WRAP],
  [1, -2, COLORS.WRAP_SHADOW],
  [0, -1, COLORS.WRAP],
];

// Moo: black hair swept up, gold glasses, big smile
const HEAD = [
  "...hh.hhhhh.h...",
  "...hhhhhhhhhhh..",
  "..hhhhhhhhhhhhh.",
  "..hhhhhhhssssss.",
  "..hhssssgggsggg.",
  "..hsssssgegggeg.",
  "..hssssssssssss.",
  "...ssssssmwwwms.",
  "....sssssssssss.",
  "......sssssss...",
];

// White shirt, grey vest, navy cravat
const TORSO = [
  "....wwwNNwww....",
  "...wvvwNNwvvw...",
  "...wvvvnnvvvw...",
  "...wvvvnnnvvw...",
  "...wvvvnnvvvw...",
  "....vvvvnvvv....",
  "....VVVVVVVV....",
];

// Joint positions inside the 16x27 sprite: [x, y]. Feet touch y = 26.
// Legs (4 poses). The second half of the run cycle swaps near/far legs.
//   contact -> down -> passing -> up
const LEG_POSES = [
  {
    nearKnee: [11, 21],
    nearFoot: [13, 26],
    farKnee: [5, 21],
    farFoot: [1, 22],
    bob: 0,
  },
  {
    nearKnee: [11, 21],
    nearFoot: [10, 26],
    farKnee: [5, 22],
    farFoot: [3, 19],
    bob: 1,
  },
  {
    nearKnee: [8, 21],
    nearFoot: [7, 26],
    farKnee: [11, 19],
    farFoot: [9, 23],
    bob: 0,
  },
  {
    nearKnee: [5, 21],
    nearFoot: [2, 24],
    farKnee: [12, 19],
    farFoot: [14, 22],
    bob: -1,
  },
];

// Near arm holds the bouquet steady in front of the chest
// (it only moves up and down with the body)
const HOLD_POSE = { elbow: [8, 15], hand: [12, 15] };

// Far arm (8 poses) swings opposite to the far leg, mostly behind the body
const FAR_ARM_POSES = [
  { elbow: [8, 15], hand: [11, 13] },
  { elbow: [7, 15], hand: [9, 15] },
  { elbow: [6, 15], hand: [6, 17] },
  { elbow: [4, 14], hand: [3, 16] },
  { elbow: [3, 13], hand: [1, 15] },
  { elbow: [5, 15], hand: [4, 17] },
  { elbow: [7, 15], hand: [8, 16] },
  { elbow: [8, 15], hand: [10, 14] },
];

const JUMP_POSE = {
  legs: {
    nearKnee: [11, 19],
    nearFoot: [10, 23],
    farKnee: [6, 20],
    farFoot: [2, 21],
    bob: 0,
  },
  arm: { elbow: [9, 14], hand: [13, 14] },
  farArm: { elbow: [3, 12], hand: [1, 11] },
};

// Front flip: knees pulled up to the chest, bouquet hugged close
const TUCK_POSE = {
  legs: {
    nearKnee: [12, 15],
    nearFoot: [9, 20],
    farKnee: [10, 15],
    farFoot: [7, 20],
    bob: 0,
  },
  arm: { elbow: [10, 15], hand: [12, 13] },
  farArm: { elbow: [9, 14], hand: [11, 16] },
};

// Standing still on the start screen: feet together, bouquet in hand,
// other arm relaxed. The two frames only differ by a 1px "breath".
const IDLE_LEGS = {
  nearKnee: [9, 21],
  nearFoot: [9, 26],
  farKnee: [6, 21],
  farFoot: [5, 26],
};
const IDLE_FAR_ARM = { elbow: [5, 14], hand: [5, 17] };

// Knee slide across the dance floor: leaning back, knees on the carpet,
// bouquet raised high. 16x20 pixels (drawn at the bottom of the sprite).
const SLIDE_BODY = [
  ".hh.hhhhh.h.....",
  ".hhhhhhhhhhh....",
  "hhhhhhhhhhhhh...",
  "hhhhhhhssssss...",
  "hhssssgggsggg...",
  "hsssssgegggeg...",
  "hssssssssssss...",
  ".ssssssmwwwms...",
  "..sssssssssss...",
  "....sssssss.....",
  "..wwwNNwww......",
  ".wvvwNNwvvwaa...",
  ".wvvvnnvvvaa....",
  ".wvvvnnnvvw.....",
  ".wvvvnnvvvw.....",
  "..vvvvnvvv......",
  "..VVVVVVVV......",
  "...lllllll......",
  "....lllllllll...",
  "oolllllllllll...",
];
const SLIDE_HAND = [13, 9]; // where the raised hand holds the bouquet
const SLIDE_SPARKS = [
  [
    [13, 19],
    [15, 18],
  ],
  [
    [14, 19],
    [15, 17],
  ],
];

// Bresenham line: every pixel between two points
function linePoints([x0, y0], [x1, y1]) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y0 += sy;
    }
  }
  return points;
}

// Flower bouquet held upright; (hx, hy) is the hand
function drawBouquet(pixel, hx, hy) {
  for (const [dx, dy, color] of BOUQUET) pixel(hx + dx, hy + dy, color);
  // Hand wraps around the paper cone
  pixel(hx, hy, COLORS.NEAR_HAND);
  pixel(hx, hy + 1, COLORS.NEAR_HAND);
}

// Creates an empty sprite canvas and a 1-pixel drawing helper for it
function newSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_WIDTH;
  canvas.height = SPRITE_HEIGHT;
  const ctx = canvas.getContext("2d");
  const pixel = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };
  return { canvas, pixel };
}

// Draws one frame of the groom on a small offscreen canvas
function makeFrame(legs, arm, farArm) {
  const { canvas, pixel } = newSprite();
  const bob = legs.bob;

  // Leg: hip -> knee -> foot, 2 pixels wide, with a shoe pointing forward
  const drawLeg = (hip, knee, foot, color, shoeColor) => {
    for (const [x, y] of [
      ...linePoints(hip, knee),
      ...linePoints(knee, foot),
    ]) {
      pixel(x, y, color);
      pixel(x + 1, y, color);
    }
    for (let i = 0; i < 3; i++) pixel(foot[0] + i, foot[1], shoeColor);
  };

  // Arm: shoulder -> elbow -> hand, 2 pixels tall, with a hand at the end
  const drawArm = (shoulder, pose, color, handColor) => {
    const elbow = [pose.elbow[0], pose.elbow[1] + bob];
    const hand = [pose.hand[0], pose.hand[1] + bob];
    for (const [x, y] of [
      ...linePoints(shoulder, elbow),
      ...linePoints(elbow, hand),
    ]) {
      pixel(x, y, color);
      pixel(x, y + 1, color);
    }
    pixel(hand[0], hand[1], handColor);
    pixel(hand[0], hand[1] + 1, handColor);
  };

  // Back to front: far arm, far leg, body, near leg, near arm (+ bouquet)
  drawArm([6, 11 + bob], farArm, COLORS.FAR_SLEEVE, COLORS.FAR_HAND);
  drawLeg([6, 16], legs.farKnee, legs.farFoot, COLORS.FAR_LEG, COLORS.FAR_SHOE);

  [...HEAD, ...TORSO].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (color) pixel(x, y + bob, color);
    }
  });

  drawLeg(
    [8, 16],
    legs.nearKnee,
    legs.nearFoot,
    COLORS.NEAR_LEG,
    COLORS.NEAR_SHOE,
  );
  drawArm([8, 11 + bob], arm, COLORS.NEAR_SLEEVE, COLORS.NEAR_HAND);
  drawBouquet(pixel, arm.hand[0], arm.hand[1] + bob);

  return canvas;
}

// Slide frame: body map + raised bouquet + little friction sparks
function makeSlideFrame(sparks) {
  const { canvas, pixel } = newSprite();
  const top = SPRITE_HEIGHT - SLIDE_HEIGHT;
  SLIDE_BODY.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (color) pixel(x, top + y, color);
    }
  });
  drawBouquet(pixel, SLIDE_HAND[0], top + SLIDE_HAND[1]);
  for (const [x, y] of sparks) pixel(x, top + y, COLORS.SPARK);
  return canvas;
}

// 8-frame run cycle
const RUN_FRAMES = FAR_ARM_POSES.map((farArm, i) => {
  const pose = LEG_POSES[i % 4];
  // Second half of the cycle: the other leg leads
  const legs =
    i < 4
      ? pose
      : {
          nearKnee: pose.farKnee,
          nearFoot: pose.farFoot,
          farKnee: pose.nearKnee,
          farFoot: pose.nearFoot,
          bob: pose.bob,
        };
  return makeFrame(legs, HOLD_POSE, farArm);
});

const JUMP_FRAME = makeFrame(JUMP_POSE.legs, JUMP_POSE.arm, JUMP_POSE.farArm);

const TUCK_FRAME = makeFrame(TUCK_POSE.legs, TUCK_POSE.arm, TUCK_POSE.farArm);

const IDLE_FRAMES = [0, 1].map((bob) =>
  makeFrame({ ...IDLE_LEGS, bob }, HOLD_POSE, IDLE_FAR_ARM),
);

const SLIDE_FRAMES = SLIDE_SPARKS.map((sparks) => makeSlideFrame(sparks));

export class Player {
  constructor() {
    this.width = SPRITE_WIDTH;
    this.height = SPRITE_HEIGHT;
    this.reset();
  }

  reset() {
    this.x = PLAYER_X;
    this.y = CONFIG.GROUND_Y - this.height; // top of the groom
    this.velocityY = 0;
    this.onGround = true;
    this.running = false; // standing still until the game starts
    this.jumpBufferTimer = 0;
    this.jumpCount = 0; // jumps used since leaving the ground
    this.flipTimer = 0; // > 0 while doing the front flip
    this.runTimer = 0;
    this.runFrame = 0;
    this.idleTimer = 0;
    this.idleFrame = 0;
    this.sliding = false;
    this.slideTimer = 0;
    this.slideQueued = false; // slide pressed in the air -> slide on landing
    this.fastFalling = false;
    this.slideFrameTimer = 0;
    this.slideFrame = 0;
  }

  startRunning() {
    this.running = true;
    this.runTimer = 0;
    this.runFrame = 0;
  }

  // Called when the player presses jump
  requestJump() {
    this.jumpBufferTimer = JUMP_BUFFER_TIME;
  }

  // Called when the player presses slide
  requestSlide() {
    if (!this.running) return;
    if (this.onGround) {
      this.startSlide();
    } else {
      // In the air: drop faster, then slide as soon as the feet touch down
      this.fastFalling = true;
      this.slideQueued = true;
      this.jumpBufferTimer = 0;
      this.flipTimer = 0;
    }
  }

  startSlide() {
    this.sliding = true;
    this.slideTimer = CONFIG.SLIDE_DURATION;
    this.slideQueued = false;
  }

  // Collision box for the current pose (the flip uses the normal standing box)
  getHitbox() {
    const height = this.sliding ? SLIDE_HEIGHT : SPRITE_HEIGHT;
    return {
      x: this.x + 3,
      y: this.y + (SPRITE_HEIGHT - height) + 1,
      width: this.width - 6,
      height: height - 1,
    };
  }

  update(dt) {
    // Waiting on the start screen: only the breathing animation
    if (!this.running) {
      this.idleTimer += dt;
      while (this.idleTimer >= IDLE_FRAME_DURATION) {
        this.idleTimer -= IDLE_FRAME_DURATION;
        this.idleFrame = (this.idleFrame + 1) % IDLE_FRAMES.length;
      }
      return;
    }

    // Count down the buffered jump
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
    }

    // First jump from the ground (ends a slide), second jump in the air with a flip
    if (this.jumpBufferTimer > 0) {
      if (this.onGround) {
        this.velocityY = -CONFIG.JUMP_FORCE;
        this.onGround = false;
        this.jumpBufferTimer = 0;
        this.jumpCount = 1;
        this.sliding = false;
      } else if (this.jumpCount < MAX_JUMPS && !this.fastFalling) {
        this.velocityY = -CONFIG.DOUBLE_JUMP_FORCE;
        this.jumpBufferTimer = 0;
        this.jumpCount = MAX_JUMPS;
        this.flipTimer = FLIP_DURATION;
      }
    }

    if (this.flipTimer > 0) this.flipTimer = Math.max(0, this.flipTimer - dt);

    // Slide timer
    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.sliding = false;

      this.slideFrameTimer += dt;
      while (this.slideFrameTimer >= SLIDE_FRAME_DURATION) {
        this.slideFrameTimer -= SLIDE_FRAME_DURATION;
        this.slideFrame = (this.slideFrame + 1) % SLIDE_FRAMES.length;
      }
    }

    // Gravity (exact for constant acceleration, so jump height is
    // the same at any frame rate)
    if (!this.onGround) {
      const gravity =
        CONFIG.GRAVITY * (this.fastFalling ? CONFIG.FAST_FALL_MULTIPLIER : 1);
      this.y += this.velocityY * dt + 0.5 * gravity * dt * dt;
      this.velocityY += gravity * dt;

      // Ground collision
      const groundTop = CONFIG.GROUND_Y - this.height;
      if (this.y >= groundTop) {
        this.y = groundTop;
        this.velocityY = 0;
        this.onGround = true;
        this.fastFalling = false;
        this.jumpCount = 0;
        this.flipTimer = 0;
        this.runFrame = 0; // land on a "contact" pose
        this.runTimer = 0;
        if (this.slideQueued) this.startSlide();
      }
    }

    // Running animation
    if (this.onGround) {
      this.runTimer += dt;
      while (this.runTimer >= RUN_FRAME_DURATION) {
        this.runTimer -= RUN_FRAME_DURATION;
        this.runFrame = (this.runFrame + 1) % RUN_FRAMES.length;
      }
    }
  }

  draw(ctx) {
    if (this.flipTimer > 0) {
      this.drawFlip(ctx);
      return;
    }
    let sprite = JUMP_FRAME;
    if (!this.running) sprite = IDLE_FRAMES[this.idleFrame];
    else if (this.sliding) sprite = SLIDE_FRAMES[this.slideFrame];
    else if (this.onGround) sprite = RUN_FRAMES[this.runFrame];
    ctx.drawImage(sprite, Math.round(this.x), Math.round(this.y));
  }

  // Tucked pose spinning forward (clockwise, he faces right) around its center
  drawFlip(ctx) {
    const progress = 1 - this.flipTimer / FLIP_DURATION;
    const centerX = Math.round(this.x + this.width / 2);
    const centerY = Math.round(this.y + this.height / 2);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(progress * Math.PI * 2);
    ctx.drawImage(TUCK_FRAME, -this.width / 2, -this.height / 2);
    ctx.restore();
  }
}
