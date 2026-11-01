import { useState } from "react";
import { Pin, PinOff, Plus, StickyNote, Trash2 } from "lucide-react";
import { makeId } from "../utils/dates";

const COLORS = ["yellow", "pink", "blue", "green", "orange"];
const timeLabel = iso => { try { return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""; } catch { return ""; } };

// A day can hold any number of sticky notes. They are saved as day.notes (id, text, color, pinned, createdAt);
// day.note is kept as the joined text so History search and older data keep working.
// An older single note (day.note only) shows up as the first sticky, so nothing is lost and you can type straight away.
export const notesOf = day => Array.isArray(day?.notes) && day.notes.length
  ? day.notes
  : [{ id: "note-main", text: day?.note || "", color: 0, pinned: false, createdAt: null }];

export default function StickyNotes({ day, onChange }) {
  const [focusId, setFocusId] = useState(null);
  const notes = notesOf(day);
  const ordered = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));   // pinned first, otherwise creation order
  const save = next => onChange(next, next.map(n => (n.text || "").trim()).filter(Boolean).join("\n\n"));
  const patch = (id, change) => save(notes.map(n => n.id === id ? { ...n, ...change } : n));
  const add = () => {
    const note = { id: makeId(), text: "", color: notes.length % COLORS.length, pinned: false, createdAt: new Date().toISOString() };
    setFocusId(note.id);
    save([...notes, note]);
  };
  const remove = id => save(notes.filter(n => n.id !== id));

  return <section className="panel notes-panel">
    <div className="panel-heading"><div><h2>Daily notes</h2><p>What did you learn today?</p></div><button type="button" className="button notes-add" onClick={add}><Plus size={14} /> Add note</button></div>
    <div className="sticky-grid">
      {ordered.map(n => {
        const color = COLORS[(Number(n.color) || 0) % COLORS.length];
        return <div className={`sticky c-${color} ${n.pinned ? "is-pinned" : ""}`} key={n.id}>
          <div className="sticky-top">
            <span className="sticky-time"><StickyNote size={12} /> {timeLabel(n.createdAt) || "Note"}</span>
            <span className="sticky-actions">
              <button type="button" className="sticky-btn" aria-pressed={!!n.pinned} title={n.pinned ? "Unpin" : "Pin to top"} aria-label={n.pinned ? "Unpin note" : "Pin note"} onClick={() => patch(n.id, { pinned: !n.pinned })}>{n.pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
              <button type="button" className="sticky-btn" title="Delete note" aria-label="Delete note" onClick={() => remove(n.id)}><Trash2 size={14} /></button>
            </span>
          </div>
          <textarea className="sticky-text" autoFocus={n.id === focusId} value={n.text || ""} onChange={e => patch(n.id, { text: e.target.value })} placeholder="Write notes, blockers and wins…" aria-label="Sticky note" />
          <div className="sticky-tools">
            <span className="sticky-colors" role="group" aria-label="Note colour">{COLORS.map((c, i) => <button type="button" key={c} className={`sticky-dot c-${c} ${color === c ? "on" : ""}`} aria-label={`${c} note`} aria-pressed={color === c} onClick={() => patch(n.id, { color: i })} />)}</span>
          </div>
        </div>;
      })}
    </div>
  </section>;
}
