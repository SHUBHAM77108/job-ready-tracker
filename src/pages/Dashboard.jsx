import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, FolderKanban, Lock, NotebookPen, Plus, Repeat, Star } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ProgressBar from "../components/ProgressBar";
import Button from "../components/Button";
import PlanGlance from "../components/PlanGlance";
import { realLogs } from "../components/TaskDetail";
import { MAX_PLAN_DAYS, changeDuration, clusterTasks, isActive, isDayLocked, priorityOf, taskRange } from "../services/scheduling";
import { formatDate, pct, roadmapDayForDate, dayDate } from "../utils/dates";

const STATUS_TEXT = { completed: "Done", progress: "In progress", paused: "Paused", pending: "Pending", skipped: "Skipped", ready: "Ready", upcoming: "Upcoming" };
const sourceOf = t => (t.source === "roadmap" || t.topicId) ? "roadmap" : t.scheduleId ? "timetable" : "manual";
const MAX_ROWS = 12;

export default function Dashboard({ state, update, flash, selectedDay, setSelectedDay, navigate }) {
  const startDate = state.settings.startDate;
  const today = roadmapDayForDate(startDate);
  const duration = Number(state.settings.durationDays) || 60;
  const actualDay = Math.max(1, Math.min(duration, today));
  const date = dayDate(startDate, selectedDay);
  const tasks = state.days[selectedDay]?.tasks || [];
  const done = tasks.filter(t => t.status === "completed").length;
  const total = Object.values(state.days).reduce((sum, d) => sum + (d.tasks || []).length, 0);
  const complete = Object.values(state.days).reduce((sum, d) => sum + (d.tasks || []).filter(t => t.status === "completed").length, 0);
  const locked = isDayLocked(selectedDay, today, state.unlockedDays);
  const roadmapToday = tasks.filter(t => sourceOf(t) === "roadmap");
  const open = () => { setSelectedDay(selectedDay); navigate("/daily"); };

  // "Now" / "Up next" (only meaningful for the real today)
  let upNext = null;
  if (selectedDay === today) {
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    const live = tasks.filter(t => isActive(t) && t.status !== "completed").map(t => ({ t, r: taskRange(t) })).filter(x => x.r);
    const current = live.find(x => x.r[0] <= nowMin && nowMin < x.r[1]);
    const next = live.filter(x => x.r[0] > nowMin).sort((a, b) => a.r[0] - b.r[0])[0];
    upNext = current ? { kind: "Now", task: current.t } : next ? { kind: "Up next", task: next.t } : null;
  }

  const groups = clusterTasks(tasks);
  let rowCount = 0;
  const renderRow = t => {
    const logs = realLogs(t), src = sourceOf(t), pr = priorityOf(t);
    return <button type="button" key={t.id} className={`sched-item st-${t.status || "upcoming"} ${t.status === "completed" ? "is-done" : ""}`} onClick={open} title="Open in Daily tracker">
      <span className="sched-time"><b>{t.start || "Flexible"}</b>{t.end && <small>{t.end}</small>}</span>
      <span className="sched-body">
        <span className="sched-title">{t.name}
          {src === "roadmap" && <span className="src-badge roadmap"><BookOpen size={11} /> Roadmap</span>}
          {src === "timetable" && <span className="src-badge timetable"><Repeat size={11} /> Timetable</span>}
          {pr === "high" && <span className="src-badge priority"><Star size={11} /> Priority</span>}
        </span>
        {t.description && <span className="sched-desc">{t.description}</span>}
        {logs.length > 0 && <span className="sched-meta"><NotebookPen size={12} /> {logs.length} work log{logs.length === 1 ? "" : "s"}</span>}
      </span>
      <span className={`status-pill st-${t.status || "upcoming"} ${t.status === "completed" ? "success" : "muted"}`}>{STATUS_TEXT[t.status || "upcoming"] || t.status}</span>
    </button>;
  };

  return <>
    <PageHeader eyebrow="YOUR CAREER WORKSPACE" title="Build skills. Get job ready." description="Stay consistent, build real projects and track your progress." action={<span className="date-chip"><CalendarDays size={16} />{formatDate(date)}</span>} />

    {today > duration && <div className="plan-banner"><div><strong>Your {duration}-day plan is complete.</strong><span>{duration < MAX_PLAN_DAYS ? "Extend it to keep your timetable and roadmap going." : `You have reached the ${MAX_PLAN_DAYS}-day maximum. Set a new start date in Settings to begin again.`}</span></div>
      {duration < MAX_PLAN_DAYS ? <Button onClick={() => { const nd = Math.min(MAX_PLAN_DAYS, duration + 30); update(s => changeDuration(s, nd, true)); flash(`Plan extended to ${nd} days.`); }}><Plus size={14} /> Extend by {Math.min(30, MAX_PLAN_DAYS - duration)} days</Button> : <Button variant="secondary" onClick={() => navigate("/settings")}>Open settings</Button>}</div>}

    <div className="stats-grid four">
      <Stat icon={CalendarDays} label="Roadmap day" value={`${actualDay} / ${duration}`} helper={today < 1 ? "Plan hasn't started" : today > duration ? "Plan complete" : "Based on start date"} />
      <Stat icon={CheckCircle2} label="Selected day's tasks" value={`${done} / ${tasks.length}`} helper="Completed tasks" tone="blue" />
      <Stat icon={BookOpen} label="Roadmap topics" value={state.roadmap.length} helper={roadmapToday.length ? `${roadmapToday.filter(t => t.status === "completed").length}/${roadmapToday.length} learned today` : "Personal learning plan"} tone="purple" />
      <Stat icon={FolderKanban} label="Projects" value={state.projects.length} helper={`${state.projects.filter(p => p.status === "Completed").length} completed`} tone="orange" />
    </div>

    {upNext && <div className={`upnext ${upNext.kind === "Now" ? "now" : ""}`}><span className="upnext-kind">{upNext.kind}</span><div><strong>{upNext.task.name}</strong><span>{upNext.task.start}{upNext.task.end ? ` – ${upNext.task.end}` : ""}{upNext.task.description ? ` · ${upNext.task.description}` : ""}</span></div><button type="button" className="link-button" onClick={open}>Open <ChevronRight size={14} /></button></div>}

    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-heading"><div><h2>Selected day's schedule</h2><p>{selectedDay === today ? "Today" : `Day ${selectedDay} · ${formatDate(date)}`} · {tasks.length} task{tasks.length === 1 ? "" : "s"}</p></div><button className="link-button" onClick={open}>Open tracker <ChevronRight size={15} /></button></div>
        {locked && <div className="lock-note"><Lock size={14} /> This day is in the future and locked. You can unlock it in the Daily tracker.</div>}
        {tasks.length ? <div className="sched-list">
          {groups.map((group, gi) => {
            if (rowCount >= MAX_ROWS) return null;
            const clash = group.filter(isActive).length > 1;
            const rows = group.map(t => { rowCount++; return renderRow(t); });
            return clash ? <div className="sched-cluster" key={gi}><div className="cluster-label">Same time · {group.length} tasks</div>{rows}</div> : rows;
          })}
          {tasks.length > MAX_ROWS && <button type="button" className="show-all" onClick={open}>View all {tasks.length} tasks in Daily tracker <ChevronRight size={14} /></button>}
        </div> : <div className="empty-state small"><h3>No tasks for this day</h3><p>Add tasks in Daily Tracker or import a timetable.</p><Button onClick={() => navigate("/daily")}>Open daily tracker</Button></div>}
      </section>

      <div className="dashboard-side">
        <PlanGlance fluid state={state} onOpenDay={d => { setSelectedDay(d); navigate("/daily"); }} />
      <section className="panel">
        <div className="panel-heading"><div><h2>Progress overview</h2><p>Across all saved daily tasks</p></div></div>
        <div className="big-progress"><strong>{pct(complete, total)}%</strong><span>completed</span></div>
        <ProgressBar value={pct(complete, total)} />
        <p className="muted-text">{complete} of {total} task records completed.</p>
        <div className="quick-actions">
          <button onClick={() => navigate("/roadmap")}><BookOpen size={17} /> Edit personal roadmap <ChevronRight size={15} /></button>
          <button onClick={() => navigate("/projects")}><FolderKanban size={17} /> Manage projects <ChevronRight size={15} /></button>
          <button onClick={() => navigate("/resources")}><CalendarDays size={17} /> Import timetable <ChevronRight size={15} /></button>
        </div>
      </section>
      </div>
    </div>
  </>;
}
function Stat({ icon: Icon, label, value, helper, tone = "" }) { return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>; }
