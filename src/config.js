// =====================================================
// Run to My Love - Game Configuration
// Change values here to customize the game.
// =====================================================

// ----- The two dates the whole game is built on (YYYY-MM-DD) -----
const RELATIONSHIP_START_DATE = "2014-03-13";
const WEDDING_DAY = "2026-11-14";

// Calendar days between two YYYY-MM-DD dates (UTC, so daylight saving never shifts it)
function daysBetween(from, to) {
  const toUtc = (date) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(to) - toUtc(from)) / (24 * 60 * 60 * 1000));
}

// Days from the start date to its Nth anniversary (leap days included)
function daysToAnniversary(years) {
  const [year, month, day] = RELATIONSHIP_START_DATE.split("-").map(Number);
  const anniversary = `${year + years}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return daysBetween(RELATIONSHIP_START_DATE, anniversary);
}

// "2026-11-14" -> "14 November 2026"
function formatDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  const name = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
    "en-GB",
    {
      month: "long",
      timeZone: "UTC",
    },
  );
  return `${day} ${name} ${year}`;
}

// 1 point = 1 day together, so the finish line is the wedding day (4,629 days)
const TARGET_SCORE = daysBetween(RELATIONSHIP_START_DATE, WEDDING_DAY);

export const CONFIG = Object.freeze({
  // ----- Story / Text -----
  GAME_TITLE: "Run to My Love",
  // {years} and {days} are counted from RELATIONSHIP_START_DATE to WEDDING_DAY
  GAME_SUBTITLE: "{years} Years, {days} Days, One Love.",
  RELATIONSHIP_START_DATE,
  WEDDING_DAY,
  GROOM_NAME: "Moo",
  BRIDE_NAME: "Bee",
  WEDDING_DATE: formatDate(WEDDING_DAY), // shown on the ending screen
  ENDING_TITLE: "We are getting married!",
  ENDING_MESSAGE: "Thank you for playing & celebrating with us!",

  // ----- Canvas (logical resolution, 16:9) -----
  CANVAS_WIDTH: 480,
  CANVAS_HEIGHT: 270,
  GROUND_Y: 226, // y position of the top of the ground

  // ----- Font -----
  // Pixel font in assets/fonts (loaded by style.css), monospace until it is ready
  FONT_FAMILY: "'Pixelify Sans', monospace",

  // ----- Scoring (1 point = 1 day together) -----
  TARGET_SCORE, // reach this to win (worked out from the two dates above)
  PASSIVE_SCORE_PER_SECOND: 64,
  HEART_SCORE: 120,
  // A banner appears when the score passes each value (real anniversaries)
  MILESTONES: Object.freeze([
    { score: daysToAnniversary(3), text: "3 Years Together!" },
    { score: daysToAnniversary(6), text: "6 Years Together!" },
    { score: daysToAnniversary(9), text: "9 Years Together!" },
    { score: TARGET_SCORE, text: "Wedding Day! You made it!" },
  ]),

  // ----- Health -----
  STARTING_LIVES: 3,
  INVULNERABILITY_DURATION: 1, // seconds

  // ----- Physics (pixels per second) -----
  GRAVITY: 1400,
  JUMP_FORCE: 480,
  DOUBLE_JUMP_FORCE: 460, // second jump in the air (with a front flip)
  SLIDE_DURATION: 0.6, // seconds the groom stays low when sliding
  FAST_FALL_MULTIPLIER: 3, // pressing slide in the air pulls the groom down faster

  // ----- Touch controls (phones) -----
  // 'left' = Cookie Run style (JUMP on the left, SLIDE on the right)
  // 'right' = JUMP on the right, SLIDE on the left
  TOUCH_JUMP_SIDE: "left",

  // ----- Obstacles -----
  OBSTACLE_SPEED: 150, // world scroll speed in pixels per second
  OBSTACLE_SPAWN_INTERVAL: 1.6, // seconds (base value)
  // Difficulty goes up a little after each milestone (index = milestones passed).
  // speed: world speed multiplier. spawn: gap between obstacles (smaller = more obstacles).
  DIFFICULTY_LEVELS: Object.freeze([
    { speed: 1.0, spawn: 1.0 }, // 150 px/s
    { speed: 1.25, spawn: 0.92 }, // 188 px/s
    { speed: 1.5, spawn: 0.85 }, // 225 px/s
    { speed: 1.7, spawn: 0.8 }, // 255 px/s
  ]),

  // ----- Audio (0.0 - 1.0) -----
  MUSIC_VOLUME: 0.4,
  SFX_VOLUME: 0.7,

  // ----- Game loop -----
  MAX_DELTA_TIME: 0.05, // cap delta time (seconds) after tab switching

  // ----- Debug -----
  SHOW_FPS: false,

  // ----- Colors (wedding hall palette) -----
  COLORS: Object.freeze({
    CEILING: "#3d0c19",
    WALL: "#7a1c32",
    WALL_PATTERN: "#8a2640",
    WAINSCOT: "#5a1124",
    WAINSCOT_PANEL: "#6b182d",
    GOLD: "#e8c26a",
    GOLD_DARK: "#b08a3e",
    GOLD_LIGHT: "#fff1b8",
    GLOW: "#ffe6a0",
    WINDOW: "#2b2856",
    WINDOW_LIGHT: "#433f7e",
    STAR: "#fff8ef",
    DRAPE: "#fbf7f2",
    DRAPE_SHADOW: "#e3d8d0",
    CRYSTAL: "#dff3ff",
    FLAME: "#ffcf5a",
    CARPET: "#503117c9",
    CARPET_DARK: "#e8d6bb",
    MARBLE: "#d8c09a",
    MARBLE_DARK: "#c4a77c",
    PETAL: "#f28bb0",
    PETAL_WHITE: "#d9466a",
    TEXT: "#fff1b8",
    TEXT_SHADOW: "#3d0c19",
  }),
});
