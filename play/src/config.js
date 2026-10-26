// Every tunable number of the game. Units: logical pixels (the world is 640 units tall) and seconds.
export const C = Object.freeze({
  H: 640,                  // logical world height
  GROUND_Y: 572,           // sea surface; touching it ends the run
  MIN_W: 270,              // narrowest logical width (taller screens get letterboxed)
  MAX_W: 720,              // widest logical width (wider screens get side bands)
  MAX_BACKING_PIXELS: 2600000, // cap on canvas backing-store pixels (keeps fill cost bounded)

  STEP: 1 / 120,           // fixed physics step
  MAX_FRAME_DT: 0.25,      // clamp after stalls / background tabs

  GRAVITY: 1800,           // units/s^2
  FLAP_V: -500,            // units/s, set (not added) on flap: ~69 units rise, apex after 0.28 s
  MAX_FALL: 740,           // terminal fall speed
  BIRD_R: 12,              // collision circle radius (sprite is ~31 x 25, so hits feel fair)
  BIRD_X_FRAC: 0.3,        // bird x = 30% of view width, clamped below
  BIRD_X_MIN: 72,
  BIRD_X_MAX: 216,
  BIRD_HOVER_Y: 290,

  PILLAR_W: 76,            // rock column width
  CAP_H: 26,               // grassy cap height at the gap edge
  CAP_OVER: 6,             // cap overhang on each side
  GAP_MARGIN_TOP: 64,      // min distance from screen top to gap top
  GAP_MARGIN_BOTTOM: 56,   // min distance from gap bottom to sea

  // Difficulty: d = smoothstep(score / DIFF_FULL_SCORE); each value goes START -> END
  DIFF_FULL_SCORE: 50,
  GAP_START: 180, GAP_END: 146,
  SPEED_START: 150, SPEED_END: 200,
  SPACING_START: 270, SPACING_END: 230,
  MAX_RISE_START: 120, MAX_RISE_END: 170,   // how much higher the next gap centre may be
  MAX_DROP_START: 110, MAX_DROP_END: 140,   // how much lower (drops are capped tighter: a flap
                                            // just before a drop costs time)
  MOVE_FROM_SCORE: 25,     // from this score half the columns bob up and down
  MOVE_AMP_STEP: 1.5,      // +1.5 units amplitude per point after MOVE_FROM_SCORE
  MOVE_AMP_MAX: 28,
  MOVE_SPEED: 1.4,         // rad/s
  FIRST_PILLAR_LEAD: 420,  // first column is at least this far right of the bird

  OVER_DELAY: 0.5,         // s between splash and the game-over panel
  RESTART_LOCK_MS: 600,    // ignore restart input this long after game over
  RESUME_COUNTDOWN: 0.9,   // 3-2-1 after un-pausing (0.3 s each)
  PALETTE_EVERY: 10,       // sky changes dawn -> day -> sunset -> night every 10 points
  PALETTE_BLEND_S: 2.5,
  MEDALS: [[50, 'platinum'], [30, 'gold'], [20, 'silver'], [10, 'bronze']],
});
