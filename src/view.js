// =====================================================
// View - the size of the visible game area in logical pixels.
// The height is always CANVAS_HEIGHT (270). The width starts at
// CANVAS_WIDTH (480, 16:9) and grows on long phone screens, so the
// hall fills the whole screen instead of leaving black bars.
// Menus and panels are designed for 480px and stay in the middle:
// draw them at view.offsetX + x.
// =====================================================

import { CONFIG } from "./config.js";

// Widest view (about 21:9). Wider screens get thin bars on the sides.
const MAX_VIEW_WIDTH = 640;

export const view = {
  width: CONFIG.CANVAS_WIDTH,
  offsetX: 0, // left edge of the centered 480px area used by menus and panels
};

// aspect = screen width / screen height
export function setViewAspect(aspect) {
  const wanted = Math.round((CONFIG.CANVAS_HEIGHT * aspect) / 2) * 2; // even, so the center is a whole pixel
  view.width = Math.min(MAX_VIEW_WIDTH, Math.max(CONFIG.CANVAS_WIDTH, wanted));
  view.offsetX = (view.width - CONFIG.CANVAS_WIDTH) / 2;
}
