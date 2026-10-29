import ActivityHeatmap, { HeatmapLegend } from "./ActivityHeatmap";

// Full-screen start-up screen: the large animated heatmap. It stays up while the app really loads (see App.jsx) and
// fades out (`leaving`) once auth + data are ready. Its look is mirrored by the first-paint loader in index.html.
export default function SplashScreen({ leaving = false, label = "Loading…" }) {
  return <div className={`splash${leaving ? " is-leaving" : ""}`} role="status" aria-live="polite" aria-busy={!leaving}>
    <div className="splash-inner">
      <div className="splash-brand"><span className="splash-mark"><img src="/Plan%20at%20a%20Glance%20Heatmap.png" alt="" /></span><span><b>Job-Ready</b><small>Tracker</small></span></div>
      <div className="splash-card">
        <div className="splash-head"><p className="splash-title">Plan at a glance</p><span>365 days</span></div>
        <ActivityHeatmap />
        <HeatmapLegend />
      </div>
      <p className="splash-label">{label}</p>
    </div>
  </div>;
}
