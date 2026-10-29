import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isActive } from "../services/scheduling";
import { dayDate, formatDate, roadmapDayForDate } from "../utils/dates";

export const GLANCE_DAYS = 365;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MIN_CELL = 11;   // never draw squares smaller than this — on small screens the rest scrolls sideways

// Level of one day: none (no tasks) · l0 (nothing done) · l1 · l2 · l3 (all done) · planned (future day with tasks) · out (outside the plan)
const levelFor = (day, info, today, duration) => {
  if (day > duration) return "out";
  if (!info.total) return "none";
  if (day > today) return "planned";
  return info.done === 0 ? "l0" : info.done === info.total ? "l3" : info.done / info.total >= 0.5 ? "l2" : "l1";
};

// GitHub-style "plan at a glance": always 365 squares (Day 1 … Day 365), one column per week.
// The square size adapts to the space: wide screens show everything; small screens keep the squares readable
// (about 5–6 months visible on a phone) and the rest scrolls. It starts scrolled to today.
export default function PlanGlance({ state, onOpenDay, compact = false, fluid = false, title = "Plan at a glance" }) {
  const startDate = state.settings.startDate;
  const duration = Number(state.settings.durationDays) || 60;
  const today = roadmapDayForDate(startDate);
  const scroller = useRef(null);
  const [size, setSize] = useState({ cell: 13, gap: 3, overflow: false });

  const model = useMemo(() => {
    const first = new Date(`${startDate}T12:00:00`).getDay();
    const offset = (first + 6) % 7;                                   // rows are Monday-first
    const cells = [];
    let done = 0, total = 0;
    for (let day = 1; day <= GLANCE_DAYS; day++) {
      const tasks = (state.days[day]?.tasks || []).filter(isActive);
      const info = { total: tasks.length, done: tasks.filter(t => t.status === "completed").length };
      if (day <= duration) { done += info.done; total += info.total; }
      cells.push({ day, ...info, level: levelFor(day, info, today, duration), date: dayDate(startDate, day) });
    }
    const weeks = Math.ceil((offset + GLANCE_DAYS) / 7);
    // month labels: the later month wins when two start in the same column; drop labels that would touch the next one
    const raw = [];
    cells.forEach((c, i) => {
      const d = new Date(`${c.date}T12:00:00`);
      if (i !== 0 && d.getDate() !== 1) return;
      const col = Math.floor((offset + i) / 7);
      const entry = { col, label: MONTHS[d.getMonth()] };
      if (raw.length && raw[raw.length - 1].col === col) raw[raw.length - 1] = entry; else raw.push(entry);
    });
    const months = raw.filter((m, i) => !raw[i + 1] || raw[i + 1].col - m.col >= 3);
    const activeDays = cells.filter(c => c.day <= duration && c.done > 0).length;
    return { cells, offset, weeks, months, done, total, activeDays };
  }, [state.days, startDate, duration, today]);

  // pick the biggest square size that fits (within limits); if even the smallest allowed size does not fit, allow scrolling
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const measure = () => {
      const width = el.clientWidth;
      if (!width) return;
      const gap = width < 520 ? 2 : 3;
      const max = compact ? 13 : fluid ? 14 : 20;
      const fit = Math.floor((width - (model.weeks - 1) * gap) / model.weeks);
      const cell = Math.max(MIN_CELL, Math.min(max, fit));
      const next = { cell, gap, overflow: model.weeks * cell + (model.weeks - 1) * gap > width + 1 };
      setSize(prev => (prev.cell === next.cell && prev.gap === next.gap && prev.overflow === next.overflow ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [model.weeks, compact, fluid]);

  // start with "today" in view (matters when the grid is wider than the screen)
  useEffect(() => {
    const el = scroller.current;
    if (!el || !size.overflow) { if (el) el.scrollLeft = 0; return; }
    const col = Math.floor((model.offset + Math.min(Math.max(today, 1), GLANCE_DAYS) - 1) / 7);
    el.scrollLeft = Math.max(0, col * (size.cell + size.gap) - el.clientWidth * 0.35);
  }, [size.cell, size.gap, size.overflow, model.offset, today]);

  const page = dir => scroller.current?.scrollBy({ left: dir * (size.cell + size.gap) * 13, behavior: "smooth" });   // 13 weeks ≈ 3 months

  return <section className={`panel glance ${compact ? "compact" : ""} ${fluid ? "fluid" : ""}`}>
    <div className="panel-heading">
      <div><h2>{title}</h2><p>{fluid ? `${GLANCE_DAYS} days · ${duration}-day plan · ${model.activeDays} active` : `All ${GLANCE_DAYS} days · your plan is ${duration} day${duration === 1 ? "" : "s"} · ${model.activeDays} active day${model.activeDays === 1 ? "" : "s"}${model.total ? ` · ${model.done}/${model.total} tasks done` : ""}`}</p></div>
      {size.overflow && <div className="glance-nav"><button type="button" aria-label="Show earlier days" onClick={() => page(-1)}><ChevronLeft size={16} /></button><button type="button" aria-label="Show later days" onClick={() => page(1)}><ChevronRight size={16} /></button></div>}
    </div>
    <div className="glance-scroll" ref={scroller}>
      <div className="glance-inner" style={{ "--weeks": model.weeks, "--cell": `${size.cell}px`, "--gap": `${size.gap}px` }}>
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
