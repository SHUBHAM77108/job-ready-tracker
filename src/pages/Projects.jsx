import { useState } from "react";
import { Code2, ExternalLink, Github, Pencil, Plus, Save, Trash2 } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { makeId } from "../utils/dates";

const STATUSES = ["Planned", "In progress", "Completed"];
const blank = () => ({ id: makeId(), name: "", description: "", imageUrl: "", liveUrl: "", githubUrl: "", technologies: "", status: "In progress" });
const cls = s => s.toLowerCase().replace(/\s+/g, "-");

export default function Projects({ state, update, flash, search = "" }) {
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("All");

  const begin = p => { setEditing(p?.id || null); setForm(p ? { ...blank(), ...p, technologies: Array.isArray(p.technologies) ? p.technologies.join(", ") : p.technologies || "" } : blank()); };
  const close = () => { setForm(null); setEditing(null); };
  const save = e => {
    e.preventDefault();
    const item = { ...form, name: form.name.trim(), technologies: form.technologies.split(",").map(x => x.trim()).filter(Boolean), updatedAt: new Date().toISOString() };
    if (!item.name) return;
    update(s => ({ ...s, projects: editing ? s.projects.map(p => p.id === editing ? item : p) : [item, ...s.projects] }));
    flash(editing ? "Project updated." : "Project added.");
    close();
  };
  const remove = p => { update(s => ({ ...s, projects: s.projects.filter(x => x.id !== p.id), undoItem: { type: "project", item: p } })); flash("Project removed. You can undo this action."); };

  const needle = search.trim().toLowerCase();
  const count = s => state.projects.filter(p => s === "All" || p.status === s).length;
  const projects = state.projects.filter(p => (filter === "All" || p.status === filter) && (!needle || `${p.name} ${p.description || ""} ${(p.technologies || []).join(" ")}`.toLowerCase().includes(needle)));

  return <>
    <PageHeader eyebrow="YOUR WORK, SHOWCASED" title="Projects" description="Track projects with images, technologies, GitHub and live links." action={<Button onClick={() => begin()}><Plus size={15} /> Add project</Button>} />
    <div className="filter-row">{["All", ...STATUSES].map(f => <button key={f} className={`filter-chip ${filter === f ? "selected" : ""}`} onClick={() => setFilter(f)}>{f} <span className="chip-count">{count(f)}</span></button>)}</div>

    {projects.length ? <div className="projects-grid">{projects.map(p => <article className="project-card" key={p.id}>
      <div className="project-cover">
        {p.imageUrl ? <img src={p.imageUrl} alt={`${p.name} preview`} onError={e => e.currentTarget.style.display = "none"} /> : <div className="project-cover-placeholder"><Code2 size={27} /><span>PROJECT PREVIEW</span></div>}
        <span className={`status-pill proj-${cls(p.status)}`}>{p.status}</span>
        <div className="project-card-menu"><button className="icon-button" title="Edit project" aria-label={`Edit ${p.name}`} onClick={() => begin(p)}><Pencil size={14} /></button><button className="icon-button danger" title="Delete project" aria-label={`Delete ${p.name}`} onClick={() => remove(p)}><Trash2 size={14} /></button></div>
      </div>
      <div className="project-card-body"><h3>{p.name}</h3><p>{p.description || "No description yet."}</p>
        <div className="tech-tags">{(p.technologies || []).map(t => <span key={t}>{t}</span>)}</div>
        <div className="project-links">{p.liveUrl ? <a href={p.liveUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Live demo</a> : <span className="disabled-link">Live demo</span>}{p.githubUrl ? <a href={p.githubUrl} target="_blank" rel="noreferrer"><Github size={14} /> GitHub</a> : <span className="disabled-link">GitHub</span>}</div>
      </div>
    </article>)}</div>
    : <div className="empty-state panel"><div className="empty-icon"><Code2 size={25} /></div><h3>{state.projects.length ? "No projects match" : "No projects yet"}</h3><p>{state.projects.length ? "Try another status or clear the search." : "Add your projects and keep links to demos and source code in one place."}</p>{!state.projects.length && <Button onClick={() => begin()}><Plus size={15} /> Add project</Button>}</div>}

    {form && <Modal title={editing ? "Edit project" : "Add project"} subtitle="Image URL is optional; file uploads are not enabled." onClose={close}>
      <form className="project-form" onSubmit={save}>
        <label>Project name *<input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weather app" /></label>
        <label>Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What does it do?" /></label>
        <label>Project image URL<input type="url" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" /></label>
        <div className="form-two"><label>Live demo URL<input type="url" value={form.liveUrl} onChange={e => setForm({ ...form, liveUrl: e.target.value })} placeholder="https://…" /></label><label>GitHub URL<input type="url" value={form.githubUrl} onChange={e => setForm({ ...form, githubUrl: e.target.value })} placeholder="https://github.com/…" /></label></div>
        <div className="form-two"><label>Technologies (comma separated)<input value={form.technologies} onChange={e => setForm({ ...form, technologies: e.target.value })} placeholder="React, Node, Tailwind" /></label><label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label></div>
        <div className="form-actions"><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit"><Save size={14} /> {editing ? "Save changes" : "Save project"}</Button></div>
      </form>
    </Modal>}
  </>;
}
