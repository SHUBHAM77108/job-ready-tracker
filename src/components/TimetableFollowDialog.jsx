import { useMemo, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import Button from "./Button";
import { ALL_WEEKDAYS, WEEKDAY_NAMES, weekdayOf } from "../services/scheduling";
import { dayDate, formatDate } from "../utils/dates";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Asks the user how many days the imported timetable should repeat for.
export default function TimetableFollowDialog({title="How many days will you follow this timetable?",confirmLabel="Apply timetable",taskCount,duration,startDate,defaults,previewConflicts,onCancel,onConfirm}) {
  const [startRaw,setStartRaw]=useState(String(defaults.startDay));
  const [countRaw,setCountRaw]=useState(String(defaults.endDay-defaults.startDay+1));
  const [weekdays,setWeekdays]=useState(defaults.weekdays||ALL_WEEKDAYS);
  const start=clamp(Number(startRaw)||1,1,duration);
  const count=clamp(Number(countRaw)||1,1,duration-start+1);
  const end=start+count-1;
  const dayList=useMemo(()=>{const out=[];for(let d=start;d<=end;d++)if(weekdays.includes(weekdayOf(startDate,d)))out.push(d);return out;},[start,end,weekdays,startDate]);
  const clashes=useMemo(()=>previewConflicts?previewConflicts(dayList):0,[dayList]); // eslint-disable-line
  const toggle=d=>setWeekdays(w=>w.includes(d)?w.filter(x=>x!==d):[...w,d].sort());
  const preset=(s,c)=>{setStartRaw(String(s));setCountRaw(String(c));};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel();}}>
    <section className="panel form-panel follow-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel-heading"><div><h2>{title}</h2><p>This timetable has {taskCount} task{taskCount===1?"":"s"} with no Day column, so it repeats on every day you choose below.</p></div><button className="icon-button" type="button" aria-label="Close" onClick={onCancel}><X size={18}/></button></div>
      <div className="follow-presets">
        <button type="button" className="filter-chip" onClick={()=>preset(1,duration)}>Whole plan · {duration} days</button>
        <button type="button" className="filter-chip" onClick={()=>preset(defaults.startDay,duration-defaults.startDay+1)}>Rest of plan from Day {defaults.startDay}</button>
        <button type="button" className="filter-chip" onClick={()=>preset(start,7)}>7 days</button>
        <button type="button" className="filter-chip" onClick={()=>preset(start,30)}>30 days</button>
      </div>
      <div className="form-two follow-fields">
        <label>Start from day<input type="number" min="1" max={duration} value={startRaw} onChange={e=>setStartRaw(e.target.value)}/></label>
        <label>Number of days<input type="number" min="1" max={duration-start+1} value={countRaw} onChange={e=>setCountRaw(e.target.value)}/></label>
      </div>
      <div className="weekday-row" role="group" aria-label="Days of the week"><span>Repeat on</span>{[1,2,3,4,5,6,0].map(d=><button type="button" key={d} className={`weekday-chip ${weekdays.includes(d)?"selected":""}`} aria-pressed={weekdays.includes(d)} onClick={()=>toggle(d)}>{WEEKDAY_NAMES[d]}</button>)}</div>
      <div className="follow-summary"><CalendarClock size={18}/><div>
        <strong>Day {start} ({formatDate(dayDate(startDate,start))}) → Day {end} ({formatDate(dayDate(startDate,end))})</strong>
        <span>{dayList.length} day{dayList.length===1?"":"s"} × {taskCount} task{taskCount===1?"":"s"} = {dayList.length*taskCount} tasks will appear in Daily Tracker, Analytics and Activity history.</span>
      </div></div>
      {clashes>0&&<div className="warn-box">{clashes} task{clashes===1?"":"s"} would overlap with tasks you already have. You will be asked before anything is added.</div>}
      <div className="form-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button disabled={!dayList.length} onClick={()=>onConfirm({startDay:start,endDay:end,weekdays})}>{confirmLabel}</Button></div>
    </section>
  </div>;
}
