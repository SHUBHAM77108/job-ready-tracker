import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import Button from "./Button";

export default function ImportPreview({preview,onCancel,onImport,mode="roadmap"}) {
 const [selected,setSelected]=useState(()=>Object.fromEntries(preview.rows.map(r=>[r.id,true])));
 const [name,setName]=useState(preview.fileName.replace(/\.[^.]+$/,""));
 const rows=preview.rows;
 const all=rows.length>0&&rows.every(r=>selected[r.id]);
 const count=useMemo(()=>rows.filter(r=>selected[r.id]).length,[rows,selected]);
 return <section className="panel import-preview"><div className="panel-heading"><div><h2>Preview before importing</h2><p>{preview.fileName} · {rows.length} rows detected</p></div><button className="icon-button" onClick={onCancel} aria-label="Close preview"><X size={17}/></button></div><label className="field-label">Name for this {mode==="roadmap"?"roadmap":"timetable"}<input value={name} onChange={e=>setName(e.target.value)} /></label><div className="table-wrap preview-table"><table><thead><tr><th><input type="checkbox" checked={all} onChange={e=>setSelected(Object.fromEntries(rows.map(r=>[r.id,e.target.checked])))}/></th><th>{mode==="roadmap"?"Topic / task":"Task"}</th><th>Start</th><th>End</th><th>Description</th><th>Day</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><input type="checkbox" checked={!!selected[row.id]} onChange={e=>setSelected(s=>({...s,[row.id]:e.target.checked}))}/></td><td>{row.title||"Untitled row"}</td><td>{row.start||"—"}</td><td>{row.end||"—"}</td><td>{row.description||"—"}</td><td>{row.day||(mode==="timetable"?"Every day":"—")}</td></tr>)}</tbody></table></div><div className="form-actions"><span className="muted-text">{count} rows selected</span><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button onClick={()=>onImport({rows:rows.filter(r=>selected[r.id]),name})}><Check size={15}/> {mode==="timetable"?"Continue":"Import selected"}</Button></div></section>;
}