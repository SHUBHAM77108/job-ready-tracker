import { useEffect, useMemo, useRef } from "react";
import { isActive } from "../services/scheduling";
import { dayDate, formatDate, roadmapDayForDate } from "../utils/dates";

export const GLANCE_DAYS = 365;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Level of one day: none (no tasks) · l0 (nothing done) · l1 · l2 · l3 (all done) · planned (future day with tasks) · out (outside the plan)
const levelFor = (day, info, today, duration) => {
  if (day > duration) return "out";
  if (!info.total) return "none";
  if (day > today) return "planned";
  return info.done === 0 ? "l0" : info.done === info.total ? "l3" : info.done / info.total >= 0.5 ? "l2" : "l1";
};

// GitHub-style "plan at a glance": always 365 squares (Day 1 … Day 365), one column per week.
// Squares beyond the plan length are dimmed. Re-computes from live state, so it updates the moment anything changes.
export default function PlanGlance({ state, onOpenDay, compact = false, fluid = false, title = "Plan at a glance" }) {
  const startDate = state.settings.startDate;
  const duration = Number(state.settings.durationDays) || 60;
  const today = roadmapDayForDate(startDate);
  const scroller = useRef(null);

  const model = useMemo(() => {
    const first = new Date(`${startDate}T12:00:00`).getDay();            // 0 = Sun … we draw Mon-first rows
    const offset = (first + 6) % 7;
    const cells = [];
    let done = 0, total = 0;
    for (let day = 1; day <= GLANCE_DAYS; day++) {
      const tasks = (state.days[day]?.tasks || []).filter(isActive);
      const info = { total: tasks.length, done: tasks.filter(t => t.status === "completed").length };
      if (day <= duration) { done += info.done; total += info.total; }
      cells.push({ day, ...info, level: levelFor(day, info, today, duration), date: dayDate(startDate, day) });
    }
    const weeks = Math.ceil((offset + GLANCE_DAYS) / 7);
    const months = [];
    cells.forEach((c, i) => {
      const col = Math.floor((offset + i) / 7);
      const d = new Date(`${c.date}T12:00:00`);
      if (i === 0 || d.getDate() === 1) {
        if (!months.length || months[months.length - 1].col !== col) months.push({ col, label: MONTHS[d.getMonth()] });
      }
    });
    const activeDays = cells.filter(c => c.day <= duration && c.done > 0).length;
    return { cells, offset, weeks, months, done, total, activeDays };
  }, [state.days, startDate, duration, today]);

  // jump the scroll position so "today" is visible (matters on phones, where 53 weeks do not fit)
  useEffect(() => {
    const el = scroller.current;
    if (!el || today < 1) return;
    const col = Math.floor((model.offset + Math.min(today, GLANCE_DAYS) - 1) / 7);
    const cell = el.scrollWidth / (model.weeks + 1);
    el.scrollLeft = Math.max(0, col * cell - el.clientWidth / 2);
  }, [model.offset, model.weeks, today]);

  return <section className={`panel glance ${compact ? "compact" : ""} ${fluid ? "fluid" : ""}`}>
    <div className="panel-heading">
      <div><h2>{title}</h2><p>{fluid ? `${GLANCE_DAYS} days · ${duration}-day plan · ${model.activeDays} active` : `All ${GLANCE_DAYS} days · your plan is ${duration} day${duration === 1 ? "" : "s"} · ${model.activeDays} active day${model.activeDays === 1 ? "" : "s"}${model.total ? ` · ${model.done}/${model.total} tasks done` : ""}`}</p></div>
    </div>
    <div className="glance-scroll" ref={scroller}>
      <div className="glance-inner" style={{ "--weeks": model.weeks }}>
        <div className="glance-months" aria-hidden="true">{model.months.map(m => <span key={m.col} style={{ gridColumn: m.col + 1 }}>{m.label}</span>)}</div>
        <div className="glance-grid" role="grid" aria-label={`Plan at a glance, ${GLANCE_DAYS} days`}>
          {Array.from({ length: model.offset }, (_, i) => <i key={`pad-${i}`} className="glance-pad" />)}
          {model.cells.map(c => <button key={c.day} type="button" role="gridcell" disabled={!onOpenDay || c.day > duration}
            onClick={() => onOpenDay?.(c.day)} className={`glance-cell ${c.level} ${c.day === today ? "now" : ""}`}
            title={c.day > duration ? `Day ${c.day} · ${formatDate(c.date)} · outside your ${duration}-day plan` : `Day ${c.day} · ${formatDate(c.date)}${c.total ? ` · ${c.done}/${c.total} done` : " · no tasks"}`}
            aria-label={`Day ${c.day}, ${c.day > duration ? "outside plan" : c.total ? `${c.done} of ${c.total} done` : "no tasks"}`} />)}
        </div>
      </div>
    </div>
    <div className="heat-legend">
      <span>Less</span><i className="glance-cell l0" /><i className="glance-cell l1" /><i className="glance-cell l2" /><i className="glance-cell l3" /><span>All done</span>
      <i className="glance-cell none" /><span>No tasks</span><i className="glance-cell planned" /><span>Planned</span><i className="glance-cell out" /><span>Outside plan</span>
    </div>
  </section>;
}
