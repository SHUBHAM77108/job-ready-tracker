import { useEffect, useMemo, useRef } from "react";
import { BookOpen, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, FolderKanban, Lock, NotebookPen, Play, Plus, Repeat, Star, TriangleAlert } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ProgressBar from "../components/ProgressBar";
import Button from "../components/Button";
import PlanGlance from "../components/PlanGlance";
import { realLogs } from "../components/TaskDetail";
import { MAX_PLAN_DAYS, changeDuration, isActive, isDayLocked, isRoadmapSlot, priorityOf, setTopicCompleted, topicsOnDay } from "../services/scheduling";
import RoadmapSlotLine from "../components/RoadmapSlotLine";
import { STATE_LABEL, groupOverlaps, minutesOnSelectedDate, resolveTaskStates, scheduleGap, scheduleRange } from "../services/dashboardSchedule";
import { useNow } from "../hooks/useNow";
import { formatDate, pct, roadmapDayForDate, dayDate, localDateString } from "../utils/dates";

const sourceOf = t => (t.source === "roadmap" || t.topicId) ? "roadmap" : t.scheduleId ? "timetable" : "manual";
const MAX_ROWS = 200;   // the schedule scrolls inside its own box, so every task is reachable
const pad2 = n => String(n).padStart(2, "0");
const clock24 = date => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
const hhmm = minutes => `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`;
const durationLabel = minutes => minutes >= 60 ? `${Math.floor(minutes / 60)} hr${Math.floor(minutes / 60) === 1 ? "" : "s"}${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;

export default function Dashboard({ state, update, flash, selectedDay, setSelectedDay, navigate }) {
  const clock = useNow();
  const scheduleRef = useRef(null);
  const listRef = useRef(null);
  const autoFocused = useRef(null);
  const startDate = state.settings.startDate;
  const today = roadmapDayForDate(startDate);
  const duration = Number(state.settings.durationDays) || 60;
  const actualDay = Math.max(1, Math.min(duration, today));
  const date = dayDate(startDate, selectedDay);
  const tasks = state.days[selectedDay]?.tasks || [];
  const selectedDate = date;
  const todayDate = localDateString(clock);
  const isSelectedToday = selectedDate === todayDate;
  const nowMin = clock.getHours() * 60 + clock.getMinutes();
  const selectedNowMin = minutesOnSelectedDate(selectedDate, todayDate, nowMin);
  const done = tasks.filter(t => t.status === "completed").length;
  const total = Object.values(state.days).reduce((sum, d) => sum + (d.tasks || []).length, 0);
  const complete = Object.values(state.days).reduce((sum, d) => sum + (d.tasks || []).filter(t => t.status === "completed").length, 0);
  const locked = isDayLocked(selectedDay, today, state.unlockedDays);
  const roadmapToday = tasks.filter(t => sourceOf(t) === "roadmap");
  const open = () => { setSelectedDay(selectedDay); navigate("/daily"); };
  // Same completion data as the Daily tracker (status + completedAt, and the roadmap topic when the task came from one).
  const patchTask = (task, patch, topicDone) => update(s => {
    const list = s.days[selectedDay]?.tasks || [];
    let next = { ...s, days: { ...s.days, [selectedDay]: { ...(s.days[selectedDay] || {}), tasks: list.map(t => t.id === task.id ? { ...t, ...patch } : t) } } };
    if (topicDone !== undefined && task.topicId) next = setTopicCompleted(next, task.topicId, topicDone);
    return next;
  });
  const markComplete = task => { patchTask(task, { status: "completed", completedAt: new Date().toISOString() }, true); flash(`Marked complete: ${task.name}`); };
  const startTask = task => { patchTask(task, { status: "progress", startedAt: new Date().toISOString(), pausedAt: null }); flash(`Started: ${task.name}`); };

  // One shared status decision (also used by the Daily tracker): in progress / not started / next / upcoming / pending / not completed.
  const slotTopics = useMemo(() => topicsOnDay(state, selectedDay), [state.roadmaps, state.roadmap, state.activeRoadmapId, selectedDay]);
  const { states, current: activeTask, next: nextTask } = useMemo(() => resolveTaskStates(tasks, selectedDate, todayDate, nowMin), [tasks, selectedDate, todayDate, nowMin]);
  const allScheduledFinished = tasks.length > 0 && tasks.every(task => task.status === "completed");
  const allTasksResolved = tasks.length > 0 && tasks.every(task => ["completed", "skipped"].includes(task.status));
  const activeStarted = activeTask ? states.get(activeTask.id) === "progress" : false;
  const upNext = activeTask ? { kind: activeStarted ? "progress" : "now", task: activeTask, minutes: scheduleRange(activeTask)[1] - selectedNowMin }
    : nextTask ? { kind: "next", task: nextTask, minutes: scheduleRange(nextTask)[0] - nowMin }
      : isSelectedToday && tasks.length ? { kind: allScheduledFinished ? "complete" : allTasksResolved ? "cleared" : "none", task: null } : null;
  const UPNEXT_LABEL = { progress: "In progress", now: "Now · Not started", next: "Next", complete: "Schedule complete", cleared: "Schedule cleared", none: "No more tasks today" };

  const groups = groupOverlaps(tasks);
  useEffect(() => {
    
    const key = `${selectedDay}:${activeTask?.id || "now"}`;
    if (autoFocused.current === key) return;
    autoFocused.current = key;
    requestAnimationFrame(() => {
      const box = listRef.current;
      if (!box) return;
      const target = box.querySelector(".tl-item.is-current") || box.querySelector(".tl-now") || box.querySelector(".tl-gap.contains-now");
      if (!target) { box.scrollTop = 0; return; }
      const offset = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      box.scrollTo({ top: Math.max(0, offset - box.clientHeight / 3), behavior: "smooth" });
    });
  }, [activeTask?.id, selectedDay]);
  let rowCount = 0;
  let stoppedAtRowLimit = false;
  const renderRow = (t, group) => {
    const range = scheduleRange(t), state = states.get(t.id) || "upcoming";
    const conflict = range && isActive(t) && group.some(other => other.id !== t.id && isActive(other) && scheduleRange(other)?.[0] < range[1] && range[0] < scheduleRange(other)?.[1]);
    const current = activeTask?.id === t.id, isNext = nextTask?.id === t.id;
    const planned = range ? `${durationLabel(range[1] - range[0])} planned` : "No fixed time";
    const inWindow = range && selectedNowMin >= range[0] && selectedNowMin < range[1];
    const timing = state === "progress" || state === "now"
      ? (inWindow ? (isSelectedToday ? `${durationLabel(range[1] - selectedNowMin)} left` : `Continues overnight · ${durationLabel(range[1] - selectedNowMin)} left`) : `Started early · ${planned}`)
      : state === "next" || state === "upcoming"
        ? (range ? (isSelectedToday ? `Starts in ${durationLabel(Math.max(0, range[0] - nowMin))}` : selectedDate > todayDate ? `Starts at ${t.start}` : planned) : planned)
        : state === "pending" ? (isSelectedToday ? "Time is over" : "Kept pending")
          : state === "missed" ? "Not done"
            : state === "paused" ? "Paused" : planned;
    const logs = realLogs(t), src = sourceOf(t), pr = priorityOf(t);
    const canAct = isActive(t) && !locked && state !== "completed" && state !== "skipped";
    const canStart = canAct && state === "now";
    const canComplete = canAct && ["now", "progress", "pending", "missed", "paused"].includes(state);
    return <div role="button" tabIndex={0} key={t.id} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(); } }} className={`tl-row tl-item st-${state} ${current ? "is-current" : ""} ${isNext ? "is-next" : ""} ${conflict ? "has-conflict" : ""}`} onClick={open} title="Open in Daily tracker">
      <span className="tl-time"><b>{t.start || "Flexible"}</b>{t.end && <small>{t.end}{range?.[1] > 1440 ? " +1d" : ""}</small>}</span>
      <span className="tl-rail" aria-hidden="true"><i className="tl-dot">{state === "completed" && <Check size={9} strokeWidth={4} />}</i></span>
      <span className="tl-card">
        <span className="tl-head">
          <span className="tl-name">{t.name}</span>
          {src === "roadmap" && <span className="src-badge roadmap"><BookOpen size={11} /> Roadmap</span>}
          {src === "timetable" && <span className="src-badge timetable"><Repeat size={11} /> Timetable</span>}
          {t.repeatId && <span className="src-badge low"><Repeat size={11} /> Every day</span>}
          {pr === "high" && <span className="src-badge priority"><Star size={11} /> Priority</span>}
          {current && <span className="tl-live"><i />{isSelectedToday ? "NOW" : "OVERNIGHT"}</span>}
        </span>
        {t.description && <span className="tl-desc">{t.description}</span>}
        {isRoadmapSlot(t) && <RoadmapSlotLine topics={slotTopics} onAdd={() => navigate("/roadmap")} />}
        <span className="tl-foot">
          <span className={`tl-pill st-${state}`}>{state === "completed" && <Check size={11} />}{STATE_LABEL[state]}</span>
          <span className={`tl-timing ${conflict ? "conflict" : ""}`}>{conflict && <TriangleAlert size={12} />}{conflict ? "Overlaps another task" : timing}{logs.length > 0 && <span className="tl-logs"><NotebookPen size={11} /> {logs.length}</span>}</span>
          {(canStart || canComplete) && <span className="tl-actions">
            {canStart && <button type="button" className="tl-act start" title="Start" aria-label={`Start ${t.name}`} onClick={e => { e.stopPropagation(); startTask(t); }}><Play size={13} /></button>}
            {canComplete && <button type="button" className="tl-act done" title="Mark complete" aria-label={`Mark ${t.name} complete`} onClick={e => { e.stopPropagation(); markComplete(t); }}><Check size={14} /></button>}
          </span>}
        </span>
      </span>
    </div>;
  };

  const timelineEntries = [];
  let previousEnd = null, nowPlaced = !isSelectedToday || !!activeTask;
  groups.forEach(group => {
    const ranges = group.map(scheduleRange).filter(Boolean);
    const start = ranges.length ? Math.min(...ranges.map(range => range[0])) : null;
    const end = ranges.length ? Math.max(...ranges.map(range => range[1])) : null;
    if (start != null && previousEnd != null && start > previousEnd) {
      const nowInGap = isSelectedToday && !nowPlaced && nowMin >= previousEnd && nowMin < start;
      const gap = scheduleGap(previousEnd, start);
      if (gap) timelineEntries.push({ type: "gap", ...gap, now: nowInGap });
      if (nowInGap) nowPlaced = true;
    } else if (start != null && previousEnd == null && isSelectedToday && !nowPlaced && nowMin < start) {
      timelineEntries.push({ type: "now" }); nowPlaced = true;
    }
    const ordered = [...group].sort((a,b) => (scheduleRange(a)?.[0] ?? Infinity) - (scheduleRange(b)?.[0] ?? Infinity));
    const active = ordered.filter(task => isActive(task) && scheduleRange(task));
    const conflict = active.some((task, i) => active.slice(i + 1).some(other => scheduleRange(task)[0] < scheduleRange(other)[1] && scheduleRange(other)[0] < scheduleRange(task)[1]));
    timelineEntries.push({ type: "tasks", group: ordered, conflict });
    if (end != null) previousEnd = Math.max(previousEnd ?? end, end);
  });
  if (isSelectedToday && !nowPlaced) timelineEntries.push({ type: "now" });

  return <>
    <PageHeader eyebrow="YOUR CAREER WORKSPACE" title="Build skills. Get job ready." description="Stay consistent, build real projects and track your progress." action={<div className="dashboard-date-selector"><button type="button" aria-label="Previous day" disabled={selectedDay <= 1} onClick={() => setSelectedDay(day => Math.max(1, day - 1))}><ChevronLeft size={16}/></button><span className="date-chip"><CalendarDays size={16} />{formatDate(date)}</span><button type="button" aria-label="Next day" disabled={selectedDay >= duration} onClick={() => setSelectedDay(day => Math.min(duration, day + 1))}><ChevronRight size={16}/></button></div>} />

    {today > duration && <div className="plan-banner"><div><strong>Your {duration}-day plan is complete.</strong><span>{duration < MAX_PLAN_DAYS ? "Extend it to keep your timetable and roadmap going." : `You have reached the ${MAX_PLAN_DAYS}-day maximum. Set a new start date in Settings to begin again.`}</span></div>
      {duration < MAX_PLAN_DAYS ? <Button onClick={() => { const nd = Math.min(MAX_PLAN_DAYS, duration + 30); update(s => changeDuration(s, nd, true)); flash(`Plan extended to ${nd} days.`); }}><Plus size={14} /> Extend by {Math.min(30, MAX_PLAN_DAYS - duration)} days</Button> : <Button variant="secondary" onClick={() => navigate("/settings")}>Open settings</Button>}</div>}

    <div className="stats-grid four">
      <Stat icon={CalendarDays} label="Roadmap day" value={`${actualDay} / ${duration}`} helper={today < 1 ? "Plan hasn't started" : today > duration ? "Plan complete" : "Based on start date"} />
      <Stat icon={CheckCircle2} label="Selected day's tasks" value={`${done} / ${tasks.length}`} helper="Completed tasks" tone="blue" />
      <Stat icon={BookOpen} label="Roadmap topics" value={state.roadmap.length} helper={roadmapToday.length ? `${roadmapToday.filter(t => t.status === "completed").length}/${roadmapToday.length} learned today` : "Personal learning plan"} tone="purple" />
      <Stat icon={FolderKanban} label="Projects" value={state.projects.length} helper={`${state.projects.filter(p => p.status === "Completed").length} completed`} tone="orange" />
    </div>

    {upNext && <div className={`upnext k-${upNext.kind}`}><span className="upnext-kind">{UPNEXT_LABEL[upNext.kind]}</span><div><strong>{upNext.task?.name || (upNext.kind === "complete" ? "All scheduled tasks are complete" : upNext.kind === "cleared" ? "Today's scheduled work is cleared" : "No more timed tasks today")}</strong><span>{upNext.task
      ? (upNext.kind === "next"
        ? `${upNext.task.start}${upNext.task.end ? `–${upNext.task.end}` : ""} · starts in ${durationLabel(upNext.minutes)}`
        : `${upNext.kind === "now" ? "Not started · " : ""}${upNext.task.start}–${upNext.task.end || ""} · ${isSelectedToday ? `${durationLabel(upNext.minutes)} left` : "continues overnight"}${nextTask ? ` · Next: ${nextTask.name} at ${nextTask.start}` : ""}`)
      : `Current local time ${clock24(clock)}${upNext.kind === "none" ? " · Review unfinished tasks in Daily tracker" : ""}`}</span></div>{upNext.task && <button type="button" className="link-button" onClick={open}>Open <ChevronRight size={14} /></button>}</div>}

    <div className="dashboard-grid">
      <section className="panel" ref={scheduleRef}>
        <div className="panel-heading"><div><h2>Selected day's schedule</h2><p>{isSelectedToday ? "Today" : `Day ${selectedDay} · ${formatDate(date)}`} · {tasks.length} task{tasks.length === 1 ? "" : "s"}</p></div><button className="link-button" onClick={open}>Open tracker <ChevronRight size={15} /></button></div>
        {locked && <div className="lock-note"><Lock size={14} /> This day is in the future and locked. You can unlock it in the Daily tracker.</div>}
        {tasks.length ? <><div className="sched-scroll" ref={listRef}><div className="tl-list">
          {timelineEntries.map((entry, index) => {
            if (stoppedAtRowLimit) return null;
            if (entry.type === "now") return <div className="tl-row tl-now" key={`now-${index}`}><span className="tl-time"><b>{clock24(clock)}</b></span><span className="tl-rail" aria-hidden="true"><i className="tl-dot" /></span><span className="tl-now-line"><b>NOW</b><i /></span></div>;
            if (entry.type === "gap") return <div className={`tl-row tl-gap ${entry.now ? "contains-now" : ""}`} key={`gap-${index}`}><span className="tl-time" /><span className="tl-rail" aria-hidden="true">{entry.now && <i className="tl-dot" />}</span><span className="tl-gap-text">{hhmm(entry.start)}–{hhmm(entry.end)} · {durationLabel(entry.minutes)} free{entry.now && <b>NOW</b>}</span></div>;
            const visibleTasks = entry.group.slice(0, Math.max(0, MAX_ROWS - rowCount));
            if (!visibleTasks.length) { stoppedAtRowLimit = true; return null; }
            if (visibleTasks.length < entry.group.length) stoppedAtRowLimit = true;
            const rows = visibleTasks.map(task => { rowCount++; return renderRow(task, entry.group); });
            return <div className="tl-group" key={`group-${index}`}>{entry.conflict && <div className="tl-row tl-label"><span className="tl-time" /><span className="tl-rail" aria-hidden="true" /><span className="tl-label-text"><TriangleAlert size={12} /> Schedule conflict · overlapping task times</span></div>}{rows}</div>;
          })}
        </div></div>{tasks.length > MAX_ROWS && <button type="button" className="show-all" onClick={open}>View all {tasks.length} tasks in Daily tracker <ChevronRight size={14} /></button>}</> : <div className="empty-state small"><h3>No tasks for this day</h3><p>Add tasks in Daily Tracker or import a timetable.</p><Button onClick={() => navigate("/daily")}>Open daily tracker</Button></div>}
      </section>

      <div className="dashboard-side">
        <PlanGlance fluid state={state} onOpenDay={d => { setSelectedDay(d); navigate("/daily"); }} />
      <section className="panel dashboard-progress-panel">
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
