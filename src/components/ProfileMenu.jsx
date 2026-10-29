import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Button from "./Button";

export default function ProfileMenu({user,onLogout}) {
  const [open,setOpen]=useState(false);
  const box=useRef(null);
  const name=user?.displayName || user?.email?.split("@")[0] || "User";
  // close when you click / tap anywhere outside the menu, press Esc, or move focus away
  useEffect(()=>{
    if(!open)return undefined;
    const outside=e=>{if(box.current&&!box.current.contains(e.target))setOpen(false);};
    const esc=e=>{if(e.key==="Escape")setOpen(false);};
    document.addEventListener("pointerdown",outside,true);
    document.addEventListener("keydown",esc);
    const blur=()=>setOpen(false);
    window.addEventListener("blur",blur);
    return()=>{document.removeEventListener("pointerdown",outside,true);document.removeEventListener("keydown",esc);window.removeEventListener("blur",blur);};
  },[open]);
  return <div className="profile-menu" ref={box}>
    <button className="profile-trigger" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="menu">
      <span className="avatar"><UserRound size={17}/></span>
      <span className="profile-trigger-copy"><strong>{name}</strong><small>{user?.email || "Local demo"}</small></span>
      <ChevronDown size={15}/>
    </button>
    {open&&<div className="profile-dropdown" role="menu"><div className="profile-dropdown-heading"><strong>{name}</strong><span>{user?.email}</span></div><Button variant="secondary" onClick={()=>{setOpen(false);onLogout();}}><LogOut size={15}/> Sign out</Button></div>}
  </div>;
}
