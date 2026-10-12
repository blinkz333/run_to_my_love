// =====================================================
// Game - owns the game loop, input and the game state.
// =====================================================

import { CONFIG } from "./config.js";
import { Renderer, START_BUTTON, SOUND_BUTTON } from "./renderer.js";
import { Player } from "./player.js";
import { Bride, drawFlowerArch } from "./bride.js";
import { ObstacleManager } from "./obstacle.js";
import { HeartManager } from "./collectible.js";
import { Effects } from "./effects.js";
import { view } from "./view.js";
import { SoundManager } from "./audio.js";
import { Hud, POPUP_DURATION } from "./hud.js";
import {
  Screens,
  RETRY_BUTTON,
  MENU_BUTTON,
  POOF_DURATION,
} from "./screens.js";

export const GameState = Object.freeze({
  BOOT: "BOOT",
  MENU: "MENU",
  PLAYING: "PLAYING",
  GAME_OVER: "GAME_OVER",
  WINNING: "WINNING",
  ENDING: "ENDING",
});

const JUMP_KEYS = ["Space", "ArrowUp", "KeyW"];
const SLIDE_KEYS = ["ArrowDown", "KeyS"];
const START_KEYS = ["Space", "Enter"];
const MENU_KEYS = ["Escape"];
const MUTE_KEY = "KeyM";
const GAME_KEYS = [
  ...new Set([...JUMP_KEYS, ...SLIDE_KEYS, ...START_KEYS, ...MENU_KEYS]),
];

// The sound button is small, so taps a little outside it still count (pixels)
const SOUND_BUTTON_PADDING = 6;

// Phone held upright: the "turn your phone" hint covers the game, so taps are ignored
const PORTRAIT_TOUCH = window.matchMedia(
  "(orientation: portrait) and (pointer: coarse)",
);

// A quick tap still lights the touch button for this long (seconds)
const BUTTON_FLASH_TIME = 0.12;

// Hit feedback
const BLINK_RATE = 15; // groom blinks this many times per second while invulnerable
const SHAKE_DURATION = 0.25; // seconds
const SHAKE_STRENGTH = 2; // pixels
const HURT_FLASH_DURATION = 0.2; // seconds

// Wait a moment before end screens accept input, so a panicked tap does not skip them
const RETRY_DELAY = 0.6; // seconds (Game Over)
const CONTINUE_DELAY = 1.2; // seconds after the couple meets (Winning)
const RESTART_DELAY = 2.2; // seconds (Ending, waits for the zoom and the panel)

// Winning scene: the bride walks in from the right and stops next to the groom
const BRIDE_START_MARGIN = 10; // she starts this far past the right edge
const MEET_DISTANCE = 20; // pixels between groom and bride when they meet

// Slow motion just before the couple meets
const SLOWMO_START_DISTANCE = 110; // starts when the bride is this close (pixels)
const SLOWMO_SCALE = 0.3; // world runs at 30% speed
const SLOWMO_EASE_TIME = 0.25; // seconds to slow down / speed back up
const LETTERBOX_HEIGHT = 18; // cinematic black bars during slow motion

// Screen changes: fade to dark, switch, fade back in
const FADE_TIME = 0.3; // seconds for each half
const FADE_STEPS = 6; // the fade moves in a few hard steps, like an old console
const FADE_COLOR = "#1e0710";

// Speed changes ease in over about this many seconds instead of jumping
const SPEED_EASE_TIME = 1.5;

// Wedding march starts after the win fanfare (seconds)
const WEDDING_MUSIC_DELAY = 1.3;

// Ending scene: the couple stands under the flower arch in the middle
const ENDING_GROOM_OFFSET = -20; // from the middle of the view
const ENDING_BRIDE_OFFSET = 4;

// Ending camera: zooms in on the flower arch, then the text panel fades in
const ENDING_ZOOM = 1.5;
const ENDING_ZOOM_TIME = 1.8; // seconds
const ENDING_FOCUS_Y = CONFIG.GROUND_Y - 26; // the camera aims at (middle of the view, this y)
const ENDING_FOCUS_SCREEN_Y = CONFIG.GROUND_Y - 16; // ...and where that point ends up on screen
const ENDING_PANEL_DELAY = 1.2; // seconds before the panel starts to fade in
const ENDING_PANEL_FADE = 0.6; // seconds

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.renderer = new Renderer(this.ctx);
    this.player = new Player();
    this.bride = new Bride();
    this.obstacles = new ObstacleManager();
    this.hearts = new HeartManager();
    this.effects = new Effects();
    this.audio = new SoundManager();
    this.hud = new Hud(this.renderer);
    this.screens = new Screens(this.renderer);

    this.state = GameState.BOOT;
    this.scrollX = 0; // how far the world has scrolled (pixels)
    this.lastScrollX = 0; // scrollX on the previous frame (for the effects)
    this.playerWasSliding = false; // for the slide sound
    this.speed = CONFIG.OBSTACLE_SPEED; // current world speed (pixels per second)
    this.time = 0; // seconds since the game opened (for UI animation)
    this.playTime = 0; // seconds since the current run started
    this.lastTime = 0;

    // Score (1 point = 1 day together) and milestones
    this.score = 0;
    this.heartsCollected = 0;
    this.nextMilestone = 0; // index into CONFIG.MILESTONES
    this.milestoneText = "";
    this.milestoneAge = Infinity; // seconds since the last banner appeared
    this.popups = []; // floating "+120" texts

    // Lives and hit feedback
    this.lives = CONFIG.STARTING_LIVES;
    this.invulnerableTimer = 0;
    this.shakeTimer = 0;
    this.hurtFlashTimer = 0;

    // End screens
    this.stateTime = 0; // seconds since the current state started
    this.hasMet = false; // Winning: the bride has reached the groom
    this.meetAge = 0; // Winning: seconds since they met
    this.poofs = []; // Winning: sparkles where obstacles vanished
    this.timeScale = 1; // Winning: < 1 while in slow motion

    // Screen fade: { action, time, switched } while fading, otherwise null
    this.fade = null;

    // Touch buttons: which pointer is holding which action, plus a short flash per tap
    this.heldPointers = new Map(); // pointerId -> 'jump' | 'slide'
    this.buttonFlash = { jump: 0, slide: 0 };

    // FPS counter (debug)
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTimer = 0;

    this.loop = this.loop.bind(this);
    this.setupInput();
  }

  setupInput() {
    window.addEventListener("keydown", (event) => {
      if (event.code === MUTE_KEY && !event.repeat) {
        this.audio.toggleMute();
        return;
      }
      if (!GAME_KEYS.includes(event.code)) return;
      event.preventDefault(); // stop the page from scrolling
      if (event.repeat) return; // ignore auto-repeat when a key is held
      if (this.fade) return; // the screen is changing

      const isStart = START_KEYS.includes(event.code);
      const isMenu = MENU_KEYS.includes(event.code);

      if (this.state === GameState.MENU) {
        if (isStart) this.fadeTo(() => this.startGame());
      } else if (this.state === GameState.PLAYING) {
        if (JUMP_KEYS.includes(event.code)) this.player.requestJump();
        if (SLIDE_KEYS.includes(event.code)) this.player.requestSlide();
      } else if (this.state === GameState.GAME_OVER) {
        if (isStart) this.retry();
        if (isMenu) this.backToMenu(RETRY_DELAY);
      } else if (this.state === GameState.WINNING) {
        if (isStart) this.continueToEnding();
      } else if (this.state === GameState.ENDING) {
        if (isStart || isMenu) this.backToMenu(RESTART_DELAY);
      }
    });

    // Mouse / touch / pen
    window.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        if (PORTRAIT_TOUCH.matches) return;

        // The sound button works on every screen, and is checked first
        // so tapping it during a run does not also jump
        const point = this.toGamePoint(event);
        if (pointInRect(point, SOUND_BUTTON, SOUND_BUTTON_PADDING)) {
          this.audio.toggleMute();
          return;
        }
        if (this.fade) return; // the screen is changing

        // Menu and Game Over buttons sit in the centered 480px area
        const uiPoint = { x: point.x - view.offsetX, y: point.y };
        if (this.state === GameState.MENU) {
          if (pointInRect(uiPoint, START_BUTTON))
            this.fadeTo(() => this.startGame());
        } else if (this.state === GameState.PLAYING) {
          // The whole half of the screen works, not only the drawn button
          const action = this.getTouchAction(point);
          if (action === "jump") this.player.requestJump();
          else this.player.requestSlide();
          this.heldPointers.set(event.pointerId, action);
          this.buttonFlash[action] = BUTTON_FLASH_TIME;
        } else if (this.state === GameState.GAME_OVER) {
          if (pointInRect(uiPoint, RETRY_BUTTON)) this.retry();
          if (pointInRect(uiPoint, MENU_BUTTON)) this.backToMenu(RETRY_DELAY);
        } else if (this.state === GameState.WINNING) {
          this.continueToEnding();
        } else if (this.state === GameState.ENDING) {
          this.backToMenu(RESTART_DELAY);
        }
      },
      { passive: false },
    );

    // Release the button when the finger lifts or leaves the screen
    const releasePointer = (event) => this.heldPointers.delete(event.pointerId);
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);

    // Stop the long-press menu on mobile
    window.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  // Converts a pointer position on the page into game coordinates (view.width x 270)
  toGamePoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * view.width,
      y: ((event.clientY - rect.top) / rect.height) * CONFIG.CANVAS_HEIGHT,
    };
  }

  // Which action a tap triggers, based on TOUCH_JUMP_SIDE in config.js
  getTouchAction(point) {
    const isLeft = point.x < view.width / 2;
    const jumpOnLeft = CONFIG.TOUCH_JUMP_SIDE !== "right";
    return isLeft === jumpOnLeft ? "jump" : "slide";
  }

  // Button is lit while a finger holds it, or briefly after a quick tap
  isButtonPressed(action) {
    if (this.buttonFlash[action] > 0) return true;
    for (const held of this.heldPointers.values()) {
      if (held === action) return true;
    }
    return false;
  }

  // ---------- State changes ----------

  setState(state) {
    this.state = state;
    this.stateTime = 0;
    this.heldPointers.clear();
  }

  start() {
    // BOOT finished -> show the start screen
    this.setState(GameState.MENU);
    this.audio.playMusic("wedding"); // starts after the first tap / key press
    this.fade = { action: null, time: FADE_TIME, switched: true }; // fade in from dark
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  startGame() {
    this.player.reset();
    this.player.startRunning();
    this.obstacles.reset();
    this.hearts.reset();
    this.effects.reset();
    this.speed = CONFIG.OBSTACLE_SPEED;
    this.playTime = 0;
    this.score = 0;
    this.heartsCollected = 0;
    this.nextMilestone = 0;
    this.milestoneAge = Infinity;
    this.popups = [];
    this.poofs = [];
    this.lives = CONFIG.STARTING_LIVES;
    this.invulnerableTimer = 0;
    this.shakeTimer = 0;
    this.hurtFlashTimer = 0;
    this.buttonFlash.jump = 0;
    this.buttonFlash.slide = 0;
    this.setState(GameState.PLAYING);
    this.audio.playMusic("run");
  }

  // Game Over -> play again (after a short delay)
  retry() {
    if (this.stateTime < RETRY_DELAY) return;
    this.fadeTo(() => this.startGame());
  }

  // Game Over / Ending -> start screen (after `delay` seconds in the current state)
  backToMenu(delay) {
    if (this.stateTime < delay) return;
    this.fadeTo(() => this.showMenu());
  }

  showMenu() {
    this.player.reset();
    this.obstacles.reset();
    this.hearts.reset();
    this.effects.reset();
    this.popups = [];
    this.poofs = [];
    this.setState(GameState.MENU);
    this.audio.playMusic("wedding");
  }

  gameOver() {
    this.invulnerableTimer = 0;
    this.milestoneAge = Infinity;
    this.player.reset(); // groom stops and stands (standby pose)
    this.setState(GameState.GAME_OVER);
    this.audio.stopMusic();
    this.audio.play("gameOver");
  }

  // Score reached TARGET_SCORE: clear the way and let the bride walk in
  win() {
    this.invulnerableTimer = 0;
    this.milestoneAge = Infinity; // the win banner replaces the milestone banner

    // Obstacles and hearts ahead of the groom vanish with a sparkle
    const groomX = this.player.x;
    for (const thing of [...this.obstacles.obstacles, ...this.hearts.hearts]) {
      if (thing.x + thing.width > groomX) {
        this.poofs.push({
          x: thing.x + thing.width / 2,
          y: thing.y + thing.height / 2,
          age: 0,
        });
      }
    }
    this.obstacles.obstacles = this.obstacles.obstacles.filter(
      (o) => o.x + o.width <= groomX,
    );
    this.hearts.hearts = this.hearts.hearts.filter(
      (h) => h.x + h.width <= groomX,
    );

    this.bride.x = view.width + BRIDE_START_MARGIN;
    this.timeScale = 1;
    this.hasMet = false;
    this.meetAge = 0;
    this.setState(GameState.WINNING);
    this.audio.stopMusic(); // silence for the slow-motion moment
  }

  // Winning -> Ending (only after the couple has met)
  continueToEnding() {
    if (!this.hasMet || this.meetAge < CONTINUE_DELAY) return;
    this.fadeTo(() => this.showEnding());
  }

  showEnding() {
    this.player.reset();
    this.effects.reset();
    this.player.x = view.width / 2 + ENDING_GROOM_OFFSET;
    this.bride.x = view.width / 2 + ENDING_BRIDE_OFFSET;
    this.setState(GameState.ENDING);
  }

  // ---------- Screen fade ----------

  // Fades to dark, runs `action` (the screen change), then fades back in
  fadeTo(action) {
    if (this.fade) return;
    this.fade = { action, time: 0, switched: false };
    this.audio.play("click");
  }

  updateFade(dt) {
    if (!this.fade) return;
    this.fade.time += dt;
    if (!this.fade.switched && this.fade.time >= FADE_TIME) {
      this.fade.switched = true;
      this.fade.action?.();
    }
    if (this.fade.time >= FADE_TIME * 2) this.fade = null;
  }

  drawFade() {
    if (!this.fade) return;
    const { time } = this.fade;
    const amount = time < FADE_TIME ? time / FADE_TIME : 2 - time / FADE_TIME; // 0 -> 1 -> 0
    const stepped = Math.ceil(clamp01(amount) * FADE_STEPS) / FADE_STEPS;
    if (stepped <= 0) return;
    this.ctx.save();
    this.ctx.globalAlpha = stepped;
    this.ctx.fillStyle = FADE_COLOR;
    this.ctx.fillRect(0, 0, view.width, CONFIG.CANVAS_HEIGHT);
    this.ctx.restore();
  }
  // ---------- Score ----------

  addScore(points) {
    this.score += points;

    // Show a banner for each milestone passed
    const milestones = CONFIG.MILESTONES;
    while (
      this.nextMilestone < milestones.length &&
      this.score >= milestones[this.nextMilestone].score
    ) {
      this.milestoneText = milestones[this.nextMilestone].text;
      this.milestoneAge = 0;
      this.nextMilestone += 1;
      // The last milestone is the win, which has its own fanfare
      if (this.nextMilestone < milestones.length) this.audio.play("milestone");
    }

    if (this.score >= CONFIG.TARGET_SCORE) {
      this.score = CONFIG.TARGET_SCORE;
      this.win();
    }
  }

  // Picks up every heart the groom touches
  collectHearts() {
    const collected = this.hearts.collect(this.player.getHitbox());
    for (const heart of collected) {
      this.effects.heartBurst(
        heart.x + heart.width / 2,
        heart.y + heart.height / 2,
      );
      this.popups.push({
        x: heart.x + heart.width / 2,
        y: heart.y - 4,
        age: 0,
        text: `+${CONFIG.HEART_SCORE}`,
      });
      this.heartsCollected += 1;
      this.audio.play("heart");
      this.addScore(CONFIG.HEART_SCORE);
    }
  }

  // Called when the groom touches an obstacle
  hitPlayer() {
    const player = this.player;
    this.effects.hitStars(
      player.x + player.width / 2,
      player.y + player.height / 2 - 4,
    );
    this.lives -= 1;
    this.shakeTimer = SHAKE_DURATION;
    this.hurtFlashTimer = HURT_FLASH_DURATION;
    this.audio.play("hit");

    if (this.lives <= 0) {
      this.lives = 0;
      this.gameOver();
    } else {
      this.invulnerableTimer = CONFIG.INVULNERABILITY_DURATION;
    }
  }

  // ---------- Loop ----------

  loop(now) {
    // Delta time in seconds, capped to avoid huge jumps after tab switching
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(Math.max(dt, 0), CONFIG.MAX_DELTA_TIME);

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    this.updateFade(dt);

    if (this.state === GameState.PLAYING) {
      this.updatePlaying(dt);
    } else if (this.state === GameState.WINNING) {
      this.updateWinning(dt);
    } else {
      // MENU, GAME_OVER, ENDING: the hall stands still, the couple breathes
      this.player.update(dt);
      this.bride.update(dt);
    }

    // Particles follow the slow motion and scroll away with the floor
    const effectDt =
      this.state === GameState.WINNING ? dt * this.timeScale : dt;
    this.effects.update(effectDt, this.scrollX - this.lastScrollX);
    this.lastScrollX = this.scrollX;

    // Popups, poofs and the milestone banner animate in every state
    for (const popup of this.popups) popup.age += dt;
    this.popups = this.popups.filter((popup) => popup.age < POPUP_DURATION);
    for (const poof of this.poofs) poof.age += dt;
    this.poofs = this.poofs.filter((poof) => poof.age < POOF_DURATION);
    this.milestoneAge += dt;

    this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - dt);

    this.fpsFrames += 1;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }
  }

  // Difficulty level = number of milestones passed so far
  getDifficulty() {
    const levels = CONFIG.DIFFICULTY_LEVELS;
    return levels[Math.min(this.nextMilestone, levels.length - 1)];
  }

  updatePlaying(dt) {
    const difficulty = this.getDifficulty();
    const targetSpeed = CONFIG.OBSTACLE_SPEED * difficulty.speed;
    this.speed +=
      (targetSpeed - this.speed) * Math.min(1, dt / SPEED_EASE_TIME);

    this.playTime += dt;
    this.scrollX += this.speed * dt;
    this.updatePlayer(dt);
    this.obstacles.update(dt, this.speed, difficulty.spawn);
    this.hearts.update(dt, this.speed, this.obstacles);

    // Collision (ignored while invulnerable after a hit)
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    } else if (this.obstacles.findCollision(this.player.getHitbox())) {
      this.hitPlayer();
    }

    // Score: points for running, plus hearts (may end the run with a win)
    if (this.state === GameState.PLAYING) this.collectHearts();
    if (this.state === GameState.PLAYING)
      this.addScore(CONFIG.PASSIVE_SCORE_PER_SECOND * dt);

    this.buttonFlash.jump = Math.max(0, this.buttonFlash.jump - dt);
    this.buttonFlash.slide = Math.max(0, this.buttonFlash.slide - dt);
  }

  // Moves the groom and kicks up dust / sparks / sounds for what he just did
  updatePlayer(dt) {
    const player = this.player;
    const wasOnGround = player.onGround;
    const jumpsBefore = player.jumpCount;
    player.update(dt);

    const centerX = player.x + player.width / 2;
    if (wasOnGround && !player.onGround) {
      this.effects.footPuff(centerX, 4, 0.7); // take off
      this.audio.play("jump");
    } else if (!wasOnGround && player.onGround) {
      this.effects.footPuff(centerX, 6, 1); // landing
    }
    if (player.jumpCount > jumpsBefore && jumpsBefore > 0) {
      this.effects.doubleJump(centerX, player.y + player.height);
      this.audio.play("doubleJump");
    }
    // A slide can start from a key press between frames, so compare with the last frame
    if (player.sliding && !this.playerWasSliding) this.audio.play("slide");
    this.playerWasSliding = player.sliding;
    if (player.onGround && player.running) {
      this.effects.trail(dt, player.x + 4, player.sliding);
    }
  }

  updateWinning(realDt) {
    // Slow motion while the bride is close, back to normal once they meet
    const isClose =
      this.bride.x - (this.player.x + MEET_DISTANCE) < SLOWMO_START_DISTANCE;
    const targetScale = isClose && !this.hasMet ? SLOWMO_SCALE : 1;
    this.timeScale +=
      (targetScale - this.timeScale) * Math.min(1, realDt / SLOWMO_EASE_TIME);
    const dt = realDt * this.timeScale;

    this.bride.update(dt);

    if (this.hasMet) {
      this.meetAge += dt;
      this.player.update(dt);
      return;
    }

    // The world keeps scrolling until the bride reaches the groom
    const meetX = this.player.x + MEET_DISTANCE;
    if (this.bride.x > meetX) {
      const step = Math.min(this.speed * dt, this.bride.x - meetX);
      this.scrollX += step;
      this.bride.x -= step;
      for (const obstacle of this.obstacles.obstacles) obstacle.x -= step;
      for (const heart of this.hearts.hearts) heart.x -= step;
    }
    this.updatePlayer(dt);

    // They meet once she is there and his feet are on the floor
    if (this.bride.x <= meetX && this.player.onGround) {
      this.hasMet = true;
      this.meetAge = 0;
      this.player.reset(); // stop running, stand and face her
      this.bride.hop();
      this.audio.play("win");
      this.audio.playMusic("wedding", WEDDING_MUSIC_DELAY);
    }
  }

  // ---------- Drawing ----------

  render() {
    const ctx = this.ctx;
    this.renderer.clear();

    // World (shakes for a moment when the groom is hit)
    ctx.save();
    if (this.state === GameState.ENDING) this.applyEndingCamera();
    if (this.shakeTimer > 0) {
      const dx = Math.round((Math.random() * 2 - 1) * SHAKE_STRENGTH);
      const dy = Math.round((Math.random() * 2 - 1) * SHAKE_STRENGTH);
      ctx.translate(dx, dy);
    }
    this.renderer.drawBackground(this.scrollX);
    if (this.state === GameState.ENDING) {
      drawFlowerArch(ctx, view.width / 2, CONFIG.GROUND_Y);
    } else {
      this.obstacles.draw(ctx);
      this.hearts.draw(ctx);
    }
    if (this.state === GameState.WINNING || this.state === GameState.ENDING) {
      this.bride.draw(ctx);
    }
    if (this.isPlayerVisible()) this.player.draw(ctx);
    this.effects.draw(ctx);
    ctx.restore();

    this.hud.drawHurtFlash(this.hurtFlashTimer / HURT_FLASH_DURATION);
    if (this.state === GameState.WINNING) this.drawLetterbox();

    if (this.state === GameState.MENU) {
      this.renderer.drawMenu(this.time);
    } else if (this.state === GameState.ENDING) {
      this.screens.drawPetals(this.time);
      ctx.save();
      ctx.globalAlpha = clamp01(
        (this.stateTime - ENDING_PANEL_DELAY) / ENDING_PANEL_FADE,
      );
      this.screens.drawEnding(
        this.time,
        this.renderer.subtitle,
        this.stateTime >= RESTART_DELAY,
      );
      ctx.restore();
    } else {
      this.drawRunHud();
    }

    this.renderer.drawSoundButton(this.audio.muted);
    this.drawFade(); // on top of everything
  }

  // Ending: zoom from the normal view into the flower arch
  applyEndingCamera() {
    const t = clamp01(this.stateTime / ENDING_ZOOM_TIME);
    const ease = 1 - Math.pow(1 - t, 3); // fast at first, gentle at the end
    const zoom = 1 + (ENDING_ZOOM - 1) * ease;
    const focusX = view.width / 2;
    const screenY =
      ENDING_FOCUS_Y + (ENDING_FOCUS_SCREEN_Y - ENDING_FOCUS_Y) * ease;
    // screen = focusScreen + (world - focus) * zoom
    this.ctx.translate(focusX, screenY);
    this.ctx.scale(zoom, zoom);
    this.ctx.translate(-focusX, -ENDING_FOCUS_Y);
  }

  // Black bars slide in from the top and bottom during slow motion
  drawLetterbox() {
    const amount = clamp01((1 - this.timeScale) / (1 - SLOWMO_SCALE));
    const height = Math.round(LETTERBOX_HEIGHT * amount);
    if (height <= 0) return;
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, view.width, height);
    this.ctx.fillRect(0, CONFIG.CANVAS_HEIGHT - height, view.width, height);
  }

  // HUD for PLAYING, GAME_OVER and WINNING
  drawRunHud() {
    // The heart that was just lost blinks while the groom is invulnerable
    this.hud.drawLives(
      this.lives,
      this.invulnerableTimer > 0 && this.isBlinkOn(),
    );
    this.hud.drawProgress(this.score);
    this.hud.drawPopups(this.popups);
    this.hud.drawMilestone(this.milestoneText, this.milestoneAge);

    if (this.state === GameState.PLAYING) {
      this.renderer.drawTouchButtons({
        jump: this.isButtonPressed("jump"),
        slide: this.isButtonPressed("slide"),
      });
      this.renderer.drawHint(this.fps);
    } else if (this.state === GameState.GAME_OVER) {
      this.screens.drawGameOver(
        this.time,
        this.score,
        this.heartsCollected,
        this.stateTime >= RETRY_DELAY,
      );
    } else if (this.state === GameState.WINNING) {
      this.screens.drawPoofs(this.poofs);
      if (this.hasMet) {
        const between = (this.player.x + this.player.width + this.bride.x) / 2;
        this.screens.drawMeetHearts(between, CONFIG.GROUND_Y, this.meetAge);
        this.screens.drawWinBanner(this.time, this.meetAge >= CONTINUE_DELAY);
      }
    }
  }

  // Blinks on/off BLINK_RATE times per second
  isBlinkOn() {
    return Math.floor(this.invulnerableTimer * BLINK_RATE) % 2 === 0;
  }

  // The groom blinks while invulnerable
  isPlayerVisible() {
    return this.invulnerableTimer <= 0 || this.isBlinkOn();
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

// padding = extra pixels around the rect that still count as inside
function pointInRect(point, rect, padding = 0) {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}
