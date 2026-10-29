import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Flame, Percent } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ProgressBar from "../components/ProgressBar";
import PlanGlance from "../components/PlanGlance";
import { isActive } from "../services/scheduling";
import { dayDate, formatDate, pct, roadmapDayForDate } from "../utils/dates";

const sourceOf = t => (t.source === "roadmap" || t.topicId) ? "Roadmap topics" : t.scheduleId ? "Timetable & rules" : "Added manually";
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
const levelOf = d => d.total === 0 ? "none" : d.done === 0 ? "l0" : d.done === d.total ? "l3" : d.done / d.total >= .5 ? "l2" : "l1";

export default function Analytics({ state, setSelectedDay, navigate }) {
  const startDate = state.settings.startDate;
  const duration = Number(state.settings.durationDays) || 60;
  const today = roadmapDayForDate(startDate);
  const lastDay = Math.min(duration, today);          // days that have started
  const [range, setRange] = useState("30");
  const [shown, setShown] = useState(10);

  // one row per plan day (cheap even for 365 days)
  const perDay = useMemo(() => Array.from({ length: duration }, (_, i) => {
    const tasks = (state.days[i + 1]?.tasks || []).filter(isActive);
    return { day: i + 1, tasks, total: tasks.length, done: tasks.filter(t => t.status === "completed").length,
      minutes: tasks.reduce((n, t) => n + (t.workLogs || []).reduce((m, l) => m + (Number(l.minutes) || 0), 0), 0) };
  }), [state.days, duration]);

  const options = [["7", "Last 7 days"], ["30", "Last 30 days"], ...(lastDay > 90 ? [["90", "Last 90 days"]] : []), ...(lastDay > 180 ? [["180", "Last 180 days"]] : []), ["all", "All so far"]];
  const n = range === "all" ? lastDay : Math.min(Number(range), lastDay);
  const rangeStart = Math.max(1, lastDay - n + 1);
  const rangeDays = lastDay >= 1 ? perDay.slice(rangeStart - 1, lastDay) : [];

  const total = rangeDays.reduce((s, d) => s + d.total, 0);
  const done = rangeDays.reduce((s, d) => s + d.done, 0);
  const minutes = rangeDays.reduce((s, d) => s + d.minutes, 0);
  const activeDays = rangeDays.filter(d => d.done > 0).length;
  const streak = useMemo(() => {
    let d = lastDay, count = 0;
    if (d >= 1 && perDay[d - 1].done === 0) d--;       // today may not have a finished task yet
    while (d >= 1 && perDay[d - 1].done > 0) { count++; d--; }
    return count;
  }, [perDay, lastDay]);

  const byType = useMemo(() => {
    const map = {};
    rangeDays.forEach(d => d.tasks.forEach(t => { const k = sourceOf(t); map[k] = map[k] || { total: 0, done: 0 }; map[k].total++; if (t.status === "completed") map[k].done++; }));
    return Object.entries(map);
  }, [rangeDays]);

  const weeks = useMemo(() => {
    const out = [];
    for (let w = 0; w * 7 < lastDay; w++) {
      const slice = perDay.slice(w * 7, Math.min(lastDay, w * 7 + 7));
      const t = slice.reduce((s, d) => s + d.total, 0), dn = slice.reduce((s, d) => s + d.done, 0);
      out.push({ w: w + 1, total: t, done: dn, pct: pct(dn, t) });
    }
    return out;
  }, [perDay, lastDay]);

  const list = [...rangeDays].reverse().filter(d => d.total > 0);
  const open = d => { setSelectedDay?.(d); navigate?.("/daily"); };

  return <>
    <PageHeader eyebrow="YOUR PROGRESS" title="Analytics" description="See how you are doing across your plan — from one week to a full year." />

    {lastDay < 1 ? <div className="empty-state panel"><h3>Your plan hasn't started yet</h3><p>Analytics begin on {formatDate(dayDate(startDate, 1))}.</p></div> : <>
      <div className="range-bar" role="group" aria-label="Date range">{options.map(([id, text]) => <button key={id} type="button" className={`filter-chip ${range === id ? "selected" : ""}`} onClick={() => { setRange(id); setShown(10); }}>{text}</button>)}<span className="range-note">Day {rangeStart}–{lastDay} · {formatDate(dayDate(startDate, rangeStart))} → {formatDate(dayDate(startDate, lastDay))}</span></div>

      <div className="stats-grid four">
        <Stat icon={Percent} label="Completion rate" value={`${pct(done, total)}%`} helper={`${activeDays} active day${activeDays === 1 ? "" : "s"}`} />
        <Stat icon={CheckCircle2} tone="blue" label="Tasks completed" value={`${done} / ${total}`} helper="in this range" />
        <Stat icon={Flame} tone="orange" label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} helper="days with a finished task" />
        <Stat icon={Clock3} tone="purple" label="Time logged" value={minutes ? fmtMin(minutes) : "—"} helper="from work logs" />
      </div>

      <PlanGlance state={state} onOpenDay={open} />

      <div className="analytics-split">
        <section className="panel"><div className="panel-heading"><div><h2>Week by week</h2><p>Completion rate of each week so far</p></div></div>
          <div className="week-chart" role="img" aria-label="Weekly completion chart">{weeks.map(w => <div className="week-col" key={w.w} title={`Week ${w.w}: ${w.done}/${w.total} (${w.pct}%)`}><span className="week-val">{w.total ? `${w.pct}` : ""}</span><div className="week-bar-wrap"><div className="week-bar" style={{ height: `${Math.max(w.total ? 4 : 0, w.pct)}%` }} /></div><span className="week-lab">W{w.w}</span></div>)}</div>
        </section>
        <section className="panel"><div className="panel-heading"><div><h2>By type</h2><p>Where your tasks come from</p></div></div>
          {byType.length ? byType.map(([name, v]) => <div className="type-row" key={name}><div><strong>{name}</strong><small>{v.done} of {v.total} done</small></div><ProgressBar value={pct(v.done, v.total)} /><b>{pct(v.done, v.total)}%</b></div>) : <div className="empty-state small"><p>No tasks in this range.</p></div>}
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading"><div><h2>Daily completion</h2><p>{list.length} day{list.length === 1 ? "" : "s"} with tasks in this range, newest first</p></div></div>
        {list.length ? <>
          {list.slice(0, shown).map(d => <button type="button" className="analytics-day clickable-row" key={d.day} onClick={() => open(d.day)}><div><strong>Day {d.day}</strong><small>{formatDate(dayDate(startDate, d.day))}</small></div><ProgressBar value={pct(d.done, d.total)} /><b>{pct(d.done, d.total)}%</b></button>)}
          {list.length > shown && <div className="show-more"><button type="button" className="button secondary" onClick={() => setShown(s => s + 20)}>Show 20 more</button><button type="button" className="link-button" onClick={() => setShown(list.length)}>Show all {list.length}</button></div>}
        </> : <div className="empty-state small"><h3>No activity in this range</h3><p>Complete tasks in Daily Tracker to see progress here.</p></div>}
      </section>
    </>}
  </>;
}
function Stat({ icon: Icon, label, value, helper, tone = "" }) { return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>; }
