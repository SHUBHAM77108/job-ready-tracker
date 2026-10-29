import "../styles/heatmap.css";

// The "Plan at a glance" preview grid used on the splash screen (large) and on the login page hero (small).
// It is purely decorative — a fixed pattern that is NOT your activity — so it is hidden from assistive tech.
// Size comes from the container (cells are square and fill the width); `gap`, `cols` and `animated` are configurable.
export const HEATMAP_COLS = 21;
export const HEATMAP_ROWS = 7;

// small seeded PRNG so the pattern is identical on every render (and in index.html's first-paint copy)
const rand = (seed) => { let t = (seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const cache = new Map();
function buildCells(count) {
  if (cache.has(count)) return cache.get(count);
  const cells = Array.from({ length: count }, (_, i) => {
    const a = rand(i * 4 + 1), b = rand(i * 4 + 2), c = rand(i * 4 + 3), d = rand(i * 4 + 4);
    const level = a < 0.16 ? 0 : a < 0.38 ? 1 : a < 0.62 ? 2 : a < 0.84 ? 3 : 4;
    const options = [0, 1, 2, 3, 4].filter((l) => l !== level && Math.abs(l - level) <= 2);
    const to = options[Math.floor(b * options.length)];
    const dur = 3.4 + d * 4.6;                       // 3.4 – 8 s per cycle, different for every cell
    return { level, to, live: c < 0.62, dur: dur.toFixed(2), delay: (-(rand(i * 4 + 5) * dur)).toFixed(2) };   // negative delay = already mid-cycle on first paint
  });
  cache.set(count, cells);
  return cells;
}

export default function ActivityHeatmap({ cols = HEATMAP_COLS, rows = HEATMAP_ROWS, gap, animated = true, className = "" }) {
  const cells = buildCells(cols * rows);
  return <div className={`ah ${className}`} style={{ "--cols": cols, ...(gap ? { "--ah-gap": gap } : null) }} aria-hidden="true">
    {cells.map((c, i) => <i key={i} className={`ah-cell${animated && c.live ? " is-live" : ""}`} style={{ "--from": `var(--ah-${c.level})`, "--to": `var(--ah-${c.to})`, "--t": `${c.dur}s`, "--d": `${c.delay}s` }} />)}
  </div>;
}

export function HeatmapLegend({ className = "" }) {
  return <div className={`ah-legend ${className}`} aria-hidden="true"><span>Less</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} style={{ background: `var(--ah-${l})` }} />)}<span>More</span></div>;
}
