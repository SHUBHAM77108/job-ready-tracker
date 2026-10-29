import { initialState, defaultTasks } from "../data";

export const LEGACY_STORAGE_KEY = "job-ready-tracker-react-v1";
export const storageKeyFor = (uid) => `job-ready-tracker-v2:${uid || "local-demo"}`;

export function migrateState(input) {
  const fresh = initialState();
  if (!input || typeof input !== "object") return fresh;
  const state = {...fresh, ...input, schemaVersion:2, settings:{...fresh.settings, ...(input.settings || {})}};
  state.settings.durationDays = Math.max(1, Math.min(365, Number(state.settings.durationDays) || 60));
  // Convert old hardcoded/global topics into a personal editable roadmap.
  const oldTopics = input.settings?.customTopics;
  if (!Array.isArray(state.roadmap) || !state.roadmap.length) {
    if (Array.isArray(oldTopics) && oldTopics.length) {
      state.roadmap = oldTopics.map((title, index) => ({id:`migrated-topic-${index+1}`, title:String(title), description:"", phase:"My roadmap"}));
    } else {
      state.roadmap = [];
    }
  }
  // Preserve each old day's status map and attach the old task definitions to each day where used.
  const hasLegacyGlobalTasks = Array.isArray(input.settings?.customTasks);
  const oldTasks = hasLegacyGlobalTasks ? input.settings.customTasks : defaultTasks;
  const migratedDays = {};
  const oldDays = input.days || {};
  // In the old app the timetable was global and appeared on every day. Preserve that behavior
  // during the one-time migration by copying its task definitions into each eligible day.
  if (hasLegacyGlobalTasks) {
    for (let day = 1; day <= Math.max(92, Number(state.settings.durationDays)||60); day++) {
      const value = oldDays[day] || {};
      const oldMap = value.tasks || {};
      const list = oldTasks.filter(task => !task.fromDay || day >= task.fromDay).map(task => {
        const record = Array.isArray(oldMap) ? oldMap.find(t => t.id === task.id) : oldMap[task.id];
        return {...task, ...(record || {}), id:task.id, status:record?.status || "upcoming"};
      });
      migratedDays[day] = {...value, tasks:list, note:value.note || "", leetcode:value.leetcode || 0};
    }
  } else {
    for (const [day, value] of Object.entries(oldDays)) {
      const oldMap = value?.tasks || {};
      const list = Array.isArray(oldMap) ? oldMap : Object.entries(oldMap).map(([taskId, record]) => {
        const definition = oldTasks.find(t => t.id === taskId) || {id:taskId, name:taskId, description:"", start:"", end:""};
        return {...definition, ...(record || {}), id:taskId, status:record?.status || "upcoming"};
      });
      migratedDays[day] = {...value, tasks:list, note:value?.note || "", leetcode:value?.leetcode || 0};
    }
  }
  state.days = migratedDays;
  // Remove old global template from settings; the new timetable is per-day.
  delete state.settings.customTasks;
  delete state.settings.customTopics;
  state.projects = Array.isArray(state.projects) ? state.projects : [];
  state.applications = Array.isArray(state.applications) ? state.applications : [];
  state.schedules = Array.isArray(state.schedules) ? state.schedules : [];
  state.unlockedDays = Array.isArray(state.unlockedDays) ? state.unlockedDays : [];
  // Add roadmap containers without removing the legacy flat roadmap, preserving existing topic IDs/statuses.
  state.roadmaps = Array.isArray(state.roadmaps) ? state.roadmaps : [];
  if (!state.roadmaps.length && state.roadmap.length) {
    state.roadmaps = [{id:"roadmap-default", name:"My learning roadmap", description:"Migrated from your existing roadmap", startDate:state.settings.startDate, durationDays:state.settings.durationDays, topics:state.roadmap}];
    state.activeRoadmapId = "roadmap-default";
  }
  if (!state.activeRoadmapId && state.roadmaps.length) state.activeRoadmapId = state.roadmaps[0].id;
  return state;
}

export function loadLocalState(uid) {
  const key = storageKeyFor(uid);
  const current = localStorage.getItem(key);
  if (current) {
    try { return migrateState(JSON.parse(current)); } catch { /* recover below */ }
  }
  // One-time migration from the original starter app's localStorage key — only for the local demo account, so a new
  // signed-in account never starts with someone else's (or old sample) data.
  const legacy = uid === "local-demo" ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
  if (legacy) {
    try {
      const migrated = migrateState(JSON.parse(legacy));
      localStorage.setItem(key, JSON.stringify(migrated));
      return migrated;
    } catch { /* use fresh state */ }
  }
  return initialState();
}
export function saveLocalState(uid, state) {
  localStorage.setItem(storageKeyFor(uid), JSON.stringify(state));
}

/* ---------- restoring a JSON backup ---------- */
// Reads the text of a backup file. Returns { state, summary } or throws an Error with a plain message.
export function parseBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error("This file is not valid JSON. Choose the backup you exported from Settings."); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("This does not look like a Job-Ready Tracker backup.");
  const known = ["days", "roadmap", "roadmaps", "projects", "applications", "settings", "schedules"];
  if (!known.some((key) => key in raw)) throw new Error("This does not look like a Job-Ready Tracker backup (no tracker data found).");
  for (const key of ["days", "settings"]) if (key in raw && (raw[key] === null || typeof raw[key] !== "object" || Array.isArray(raw[key]))) throw new Error(`The backup is damaged: “${key}” has the wrong shape.`);
  for (const key of ["roadmap", "roadmaps", "projects", "applications", "schedules"]) if (key in raw && !Array.isArray(raw[key])) throw new Error(`The backup is damaged: “${key}” should be a list.`);
  const state = migrateState(raw);
  delete state.undoItem; // transient
  return { state, summary: summarizeState(state) };
}
export function summarizeState(state) {
  return {
    topics: (state.roadmaps || []).reduce((n, r) => n + (r.topics?.length || 0), 0) || (state.roadmap || []).length,
    days: Object.keys(state.days || {}).length,
    projects: (state.projects || []).length,
    applications: (state.applications || []).length,
    planDays: Number(state.settings?.durationDays) || 0,
    startDate: state.settings?.startDate || "",
  };
}
