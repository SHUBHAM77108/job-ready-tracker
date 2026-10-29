// Full-screen loader: the same "Plan at a glance" card as on the login page, with the days blinking on and off while
// the app / your data loads. Its styles live in index.html so the very first paint (before the bundle) looks identical.
const level = (i) => { const v = (i * 2654435761) >>> 0; const h = v % 100; return h < 18 ? 0 : h < 38 ? 1 : h < 62 ? 2 : h < 84 ? 3 : 4; };
export const ART_LEVELS = Array.from({ length: 365 }, (_, i) => level(i));

// Static 365-day grid used by the login page's right-hand card (no animation there).
export function ArtGrid() {
  return <div className="art-heat" aria-hidden="true">{ART_LEVELS.map((l, i) => <i key={i} className={`art-cell l${l}`} />)}</div>;
}

export default function GlanceLoader({ label = "Loading your workspace…" }) {
  return <div className="jr-boot" role="status" aria-live="polite" aria-label={label}>
    <div className="jr-brand"><span className="jr-mark"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" /></svg></span><span><b>Job-Ready</b><small>Tracker</small></span></div>
    <div className="jr-card"><div className="jr-card-head"><b>Plan at a glance</b><span>365 days</span></div>
      <div className="jr-grid" aria-hidden="true">{ART_LEVELS.map((l, i) => <i key={i} className={`jr-cell${l ? ` l${l}` : ""}`} style={{ "--d": `${((i * 7919) % 2400) / 1000}s`, "--t": `${2.2 + ((i * 104729) % 1600) / 1000}s` }} />)}</div>
      <div className="jr-foot"><span>Less</span><i className="jr-cell" /><i className="jr-cell l1" /><i className="jr-cell l2" /><i className="jr-cell l3" /><i className="jr-cell l4" /><span>More</span></div>
    </div>
    <p className="jr-label">{label}</p>
  </div>;
}
