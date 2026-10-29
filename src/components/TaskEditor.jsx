import { Pencil, Plus, Trash2 } from "lucide-react";
import Button from "./Button";
import { makeId } from "../utils/dates";
import { useState } from "react";

const emptyTask=()=>({id:makeId(),name:"",description:"",start:"09:00",end:"10:00",flexible:false,status:"upcoming"});
export default function TaskEditor({tasks,onChange,onUndo,heading="Tasks for this day"}) {
 const [form,setForm]=useState(null);
 const [editingId,setEditingId]=useState(null);
 const [deleted,setDeleted]=useState(null);
 const begin=(task=null)=>{setEditingId(task?.id||null);setForm(task?{...task}:emptyTask());};
 const save=e=>{e.preventDefault();const next={...form,name:form.name.trim()};if(!next.name)return;onChange(editingId?tasks.map(t=>t.id===editingId?next:t):[...tasks,next]);setForm(null);setEditingId(null);};
 const remove=task=>{onChange(tasks.filter(t=>t.id!==task.id));setDeleted(task);};
 const undo=()=>{if(!deleted)return;onChange([...tasks,deleted]);setDeleted(null);onUndo?.();};
 return <section className="panel"><div className="panel-heading"><div><h2>{heading}</h2><p>Add, edit or remove tasks. Changes save automatically.</p></div><Button onClick={()=>begin()}><Plus size={15}/> Add task</Button></div>
 {form&&<form className="task-edit-form" onSubmit={save}><label>Task name *<input autoFocus required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Description<input value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="form-two"><label>Start time<input type="time" value={form.start||""} onChange={e=>setForm({...form,start:e.target.value})}/></label><label>End time<input type="time" value={form.end||""} onChange={e=>setForm({...form,end:e.target.value})}/></label></div><label className="inline-check"><input type="checkbox" checked={!!form.flexible} onChange={e=>setForm({...form,flexible:e.target.checked})}/> Flexible timing</label><div className="form-actions"><Button variant="secondary" onClick={()=>setForm(null)}>Cancel</Button><Button type="submit">{editingId?"Save changes":"Add task"}</Button></div></form>}
 {deleted&&<div className="undo-banner"><span>“{deleted.name}” removed.</span><button onClick={undo}>Undo</button><button aria-label="Dismiss undo" onClick={()=>setDeleted(null)}>×</button></div>}
 {tasks.length?<div className="editable-task-list">{tasks.map(task=><div className="editable-task-row" key={task.id}><div className="editable-task-main"><strong>{task.name}</strong><span>{task.description||"No description"} · {task.start||"Flexible"}{task.end?`–${task.end}`:""}</span></div><button className="icon-button" title="Edit task" onClick={()=>begin(task)}><Pencil size={15}/></button><button className="icon-button danger" title="Delete task" onClick={()=>remove(task)}><Trash2 size={15}/></button></div>)}</div>:<div className="empty-state small"><h3>No tasks yet</h3><p>Add a task or import a timetable file.</p></div>}
 </section>;
}