import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import { minTopicsPerDay, spreadTopicsAcrossDays, isLooseTopic } from "../services/scheduling";

// Gives every topic that is still in "Not on a day yet" a day, following the order the topics are saved in.
export default function SpreadTopicsDialog({ topics, duration, defaultStartDay = 1, onCancel, onApply }) {
  const looseCount = useMemo(() => topics.filter((t) => isLooseTopic(t, duration)).length, [topics, duration]);
  const [startDay, setStartDay] = useState("1");
  const start = Math.max(1, Math.min(duration, Number(startDay) || 1));
  const minPer = minTopicsPerDay(looseCount, start, duration);
  const [perDay, setPerDay] = useState("");
  const per = Math.max(minPer, Number(perDay) || 1);
  const plan = useMemo(() => spreadTopicsAcrossDays(topics, { startDay: start, perDay: per, duration }), [topics, start, per, duration]);
  return (
    <Modal title="Give these topics a day" subtitle="Topics keep their saved order: first topic → first day, and so on." onClose={onCancel} size="sm">
      <div className="follow-summary"><CalendarDays size={18} /><div>
        <strong>{plan.count} topic{plan.count === 1 ? "" : "s"} will move to Day {start} → Day {plan.lastDay}</strong>
        <span>{plan.perDay} topic{plan.perDay === 1 ? "" : "s"} per day. Only the topic’s day changes — no tasks are created, and nothing is deleted.</span>
      </div></div>
      <div className="form-two follow-fields">
        <label>Start from day<input type="number" min="1" max={duration} value={startDay} onChange={(e) => setStartDay(e.target.value)} /></label>
        <label>Topics per day<input type="number" min={minPer} max="12" value={perDay || String(per)} onChange={(e) => setPerDay(e.target.value)} /></label>
      </div>
      {minPer > 1 && <div className="notice-box">Your plan is {duration} days, so at least {minPer} topics per day are needed to fit all {plan.count}. To use 1 per day, make the plan longer in Settings first.</div>}
      <p className="muted-text">After this you can press “Schedule in Daily Tracker” to put them on the timetable in free time slots. You can undo this change right after applying it.</p>
      <div className="form-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button disabled={!plan.count} onClick={() => onApply(plan)}>Apply to {plan.count} topic{plan.count === 1 ? "" : "s"}</Button></div>
    </Modal>
  );
}
