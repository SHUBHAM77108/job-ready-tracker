import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Lock, NotebookPen,
  FileSpreadsheet, Pencil, Play, Plus, Repeat, Save, Search, Star, Trash2,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import Modal from "../components/Modal";
import ConflictDialog from "../components/ConflictDialog";
import TaskDetail, { realLogs } from "../components/TaskDetail";
import {
  MAX_PLAN_DAYS, changeDuration, clusterTasks, findConflicts, isActive, isDayLocked, overlapKind, overlapText,
  priorityOf, setTopicCompleted, timeLabel,
} from "../services/scheduling";
import { dayDate, formatDate, makeId, pct, roadmapDayForDate } from "../utils/dates";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const STATUS_OPTIONS = [["upcoming", "Upcoming"], ["ready", "Ready"], ["progress", "In progress"], ["paused", "Paused"], ["completed", "Completed"], ["pending", "Pending"], ["skipped", "Skipped"]];
const asDate = (ds) => new Date(`${ds}T00:00:00`);
const longDate = (ds) => asDate(ds).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const weekdayShort = (ds) => asDate(ds).toLocaleDateString("en-IN", { weekday: "short" });
const monthShort = (ds) => asDate(ds).toLocaleDateString("en-IN", { month: "short" });
const blankTask = () => ({ id: makeId(), name: "", description: "", start: "09:00", end: "10:00", status: "upcoming", workLogs: [], required: true, priority: "normal" });
const sourceOf = (t) => (t.source === "roadmap" || t.topicId) ? "roadmap" : t.scheduleId ? "timetable" : "manual";

export default function DailyTracker({ state, update, selectedDay, setSelectedDay, flash }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [targetDay, setTargetDay] = useState(selectedDay);
  const [detail, setDetail] = useState(null);
  const [conflict, setConflict] = useState(null);   // {destination, hits, task}
  const [pick, setPick] = useState("none");         // which clashing task gets priority
  const [unlockAsk, setUnlockAsk] = useState(null); // {run}

  const startDate = state.settings.startDate;
  const duration = Number(state.settings.durationDays) || 60;
  const today = roadmapDayForDate(startDate);
  const unlocked = state.unlockedDays || [];
  const locked = isDayLocked(selectedDay, today, unlocked);
  const date = dayDate(startDate, selectedDay);
  const day = state.days[selectedDay] || { tasks: [], note: "" };
  const tasks = Array.isArray(day.tasks) ? day.tasks : [];
  const detailTask = detail ? tasks.find(t => t.id === detail) || null : null;
  const filtered = useMemo(() => tasks.filter(t => !search || `${t.name} ${t.description}`.toLowerCase().includes(search.toLowerCase())), [tasks, search]);
  const roadmapTasks = tasks.filter(t => sourceOf(t) === "roadmap");
  // A brand-new account has nothing yet: show a clear starting point instead of an empty "Day 1 of N" calendar.
  const hasAnyData = useMemo(() => Object.values(state.days || {}).some(d => (d?.tasks || []).length || (d?.note || "").trim())
    || (state.schedules || []).length > 0 || (state.roadmaps || []).some(r => (r.topics || []).length) || (state.roadmap || []).length > 0, [state.days, state.schedules, state.roadmaps, state.roadmap]);
  const openTasks = tasks.filter(t => isActive(t) && t.status !== "completed").length;

  const done = tasks.filter(t => t.status === "completed").length;
  const requiredTasks = tasks.filter(t => t.required !== false);
  const requiredDone = requiredTasks.filter(t => t.status === "completed").length;
  const label = selectedDay === today ? "Today" : selectedDay < today ? "Past day" : unlocked.includes(selectedDay) ? "Unlocked early" : "Upcoming day";

  /* ---------- earlier days that still have unfinished required tasks ---------- */
  const missed = useMemo(() => {
    const out = [];
    for (let d = Math.min(today - 1, duration); d >= 1 && out.length < 5; d--) {
      const left = (state.days[d]?.tasks || []).filter(t => t.required !== false && isActive(t) && t.status !== "completed");
      if (left.length) out.push({ day: d, count: left.length });
    }
    return out;
  }, [state.days, today, duration]);

  /* ---------- day lock: browse any day, but future days need an unlock before tasks can be worked on ---------- */
  const guard = (fn) => (...args) => {
    if (locked) { setUnlockAsk({ run: () => fn(...args) }); return; }
    fn(...args);
  };
  const unlockDay = () => {
    const run = unlockAsk?.run;
    update(s => ({ ...s, unlockedDays: [...new Set([...(s.unlockedDays || []), selectedDay])] }));
    flash(`Day ${selectedDay} unlocked. You can work on it now.`);
    setUnlockAsk(null);
    run?.();
  };
  const relock = () => update(s => ({ ...s, unlockedDays: (s.unlockedDays || []).filter(d => d !== selectedDay) }));

  /* ---------- task actions ---------- */
  const changeTasks = next => update(s => ({ ...s, days: { ...s.days, [selectedDay]: { ...(s.days[selectedDay] || {}), tasks: typeof next === "function" ? next(s.days[selectedDay]?.tasks || []) : next } } }));
  const status = (taskId, next) => {
    update(s => {
      const list = s.days[selectedDay]?.tasks || [];
      const task = list.find(t => t.id === taskId);
      let ns = { ...s, days: { ...s.days, [selectedDay]: { ...(s.days[selectedDay] || {}), tasks: list.map(t => t.id === taskId ? { ...t, status: next, ...(next === "progress" ? { startedAt: new Date().toISOString(), pausedAt: null } : {}), ...(next === "completed" ? { completedAt: new Date().toISOString() } : {}) } : t) } } };
      if (task?.topicId && (next === "completed" || task.status === "completed")) ns = setTopicCompleted(ns, task.topicId, next === "completed");
      return ns;
    });
    flash(`Task updated: ${next}`);
  };
  const toggleLearned = task => status(task.id, task.status === "completed" ? "upcoming" : "completed");
  const pauseResume = task => { const paused = task.status === "paused"; changeTasks(old => old.map(t => t.id === task.id ? { ...t, status: paused ? "progress" : "paused", ...(paused ? { resumedAt: new Date().toISOString() } : { pausedAt: new Date().toISOString() }) } : t)); flash(paused ? "Task resumed" : "Task paused"); };
  const deleteTask = task => { changeTasks(old => old.filter(t => t.id !== task.id)); update(s => ({ ...s, undoItem: { type: "task", day: selectedDay, item: task } })); flash("Task deleted. You can undo this action."); };
  const addWorkLog = task => { const log = { id: makeId(), note: "", url: "", minutes: 0, createdAt: new Date().toISOString() }; setAdding(false); setEditing({ ...task, workLogs: [...(task.workLogs || []), log] }); };
  const markRemainingPending = () => changeTasks(old => old.map(t => t.status === "completed" ? t : { ...t, status: "pending" }));

  /* ---------- add / edit with clash check ---------- */
  const closeEdit = () => { setEditing(null); setAdding(false); };
  const commitTask = (task, destination, choice = "none", hits = []) => {
    update(s => {
      let list = s.days[destination]?.tasks || [];
      let finalTask = task;
      if (choice !== "none" && hits.length) {
        const involved = new Set(hits.map(h => h.id));
        list = list.map(t => involved.has(t.id) ? { ...t, priority: t.id === choice ? "high" : (priorityOf(t) === "high" ? "normal" : t.priority) } : t);
        finalTask = { ...task, priority: choice === "new" ? "high" : (priorityOf(task) === "high" ? "normal" : (task.priority || "normal")) };
      }
      const nextList = adding ? [...list, finalTask] : list.map(t => t.id === finalTask.id ? finalTask : t);
      return { ...s, days: { ...s.days, [destination]: { ...(s.days[destination] || {}), tasks: nextList } } };
    });
    closeEdit(); setConflict(null); setPick("none");
    flash(adding ? `Task added to Day ${destination}` : "Task updated");
  };
  const saveTask = e => {
    e.preventDefault();
    const task = { ...editing, name: editing.name.trim(), workLogs: (editing.workLogs || []).filter(l => l.note?.trim() || l.url?.trim() || Number(l.minutes) > 0) };
    if (!task.name) return;
    const destination = adding ? (Number(targetDay) || selectedDay) : selectedDay;
    const existing = state.days[destination]?.tasks || [];
    const original = existing.find(t => t.id === task.id);
    const timeChanged = adding || !original || original.start !== task.start || original.end !== task.end;
    const hits = timeChanged ? findConflicts(existing, task) : [];
    if (hits.length) { setPick("none"); setConflict({ destination, hits, task }); return; }
    commitTask(task, destination);
  };

  /* ---------- navigation (always free) ---------- */
  const goToday = () => setSelectedDay(clamp(today, 1, duration));
  const jumpToDate = value => {
    if (!value) return;
    const target = roadmapDayForDate(startDate, asDate(value));
    if (target < 1 || target > duration) { flash(`Pick a date inside the ${duration}-day plan.`); return; }
    setSelectedDay(target);
  };
  const stripStart = clamp(selectedDay - 3, 1, Math.max(1, duration - 6));
  const strip = Array.from({ length: Math.min(7, duration) }, (_, i) => stripStart + i);
  const dayInfo = d => {
    const ts = state.days[d]?.tasks || [];
    const req = ts.filter(t => t.required !== false && isActive(t));
    return { total: ts.length, done: ts.filter(t => t.status === "completed").length, complete: req.length > 0 && req.every(t => t.status === "completed"), locked: isDayLocked(d, today, unlocked) };
  };
  const extendPlan = n => {
    const nd = Math.min(MAX_PLAN_DAYS, duration + n);
    update(s => changeDuration(s, nd, true));
    flash(`Plan extended to ${nd} days. Timetables set to run to the end were extended too.`);
  };

  /* ---------- one task card ---------- */
  const renderCard = task => {
    const src = sourceOf(task), isDone = task.status === "completed", pr = priorityOf(task), st = task.status || "upcoming";
    const logs = realLogs(task), minutes = logs.reduce((n, l) => n + (Number(l.minutes) || 0), 0);
    return <article key={task.id} className={`tcard src-${src} st-${st} ${isDone ? "is-done" : ""} ${pr === "high" ? "pri-high" : ""} ${locked ? "is-locked" : ""}`}>
      <div className="tcard-time"><b>{task.start || "Flexible"}</b>{task.end && <small>{task.end}</small>}</div>
      <button type="button" className={`tcheck ${isDone ? "on" : ""}`} aria-pressed={isDone} aria-label={isDone ? "Mark as not done" : src === "roadmap" ? "Mark topic as learned" : "Mark as done"} onClick={guard(() => toggleLearned(task))}>{isDone && <Check size={15} />}</button>
      <div className="tcard-body">
        <div className="tcard-main" role="button" tabIndex={0} title="View details and work log" onClick={() => setDetail(task.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetail(task.id); } }}>
          <div className="tcard-top">
            <h3>{task.name}</h3>
            <span className={`status-pill ${isDone ? "success" : st === "progress" ? "progress" : "muted"} st-${st}`}>{st}</span>
          </div>
          <div className="task-badges">
            {src === "roadmap" && <span className="src-badge roadmap"><BookOpen size={11} /> Roadmap topic</span>}
            {src === "timetable" && <span className="src-badge timetable"><Repeat size={11} /> Timetable</span>}
            {pr === "high" && <span className="src-badge priority"><Star size={11} /> Priority</span>}
            {pr === "low" && <span className="src-badge low">Low priority</span>}
            {task.flexible && <span className="src-badge low">Flexible</span>}
            {logs.length > 0 && <span className="log-chip"><NotebookPen size={12} /> {logs.length} log{logs.length === 1 ? "" : "s"}{minutes > 0 ? ` · ${minutes} min` : ""}</span>}
          </div>
          {task.description && <p>{task.description}</p>}
        </div>
        <div className="tcard-actions">
          {!isDone && st !== "progress" && <Button onClick={guard(() => status(task.id, "progress"))}><Play size={13} /> Start</Button>}
          {!isDone && st === "progress" && <Button onClick={guard(() => status(task.id, "completed"))}><Check size={13} /> {src === "roadmap" ? "Learned" : "Done"}</Button>}
          {!isDone && <Button variant="secondary" onClick={guard(() => pauseResume(task))} aria-label={st === "paused" ? "Resume" : "Pause"}>{st === "paused" ? <Play size={13} /> : <Clock3 size={13} />}<span className="hide-sm"> {st === "paused" ? "Resume" : "Pause"}</span></Button>}
          <Button variant="secondary" onClick={guard(() => addWorkLog(task))} aria-label="Log work"><Plus size={13} /><span className="hide-sm"> Log</span></Button>
          <Button variant="secondary" onClick={() => { setAdding(false); setEditing({ ...task }); }} aria-label="Edit task"><Pencil size={13} /></Button>
          <Button variant="secondary" aria-label="Delete task" title="Delete task" onClick={() => deleteTask(task)}><Trash2 size={13} /></Button>
          <select aria-label={`Change ${task.name} status`} value={st} onChange={e => guard(status)(task.id, e.target.value)}>{STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </div>
      </div>
    </article>;
  };

  return <>
    <PageHeader eyebrow="DAILY WORKSPACE" title="Daily tracker" description="Open any day to look around. Tasks can be worked on for today and past days; future days unlock when you ask." />

    {!hasAnyData ? <section className="panel daily-empty">
      <div className="empty-icon"><CalendarDays size={26} /></div>
      <h2>Nothing here yet</h2>
      <p>Your Daily tracker fills up with your own tasks. Pick a starting point — nothing is pre-filled.</p>
      <div className="daily-empty-actions">
        <Button onClick={() => { setAdding(true); setTargetDay(clamp(today, 1, duration)); setEditing(blankTask()); }}><Plus size={15} /> Add your first task</Button>
        <Button variant="secondary" onClick={() => navigate("/resources")}><FileSpreadsheet size={15} /> Import a timetable</Button>
        <Button variant="secondary" onClick={() => navigate("/roadmap")}><BookOpen size={15} /> Build a roadmap</Button>
      </div>
    </section> : <>
    <section className="day-hero panel">
      <div className="day-hero-top">
        <Button variant="secondary" disabled={selectedDay <= 1} aria-label="Previous day" onClick={() => setSelectedDay(d => Math.max(1, d - 1))}><ChevronLeft size={17} /></Button>
        <div className="day-hero-main">
          <div className="day-hero-badges"><span className={`day-tag ${selectedDay === today ? "today" : selectedDay < today ? "past" : "future"}`}>{label}</span>{locked && <span className="day-tag locked"><Lock size={11} /> Locked</span>}</div>
          <h2 className="day-hero-title">Day {selectedDay}<small>of {duration}</small></h2>
          <div className="day-hero-date"><CalendarDays size={15} /> {longDate(date)}</div>
        </div>
        <Button variant="secondary" disabled={selectedDay >= duration} aria-label="Next day" onClick={() => setSelectedDay(d => Math.min(duration, d + 1))}><ChevronRight size={17} /></Button>
      </div>
      <div className="day-strip" role="group" aria-label="Days around the selected day">
        {strip.map(d => {
          const ds = dayDate(startDate, d), inf = dayInfo(d), sel = d === selectedDay;
          return <button key={d} type="button" aria-current={sel ? "date" : undefined} onClick={() => setSelectedDay(d)} title={`Day ${d} · ${formatDate(ds)}${inf.total ? ` · ${inf.done}/${inf.total} done` : ""}`} className={`strip-day ${sel ? "selected" : ""} ${d === today ? "is-today" : ""} ${inf.locked ? "locked" : ""} ${inf.complete ? "complete" : ""}`}>
            <span className="strip-wd">{weekdayShort(ds)}</span><span className="strip-num">{ds.slice(8, 10)}</span><span className="strip-mon">{monthShort(ds)}</span>
            <span className="strip-flag">{inf.complete ? <Check size={11} /> : inf.locked ? <Lock size={10} /> : inf.total ? <i className="strip-dot" /> : null}</span>
          </button>;
        })}
      </div>
      <div className="day-hero-tools">
        <label className="date-picker"><CalendarDays size={15} /><span>Jump to date</span><input type="date" aria-label="Jump to roadmap date" min={startDate} max={dayDate(startDate, duration)} value={date} onChange={e => jumpToDate(e.target.value)} /></label>
        <Button variant="secondary" disabled={selectedDay === clamp(today, 1, duration)} onClick={goToday}><CalendarDays size={14} /> Go to today</Button>
      </div>
    </section>

    {today > duration && <div className="plan-banner"><div><strong>Your {duration}-day plan is complete.</strong><span>{duration < MAX_PLAN_DAYS ? "Keep going — extend the plan and your running timetables continue." : `You have reached the ${MAX_PLAN_DAYS}-day maximum. Set a new start date in Settings to begin a new plan.`}</span></div>{duration < MAX_PLAN_DAYS && <Button onClick={() => extendPlan(30)}><Plus size={14} /> Extend by {Math.min(30, MAX_PLAN_DAYS - duration)} days</Button>}</div>}

    {locked && <div className="lock-banner"><Lock size={20} /><div><strong>Day {selectedDay} is locked</strong><span>You can look at it and plan tasks, but starting, completing or logging work needs this day to be unlocked. It opens by itself at 12:00 AM on {formatDate(date)}.</span></div><Button onClick={() => setUnlockAsk({ run: null })}>Unlock this day</Button></div>}
    {!locked && selectedDay > today && <div className="lock-banner open"><Check size={18} /><div><strong>Day {selectedDay} is unlocked early</strong><span>Your calendar has not moved. You can lock it again if you opened it by mistake.</span></div><Button variant="secondary" onClick={relock}>Lock again</Button></div>}

    <div className="daily-layout"><div className="daily-main">
      <section className="panel tasks-panel">
        <div className="tasks-head">
          <div className="ring" style={{ "--p": pct(done, tasks.length) }} role="img" aria-label={`${pct(done, tasks.length)} percent done`}><span>{pct(done, tasks.length)}%</span></div>
          <div className="tasks-head-copy">
            <h2>{selectedDay === today ? "Today's tasks" : `Day ${selectedDay} tasks`}</h2>
            <p>{longDate(date)}</p>
            <div className="tasks-chips"><span className="chip ok"><Check size={12} /> {done} done</span><span className="chip">{openTasks} left</span>{requiredTasks.length > 0 && <span className="chip">{requiredDone}/{requiredTasks.length} required</span>}</div>
          </div>
          <Button onClick={() => { setAdding(true); setTargetDay(selectedDay); setEditing(blankTask()); }}><Plus size={15} /> Add task</Button>
        </div>
        {tasks.length > 3 && <label className="tasks-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search this day's tasks" aria-label="Search this day's tasks" /></label>}
        {filtered.length ? clusterTasks(filtered).map((group, gi) => {
          const clash = group.filter(isActive).length > 1;
          const cards = group.map(renderCard);
          if (!clash) return cards;
          const top = group.find(t => priorityOf(t) === "high");
          return <div className="task-cluster" key={`cluster-${gi}`}>
            <div className="cluster-label"><AlertTriangle size={14} /> Same time · {group.length} tasks overlap{top ? ` · Priority: ${top.name}` : " · no priority chosen"}</div>
            <div className="cluster-grid">{cards}</div>
          </div>;
        }) : <div className="empty-state small"><h3>{search ? "No matching tasks" : "No tasks for this day yet"}</h3><p>{search ? "Try another search." : "Add a task, import a timetable from Resources, or schedule roadmap topics from the Roadmap page."}</p></div>}
      </section>
    </div>

    <aside className="daily-side">
      <section className="panel"><div className="panel-heading"><div><h2>Daily notes</h2><p>What did you learn today?</p></div></div>
        <textarea className="notes-area" value={day.note || ""} onChange={e => update(s => ({ ...s, days: { ...s.days, [selectedDay]: { ...(s.days[selectedDay] || {}), tasks: s.days[selectedDay]?.tasks || [], note: e.target.value } } }))} placeholder="Write notes, blockers and wins…" />
      </section>

      {roadmapTasks.length > 0 && <section className="panel"><div className="panel-heading"><div><h2>Roadmap topics</h2><p>{roadmapTasks.filter(t => t.status === "completed").length} of {roadmapTasks.length} learned</p></div><BookOpen size={20} /></div>
        <ul className="topic-list">{roadmapTasks.map(t => <li key={t.id}><label className="topic-row"><input type="checkbox" checked={t.status === "completed"} onChange={guard(() => toggleLearned(t))} /><span><strong>{t.name}</strong><small>{timeLabel(t)}</small></span></label><button type="button" className="link-button" onClick={() => setDetail(t.id)}>Details</button></li>)}</ul>
      </section>}

      {missed.length > 0 && <section className="panel"><div className="panel-heading"><div><h2>Catch up</h2><p>Earlier days with unfinished tasks</p></div></div>
        <ul className="missed-list">{missed.map(m => <li key={m.day}><button type="button" onClick={() => setSelectedDay(m.day)}><span><strong>Day {m.day}</strong><small>{formatDate(dayDate(startDate, m.day))}</small></span><span className="status-pill st-pending">{m.count} left</span></button></li>)}</ul>
      </section>}

      <section className="panel"><h2>Day summary</h2>
        <div className="summary-pair"><span>Date</span><strong>{formatDate(date)}</strong></div>
        <div className="summary-pair"><span>Tasks</span><strong>{tasks.length}</strong></div>
        <div className="summary-pair"><span>Completed</span><strong>{done}</strong></div>
        <div className="summary-pair"><span>Pending / skipped</span><strong>{tasks.filter(t => ["pending", "skipped"].includes(t.status)).length}</strong></div>
        <div className="summary-pair"><span>Overdue (unfinished past day)</span><strong>{selectedDay < today ? tasks.filter(t => t.status !== "completed" && t.status !== "skipped").length : 0}</strong></div>
        <Button variant="secondary" className="full-width" onClick={guard(markRemainingPending)}>Mark remaining as pending</Button>
      </section>
    </aside></div>

    </>}

    {editing && <Modal title={adding ? "Add task" : "Edit task / work log"} subtitle="Changes apply to this day only." onClose={closeEdit} size="lg">
      <form className="project-form" onSubmit={saveTask}>
        {adding && <label>Target roadmap day<select value={targetDay} onChange={e => setTargetDay(Number(e.target.value))}>{Array.from({ length: duration }, (_, i) => <option value={i + 1} key={i}>Day {i + 1} · {formatDate(dayDate(startDate, i + 1))}</option>)}</select></label>}
        <label>Task name *<input required value={editing.name || ""} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
        <label>Description<textarea value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} /></label>
        <div className="form-two"><label>Start time<input type="time" value={editing.start || ""} onChange={e => setEditing({ ...editing, start: e.target.value })} /></label><label>End time<input type="time" value={editing.end || ""} onChange={e => setEditing({ ...editing, end: e.target.value })} /></label></div>
        <div className="form-two"><label>Priority<select value={editing.priority || "normal"} onChange={e => setEditing({ ...editing, priority: e.target.value })}><option value="high">High — do this first</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
          <label>Project / resource URL<input type="url" placeholder="https://..." value={editing.url || ""} onChange={e => setEditing({ ...editing, url: e.target.value })} /></label></div>
        <label className="field-label">Optional attachment<input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) setEditing({ ...editing, attachmentName: f.name, attachmentType: f.type, attachmentSize: f.size }); }} /><small>{editing.attachmentName ? `Selected: ${editing.attachmentName}` : "Stores attachment metadata only in this version; file contents are not uploaded."}</small></label>
        <label className="inline-check"><input type="checkbox" checked={editing.required !== false} onChange={e => setEditing({ ...editing, required: e.target.checked })} /> Required for day completion</label>
        {(editing.workLogs || []).map((log, i) => <div className="work-log-editor" key={log.id || i}><strong>Work log {i + 1}</strong>
          <label>What did you do?<textarea value={log.note || ""} onChange={e => setEditing({ ...editing, workLogs: editing.workLogs.map((x, j) => i === j ? { ...x, note: e.target.value } : x) })} /></label>
          <div className="form-two"><label>URL<input type="url" placeholder="GitHub / demo link" value={log.url || ""} onChange={e => setEditing({ ...editing, workLogs: editing.workLogs.map((x, j) => i === j ? { ...x, url: e.target.value } : x) })} /></label><label>Minutes spent<input type="number" min="0" value={log.minutes || 0} onChange={e => setEditing({ ...editing, workLogs: editing.workLogs.map((x, j) => i === j ? { ...x, minutes: Number(e.target.value) || 0 } : x) })} /></label></div>
        </div>)}
        <div className="form-actions"><Button variant="secondary" onClick={closeEdit}>Cancel</Button><Button type="submit"><Save size={14} /> Save task</Button></div>
      </form>
    </Modal>}

    {detailTask && <TaskDetail task={detailTask} state={state} dateLabel={`Day ${selectedDay} · ${formatDate(date)}`} onClose={() => setDetail(null)} onEdit={() => { setAdding(false); setEditing({ ...detailTask }); setDetail(null); }} onLogWork={guard(() => { addWorkLog(detailTask); setDetail(null); })} />}

    {conflict && <ConflictDialog
      title="Another task is already scheduled at this time"
      message={`Day ${conflict.destination} already has ${conflict.hits.length === 1 ? "a task" : `${conflict.hits.length} tasks`} at this time. You can keep both — they will be shown together. Pick which one matters more so you know what to do first.`}
      items={conflict.hits.map(t => ({ label: `${t.name} · ${timeLabel(t)}`, detail: `${overlapText(overlapKind(conflict.task, t))}${priorityOf(t) === "high" ? " · already high priority" : ""}` }))}
      choice={{ title: "Which one has the higher priority?", value: pick, onChange: setPick, options: [
        { id: "none", label: "Same priority for both", detail: "Show them together without ranking" },
        { id: "new", label: `“${conflict.task.name}”`, detail: `the task you are saving · ${timeLabel(conflict.task)}` },
        ...conflict.hits.map(t => ({ id: t.id, label: `“${t.name}”`, detail: `already on this day · ${timeLabel(t)}` })),
      ] }}
      proceedLabel="Keep both" cancelLabel="Change time"
      onCancel={() => setConflict(null)} onProceed={() => commitTask(conflict.task, conflict.destination, pick, conflict.hits)} />}

    {unlockAsk && <ConflictDialog icon={Lock} title={`Unlock Day ${selectedDay}?`}
      message={`Day ${selectedDay} (${formatDate(date)}) is still in the future, so it is locked.${unlockAsk.run ? " To do this you need to unlock the day first." : ""} It unlocks by itself at 12:00 AM on ${formatDate(date)}; unlocking now does not move your calendar.`}
      proceedLabel={`Unlock Day ${selectedDay}`} cancelLabel="Not now" onCancel={() => setUnlockAsk(null)} onProceed={unlockDay} />}
  </>;
}
