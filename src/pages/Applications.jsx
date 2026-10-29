import { useMemo, useState } from "react";
import { BriefcaseBusiness, ExternalLink, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { makeId, localDateString, formatDate } from "../utils/dates";

const STATUSES = ["Saved", "Applied", "Interview", "Offer", "Rejected"];
const blank = () => ({ company: "", role: "", url: "", status: "Applied", date: localDateString(), notes: "" });
const slug = s => s.toLowerCase();

export default function Applications({ state, update, flash, search = "" }) {
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const apps = state.applications || [];

  const counts = useMemo(() => Object.fromEntries([["All", apps.length], ...STATUSES.map(s => [s, apps.filter(a => a.status === s).length])]), [apps]);
  const needle = `${q} ${search}`.trim().toLowerCase();
  const shown = apps.filter(a => (filter === "All" || a.status === filter) && (!needle || `${a.company} ${a.role} ${a.notes || ""}`.toLowerCase().includes(needle)));

  const begin = app => { setEditingId(app?.id || null); setForm(app ? { ...blank(), ...app } : blank()); };
  const close = () => { setForm(null); setEditingId(null); };
  const save = e => {
    e.preventDefault();
    const item = { ...form, company: form.company.trim(), role: form.role.trim() };
    if (!item.company || !item.role) return;
    update(s => ({ ...s, applications: editingId ? s.applications.map(a => a.id === editingId ? { ...a, ...item } : a) : [{ ...item, id: makeId() }, ...s.applications] }));
    flash(editingId ? "Application updated." : "Application added.");
    close();
  };
  const patch = (id, key, value) => update(s => ({ ...s, applications: s.applications.map(a => a.id === id ? { ...a, [key]: value } : a) }));
  const remove = a => { update(s => ({ ...s, applications: s.applications.filter(x => x.id !== a.id), undoItem: { type: "application", item: a } })); flash("Application removed. You can undo this action."); };

  const statusSelect = a => <select className={`table-select app-status s-${slug(a.status)}`} aria-label={`Status for ${a.company}`} value={a.status} onChange={e => patch(a.id, "status", e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>;
  const actions = a => <div className="row-actions"><button className="icon-button" title="Edit application" aria-label={`Edit ${a.company}`} onClick={() => begin(a)}><Pencil size={14} /></button><button className="icon-button danger" title="Delete application" aria-label={`Delete ${a.company}`} onClick={() => remove(a)}><Trash2 size={14} /></button></div>;

  return <>
    <PageHeader eyebrow="CAREER SEARCH" title="Job applications" description="Track roles, interviews and follow-ups in one place." action={<Button onClick={() => begin()}><Plus size={15} /> Add application</Button>} />

    <div className="status-tiles" role="group" aria-label="Filter by status">{["All", ...STATUSES].map(s => <button key={s} type="button" aria-pressed={filter === s} className={`status-tile s-${slug(s)} ${filter === s ? "selected" : ""}`} onClick={() => setFilter(s)}><strong>{counts[s]}</strong><span>{s}</span></button>)}</div>

    <section className="panel">
      <div className="panel-heading"><div><h2>{filter === "All" ? "All applications" : filter}</h2><p>{shown.length} of {apps.length} role{apps.length === 1 ? "" : "s"}</p></div>
        <label className="search-pill"><Search size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search company or role…" aria-label="Search applications" /></label></div>
      {shown.length ? <>
        <div className="table-wrap app-table"><table><thead><tr><th>Company / role</th><th>Applied</th><th>Status</th><th>Link</th><th /></tr></thead><tbody>{shown.map(a => <tr key={a.id}>
          <td><strong>{a.company}</strong><span className="table-sub">{a.role}</span>{a.notes && <span className="table-note">{a.notes}</span>}</td>
          <td>{a.date ? formatDate(a.date) : "—"}</td><td>{statusSelect(a)}</td>
          <td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="inline-link"><ExternalLink size={13} /> Open role</a> : "—"}</td><td>{actions(a)}</td></tr>)}</tbody></table></div>
        <div className="app-cards">{shown.map(a => <article className="app-card" key={a.id}>
          <div className="app-card-top"><div><strong>{a.company}</strong><span>{a.role}</span></div>{actions(a)}</div>
          {a.notes && <p>{a.notes}</p>}
          <div className="app-card-bottom"><span className="app-date">{a.date ? formatDate(a.date) : "No date"}</span>{statusSelect(a)}{a.url && <a href={a.url} target="_blank" rel="noreferrer" className="inline-link"><ExternalLink size={13} /> Open</a>}</div>
        </article>)}</div>
      </> : <div className="empty-state small"><BriefcaseBusiness size={25} /><h3>{apps.length ? "No applications match" : "No applications yet"}</h3><p>{apps.length ? "Try another status or search." : "Add your first role to start tracking it."}</p>{!apps.length && <Button onClick={() => begin()}><Plus size={15} /> Add application</Button>}</div>}
    </section>

    {form && <Modal title={editingId ? "Edit application" : "Add application"} subtitle="Company and role are required." onClose={close}>
      <form className="project-form" onSubmit={save}>
        <div className="form-two"><label>Company *<input required autoFocus value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. Acme Corp" /></label><label>Role *<input required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Frontend Developer" /></label></div>
        <label>Job URL<input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></label>
        <div className="form-two"><label>Applied date<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label><label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label></div>
        <label>Notes<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Recruiter, follow-up date, salary, anything useful" /></label>
        <div className="form-actions"><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit"><Save size={14} /> {editingId ? "Save changes" : "Save application"}</Button></div>
      </form>
    </Modal>}
  </>;
}
