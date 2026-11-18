import { useState } from "react";
import {
  List, Columns3, CalendarDays, BarChart3, Gauge, Search, SlidersHorizontal, Save, Plus, X,
  Check, CheckCircle2, Circle, Clock, Flag, Paperclip, MessageSquare, GitBranch, Repeat,
  MoreHorizontal, Trash2, Send, FileText, Sparkles, ChevronDown, ChevronRight, Upload,
  ThumbsUp, AtSign, Timer, Calendar
} from "lucide-react";
import { useStore } from "../store";
import { uid } from "../data/seed";
import { cx, fmtDate, initials, daysRemaining } from "../utils";

export const VIEW_TABS = [
  { id: "list", label: "List", icon: List },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "timeline", label: "Timeline", icon: BarChart3 },
  { id: "workload", label: "Workload", icon: Gauge },
];

export const PRIORITIES = ["Urgent", "High", "Medium", "Low"];

const TODAY_KEY = new Date().toISOString().slice(0, 10);

export function slug(s = "") {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function statusesFor(project) {
  const base = project?.customStatuses?.length
    ? project.customStatuses
    : ["Backlog", "Todo", "In Progress", "Review", "Done"];
  return base.map(label => ({ id: slug(label), label }));
}

export function statusLabel(project, id) {
  return statusesFor(project).find(s => s.id === id)?.label || id;
}

export function emptyTask(projectId) {
  return {
    id: uid("t"), projectId, title: "", status: "todo", priority: "Medium", labels: [],
    assignees: [], due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    subtasks: [], checklist: [], attachments: [], comments: [], dependencies: [], recurring: null,
    estimate: 4, spent: 0, description: "", created: new Date().toISOString().slice(0, 10),
  };
}

export const TASK_TEMPLATES = [
  { id: "design", name: "Design deliverable", description: "Discover, explore, review and hand off a design deliverable.", checklist: ["Brief & requirements", "Explore directions", "Internal review", "Client review", "Final handoff"], estimate: 8 },
  { id: "dev", name: "Development task", description: "Build, test and ship a scoped piece of work.", checklist: ["Scope & acceptance criteria", "Implement", "Test", "Code review", "Deploy"], estimate: 12 },
  { id: "content", name: "Content piece", description: "Draft, edit and publish written content.", checklist: ["Outline", "Draft", "Edit", "Approve", "Publish"], estimate: 4 },
  { id: "campaign", name: "Campaign launch", description: "Coordinate a multi-channel campaign launch.", checklist: ["Assets", "Schedule", "QA", "Launch", "Report"], estimate: 10 },
];

export function useTaskFilters(initial = {}) {
  const [filters, setFilters] = useState({ search: "", status: "all", priority: "all", assignee: "all", label: "all", sort: "due", group: "none", ...initial });
  const set = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const reset = () => setFilters(f => ({ search: "", status: "all", priority: "all", assignee: "all", label: "all", sort: f.sort, group: f.group }));
  return { filters, setFilters, set, reset };
}

export function applyTaskFilters(tasks, filters) {
  let out = [...tasks];
  const q = filters.search.toLowerCase().trim();
  if (q) out = out.filter(t => (t.title + " " + (t.description || "")).toLowerCase().includes(q));
  if (filters.status !== "all") out = out.filter(t => t.status === filters.status);
  if (filters.priority !== "all") out = out.filter(t => t.priority === filters.priority);
  if (filters.assignee !== "all") out = out.filter(t => t.assignees?.includes(filters.assignee));
  if (filters.label !== "all") out = out.filter(t => t.labels?.includes(filters.label));
  if (filters.sort === "due") out.sort((a, b) => new Date(a.due || "9999") - new Date(b.due || "9999"));
  else if (filters.sort === "priority") out.sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
  else if (filters.sort === "title") out.sort((a, b) => a.title.localeCompare(b.title));
  else if (filters.sort === "progress") out.sort((a, b) => checklistPct(b) - checklistPct(a));
  return out;
}

function checklistPct(task) {
  const all = [...(task.subtasks || []), ...(task.checklist || [])];
  if (!all.length) return 0;
  return Math.round(all.filter(i => i.done).length / all.length * 100);
}

export function TaskToolbar({ filters, set, reset, onRestore, view, setView, onAdd, savedViews, onSaveView, count, showAdd = true }) {
  const { state } = useStore();
  const [showFilters, setShowFilters] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const activeFilters = ["status", "priority", "assignee", "label"].filter(k => filters[k] !== "all").length + (filters.search ? 1 : 0);

  return (
    <div className="task-toolbar">
      <div className="task-toolbar-main">
        <div className="view-tabs" role="tablist" aria-label="Task views">
          {VIEW_TABS.map(v => {
            const Icon = v.icon;
            return <button key={v.id} role="tab" aria-selected={view === v.id} className={cx("view-tab", view === v.id && "active")} onClick={() => setView(v.id)}><Icon size={15} /><span>{v.label}</span></button>;
          })}
        </div>
        <div className="task-search">
          <Search size={15} />
          <input value={filters.search} onChange={e => set("search", e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" />
          {filters.search && <button className="icon-btn" onClick={() => set("search", "")}><X size={14} /></button>}
        </div>
        <button className={cx("btn sm", showFilters && "tool-active")} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal size={15} /> Filters {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}</button>
        {showAdd && <button className="btn primary sm" onClick={onAdd}><Plus size={15} /> New task</button>}
      </div>
      {showFilters && (
        <div className="filter-drawer">
          <label className="lbl">Status<select className="field" value={filters.status} onChange={e => set("status", e.target.value)}><option value="all">All statuses</option>{statusesFor({ customStatuses: ["Backlog", "Todo", "In Progress", "Review", "Done"] }).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label className="lbl">Priority<select className="field" value={filters.priority} onChange={e => set("priority", e.target.value)}><option value="all">All priorities</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></label>
          <label className="lbl">Assignee<select className="field" value={filters.assignee} onChange={e => set("assignee", e.target.value)}><option value="all">Anyone</option>{state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label className="lbl">Label<select className="field" value={filters.label} onChange={e => set("label", e.target.value)}><option value="all">Any label</option>{state.labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className="lbl">Sort<select className="field" value={filters.sort} onChange={e => set("sort", e.target.value)}><option value="due">Due date</option><option value="priority">Priority</option><option value="title">Title</option><option value="progress">Progress</option></select></label>
          <label className="lbl">Group by<select className="field" value={filters.group} onChange={e => set("group", e.target.value)}><option value="none">None</option><option value="status">Status</option><option value="priority">Priority</option><option value="assignee">Assignee</option></select></label>
          <div className="filter-actions"><button className="btn sm" onClick={reset}>Clear filters</button></div>
        </div>
      )}
      <div className="task-toolbar-foot">
        <div className="row" style={{ flexWrap: "wrap" }}>
          <span className="small"><b>{count}</b> tasks</span>
          <span className="tool-sep" />
          {savedViews.map(v => <button key={v.id} className="saved-view" onClick={() => onRestore(v.filters)}>{v.name}</button>)}
          {saving ? (
            <form className="row" onSubmit={e => { e.preventDefault(); if (saveName.trim()) { onSaveView(saveName.trim(), filters); setSaveName(""); setSaving(false); } }}>
              <input className="field" style={{ width: 150, minHeight: 32, height: 32, padding: "4px 10px" }} autoFocus value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="View name" />
              <button className="btn sm primary" type="submit">Save</button><button className="btn sm ghost" type="button" onClick={() => setSaving(false)}><X size={14} /></button>
            </form>
          ) : <button className="btn sm ghost" onClick={() => setSaving(true)}><Save size={14} /> Save view</button>}
        </div>
      </div>
    </div>
  );
}

function PriorityMark({ priority }) {
  const color = priority === "Urgent" ? "#ef4444" : priority === "High" ? "#f97316" : priority === "Medium" ? "#6366f1" : "#94a3b8";
  return <Flag size={14} style={{ color }} fill={priority === "Urgent" ? color : "none"} />;
}

export function TaskList({ tasks, projects, group = "none", onOpen, selected, setSelected, onBulk, compact }) {
  const { state } = useStore();
  const [groupCollapsed, setGroupCollapsed] = useState({});

  function groups() {
    if (group === "none") return [{ key: "all", label: "All tasks", items: tasks }];
    const map = new Map();
    tasks.forEach(t => {
      let key, label;
      if (group === "status") { key = t.status; label = statusLabel(projects.find(p => p.id === t.projectId), t.status); }
      else if (group === "priority") { key = t.priority; label = `${t.priority} priority`; }
      else { key = t.assignees?.[0] || "unassigned"; label = state.members.find(m => m.id === key)?.name || "Unassigned"; }
      if (!map.has(key)) map.set(key, { key, label, items: [] });
      map.get(key).items.push(t);
    });
    return [...map.values()];
  }

  const allSelected = tasks.length > 0 && tasks.every(t => selected.includes(t.id));

  return (
    <div className={cx("task-list", compact && "compact")}>
      {selected.length > 0 && (
        <div className="bulk-bar">
          <span><b>{selected.length}</b> selected</span><span className="tool-sep" />
          <select className="field" style={{ width: "auto", minHeight: 30, height: 30, padding: "3px 8px" }} defaultValue="" onChange={e => { if (e.target.value) { onBulk("status", e.target.value); e.target.value = ""; } }}>
            <option value="">Move to…</option>{statusesFor({ customStatuses: ["Backlog", "Todo", "In Progress", "Review", "Done"] }).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn sm" onClick={() => onBulk("priority", "High")}>Set high priority</button>
          <button className="btn sm" onClick={() => onBulk("assign", "u1")}>Assign to me</button>
          <button className="btn sm danger" onClick={() => onBulk("delete")}><Trash2 size={14} /> Delete</button>
          <button className="btn sm ghost" onClick={() => setSelected([])}><X size={14} /></button>
        </div>
      )}
      <div className="task-table-wrap">
        <table className="task-table">
          <thead><tr>
            <th style={{ width: 36 }}><input type="checkbox" checked={allSelected} onChange={e => setSelected(e.target.checked ? tasks.map(t => t.id) : [])} aria-label="Select all" /></th>
            <th>Task</th>{!compact && <th>Project</th>}<th>Assignee</th><th>Priority</th><th>Due</th><th>Progress</th><th style={{ width: 40 }}></th>
          </tr></thead>
          <tbody>
            {groups().map(group => (
              [
                <tr key={`h-${group.key}`} className="group-row"><td colSpan={8}>
                  <button className="group-toggle" onClick={() => setGroupCollapsed(g => ({ ...g, [group.key]: !g[group.key] }))}>
                    {groupCollapsed[group.key] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <b>{group.label}</b><span className="small">{group.items.length}</span>
                  </button>
                </td></tr>,
                ...(groupCollapsed[group.key] ? [] : group.items.map(t => {
                  const project = projects.find(p => p.id === t.projectId);
                  const done = t.status === "done";
                  const overdue = !done && daysRemaining(t.due) < 0;
                  return (
                    <tr key={t.id} className={cx("task-row", done && "is-done", selected.includes(t.id) && "is-selected")} onDoubleClick={() => onOpen(t)}>
                      <td><input type="checkbox" checked={selected.includes(t.id)} onChange={e => setSelected(e.target.checked ? [...selected, t.id] : selected.filter(id => id !== t.id))} aria-label={`Select ${t.title}`} /></td>
                      <td>
                        <div className="task-name-cell">
                          <button className={cx("status-dot", done && "done")} onClick={() => onOpen(t)} aria-label="Open task">{done ? <CheckCircle2 size={17} /> : <Circle size={17} />}</button>
                          <div><button className="task-name" onClick={() => onOpen(t)}>{t.title}</button>
                            <div className="task-meta">
                              {t.labels?.slice(0, 2).map(id => { const l = state.labels.find(x => x.id === id); return l && <span key={id} className="mini-label" style={{ color: l.color, borderColor: l.color + "55", background: l.color + "14" }}>{l.name}</span>; })}
                              {(t.subtasks?.length > 0 || t.checklist?.length > 0) && <span className="small"><CheckCircle2 size={12} /> {[...(t.subtasks || []), ...(t.checklist || [])].filter(i => i.done).length}/{[...(t.subtasks || []), ...(t.checklist || [])].length}</span>}
                              {t.comments?.length > 0 && <span className="small"><MessageSquare size={12} /> {t.comments.length}</span>}
                              {t.attachments?.length > 0 && <span className="small"><Paperclip size={12} /> {t.attachments.length}</span>}
                              {t.dependencies?.length > 0 && <span className="small"><GitBranch size={12} /> {t.dependencies.length}</span>}
                              {t.recurring && <span className="small"><Repeat size={12} /> {t.recurring}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      {!compact && <td><span className="project-tag">{project?.name || "—"}</span></td>}
                      <td><div className="avatar-mini-stack">{t.assignees?.slice(0, 3).map(id => { const m = state.members.find(x => x.id === id); return m && <span key={id} className="avatar mini" style={{ background: m.color }} title={m.name}>{initials(m.name)}</span>; })}{!t.assignees?.length && <span className="small">—</span>}</div></td>
                      <td><span className="priority-cell"><PriorityMark priority={t.priority} /> {t.priority}</span></td>
                      <td><span className={cx("due-cell", overdue && "overdue")}>{fmtDate(t.due)}</span></td>
                      <td><div className="mini-progress"><span style={{ width: `${checklistPct(t)}%` }} /></div></td>
                      <td><button className="icon-btn" onClick={() => onOpen(t)}><MoreHorizontal size={16} /></button></td>
                    </tr>
                  );
                }))
              ]
            ))}
          </tbody>
        </table>
        {!tasks.length && <div className="empty">No tasks match the current filters.</div>}
      </div>
    </div>
  );
}

export function TaskBoard({ tasks, projects, statuses, onOpen, onMove, onAdd }) {
  const { state } = useStore();
  const [dragId, setDragId] = useState(null);
  return (
    <div className="board-scroll">
      <div className="board-columns" style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(240px, 1fr))` }}>
        {statuses.map(s => {
          const items = tasks.filter(t => t.status === s.id);
          return (
            <div key={s.id} className="board-column" onDragOver={e => e.preventDefault()} onDrop={() => { if (dragId) onMove(dragId, s.id); setDragId(null); }}>
              <div className="board-col-head"><div className="row"><span className={cx("status-pip", `s-${s.id}`)} /><b>{s.label}</b><span className="count">{items.length}</span></div><button className="icon-btn" onClick={() => onAdd(s.id)}><Plus size={15} /></button></div>
              <div className="board-cards">
                {items.map(t => {
                  const project = projects.find(p => p.id === t.projectId);
                  const overdue = !["done", "completed"].includes(t.status) && daysRemaining(t.due) < 0;
                  return (
                    <div key={t.id} className="board-card" draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} onClick={() => onOpen(t)}>
                      <div className="row" style={{ justifyContent: "space-between" }}><span className="board-project">{project?.name || "Project"}</span><PriorityMark priority={t.priority} /></div>
                      <strong>{t.title}</strong>
                      <div className="task-meta">{t.labels?.slice(0, 2).map(id => { const l = state.labels.find(x => x.id === id); return l && <span key={id} className="mini-label" style={{ color: l.color, borderColor: l.color + "55", background: l.color + "14" }}>{l.name}</span>; })}</div>
                      <div className="board-card-foot">
                        <div className="row"><div className="avatar-mini-stack">{t.assignees?.slice(0, 2).map(id => { const m = state.members.find(x => x.id === id); return m && <span key={id} className="avatar mini" style={{ background: m.color }} title={m.name}>{initials(m.name)}</span>; })}</div></div>
                        <div className="row" style={{ gap: 8 }}>
                          {checklistPct(t) > 0 && <span className="small">{checklistPct(t)}%</span>}
                          {(t.comments?.length > 0) && <span className="small"><MessageSquare size={12} /> {t.comments.length}</span>}
                          <span className={cx("small", overdue && "overdue-text")}><Calendar size={12} /> {fmtDate(t.due)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button className="board-add" onClick={() => onAdd(s.id)}><Plus size={14} /> Add task</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TaskCalendar({ tasks, onOpen }) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const key = d => d.toISOString().slice(0, 10);
  const move = n => setCursor(new Date(year, month + n, 1));

  return (
    <div className="calendar-view">
      <div className="calendar-head"><div><h3>{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3><span className="small">{tasks.filter(t => t.due?.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`).length} tasks this month</span></div><div className="row"><button className="btn sm" onClick={() => move(-1)}>‹</button><button className="btn sm" onClick={() => setCursor(new Date())}>Today</button><button className="btn sm" onClick={() => move(1)}>›</button></div></div>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="calendar-dow">{d}</div>)}
        {days.map(d => {
          const items = tasks.filter(t => t.due === key(d));
          const today = key(d) === TODAY_KEY;
          return (
            <div key={key(d)} className={cx("calendar-day", d.getMonth() !== month && "outside", today && "today")}>
              <div className="calendar-day-num">{d.getDate()}</div>
              <div className="calendar-day-tasks">
                {items.slice(0, 3).map(t => <button key={t.id} className={cx("calendar-task", t.status === "done" && "done")} onClick={() => onOpen(t)} title={t.title}>{t.title}</button>)}
                {items.length > 3 && <span className="small">+{items.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TaskTimeline({ tasks, projects, onOpen }) {
  const { state } = useStore();
  const dates = tasks.map(t => t.due).filter(Boolean).sort();
  const start = new Date(dates[0] || TODAY_KEY); start.setDate(start.getDate() - 3);
  const span = 28;
  const days = Array.from({ length: span }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const diff = d => Math.round((new Date(d) - start) / 86400000);

  return (
    <div className="timeline-view">
      <div className="timeline-head"><div className="timeline-label-cell"><b>Task</b><span className="small">Owner</span></div><div className="timeline-days">{days.map(d => <div key={d.toISOString()} className={cx("timeline-day", d.getDay() === 0 && "weekend")}><span>{d.getDate()}</span><em>{d.toLocaleDateString("en-US", { weekday: "short" })[0]}</em></div>)}</div></div>
      <div className="timeline-rows">
        {tasks.slice(0, 40).map(t => {
          const left = Math.max(0, diff(t.due));
          const project = projects.find(p => p.id === t.projectId);
          const owner = state.members.find(m => m.id === t.assignees?.[0]);
          return (
            <div key={t.id} className="timeline-row">
              <div className="timeline-label-cell"><button className="timeline-task-name" onClick={() => onOpen(t)}>{t.title}</button><span className="small">{project?.name || "Project"}{owner ? ` · ${owner.name.split(" ")[0]}` : ""}</span></div>
              <div className="timeline-days">
                {days.map(d => <div key={d.toISOString()} className={cx("timeline-day", d.getDay() === 0 && "weekend")} />)}
                <button className={cx("timeline-bar", t.status === "done" && "done", t.priority === "Urgent" && "urgent")} style={{ left: `${Math.min(96, left / span * 100)}%` }} onClick={() => onOpen(t)} title={`${t.title} · due ${fmtDate(t.due)}`}><span>{t.title}</span></button>
              </div>
            </div>
          );
        })}
        {!tasks.length && <div className="empty">No tasks to place on the timeline.</div>}
      </div>
    </div>
  );
}

export function TaskWorkload({ tasks }) {
  const { state } = useStore();
  const weeks = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const rows = state.members.map(m => {
    const assigned = tasks.filter(t => t.assignees?.includes(m.id) && !["done", "completed"].includes(t.status));
    const hours = assigned.reduce((s, t) => s + (Number(t.estimate) || 0), 0);
    return { member: m, assigned, hours, pct: Math.round(hours / Math.max(1, m.capacity) * 100) };
  });
  return (
    <div className="workload-view">
      <div className="workload-header"><div><h3>Team capacity</h3><span className="small">Estimated hours assigned vs weekly capacity</span></div><div className="row"><span className="chip"><span className="status-pip s-inprogress" /> On track</span><span className="chip"><span className="status-pip s-review" /> Near capacity</span><span className="chip"><span className="status-pip s-done" /> Over capacity</span></div></div>
      <div className="workload-grid">
        {rows.map(({ member, assigned, hours, pct }) => (
          <div key={member.id} className="workload-card">
            <div className="row"><span className="avatar" style={{ background: member.color }}>{initials(member.name)}</span><div><b>{member.name}</b><div className="small">{member.title}</div></div><span className={cx("workload-pct", pct > 100 && "over", pct > 80 && "near")}>{pct}%</span></div>
            <div className="workload-bar"><span className={pct > 100 ? "over" : pct > 80 ? "near" : ""} style={{ width: `${Math.min(100, pct)}%` }} /></div>
            <div className="space-between small"><span>{hours}h assigned / {member.capacity}h capacity</span><span>{assigned.length} tasks</span></div>
            <div className="workload-week">{weeks.map((d, i) => <div key={d} className="workload-week-cell"><span>{d}</span><span style={{ height: `${Math.min(34, 6 + ((hours / 5) * (1 + (i % 3) * .25)))}px` }} /></div>)}</div>
            {member.leave && <div className="small leave-note">Leave: {member.leave}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function InlineAdd({ placeholder, onAdd, icon: Icon = Plus }) {
  const [value, setValue] = useState("");
  return (
    <form className="inline-add" onSubmit={e => { e.preventDefault(); if (value.trim()) { onAdd(value.trim()); setValue(""); } }}>
      <Icon size={14} /><input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} /><button type="submit" disabled={!value.trim()}><Plus size={13} /></button>
    </form>
  );
}

export function AddTaskModal({ onClose, projects, defaultProjectId, defaultStatus = "todo", onCreated }) {
  const { state, dispatch } = useStore();
  const [template, setTemplate] = useState(null);
  const [form, setForm] = useState(() => ({ ...emptyTask(defaultProjectId || projects[0]?.id), status: defaultStatus, due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (k, id) => set(k, form[k].includes(id) ? form[k].filter(x => x !== id) : [...form[k], id]);

  function chooseTemplate(t) {
    setTemplate(t.id);
    setForm(f => ({ ...f, title: f.title || t.name, description: t.description, estimate: t.estimate, checklist: t.checklist.map(title => ({ id: uid("ck"), title, done: false })) }));
  }

  function save(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    dispatch({ type: "UPSERT_TASK", projectId: form.projectId, task: { ...form, title: form.title.trim() } });
    onCreated?.(form);
    onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal task-modal">
        <div className="task-modal-head"><div><h2>New task</h2><span className="small">Add detail now or refine it later.</span></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={save} className="task-modal-body">
          <div className="task-modal-main">
            <label className="lbl">Title<input className="field big-input" autoFocus value={form.title} onChange={e => set("title", e.target.value)} placeholder="What needs to be done?" required /></label>
            <label className="lbl">Description<textarea className="field" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Add context, links, acceptance criteria…" /></label>
            {form.checklist.length > 0 && <div className="lbl">Checklist
              <div className="stack" style={{ gap: 5 }}>{form.checklist.map(item => <div key={item.id} className="row"><CheckCircle2 size={14} className="muted" /><span style={{ fontSize: 13 }}>{item.title}</span><button type="button" className="icon-btn" onClick={() => set("checklist", form.checklist.filter(x => x.id !== item.id))}><X size={13} /></button></div>)}</div>
              <InlineAdd placeholder="Add checklist item" onAdd={v => set("checklist", [...form.checklist, { id: uid("ck"), title: v, done: false }])} />
            </div>}
            <div className="lbl">Subtasks<div className="stack" style={{ gap: 5 }}>{form.subtasks.map(item => <div key={item.id} className="row"><Circle size={14} className="muted" /><span style={{ fontSize: 13 }}>{item.title}</span></div>)}</div><InlineAdd placeholder="Add subtask" onAdd={v => set("subtasks", [...form.subtasks, { id: uid("st"), title: v, done: false }])} /></div>
          </div>
          <aside className="task-modal-side">
            <h4 className="side-heading">Details</h4>
            <label className="lbl">Project<select className="field" value={form.projectId} onChange={e => set("projectId", e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="lbl">Status<select className="field" value={form.status} onChange={e => set("status", e.target.value)}>{statusesFor(projects.find(p => p.id === form.projectId)).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <label className="lbl">Priority<select className="field" value={form.priority} onChange={e => set("priority", e.target.value)}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></label>
            <label className="lbl">Due date<input className="field" type="date" value={form.due} onChange={e => set("due", e.target.value)} /></label>
            <label className="lbl">Estimate (h)<input className="field" type="number" value={form.estimate} onChange={e => set("estimate", e.target.value)} /></label>
            <label className="lbl">Recurring<select className="field" value={form.recurring || ""} onChange={e => set("recurring", e.target.value || null)}><option value="">Does not repeat</option><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label>
            <div className="lbl">Assignees<div className="row" style={{ flexWrap: "wrap" }}>{state.members.map(m => <button type="button" key={m.id} className={cx("assign-chip", form.assignees.includes(m.id) && "on")} onClick={() => toggle("assignees", m.id)} title={m.name}><span className="avatar mini" style={{ background: m.color }}>{initials(m.name)}</span></button>)}</div></div>
            <div className="lbl">Labels<div className="row" style={{ flexWrap: "wrap" }}>{state.labels.map(l => <button type="button" key={l.id} className="chip" style={form.labels.includes(l.id) ? { borderColor: l.color, color: l.color } : {}} onClick={() => toggle("labels", l.id)}><span className="label-dot" style={{ background: l.color, width: 8, height: 8 }} />{l.name}</button>)}</div></div>
            <div className="lbl">Start from template<div className="template-list">{TASK_TEMPLATES.map(t => <button type="button" key={t.id} className={cx("template-chip", template === t.id && "on")} onClick={() => chooseTemplate(t)}><Sparkles size={13} /> {t.name}</button>)}</div></div>
          </aside>
          <div className="task-modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary"><Plus size={15} /> Create task</button></div>
        </form>
      </div>
    </div>
  );
}

export function TaskDetailModal({ task, project, projects, onClose }) {
  const { state, dispatch } = useStore();
  const [comment, setComment] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [local, setLocal] = useState(task);

  function update(patch) {
    const next = { ...local, ...patch };
    setLocal(next);
    dispatch({ type: "UPSERT_TASK", projectId: local.projectId, task: next });
  }
  const set = (k, v) => update({ [k]: v });
  const toggleItem = (k, id) => set(k, local[k].map(i => i.id === id ? { ...i, done: !i.done } : i));
  const addItem = (k, title) => set(k, [...local[k], { id: uid(k.slice(0, 2)), title, done: false }]);
  const removeItem = (k, id) => set(k, local[k].filter(i => i.id !== id));
  const pct = checklistPct(local);

  function addComment() {
    if (!comment.trim()) return;
    set("comments", [...(local.comments || []), { id: uid("cm"), author: "u1", text: comment.trim(), time: "Just now", reactions: {} }]);
    setComment(""); setMentionOpen(false);
  }

  function react(id, emoji) {
    set("comments", local.comments.map(c => {
      if (c.id !== id) return c;
      const reactions = { ...(c.reactions || {}) };
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      return { ...c, reactions };
    }));
  }

  function handleCommentChange(v) {
    setComment(v);
    setMentionOpen(/@\w*$/.test(v));
  }

  function insertMention(m) {
    setComment(c => c.replace(/@\w*$/, `@${m.name.split(" ")[0]} `));
    setMentionOpen(false);
  }

  function attach(e) {
    const files = [...e.target.files];
    const additions = files.map(f => ({ id: uid("f"), name: f.name, size: `${(f.size / 1024 / 1024).toFixed(1)} MB`, type: f.type, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null }));
    set("attachments", [...(local.attachments || []), ...additions]);
    e.target.value = "";
  }

  function addDependency(e) {
    if (!e.target.value) return;
    set("dependencies", [...new Set([...(local.dependencies || []), e.target.value])]);
    e.target.value = "";
  }

  const allTasks = projects.flatMap(p => p.tasks).filter(t => t.id !== local.id);

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal detail-modal">
        <div className="detail-head">
          <div className="detail-head-top"><span className="project-tag">{project?.name || "Project"}</span><div className="row"><button className="btn sm ghost" onClick={() => { dispatch({ type: "DELETE_TASK", projectId: local.projectId, taskId: local.id }); onClose(); }}><Trash2 size={14} /></button><button className="icon-btn" onClick={onClose}><X size={18} /></button></div></div>
          <input className="detail-title" value={local.title} onChange={e => set("title", e.target.value)} aria-label="Task title" />
          <div className="row" style={{ flexWrap: "wrap" }}>
            <select className="field auto" value={local.status} onChange={e => set("status", e.target.value)}>{statusesFor(project).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <span className="detail-chip"><Clock size={13} /> Due {fmtDate(local.due)}</span>
            <span className="detail-chip"><Flag size={13} /> {local.priority}</span>
            {local.recurring && <span className="detail-chip"><Repeat size={13} /> {local.recurring}</span>}
          </div>
        </div>
        <div className="detail-body">
          <div className="detail-main">
            <section className="detail-section">
              <h4>Description</h4>
              <textarea className="field" value={local.description} onChange={e => set("description", e.target.value)} placeholder="Add a description…" />
            </section>
            {(local.subtasks?.length > 0 || local.checklist?.length > 0) && <section className="detail-section">
              <div className="space-between"><h4>Subtasks & checklist</h4><span className="small">{pct}% complete</span></div>
              <div className="progress" style={{ marginBottom: 10 }}><span style={{ width: `${pct}%` }} /></div>
              {[...(local.subtasks || []), ...(local.checklist || [])].map(item => (
                <div key={item.id} className="check-item"><button className={cx("check-box", item.done && "on")} onClick={() => { const key = (local.subtasks || []).some(s => s.id === item.id) ? "subtasks" : "checklist"; toggleItem(key, item.id); }}>{item.done && <Check size={12} />}</button><span className={item.done ? "struck" : ""}>{item.title}</span><button className="icon-btn" onClick={() => { const key = (local.subtasks || []).some(s => s.id === item.id) ? "subtasks" : "checklist"; removeItem(key, item.id); }}><X size={13} /></button></div>
              ))}
            </section>}
            <div className="detail-two-add">
              <div className="lbl small">Add subtask<InlineAdd placeholder="Subtask title" onAdd={v => addItem("subtasks", v)} /></div>
              <div className="lbl small">Add checklist item<InlineAdd placeholder="Checklist item" onAdd={v => addItem("checklist", v)} icon={CheckCircle2} /></div>
            </div>
            <section className="detail-section">
              <div className="space-between"><h4>Attachments</h4><label className="btn sm"><Upload size={14} /> Upload<input type="file" multiple hidden onChange={attach} /></label></div>
              <div className="attachment-list">{local.attachments?.map(f => <div key={f.id} className="attachment"><span className="file-icon">{f.url ? <img src={f.url} alt="" /> : <FileText size={16} />}</span><div><b>{f.name}</b><div className="small">{f.size}</div></div><button className="icon-btn" onClick={() => set("attachments", local.attachments.filter(x => x.id !== f.id))}><X size={14} /></button></div>)}{!local.attachments?.length && <div className="small">No files attached yet.</div>}</div>
            </section>
            <section className="detail-section">
              <h4>Dependencies</h4>
              <div className="row" style={{ flexWrap: "wrap" }}>{local.dependencies?.map(id => { const dep = allTasks.find(t => t.id === id); return <span key={id} className="chip"><GitBranch size={12} /> {dep?.title || id}<button className="icon-btn" onClick={() => set("dependencies", local.dependencies.filter(x => x !== id))}><X size={11} /></button></span>; })}</div>
              <select className="field auto" style={{ marginTop: 8 }} defaultValue="" onChange={addDependency}><option value="">Add depends-on task…</option>{allTasks.slice(0, 30).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
            </section>
            <section className="detail-section">
              <h4>Comments <span className="small">({local.comments?.length || 0})</span></h4>
              <div className="comment-list">{local.comments?.map(c => { const m = state.members.find(x => x.id === c.author); return (
                <div key={c.id} className="comment"><span className="avatar mini" style={{ background: m?.color || "#94a3b8" }}>{initials(m?.name || "User")}</span><div className="comment-body"><div className="space-between"><b>{m?.name || "User"}</b><span className="small">{c.time}</span></div><p>{c.text}</p><div className="row">{Object.entries(c.reactions || {}).map(([emoji, n]) => <button key={emoji} className="reaction" onClick={() => react(c.id, emoji)}>{emoji} {n}</button>)}<button className="reaction" onClick={() => react(c.id, "👍")}><ThumbsUp size={12} /> React</button><button className="reaction" onClick={() => setComment(`@${m?.name.split(" ")[0] || "there"} `)}><AtSign size={12} /> Mention</button></div></div></div>
              ); })}</div>
              <div className="comment-compose">
                <textarea className="field" value={comment} onChange={e => handleCommentChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment(); }} placeholder="Write a comment… use @ to mention" />
                {mentionOpen && <div className="mention-menu">{state.members.filter(m => m.name.toLowerCase().includes(comment.split("@").pop().toLowerCase())).map(m => <button key={m.id} onClick={() => insertMention(m)}><span className="avatar mini" style={{ background: m.color }}>{initials(m.name)}</span> {m.name}</button>)}</div>}
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}><span className="small">⌘/Ctrl + Enter</span><button className="btn sm primary" onClick={addComment}><Send size={14} /> Send</button></div>
              </div>
            </section>
          </div>
          <aside className="detail-side">
            <h4 className="side-heading">Properties</h4>
            <label className="lbl">Status<select className="field" value={local.status} onChange={e => set("status", e.target.value)}>{statusesFor(project).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <label className="lbl">Priority<select className="field" value={local.priority} onChange={e => set("priority", e.target.value)}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></label>
            <label className="lbl">Due date<input className="field" type="date" value={local.due || ""} onChange={e => set("due", e.target.value)} /></label>
            <label className="lbl">Estimate (h)<input className="field" type="number" value={local.estimate} onChange={e => set("estimate", e.target.value)} /></label>
            <label className="lbl">Time spent (h)<input className="field" type="number" value={local.spent} onChange={e => set("spent", e.target.value)} /><button className="btn sm" style={{ marginTop: 6 }} onClick={() => { set("spent", Number(local.spent) + .5); dispatch({ type: "ADD_TIME_ENTRY", entry: { id: uid("te"), member: "u1", project: local.projectId, task: local.title, hours: .5, date: new Date().toISOString().slice(0, 10) } }); }}><Timer size={14} /> Log 30 min</button></label>
            <div className="lbl">Assignees<div className="row" style={{ flexWrap: "wrap" }}>{state.members.map(m => <button key={m.id} className={cx("assign-chip", local.assignees.includes(m.id) && "on")} onClick={() => set("assignees", local.assignees.includes(m.id) ? local.assignees.filter(x => x !== m.id) : [...local.assignees, m.id])} title={m.name}><span className="avatar mini" style={{ background: m.color }}>{initials(m.name)}</span></button>)}</div></div>
            <div className="lbl">Labels<div className="row" style={{ flexWrap: "wrap" }}>{state.labels.map(l => <button key={l.id} className="chip" style={local.labels.includes(l.id) ? { borderColor: l.color, color: l.color } : {}} onClick={() => set("labels", local.labels.includes(l.id) ? local.labels.filter(x => x !== l.id) : [...local.labels, l.id])}><span className="label-dot" style={{ background: l.color, width: 8, height: 8 }} />{l.name}</button>)}</div></div>
            {Object.entries(project?.customFields || {}).length > 0 && <div className="lbl">Custom fields{Object.entries(project.customFields).map(([k, v]) => <div key={k} className="space-between small custom-field"><span>{k}</span><b>{v}</b></div>)}</div>}
            <div className="detail-id small">ID {local.id}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
