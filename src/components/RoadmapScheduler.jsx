import { useMemo, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import Button from "./Button";
import { scheduleTopics } from "../services/scheduling";

// Turns roadmap topics into Daily Tracker tasks, placed only in free time slots.
export default function RoadmapScheduler({topics,days,duration,defaultStartDay,roadmapId,onCancel,onApply}) {
  const [startDay,setStartDay]=useState(String(defaultStartDay));
  const [perDay,setPerDay]=useState("2");
  const [minutes,setMinutes]=useState("60");
  const [windowStart,setWindowStart]=useState("09:00");
  const [windowEnd,setWindowEnd]=useState("21:00");
  const opts=useMemo(()=>({startDay:Math.max(1,Math.min(duration,Number(startDay)||1)),perDay:Math.max(1,Number(perDay)||1),minutes:Math.max(10,Math.min(480,Number(minutes)||60)),windowStart,windowEnd,roadmapId}),[startDay,perDay,minutes,windowStart,windowEnd,duration,roadmapId]);
  const result=useMemo(()=>scheduleTopics({topics,days,duration,...opts}),[topics,days,duration,opts]);
  const open=topics.filter(t=>!t.completed);
  const already=open.filter(t=>Object.values(days).some(d=>(d?.tasks||[]).some(x=>x.topicId===t.id))).length;
  const loose=open.filter(t=>!(Number(t.day)>=1)).length;
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel();}}>
    <section className="panel form-panel follow-modal" role="dialog" aria-modal="true" aria-label="Schedule roadmap topics">
      <div className="panel-heading"><div><h2>Schedule topics in Daily Tracker</h2><p>Each topic becomes a task. Topics are only placed in time that is free — your timetable always keeps its slots.</p></div><button className="icon-button" type="button" aria-label="Close" onClick={onCancel}><X size={18}/></button></div>
      <div className="follow-summary"><CalendarClock size={18}/><div><strong>{open.length} open topic{open.length===1?"":"s"}{already?` · ${already} already scheduled`:""}</strong><span>{loose} {loose===1?"has":"have"} no day yet and will be spread across days. Topics with a day stay on that day when there is room.</span></div></div>
      <div className="form-two follow-fields"><label>Start spreading from day<input type="number" min="1" max={duration} value={startDay} onChange={e=>setStartDay(e.target.value)}/></label><label>Topics per day (for topics without a day)<input type="number" min="1" max="12" value={perDay} onChange={e=>setPerDay(e.target.value)}/></label></div>
      <div className="form-two follow-fields"><label>Minutes per topic<input type="number" min="10" max="480" step="5" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label><div className="form-two follow-fields"><label>Earliest<input type="time" value={windowStart} onChange={e=>setWindowStart(e.target.value)}/></label><label>Latest end<input type="time" value={windowEnd} onChange={e=>setWindowEnd(e.target.value)}/></label></div></div>
      <div className="follow-summary subtle"><div><strong>Preview: {result.created} task{result.created===1?"":"s"} will be created</strong><span>{result.moved?`${result.moved} moved to a later day because that day was full. `:""}{result.skipped?`${result.skipped} will not fit inside the ${duration}-day plan (raise the daily window or lower minutes per topic). `:""}{!result.moved&&!result.skipped?"Everything fits without any overlap.":""}</span></div></div>
      <div className="form-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button disabled={!result.created} onClick={()=>onApply(opts,result)}>Create {result.created} task{result.created===1?"":"s"}</Button></div>
    </section>
  </div>;
}
