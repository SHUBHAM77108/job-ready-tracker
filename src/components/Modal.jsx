import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Shared pop-up. Centered card on desktop, bottom sheet on phones. Esc / backdrop click closes it.
export default function Modal({title,subtitle,onClose,children,size="md"}) {
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  useEffect(()=>{
    const onKey=e=>{if(e.key==="Escape")closeRef.current?.();};
    document.addEventListener("keydown",onKey);
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=prev;};
  },[]);
  return <div className="modal-backdrop sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)closeRef.current?.();}}>
    <section className={`panel form-panel modal-sheet size-${size}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel-heading modal-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
      {children}
    </section>
  </div>;
}
