// =====================================================
// Entry point - sets up the canvas and starts the game.
// =====================================================

import { CONFIG } from "./config.js";
import { Game } from "./game.js";
import { view, setViewAspect } from "./view.js";

const canvas = document.getElementById("game-canvas");
const wrapper = document.getElementById("game-wrapper");

// Highest render scale (limits memory use on very large screens)
const MAX_RENDER_SCALE = 8;

const game = new Game(canvas);

// Fit the canvas to the screen.
// The game "thinks" in logical pixels: always 270 tall, and 480 wide or more
// on long phone screens (see view.js). The canvas itself is drawn at the
// screen's real resolution so it looks sharp.
function resizeCanvas() {
  const availableWidth = wrapper.clientWidth;
  const availableHeight = wrapper.clientHeight;
  if (availableHeight > 0) setViewAspect(availableWidth / availableHeight);

  const cssScale = Math.min(
    availableWidth / view.width,
    availableHeight / CONFIG.CANVAS_HEIGHT,
  );

  // Size on the page (CSS pixels)
  canvas.style.width = `${Math.floor(view.width * cssScale)}px`;
  canvas.style.height = `${Math.floor(CONFIG.CANVAS_HEIGHT * cssScale)}px`;

  // Real drawing resolution: a whole number so every game pixel
  // becomes an equal square block of screen pixels
  const pixelRatio = window.devicePixelRatio || 1;
  const renderScale = Math.min(
    MAX_RENDER_SCALE,
    Math.max(1, Math.ceil(cssScale * pixelRatio)),
  );

  const width = view.width * renderScale;
  const height = CONFIG.CANVAS_HEIGHT * renderScale;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  // Changing canvas size resets the context, so always re-apply the scale
  game.renderer.setScale(renderScale);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resizeCanvas);
}
resizeCanvas();

// Phones: go full screen on the first tap where the browser allows it
// (Android Chrome, iPad). iPhone Safari does not allow it for games;
// there, "Add to Home Screen" opens the game full screen instead.
const IS_TOUCH_DEVICE = window.matchMedia("(pointer: coarse)").matches;
function enterFullscreen() {
  if (
    !IS_TOUCH_DEVICE ||
    !document.fullscreenEnabled ||
    document.fullscreenElement
  )
    return;
  document.documentElement
    .requestFullscreen({ navigationUI: "hide" })
    .then(() => screen.orientation?.lock?.("landscape"))
    .catch(() => {}); // refused or not supported: keep playing in the normal page
}
window.addEventListener("pointerup", enterFullscreen);

// Wait for the pixel font so the first frames are not drawn in a fallback font.
// If it is slow (or fails), start anyway after FONT_TIMEOUT.
const FONT_TIMEOUT = 3000; // milliseconds
const fontReady = Promise.all([
  document.fonts.load(`12px ${CONFIG.FONT_FAMILY}`),
  document.fonts.load(`bold 12px ${CONFIG.FONT_FAMILY}`),
]).catch(() => {});
const timeout = new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT));
Promise.race([fontReady, timeout]).then(() => game.start());
