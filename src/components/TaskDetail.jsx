import { ExternalLink, NotebookPen, Paperclip, Pencil, Plus, X } from "lucide-react";
import Button from "./Button";
import { priorityOf, timeLabel } from "../services/scheduling";

export const realLogs = (task) => (task?.workLogs || []).filter(l => l.note?.trim() || l.url?.trim() || Number(l.minutes) > 0);
const when = iso => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-IN", {day:"numeric", month:"short", hour:"numeric", minute:"2-digit"}); };

// Read-only view of a task: details + every work log that was saved for it.
export default function TaskDetail({task,state,dateLabel,onClose,onEdit,onLogWork}) {
  const logs = realLogs(task);
  // Roadmap tasks: show where the topic comes from.
  let topic = null, roadmapName = "";
  if (task.topicId && state) {
    for (const r of state.roadmaps || []) { const t = (r.topics || []).find(x => x.id === task.topicId); if (t) { topic = t; roadmapName = r.name; break; } }
  }
  const timetable = task.scheduleId && state ? (state.schedules || []).find(x => x.id === task.scheduleId) : null;
  const minutes = logs.reduce((n,l)=>n+(Number(l.minutes)||0),0);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="panel form-panel task-modal task-detail" role="dialog" aria-modal="true" aria-label={`${task.name} details`}>
      <div className="panel-heading"><div><h2>{task.name}</h2><p>{dateLabel} · {timeLabel(task)}</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
      <div className="detail-badges"><span className={`status-pill st-${task.status||"upcoming"} ${task.status==="completed"?"success":task.status==="progress"?"progress":"muted"}`}>{task.status||"upcoming"}</span>{task.required===false&&<span className="status-pill">Optional</span>}{priorityOf(task)==="high"&&<span className="status-pill st-pending">Priority</span>}{priorityOf(task)==="low"&&<span className="status-pill">Low priority</span>}{task.topicId&&<span className="status-pill st-ready">Roadmap topic</span>}{task.scheduleId&&<span className="status-pill">{timetable?.kind==="recurring"?"Recurring rule":"Timetable"}</span>}</div>
      {(topic||timetable)&&<dl className="detail-facts">{topic&&<><dt>Roadmap</dt><dd>{roadmapName}</dd>{topic.phase&&<><dt>Phase</dt><dd>{topic.phase}</dd></>}<dt>Topic</dt><dd>{topic.completed?"Learned":"Not learned yet"}</dd></>}{timetable&&<><dt>From</dt><dd>{timetable.name}</dd></>}</dl>}
      {task.description&&<p className="detail-desc">{task.description}</p>}
      {(task.url||task.attachmentName)&&<div className="detail-links">{task.url&&<a href={task.url} target="_blank" rel="noreferrer"><ExternalLink size={14}/> {task.url}</a>}{task.attachmentName&&<span><Paperclip size={14}/> {task.attachmentName}</span>}</div>}
      <div className="detail-logs-head"><h3><NotebookPen size={16}/> Work log</h3><span className="muted-text">{logs.length?`${logs.length} entr${logs.length===1?"y":"ies"}${minutes?` · ${minutes} min total`:""}`:"Nothing logged yet"}</span></div>
      {logs.length?<ol className="log-list">{logs.map((log,i)=><li key={log.id||i}>
        <div className="log-meta"><strong>Log {i+1}</strong>{log.createdAt&&<span>{when(log.createdAt)}</span>}{Number(log.minutes)>0&&<span className="log-minutes">{log.minutes} min</span>}</div>
        {log.note&&<p>{log.note}</p>}
        {log.url&&<a href={log.url} target="_blank" rel="noreferrer"><ExternalLink size={13}/> {log.url}</a>}
      </li>)}</ol>:<div className="empty-state small"><p>Use “Log work” to note what you did, add a link and the minutes spent. It will show up here.</p></div>}
      <div className="form-actions"><Button variant="secondary" onClick={onClose}>Close</Button><Button variant="secondary" onClick={onEdit}><Pencil size={14}/> Edit</Button><Button onClick={onLogWork}><Plus size={14}/> Log work</Button></div>
    </section>
  </div>;
}
