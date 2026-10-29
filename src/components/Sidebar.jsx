import { NavLink } from "react-router-dom";
import { Activity, BarChart3, BookOpen, BriefcaseBusiness, CalendarDays, FolderKanban, Home, Settings } from "lucide-react";

const items=[
  {to:"/",label:"Overview",icon:Home},
  {to:"/daily",label:"Daily tracker",icon:CalendarDays},
  {to:"/analytics",label:"Analytics",icon:BarChart3},
  {to:"/history",label:"Activity history",icon:Activity},
  {to:"/roadmap",label:"Learning roadmap",icon:BookOpen},
  {to:"/projects",label:"Projects",icon:FolderKanban},
  {to:"/applications",label:"Job applications",icon:BriefcaseBusiness},
  {to:"/resources",label:"Timetable & resources",icon:CalendarDays},
  {to:"/settings",label:"Settings",icon:Settings}
];
export default function Sidebar({mobileOpen,onNavigate,roadmapCount,projectCount}) {
 return <><aside className={`sidebar ${mobileOpen?"open":""}`}><div className="brand"><img className="brand-heatmap-logo" src="/Plan%20at%20a%20Glance%20Heatmap.png" alt="Job-Ready Tracker logo"/><span><strong>Job-Ready</strong><small>Tracker</small></span></div><div className="workspace-label">WORKSPACE</div><nav>{items.map(item=>{const Icon=item.icon;const count=item.to==="/roadmap"?roadmapCount:item.to==="/projects"?projectCount:0;return <NavLink key={item.to} to={item.to} end={item.to==="/"} onClick={onNavigate} className={({isActive})=>`nav-link ${isActive?"active":""}`}><Icon size={18}/><span>{item.label}</span>{count>0&&<small className="nav-count">{count}</small>}</NavLink>})}</nav><div className="sidebar-bottom"><div className="side-note"><strong>One step at a time.</strong><span>Build skills. Track progress.</span></div></div></aside>{mobileOpen&&<button className="nav-scrim" aria-label="Close navigation" onClick={onNavigate}/>}</>;
}
