import { useEffect, useState } from "react";

// Live clock shared by the pages that show "now / next" task status. Refreshes every 30 s and when the tab becomes visible again.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [intervalMs]);
  return now;
}
