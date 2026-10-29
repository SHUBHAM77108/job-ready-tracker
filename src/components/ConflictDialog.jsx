import { AlertTriangle } from "lucide-react";
import Button from "./Button";

// Generic popup used for time clashes, unlock questions and "are you sure" prompts.
// `choice` (optional) adds a radio list, e.g. "which task has priority?".
export default function ConflictDialog({title="Time clash",message,items=[],choice=null,extra=null,icon=null,proceedLabel="Add anyway",cancelLabel="Change time",onCancel,onProceed}) {
  const Icon=icon||AlertTriangle;
  return <div className="modal-backdrop conflict-backdrop" role="alertdialog" aria-modal="true" aria-label={title} onMouseDown={e=>{if(e.target===e.currentTarget)onCancel();}}>
    <section className="panel confirm-modal conflict-modal">
      <div className="conflict-head"><span className="conflict-icon"><Icon size={20}/></span><div><h2>{title}</h2><p>{message}</p></div></div>
      {items.length>0&&<ul className="conflict-list">{items.map((item,i)=><li key={i}><strong>{item.label}</strong><span>{item.detail}</span></li>)}</ul>}
      {choice&&<fieldset className="choice-box"><legend>{choice.title}</legend>{choice.options.map(o=><label key={o.id} className={`choice-option ${choice.value===o.id?"selected":""}`}><input type="radio" name="conflict-choice" checked={choice.value===o.id} onChange={()=>choice.onChange(o.id)}/><span><strong>{o.label}</strong>{o.detail&&<small>{o.detail}</small>}</span></label>)}</fieldset>}
      {extra}
      <div className="form-actions"><Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button><Button onClick={onProceed}>{proceedLabel}</Button></div>
    </section>
  </div>;
}
