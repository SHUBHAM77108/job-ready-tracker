import { useMemo, useState } from "react";
import { ChevronDown, FileText, NotebookPen, Search } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import ProgressBar from "../components/ProgressBar";
import { realLogs } from "../components/TaskDetail";
import { isActive } from "../services/scheduling";
import { dayDate, formatDate, pct, roadmapDayForDate } from "../utils/dates";

const FILTERS = [["all", "All days"], ["complete", "Fully done"], ["unfinished", "Unfinished"], ["notes", "Notes / logs"]];
const monthLabel = key => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export default function History({ state, setSelectedDay, navigate }) {
  const startDate = state.settings.startDate;
  const duration = Number(state.settings.durationDays) || 60;
  const today = roadmapDayForDate(startDate);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [upcoming, setUpcoming] = useState(false);
  const [openMonths, setOpenMonths] = useState({});

  const entries = useMemo(() => Object.entries(state.days).map(([d, v]) => {
    const day = Number(d), tasks = (v?.tasks || []).filter(isActive);
    return { day, tasks, total: tasks.length, done: tasks.filter(t => t.status === "completed").length,
      logs: tasks.reduce((n, t) => n + realLogs(t).length, 0), note: (v?.note || "").trim(), leetcode: Number(v?.leetcode) || 0 };
  }).filter(e => e.day >= 1 && e.day <= duration && (upcoming || e.day <= today) && (e.total || e.note || e.leetcode)), [state.days, duration, today, upcoming]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter(e => {
      if (filter === "complete" && !(e.total && e.done === e.total)) return false;
      if (filter === "unfinished" && !(e.total && e.done < e.total)) return false;
      if (filter === "notes" && !(e.note || e.logs)) return false;
      if (needle && !(e.note.toLowerCase().includes(needle) || e.tasks.some(t => `${t.name} ${t.description || ""}`.toLowerCase().includes(needle)))) return false;
      return true;
    }).sort((a, b) => b.day - a.day);
  }, [entries, q, filter]);

  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach(e => { const key = dayDate(startDate, e.day).slice(0, 7); if (!map.has(key)) map.set(key, []); map.get(key).push(e); });
    return [...map.entries()];
  }, [visible, startDate]);

  const open = d => { setSelectedDay(d); navigate("/daily"); };
  const totalDone = visible.reduce((n, e) => n + e.done, 0), totalTasks = visible.reduce((n, e) => n + e.total, 0);
  const isOpen = (key, i) => key in openMonths ? openMonths[key] : (i === 0 || !!q.trim());

  return <>
    <PageHeader eyebrow="ACTIVITY HISTORY" title="History" description="Look back at any day: what you finished, what you wrote and what is still open." action={today >= 1 && today <= duration ? <Button variant="secondary" onClick={() => open(today)}>Open today</Button> : null} />
    <section className="panel">
      <div className="history-toolbar">
        <label className="search-pill grow"><Search size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tasks or notes…" aria-label="Search history" /></label>
        <label className="check-pill"><input type="checkbox" checked={upcoming} onChange={e => setUpcoming(e.target.checked)} /> Include upcoming days</label>
      </div>
      <div className="range-bar" role="group" aria-label="Filter">{FILTERS.map(([id, text]) => <button key={id} type="button" className={`filter-chip ${filter === id ? "selected" : ""}`} onClick={() => setFilter(id)}>{text}</button>)}</div>
      <p className="history-summary">{visible.length} day{visible.length === 1 ? "" : "s"} · {totalDone} of {totalTasks} tasks completed</p>

      {groups.length ? groups.map(([key, rows], i) => {
        const o = isOpen(key, i), md = rows.reduce((n, r) => n + r.done, 0), mt = rows.reduce((n, r) => n + r.total, 0);
        return <div className="month-group" key={key}>
          <button type="button" className="month-head" aria-expanded={o} onClick={() => setOpenMonths(m => ({ ...m, [key]: !o }))}><ChevronDown size={16} className={o ? "open" : ""} /><strong>{monthLabel(key)}</strong><span>{rows.length} day{rows.length === 1 ? "" : "s"} · {md}/{mt} done</span></button>
          {o && <div className="month-body">{rows.map(e => <button type="button" className="history-row" key={e.day} onClick={() => open(e.day)}>
            <span className="hist-day"><b>{e.day}</b><small>Day</small></span>
            <span className="hist-main"><strong>{formatDate(dayDate(startDate, e.day))}</strong><span className="hist-bar"><ProgressBar value={pct(e.done, e.total)} /></span></span>
            <span className="hist-meta"><span className="hist-count">{e.done} / {e.total} tasks</span>{e.logs > 0 && <span className="hist-chip" title="Work logs"><NotebookPen size={12} /> {e.logs}</span>}{e.note && <span className="hist-chip" title="Has notes"><FileText size={12} /></span>}</span>
            <b className="hist-arrow">→</b>
          </button>)}</div>}
        </div>;
      }) : <div className="empty-state small"><h3>{entries.length ? "Nothing matches your filters" : "No activity history yet"}</h3><p>{entries.length ? "Try a different search or filter." : "Your days will appear here after you add tasks or notes."}</p></div>}
    </section>
  </>;
}
