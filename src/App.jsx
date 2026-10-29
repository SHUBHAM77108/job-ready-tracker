import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Bell, Menu, Moon, Search, Sun, X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firebaseEnabled } from "./firebase";
import { logout } from "./services/authService";
import { useAuth } from "./hooks/useAuth";
import { useTracker } from "./hooks/useTracker";
import Sidebar from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import { useReminders } from "./hooks/useReminders";
import ProfileMenu from "./components/ProfileMenu";
import Button from "./components/Button";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import DailyTracker from "./pages/DailyTracker";
import Roadmap from "./pages/Roadmap";
import Projects from "./pages/Projects";
import Applications from "./pages/Applications";
import Resources from "./pages/Resources";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import History from "./pages/History";
import WidgetPage from "./pages/WidgetPage";
import { localDateString, roadmapDayForDate } from "./utils/dates";
import { loadLocalState } from "./services/storage";

export default function App() {
 const {user,setUser,loading:authLoading,redirectError,clearRedirectError}=useAuth();
 const [demoUser,setDemoUser]=useState(null);
 const effectiveUser=user||demoUser;
 const {state,update,loading:stateLoading,syncError}=useTracker(effectiveUser);
 useReminders(state,!!effectiveUser&&!stateLoading);
 const [selectedDay,setSelectedDay]=useState(1);
 const [mobileOpen,setMobileOpen]=useState(false);
 const [todayKey,setTodayKey]=useState(()=>localDateString());
 useEffect(()=>{const tick=()=>{const k=localDateString();setTodayKey(prev=>prev===k?prev:k);};const id=window.setInterval(tick,30000);document.addEventListener("visibilitychange",tick);return()=>{window.clearInterval(id);document.removeEventListener("visibilitychange",tick);};},[]);
 const [search,setSearch]=useState("");
 const [toast,setToast]=useState(null);
 const [themeMode,setThemeMode]=useState(()=>localStorage.getItem("job-ready-theme")||"system");
 const [systemDark,setSystemDark]=useState(()=>window.matchMedia?.("(prefers-color-scheme: dark)").matches||false);
 const dark=themeMode==="system"?systemDark:themeMode==="dark";
 const setDark=value=>setThemeMode(value?"dark":"light");
 const location=useLocation(),navigate=useNavigate();
 useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light";localStorage.setItem("job-ready-theme",themeMode);},[dark,themeMode]);
 useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)");const onChange=e=>setSystemDark(e.matches);media.addEventListener?.("change",onChange);return()=>media.removeEventListener?.("change",onChange);},[]);
 useEffect(()=>{const fn=()=>setDemoUser({uid:"local-demo",email:"local-demo@jobready.local",displayName:"Local demo",isDemo:true});window.addEventListener("job-ready-demo-login",fn);return()=>window.removeEventListener("job-ready-demo-login",fn);},[]);
 useEffect(()=>{const today=roadmapDayForDate(state.settings.startDate);setSelectedDay(Math.max(1,Math.min(Number(state.settings.durationDays)||60,today)));},[effectiveUser?.uid,state.settings.startDate,state.settings.durationDays,todayKey]);
 const flash=message=>{setToast({message,undo:state.undoItem||null});window.clearTimeout(flash.timer);flash.timer=window.setTimeout(()=>setToast(null),6500);};
 const undo=()=>{const item=state.undoItem;if(!item)return;update(s=>{const next={...s,undoItem:null};if(item.type==="roadmap"){next.roadmap=[...s.roadmap,item.item];if(item.roadmapId)next.roadmaps=(s.roadmaps||[]).map(r=>r.id===item.roadmapId?{...r,topics:[...(r.topics||[]),item.item]}:r);}if(item.type==="roadmapDays"){const back=t=>Object.prototype.hasOwnProperty.call(item.prev,t.id)?{...t,day:item.prev[t.id]}:t;next.roadmaps=(s.roadmaps||[]).map(r=>r.id===item.roadmapId?{...r,topics:(r.topics||[]).map(back)}:r);if(s.activeRoadmapId===item.roadmapId)next.roadmap=(s.roadmap||[]).map(back);}if(item.type==="project")next.projects=[item.item,...s.projects];if(item.type==="application")next.applications=[item.item,...s.applications];if(item.type==="task"){const day=item.day;next.days={...s.days,[day]:{...(s.days[day]||{}),tasks:[...(s.days[day]?.tasks||[]),item.item]}};}return next;});setToast(null);};
 const signOut=async()=>{if(firebaseEnabled&&auth)await logout();else setDemoUser(null);};
 const actualToday=roadmapDayForDate(state.settings.startDate);
 useEffect(()=>{if(!effectiveUser)return;const handler=()=>{const n=roadmapDayForDate(state.settings.startDate);setSelectedDay(Math.max(1,Math.min(Number(state.settings.durationDays)||60,n)));};window.addEventListener("job-ready-go-today",handler);return()=>window.removeEventListener("job-ready-go-today",handler);},[effectiveUser?.uid,state.settings.startDate,state.settings.durationDays]);
 if(authLoading)return <div className="loading-screen">Loading your account…</div>;
 if(!effectiveUser)return <AuthPage redirectError={redirectError} clearRedirectError={clearRedirectError}/>;
 if(stateLoading)return <div className="loading-screen">Loading your workspace…</div>;
 if(location.pathname==="/widget")return <WidgetPage state={state}/>;
 const titleMap={"/":"Overview","/daily":"Daily tracker","/roadmap":"Learning roadmap","/projects":"Projects","/applications":"Job applications","/resources":"Timetable & resources","/settings":"Settings","/analytics":"Analytics","/history":"Activity history"};
 const routeTitle=titleMap[location.pathname]||"Workspace";
 return <div className="app-shell">
 <Sidebar mobileOpen={mobileOpen} onNavigate={()=>setMobileOpen(false)} roadmapCount={state.roadmap.length} projectCount={state.projects.length}/>
 <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumbs">Workspace <span>›</span> <strong>{routeTitle}</strong></div></div><div className="topbar-actions"><label className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search workspace…"/></label><button className="icon-button" title="Toggle theme" onClick={()=>setThemeMode(v=>v==="system"?(systemDark?"light":"dark"):v==="dark"?"light":"dark")}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="icon-button" title="Reminder settings" onClick={()=>navigate("/settings")}><Bell size={18}/></button><ProfileMenu user={effectiveUser} onLogout={signOut}/></div></header>
 <div className="page-content">{syncError&&<div className="sync-warning">{syncError}</div>}{toast&&<div className="toast"><span>{toast.message}</span>{state.undoItem&&<button onClick={undo}>Undo</button>}<button aria-label="Dismiss" onClick={()=>setToast(null)}>×</button></div>}{state.undoItem&&!toast&&<div className="toast"><span>Item removed.</span><button onClick={undo}>Undo</button><button aria-label="Dismiss" onClick={()=>update(s=>({...s,undoItem:null}))}>×</button></div>}
 <Routes>
 <Route path="/" element={<Dashboard state={state} update={update} flash={flash} selectedDay={selectedDay} setSelectedDay={setSelectedDay} navigate={navigate}/>}/>
 <Route path="/daily" element={<DailyTracker state={state} update={update} selectedDay={selectedDay} setSelectedDay={setSelectedDay} flash={flash} search={search}/>}/>
 <Route path="/roadmap" element={<Roadmap state={state} update={update} selectedDay={selectedDay} setSelectedDay={setSelectedDay} flash={flash} search={search} navigate={navigate}/>}/>
 <Route path="/projects" element={<Projects state={state} update={update} flash={flash} search={search}/>}/>
 <Route path="/applications" element={<Applications state={state} update={update} flash={flash} search={search}/>}/>
 <Route path="/resources" element={<Resources state={state} update={update} selectedDay={selectedDay} flash={flash}/>}/>
 <Route path="/settings" element={<Settings state={state} update={update} user={effectiveUser} flash={flash} dark={dark} themeMode={themeMode} setThemeMode={setThemeMode}/>}/>
 <Route path="/analytics" element={<Analytics state={state} setSelectedDay={setSelectedDay} navigate={navigate}/>}/>
 <Route path="/history" element={<History state={state} setSelectedDay={setSelectedDay} navigate={navigate}/>}/>
 <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes>
 <footer className="footer">Made for steady progress <span>•</span> Your next opportunity starts today.</footer></div></main><BottomNav menuOpen={mobileOpen} onMore={()=>setMobileOpen(true)}/></div>;
}
