import { useMemo, useState } from "react";
import { CalendarClock, CalendarDays, FileSpreadsheet, History, Pencil, Plus, Repeat, Save, Search, Trash2, Undo2, Upload } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import ImportPreview from "../components/ImportPreview";
import ConflictDialog from "../components/ConflictDialog";
import Modal from "../components/Modal";
import TimetableFollowDialog from "../components/TimetableFollowDialog";
import { parseScheduleFile } from "../services/importService";
import { makeId, roadmapDayForDate } from "../utils/dates";
import {
  ALL_WEEKDAYS, WEEKDAY_NAMES, applyRule, applyTimetable, findConflicts, previewConflicts,
  removeTimetableTasks, ruleOccurs, timeLabel, timetableDays, undoImportTasks,
} from "../services/scheduling";

const blankRule = (duration) => ({ name: "", description: "", start: "09:00", end: "10:00", recurrence: "daily", startDay: 1, endDay: duration, weekdays: [1, 2, 3, 4, 5] });
const parseDay = (value) => { const n = parseInt(String(value ?? "").replace(/\D/g, ""), 10); return Number.isFinite(n) && n >= 1 ? n : null; };
const weekdayLabel = (list = ALL_WEEKDAYS) => list.length === 7 ? "Every day" : [1, 2, 3, 4, 5, 6, 0].filter(d => list.includes(d)).map(d => WEEKDAY_NAMES[d]).join(", ");
const clashItems = (clashes) => clashes.slice(0, 6).map(c => ({
  label: `Day ${c.day} · ${c.row.name} (${c.row.start || "?"}${c.row.end ? `–${c.row.end}` : ""})`,
  detail: `Overlaps ${c.with.map(t => `${t.name} ${timeLabel(t)}`).join(", ")}`,
}));

export default function Resources({ state, update, flash }) {
  const duration = Number(state.settings.durationDays) || 60;
  const startDate = state.settings.startDate;
  const todayDay = Math.max(1, Math.min(duration, roadmapDayForDate(startDate)));

  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("timetables");
  const [search, setSearch] = useState("");
  const [scheduleForm, setScheduleForm] = useState(blankRule(duration));
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [follow, setFollow] = useState(null);        // timetable waiting for "how many days?"
  const [conflict, setConflict] = useState(null);    // clash popup
  const [removeTarget, setRemoveTarget] = useState(null);
  const [undoAsk, setUndoAsk] = useState(false);

  const schedules = state.schedules || [];
  const match = (s) => !search || `${s.name} ${s.description || ""} ${s.sourceFile || ""}`.toLowerCase().includes(search.toLowerCase());
  const timetables = useMemo(() => schedules.filter(s => s.kind === "timetable"), [schedules]);
  const rules = useMemo(() => schedules.filter(s => s.kind === "recurring"), [schedules]);
  const history = useMemo(() => schedules.filter(s => s.kind !== "timetable" && s.kind !== "recurring"), [schedules]);
  const counts = { timetables: timetables.length, rules: rules.length, history: history.length };
  const shown = { timetables: timetables.filter(match), rules: rules.filter(match), history: history.filter(match) }[tab];

  const readFile = async (file) => { try { setError(""); setPreview(await parseScheduleFile(file)); } catch (e) { setError(e.message || "Could not read file."); } };

  /* ---------- importing a file ---------- */
  // Rows WITH a Day column go to just that day. Rows WITHOUT one become a timetable that repeats every day.
  const startImport = ({ rows, name }) => {
    const clean = rows.filter(r => r.title.trim());
    if (!clean.length) { setError("Selected rows need a Task or Activity column."); return; }
    const dayRows = [], looseRows = [];
    let outOfRange = 0;
    clean.forEach((r, i) => {
      const base = { name: r.title.trim(), description: r.description || "", start: r.start || "", end: r.end || "" };
      if (String(r.day ?? "").trim()) {
        const d = parseDay(r.day);
        if (d && d <= duration) dayRows.push({ ...base, day: d, key: `day-${i}` }); else outOfRange++;
      } else looseRows.push({ ...base, key: `row-${i}` });
    });
    if (!dayRows.length && !looseRows.length) { setError(`Day numbers in the file must be between 1 and ${duration}.`); return; }
    setError("");
    const info = { name, fileName: preview?.fileName || name, dayRows, looseRows, outOfRange };
    if (looseRows.length) setFollow({ ...info, mode: "import", defaults: { startDay: todayDay, endDay: duration, weekdays: ALL_WEEKDAYS } });
    else runImport(info, null);
  };

  const runImport = (info, plan) => {
    const timetable = plan && info.looseRows.length ? {
      id: makeId(), kind: "timetable", name: info.name, sourceFile: info.fileName, rows: info.looseRows,
      startDay: plan.startDay, endDay: plan.endDay, weekdays: plan.weekdays, toEnd: plan.endDay >= duration, createdAt: new Date().toISOString(),
    } : null;
    const dayList = timetable ? timetableDays(timetable, startDate, duration) : [];
    const clashes = [
      ...(timetable ? previewConflicts(state.days, timetable.rows, dayList) : []),
      ...info.dayRows.flatMap(r => previewConflicts(state.days, [r], [r.day])),
    ];
    const go = () => commitImport(info, timetable, dayList);
    if (clashes.length) {
      setConflict({
        title: "Some tasks clash with tasks you already have",
        message: `${clashes.length} time clash${clashes.length === 1 ? "" : "es"} found. If you continue, both tasks stay and are shown together at that time.`,
        items: clashItems(clashes),
        extra: clashes.length > 6 ? <p className="muted-text">…and {clashes.length - 6} more.</p> : null,
        proceedLabel: "Import anyway", cancelLabel: "Go back",
        onProceed: () => { setConflict(null); go(); },
      });
      return;
    }
    go();
  };

  const commitImport = (info, timetable, dayList) => {
    const importId = makeId();
    update(s => {
      let days = { ...s.days };
      info.dayRows.forEach(r => {
        const old = days[r.day] || { tasks: [] };
        days[r.day] = { ...old, tasks: [...(old.tasks || []), { id: makeId(), importId, name: r.name, description: r.description, start: r.start, end: r.end, flexible: !r.start, status: "upcoming", required: true, workLogs: [] }] };
      });
      let list = [...(s.schedules || [])];
      if (info.dayRows.length) list = [{ id: importId, kind: "import", name: info.name, sourceFile: info.fileName, taskCount: info.dayRows.length, createdAt: new Date().toISOString() }, ...list];
      let timetableTasks = 0;
      if (timetable) { const res = applyTimetable(days, timetable, s.settings.startDate, duration); days = res.days; timetableTasks = res.added; list = [timetable, ...list]; }
      const lastImport = { importId, timetableId: timetable?.id || null, name: info.name, fileName: info.fileName, taskCount: info.dayRows.length + timetableTasks, at: new Date().toISOString() };
      return { ...s, days, schedules: list, lastImport };
    });
    const parts = [];
    if (timetable) parts.push(`${timetable.rows.length} tasks/day on ${dayList.length} days`);
    if (info.dayRows.length) parts.push(`${info.dayRows.length} day-specific tasks`);
    flash(`Imported: ${parts.join(" + ")}.${info.outOfRange ? ` ${info.outOfRange} rows skipped (day outside the plan).` : ""} Wrong file? Use “Undo last import” below.`);
    setFollow(null); setPreview(null); setTab("timetables");
  };

  /* ---------- undo the last import ---------- */
  const lastImport = state.lastImport || null;
  const undoPreview = useMemo(() => lastImport ? undoImportTasks(state.days, lastImport) : null, [state.days, lastImport]);
  const undoLastImport = () => {
    if (!lastImport) return;
    update(s => {
      const imp = s.lastImport;
      if (!imp) return s;
      const res = undoImportTasks(s.days, imp);
      return { ...s, days: res.days, lastImport: null, schedules: (s.schedules || []).filter(x => x.id !== imp.importId && x.id !== imp.timetableId) };
    });
    flash(`Import “${lastImport.name}” undone: ${undoPreview.removed} task${undoPreview.removed === 1 ? "" : "s"} removed${undoPreview.kept ? `, ${undoPreview.kept} started/logged task${undoPreview.kept === 1 ? "" : "s"} kept` : ""}.`);
    setUndoAsk(false);
  };

  /* ---------- changing / deleting a timetable ---------- */
  const openChangeDays = (tt) => setFollow({ mode: "edit", timetable: tt, name: tt.name, looseRows: tt.rows, dayRows: [], defaults: { startDay: tt.startDay, endDay: tt.endDay, weekdays: tt.weekdays || ALL_WEEKDAYS } });
  const applyChangeDays = (tt, plan) => {
    const next = { ...tt, startDay: plan.startDay, endDay: plan.endDay, weekdays: plan.weekdays, toEnd: plan.endDay >= duration };
    const dayList = timetableDays(next, startDate, duration);
    const preview = applyTimetable(state.days, next, startDate, duration);
    const clashes = previewConflicts(state.days, next.rows, dayList, tt.id);
    const go = () => {
      update(s => ({ ...s, days: applyTimetable(s.days, next, s.settings.startDate, duration).days, schedules: s.schedules.map(x => x.id === tt.id ? next : x) }));
      flash(`Timetable updated: ${preview.added} tasks added${preview.removed ? `, ${preview.removed} not-yet-started tasks removed` : ""}.`);
      setFollow(null);
    };
    if (clashes.length) {
      setConflict({ title: "Some tasks clash with tasks you already have", message: "If you continue, both tasks stay and are shown together at that time.", items: clashItems(clashes), proceedLabel: "Update anyway", cancelLabel: "Go back", onProceed: () => { setConflict(null); go(); } });
      return;
    }
    go();
  };
  const deleteTimetable = (tt, alsoTasks) => {
    update(s => {
      const res = alsoTasks ? removeTimetableTasks(s.days, tt.id, true) : { days: s.days };
      return { ...s, days: res.days, schedules: s.schedules.filter(x => x.id !== tt.id) };
    });
    flash(alsoTasks ? "Timetable deleted and its not-yet-started tasks removed. Started/completed records were kept." : "Timetable deleted. Existing tasks were kept.");
    setRemoveTarget(null);
  };

  /* ---------- recurring rules (single task repeating) ---------- */
  const openNewRule = () => { setEditingSchedule(null); setScheduleForm(blankRule(duration)); setError(""); setScheduleModal(true); };
  const editRule = (rule) => { setEditingSchedule(rule.id); setScheduleForm({ ...rule }); setError(""); setScheduleModal(true); };
  const closeRule = () => { setScheduleModal(false); setEditingSchedule(null); };
  const commitRule = (rule) => {
    update(s => {
      const res = applyRule(s.days, rule, s.settings.startDate);
      return { ...s, days: res.days, schedules: [rule, ...(s.schedules || []).filter(x => x.id !== rule.id)] };
    });
    closeRule(); setScheduleForm(blankRule(duration)); setError(""); setTab("rules");
    flash(editingSchedule ? "Schedule rule updated. Existing task records are preserved." : "Recurring schedule saved and tasks copied to matching days.");
  };
  const saveRecurring = (e) => {
    e.preventDefault();
    const rule = {
      ...scheduleForm, id: editingSchedule || makeId(), kind: "recurring", createdAt: new Date().toISOString(),
      startDay: Math.max(1, Math.min(duration, Number(scheduleForm.startDay) || 1)),
      endDay: Math.max(1, Math.min(duration, Number(scheduleForm.endDay) || duration)),
      weekdays: scheduleForm.weekdays || [],
    };
    if (rule.endDay < rule.startDay) { setError("End day must be on or after start day."); return; }
    const clashes = [];
    for (let d = rule.startDay; d <= rule.endDay; d++) {
      if (!ruleOccurs(rule, d, startDate)) continue;
      const existing = (state.days[d]?.tasks || []).filter(t => t.scheduleId !== rule.id);
      const hits = findConflicts(existing, { id: "probe", start: rule.start, end: rule.end, status: "upcoming" });
      if (hits.length) clashes.push({ day: d, row: rule, with: hits });
    }
    if (clashes.length) {
      setConflict({
        title: "This schedule clashes with existing tasks",
        message: `${clashes.length} day${clashes.length === 1 ? " has" : "s have"} a task at ${rule.start}${rule.end ? `–${rule.end}` : ""}. If you continue, both tasks stay and are shown together.`,
        items: clashItems(clashes), extra: clashes.length > 6 ? <p className="muted-text">…and {clashes.length - 6} more days.</p> : null,
        proceedLabel: "Save anyway", cancelLabel: "Change time",
        onProceed: () => { setConflict(null); commitRule(rule); },
      });
      return;
    }
    commitRule(rule);
  };
  const deleteRule = (rule) => {
    if (!confirm("Delete this schedule rule? Existing Daily Tracker task and completion records will be preserved.")) return;
    update(s => ({ ...s, schedules: s.schedules.filter(x => x.id !== rule.id) }));
    flash("Schedule rule deleted; existing tracker records were preserved.");
  };

  /* ---------- render ---------- */
  const tabs = [["timetables", "Timetables", Repeat], ["rules", "Single-task rules", CalendarDays], ["history", "Import history", History]];
  return <>
    <PageHeader eyebrow="YOUR MATERIALS" title="Timetable & resources" description="Import a timetable once — it repeats on every day you choose." action={<Button onClick={openNewRule}><Plus size={15} /> Add single task rule</Button>} />

    <section className="panel import-panel">
      <label className="dropzone compact">
        <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
        <span className="upload-cloud"><Upload size={22} /></span>
        <span className="dropzone-copy"><strong>Choose CSV or Excel file</strong><small>.csv, .xlsx, .xls · columns: Task, Start, End, Description, Day (optional)</small></span>
        <span className="button secondary dropzone-btn">Browse</span>
      </label>
      <ul className="import-rules">
        <li><b>No Day column</b> → a permanent timetable: same tasks every day. You’ll choose for how many days.</li>
        <li><b>Day column filled</b> → that task goes only to that day.</li>
        <li>Anything that overlaps an existing task asks you first.</li>
      </ul>
      {error && !scheduleModal && <div className="error-box">{error}</div>}
    </section>

    {preview && <ImportPreview preview={preview} onCancel={() => setPreview(null)} onImport={startImport} mode="timetable" />}

    {lastImport && undoPreview && (undoPreview.removed > 0 || undoPreview.kept > 0) && <section className="panel undo-import-bar">
      <span className="resource-icon"><Undo2 size={18} /></span>
      <div className="undo-import-copy"><strong>Last import: {lastImport.name}</strong><span>{lastImport.taskCount} tasks added · {undoPreview.removed} can still be removed{undoPreview.kept ? ` · ${undoPreview.kept} already started (will stay)` : ""}</span></div>
      <Button variant="secondary" onClick={() => setUndoAsk(true)} disabled={!undoPreview.removed && !undoPreview.kept}><Undo2 size={14} /> Undo last import</Button>
    </section>}

    <section className="panel schedule-manager">
      <div className="schedule-toolbar">
        <div className="seg" role="tablist" aria-label="Schedules">
          {tabs.map(([id, label, Icon]) => <button key={id} role="tab" aria-selected={tab === id} className={`seg-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}><Icon size={14} /> {label} <span className="seg-count">{counts[id]}</span></button>)}
        </div>
        <label className="search-pill"><Search size={14} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" aria-label="Search schedules" /></label>
      </div>

      {shown.length === 0 && <div className="empty-state small compact-empty">
        <h3>{search ? "Nothing matches your search" : tab === "timetables" ? "No timetable yet" : tab === "rules" ? "No single-task rules yet" : "No imports yet"}</h3>
        <p>{tab === "timetables" ? "Import a file above and it will repeat on the days you pick." : tab === "rules" ? "Use “Add single task rule” for one task that repeats (daily, weekly…)." : "Files you import will be listed here."}</p>
      </div>}

      {tab === "timetables" && shown.length > 0 && <div className="schedule-manager-list">{shown.map(tt => {
        const n = timetableDays(tt, startDate, duration).length;
        return <article className="schedule-manager-item" key={tt.id}>
          <span className="resource-icon"><Repeat size={18} /></span>
          <div className="schedule-manager-copy">
            <strong>{tt.name}</strong>
            <div className="tt-chips">{tt.rows.slice(0, 4).map(r => <span key={r.key}>{r.start || "Flexible"} · {r.name}</span>)}{tt.rows.length > 4 && <span>+{tt.rows.length - 4} more</span>}</div>
            <div className="schedule-manager-meta"><span>{tt.rows.length} tasks / day</span><span>Day {tt.startDay}–{tt.endDay} · {n} days</span><span>{weekdayLabel(tt.weekdays)}</span></div>
          </div>
          <div className="schedule-manager-actions"><Button variant="secondary" onClick={() => openChangeDays(tt)}><CalendarClock size={14} /> Change days</Button><Button variant="secondary" onClick={() => setRemoveTarget(tt)} aria-label="Delete timetable"><Trash2 size={14} /></Button></div>
        </article>;
      })}</div>}

      {tab === "rules" && shown.length > 0 && <div className="schedule-manager-list">{shown.map(rule => <article className="schedule-manager-item" key={rule.id}>
        <span className="resource-icon"><CalendarDays size={18} /></span>
        <div className="schedule-manager-copy"><strong>{rule.name}</strong>{rule.description && <p>{rule.description}</p>}
          <div className="schedule-manager-meta"><span>{rule.recurrence === "once" ? "One-time" : rule.recurrence === "custom" ? "Every other day" : rule.recurrence}</span><span>{rule.start || "Flexible"}{rule.end ? `–${rule.end}` : ""}</span><span>Day {rule.startDay}–{rule.endDay}</span>{rule.recurrence === "weekly" && <span>{weekdayLabel(rule.weekdays)}</span>}</div></div>
        <div className="schedule-manager-actions"><Button variant="secondary" onClick={() => editRule(rule)}><Pencil size={14} /> Edit</Button><Button variant="secondary" onClick={() => deleteRule(rule)}><Trash2 size={14} /></Button></div>
      </article>)}</div>}

      {tab === "history" && shown.length > 0 && <div className="saved-schedules">{shown.map(s => <div className="saved-schedule" key={s.id}>
        <span className="file-icon"><FileSpreadsheet size={18} /></span>
        <div className="saved-schedule-info"><strong>{s.name}</strong><span>{s.sourceFile || "Imported file"} · {s.taskCount} day-specific task{s.taskCount === 1 ? "" : "s"}{s.day ? ` · Day ${s.day}` : ""}</span></div>
        <button className="icon-button danger" title="Remove from history (tasks stay)" onClick={() => update(st => ({ ...st, schedules: st.schedules.filter(x => x.id !== s.id) }))}><Trash2 size={15} /></button>
      </div>)}</div>}
    </section>

    {follow && <TimetableFollowDialog
      title={follow.mode === "edit" ? `Change days for “${follow.name}”` : undefined}
      confirmLabel={follow.mode === "edit" ? "Update timetable" : "Apply timetable"}
      taskCount={follow.looseRows.length} duration={duration} startDate={startDate} defaults={follow.defaults}
      previewConflicts={(dayList) => previewConflicts(state.days, follow.looseRows, dayList, follow.timetable?.id).length}
      onCancel={() => setFollow(null)}
      onConfirm={(plan) => follow.mode === "edit" ? applyChangeDays(follow.timetable, plan) : runImport(follow, plan)} />}

    {undoAsk && lastImport && undoPreview && <Modal title="Undo last import?" subtitle={`“${lastImport.name}” · ${lastImport.fileName}`} onClose={() => setUndoAsk(false)} size="sm">
      <p>This removes the <b>{undoPreview.removed}</b> task{undoPreview.removed === 1 ? "" : "s"} that this import added, plus its timetable entry.{undoPreview.kept ? ` ${undoPreview.kept} task${undoPreview.kept === 1 ? " was" : "s were"} already started, logged or completed — those stay.` : ""} Tasks you added yourself are never touched.</p>
      <div className="form-actions"><Button variant="secondary" onClick={() => setUndoAsk(false)}>Cancel</Button><Button onClick={undoLastImport}><Undo2 size={14} /> Remove imported tasks</Button></div>
    </Modal>}

    {removeTarget && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setRemoveTarget(null); }}>
      <section className="panel confirm-modal" role="dialog" aria-modal="true">
        <h2>Delete “{removeTarget.name}”?</h2>
        <p>Tasks that were already started, logged or completed are always kept. What should happen to the tasks that haven’t been started yet?</p>
        <div className="form-actions stack-mobile">
          <Button variant="secondary" onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button variant="secondary" onClick={() => deleteTimetable(removeTarget, false)}>Delete, keep all tasks</Button>
          <Button onClick={() => deleteTimetable(removeTarget, true)}>Delete + remove unstarted tasks</Button>
        </div>
      </section>
    </div>}

    {scheduleModal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeRule(); }}><section className="panel form-panel schedule-modal">
      <div className="panel-heading"><div><h2>{editingSchedule ? "Edit single task rule" : "Add single task rule"}</h2><p>Changes preserve existing Daily Tracker task and completion records.</p></div><button className="icon-button" type="button" aria-label="Close schedule form" onClick={closeRule}><span aria-hidden="true">×</span></button></div>
      <form className="project-form" onSubmit={saveRecurring}>
        <label>Task name *<input required value={scheduleForm.name} onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })} placeholder="e.g. JavaScript practice" /></label>
        <label>Description<textarea value={scheduleForm.description || ""} onChange={e => setScheduleForm({ ...scheduleForm, description: e.target.value })} placeholder="What should you work on?" /></label>
        <div className="form-two"><label>Start time<input type="time" value={scheduleForm.start} onChange={e => setScheduleForm({ ...scheduleForm, start: e.target.value })} /></label><label>End time<input type="time" value={scheduleForm.end} onChange={e => setScheduleForm({ ...scheduleForm, end: e.target.value })} /></label></div>
        <div className="form-two"><label>Frequency<select value={scheduleForm.recurrence} onChange={e => setScheduleForm({ ...scheduleForm, recurrence: e.target.value })}><option value="once">One-time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="custom">Custom (every other day)</option></select></label><label>Start day<input type="number" min="1" max={duration} value={scheduleForm.startDay} onChange={e => setScheduleForm({ ...scheduleForm, startDay: e.target.value })} /></label></div>
        <div className="form-two"><label>End day<input type="number" min="1" max={duration} value={scheduleForm.endDay} onChange={e => setScheduleForm({ ...scheduleForm, endDay: e.target.value })} /></label>
          {scheduleForm.recurrence === "weekly" && <div className="weekday-field"><span>Weekdays</span><div className="weekday-row">{[1, 2, 3, 4, 5, 6, 0].map(d => { const on = (scheduleForm.weekdays || []).includes(d); return <button type="button" key={d} className={`weekday-chip ${on ? "selected" : ""}`} aria-pressed={on} onClick={() => setScheduleForm({ ...scheduleForm, weekdays: on ? scheduleForm.weekdays.filter(x => x !== d) : [...(scheduleForm.weekdays || []), d] })}>{WEEKDAY_NAMES[d]}</button>; })}</div></div>}
        </div>
        {error && <div className="error-box">{error}</div>}
        <div className="form-actions"><Button variant="secondary" onClick={closeRule}>Cancel</Button><Button type="submit"><Save size={14} /> {editingSchedule ? "Save changes" : "Create rule"}</Button></div>
      </form>
    </section></div>}

    {conflict && <ConflictDialog {...conflict} onCancel={() => setConflict(null)} />}
  </>;
}
