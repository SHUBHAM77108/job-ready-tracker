import { BookOpen, Check } from "lucide-react";

// Shown inside a "Concept study (today's roadmap topic)" task: the topic(s) the roadmap plans for that day,
// so you know straight away what to study. Topics come from the active Learning roadmap.
export default function RoadmapSlotLine({ topics, onAdd }) {
  if (!topics.length) return <span className="slot-topic is-empty"><BookOpen size={13} /><span>No roadmap topic planned for this day</span>{onAdd && <button type="button" className="slot-link" onClick={e => { e.stopPropagation(); onAdd(); }}>Add topic</button>}</span>;
  return <span className="slot-topic"><BookOpen size={13} /><b>{topics.length === 1 ? "Today's topic" : `Today's ${topics.length} topics`}</b>
    <span className="slot-chips">{topics.map(t => <span key={t.id} className={`slot-chip ${t.completed ? "is-done" : ""}`}>{t.completed && <Check size={11} strokeWidth={3} />}{t.title}</span>)}</span></span>;
}
