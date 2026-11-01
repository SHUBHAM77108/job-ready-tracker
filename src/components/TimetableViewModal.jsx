import { BookOpen, TriangleAlert } from "lucide-react";
import Modal from "./Modal";
import { ALL_WEEKDAYS, WEEKDAY_NAMES, isRoadmapSlot, taskRange, toMin } from "../services/scheduling";

const weekdayText = (list = ALL_WEEKDAYS) => list.length === 7 ? "Every day" : [1, 2, 3, 4, 5, 6, 0].filter(d => list.includes(d)).map(d => WEEKDAY_NAMES[d]).join(", ");
const lengthText = minutes => minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`;

// Big pop-up with the whole imported timetable laid out as a table (time, task, description), in time order.
export default function TimetableViewModal({ timetable, dateText, dayCount, onClose }) {
  const rows = [...(timetable.rows || [])].sort((a, b) => (toMin(a.start) ?? 9999) - (toMin(b.start) ?? 9999));
  const ranges = rows.map(r => taskRange({ start: r.start, end: r.end }));
  const clash = i => ranges[i] && ranges.some((o, j) => j !== i && o && ranges[i][0] < o[1] && o[0] < ranges[i][1]);
  return <Modal title={timetable.name} subtitle="Imported timetable · the same tasks repeat on every chosen day" size="xl" onClose={onClose}>
    <div className="tt-view-meta">
      {timetable.sourceFile && <span>{timetable.sourceFile}</span>}
      <span>{rows.length} task{rows.length === 1 ? "" : "s"} / day</span>
      <span>{dateText}{dayCount ? ` · ${dayCount} day${dayCount === 1 ? "" : "s"}` : ""}</span>
      <span>{weekdayText(timetable.weekdays)}</span>
    </div>
    <div className="tt-view-scroll">
      <table className="tt-view-table">
        <thead><tr><th className="c-no">#</th><th className="c-time">Time</th><th className="c-len">Length</th><th>Task</th><th className="c-desc">Description</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.key || i} className={clash(i) ? "has-clash" : ""}>
          <td className="c-no">{i + 1}</td>
          <td className="c-time"><b>{r.start || "Flexible"}</b>{r.end && <span>{r.end}</span>}</td>
          <td className="c-len">{ranges[i] && r.end ? lengthText(ranges[i][1] - ranges[i][0]) : "—"}</td>
          <td className="c-task"><strong>{r.name}</strong>
            {isRoadmapSlot({ name: r.name }) && <span className="tt-badge"><BookOpen size={11} /> Shows that day's roadmap topic</span>}
            {clash(i) && <span className="tt-badge warn"><TriangleAlert size={11} /> Overlaps another row</span>}
            {r.description && <span className="tt-desc-inline">{r.description}</span>}</td>
          <td className="c-desc">{r.description || <i>—</i>}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </Modal>;
}
