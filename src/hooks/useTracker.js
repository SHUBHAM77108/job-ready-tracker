import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "../firebase";
import { loadLocalState, migrateState, saveLocalState } from "../services/storage";
import { initialState } from "../data";

// Cloud document = the whole tracker + two bookkeeping fields:
//   _rev      time of the last save (ms)    _client   which browser tab saved it
// A live listener (onSnapshot) applies changes made on another device within a second or two, so laptop and phone
// signed in to the same account always show the same data.
const SAVE_DELAY = 700;
const LOAD_TIMEOUT_MS = 8000;   // if the first cloud read hangs, continue with the on-device copy (a banner explains why)
const META = ["_rev", "_client"];
const stripMeta = (data) => { const copy = { ...data }; META.forEach(k => delete copy[k]); return copy; };
// Turn a Firestore error into something you can act on (the code is shown so the real cause is visible).
const FIRESTORE_LIMIT = 1000000;
export function explainSyncError(err) {
  const code = String(err?.code || "").replace("firestore/", "");
  if (code === "permission-denied") return "Cloud sync blocked (permission-denied). Firebase console → Firestore Database → Rules mein firestore.rules publish karo, aur check karo ki database bana hua hai.";
  if (code === "not-found" || code === "failed-precondition") return `Firestore database nahi mila (${code}). Firebase console → Build → Firestore Database → Create database, phir page reload karo.`;
  if (code === "unauthenticated") return "Login expire ho gaya (unauthenticated). Sign out karke dobara login karo.";
  if (code === "unavailable" || code === "deadline-exceeded") return `Firestore tak pahunch nahi paa rahe (${code}). Internet check karo — jaise hi connect hoga, sync dobara try hoga.`;
  if (code === "invalid-argument" || code === "resource-exhausted") return `Data Firestore ke limit mein nahi aaya (${code}) — shayad bahut bada ho gaya. Settings → Data overview mein size dekho.`;
  return `Cloud sync failed (${code || "unknown"}). ${err?.message || ""}`.trim();
}
const newClientId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function useTracker(user) {
  const [state,setState] = useState(initialState);
  const [loading,setLoading] = useState(true);
  const [syncError,setSyncError] = useState("");
  const loadedUid = useRef(null);
  const clientId = useRef(newClientId());
  const lastRev = useRef(0);          // newest cloud revision we have seen or written
  const fromRemote = useRef(false);   // the next state change came from the cloud: do not write it back
  const saveTimer = useRef(null);
  const cloud = !!user && firebaseEnabled && user.uid !== "local-demo";

  // 1) first load: local copy, then the cloud copy on top
  useEffect(() => {
    if (!user) { setLoading(false); loadedUid.current=null; return; }
    let cancelled=false;
    setLoading(true);
    (async()=>{
      const local=loadLocalState(user.uid);
      let next=local;
      if (cloud) {
        try {
          const snap=await Promise.race([getDoc(doc(db,"users",user.uid,"tracker","main")),new Promise((_,reject)=>window.setTimeout(()=>reject(Object.assign(new Error("Cloud read timed out"),{code:"unavailable"})),LOAD_TIMEOUT_MS))]);
          if (snap.exists()) {
            const data=snap.data();
            lastRev.current=Number(data._rev)||0;
            next=migrateState({...local,...stripMeta(data),settings:{...local.settings,...(data.settings||{})}});
          }
        } catch (err) { console.error("Firestore load failed:",err); setSyncError(explainSyncError(err)); }
      }
      if (!cancelled) {
        fromRemote.current=true; setState(next); loadedUid.current=user.uid; setLoading(false);
      }
    })();
    return ()=>{cancelled=true;};
  },[user?.uid]);

  // 2) live updates from other devices
  useEffect(() => {
    if (!cloud || loading || loadedUid.current!==user.uid) return undefined;
    const unsubscribe = onSnapshot(doc(db,"users",user.uid,"tracker","main"), snap => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      const data = snap.data();
      if (data._client === clientId.current) return;                 // our own write coming back
      const rev = Number(data._rev) || 0;
      if (rev <= lastRev.current) return;                            // older than what we already have
      lastRev.current = rev;
      fromRemote.current = true;
      setState(migrateState(stripMeta(data)));
      setSyncError("");
    }, err => { console.error("Firestore listener failed:",err); setSyncError(explainSyncError(err)); });
    return unsubscribe;
  },[user?.uid,loading,cloud]);

  // 3) save: local immediately, cloud shortly after you stop typing (and straight away if the tab is hidden / closed)
  const pending = useRef(null);
  useEffect(()=>{
    if (!user || loading || loadedUid.current!==user.uid) return undefined;
    saveLocalState(user.uid,state);
    if (!cloud) return undefined;
    if (fromRemote.current) { fromRemote.current=false; return undefined; }
    const save=()=>{
      window.clearTimeout(saveTimer.current); pending.current=null;
      const rev = Date.now();
      lastRev.current = Math.max(lastRev.current, rev);
      const payload = JSON.parse(JSON.stringify({...state,_rev:rev,_client:clientId.current})); // drops undefined values
      const bytes = new Blob([JSON.stringify(payload)]).size;
      if (bytes > FIRESTORE_LIMIT) { setSyncError(`Your data is ${Math.round(bytes/1024)} KB — over Firestore's 1 MB limit, so it is saved on this device only. Shorter plan ya kam daily tasks rakho (Settings → Data overview).`); return; }
      setDoc(doc(db,"users",user.uid,"tracker","main"),payload)
        .then(()=>setSyncError(""))
        .catch(err=>{
          console.error("Firestore save failed:",err);
          setSyncError(explainSyncError(err));
          if (["unavailable","deadline-exceeded"].includes(String(err?.code||"").replace("firestore/",""))) saveTimer.current=window.setTimeout(save,10000);
        });
    };
    pending.current=save;
    saveTimer.current = window.setTimeout(save,SAVE_DELAY);
    return ()=>{ window.clearTimeout(saveTimer.current); pending.current=null; };
  },[state,user?.uid,loading,cloud]);
  useEffect(()=>{
    const flush=()=>{ if (document.visibilityState==="hidden") pending.current?.(); };
    const leave=()=>pending.current?.();
    document.addEventListener("visibilitychange",flush);
    window.addEventListener("pagehide",leave);
    return ()=>{document.removeEventListener("visibilitychange",flush);window.removeEventListener("pagehide",leave);};
  },[]);

  const update = useCallback(updater => setState(prev => typeof updater==="function" ? updater(prev) : updater),[]);
  return {state,update,loading,syncError,setSyncError};
}
