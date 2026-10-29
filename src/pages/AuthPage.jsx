import { useState } from "react";
import { BarChart3, BookOpen, CalendarCheck, Cloud, Eye, EyeOff } from "lucide-react";
import Button from "../components/Button";
import { firebaseEnabled } from "../firebase";
import ActivityHeatmap, { HeatmapLegend } from "../components/ActivityHeatmap";
import { AUTH_ERROR_KEY } from "../hooks/useAuth";
import { loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword } from "../services/authService";

// One screen, no scrolling: the card is compact, the heading shrinks on short screens, optional text hides itself.
export default function AuthPage() {
  const [mode,setMode]=useState("login"),[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[show,setShow]=useState(false),[error,setError]=useState(()=>{try{const raw=sessionStorage.getItem(AUTH_ERROR_KEY);if(!raw)return "";sessionStorage.removeItem(AUTH_ERROR_KEY);return friendlyError(JSON.parse(raw));}catch{return "";}}),[info,setInfo]=useState(""),[busy,setBusy]=useState(false);
  const signup=mode==="signup";
  const switchMode=m=>{setMode(m);setError("");setInfo("");};
  const submit=async e=>{e.preventDefault();setError("");setInfo("");setBusy(true);try{if(signup)await registerWithEmail(name,email,password);else await loginWithEmail(email,password);}catch(err){setError(friendlyError(err));}finally{setBusy(false);}};
  const google=async()=>{setError("");setInfo("");setBusy(true);try{await loginWithGoogle();}catch(err){setError(friendlyError(err));}finally{setBusy(false);}};
  const forgot=async()=>{setError("");setInfo("");if(!email.trim()){setError("Pehle upar email likho, phir 'Forgot password' dabao.");return;}try{await resetPassword(email);setInfo("Password reset email bhej diya. Inbox (aur spam) check karo.");}catch(err){setError(friendlyError(err));}};
  return <main className="auth-screen"><section className="auth-card">
    <div className="auth-brand"><span className="brand-mark auth-mark"><img className="brand-mark-image" src="/Plan%20at%20a%20Glance%20Heatmap.png" alt=""/></span><span><strong>Job-Ready</strong><small>Tracker</small></span></div>
    <h1>{signup?"Create your account":"Welcome back"}</h1>
    <p className="auth-lede">{signup?"Start tracking your learning, projects and applications.":"Pick up right where you left off — on any device."}</p>
    <div className="auth-tabs" role="tablist"><button role="tab" aria-selected={!signup} className={!signup?"active":""} onClick={()=>switchMode("login")}>Login</button><button role="tab" aria-selected={signup} className={signup?"active":""} onClick={()=>switchMode("signup")}>Sign up</button></div>
    {!firebaseEnabled&&<div className="notice-box auth-notice"><strong>Local demo mode</strong><span>Firebase is not configured, so data stays in this browser.</span></div>}
    <Button variant="secondary" onClick={google} disabled={busy||!firebaseEnabled} className="google-button"><svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg> Continue with Google</Button>
    <div className="auth-or"><span/>or with email<span/></div>
    <form className="auth-form" onSubmit={submit}>
      {signup&&<label>Full name<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}
      <label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
      <label>Password<span className="pw-wrap"><input type={show?"text":"password"} minLength="6" required autoComplete={signup?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/><button type="button" className="pw-toggle" aria-label={show?"Hide password":"Show password"} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></span></label>
      {error&&<div className="error-box">{error}</div>}{info&&<div className="info-box">{info}</div>}
      <Button type="submit" disabled={busy||!firebaseEnabled}>{busy?"Please wait…":signup?"Create account":"Login"}</Button>
    </form>
    {!signup&&firebaseEnabled&&<button type="button" className="text-button" onClick={forgot}>Forgot password?</button>}
    {!firebaseEnabled&&<Button variant="secondary" className="full-width" onClick={()=>{window.dispatchEvent(new CustomEvent("job-ready-demo-login"));}}>Continue in local demo</Button>}
    <div className="auth-footer">Your progress stays yours — synced to your account.</div>
  </section><aside className="auth-art" aria-hidden="true">
    <div className="art-glow one"/><div className="art-glow two"/>
    <div className="art-topline">YOUR PERSONAL CAREER WORKSPACE</div>
    <div className="art-title">Small steps.<br/><span>Real progress.</span></div>
    <div className="art-card"><div className="art-card-head"><strong>Plan at a glance</strong><span>365 days</span></div><ActivityHeatmap/><HeatmapLegend/></div>
    <ul className="art-features"><li><CalendarCheck size={16}/> Daily tasks &amp; timetables</li><li><BookOpen size={16}/> Personal learning roadmap</li><li><BarChart3 size={16}/> Streaks and analytics</li><li><Cloud size={16}/> Synced on phone &amp; laptop</li></ul>
    <div className="art-quote">Consistency beats intensity.</div>
  </aside></main>;
}
function friendlyError(err){const code=err?.code||"";if(code==="jr/auth-timeout"||code==="jr/auth-init"||code.includes("auth/network-request-failed"))return "Sign-in service se connect nahi ho paaya. Internet check karo aur page reload karke dobara try karo.";if(code.includes("auth/invalid-credential")||code.includes("auth/wrong-password")||code.includes("auth/user-not-found"))return "Email ya password match nahi hua. Details check karo.";if(code.includes("auth/email-already-in-use"))return "Is email ka account already hai. Login try karo.";if(code.includes("auth/weak-password"))return "Password kam se kam 6 characters ka rakho.";if(code.includes("auth/too-many-requests"))return "Bahut zyada koshish ho gayi. Thodi der baad try karo.";if(code.includes("auth/popup-closed-by-user"))return "Google sign-in popup band ho gaya. Dobara try karo.";if(code.includes("auth/network-request-failed"))return "Network error. Internet check karke dobara try karo.";if(code.includes("auth/web-storage-unsupported"))return "Is browser mein storage/cookies block hain. Cookies allow karo ya private mode band karo.";if(code.includes("auth/popup-blocked"))return "Browser ne popup block kiya. Popup allow karke dobara try karo.";if(code.includes("auth/unauthorized-domain"))return "Firebase Authentication → Settings → Authorized domains mein is site ka domain (localhost / live domain) add karo.";if(code.includes("auth/operation-not-allowed"))return "Firebase console mein ye sign-in method (Email/Password ya Google) enable karo.";return err?.message||"Sign-in failed. Please try again.";}
