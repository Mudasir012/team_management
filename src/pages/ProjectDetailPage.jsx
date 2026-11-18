import { useMemo, useState } from "react";
import {
  ArrowLeft, Pencil, Trash2, Download, Circle, CalendarDays, Users, FileText, MessageSquare,
  Paperclip, Activity as ActivityIcon, Settings as SettingsIcon, Plus, X, Send, Layers, Flag,
  ChevronRight, Upload, File as FileIcon, Timer, TrendingUp, Check, List
} from "lucide-react";
import { useStore } from "../store";
import { uid } from "../data/seed";
import { cx, money, fmtDate, fmtLong, daysLabel, daysRemaining, initials, progressFromTasks } from "../utils";
import { AvatarStack, StatusBadge } from "../components/ui";
import { ProjectModal } from "../components/Overlays";
import {
  useTaskFilters, applyTaskFilters, TaskToolbar, TaskList, TaskBoard, TaskCalendar,
  TaskTimeline, TaskWorkload, AddTaskModal, TaskDetailModal, statusesFor
} from "../components/Workspace";

const TODAY_DATE = new Date().toISOString().slice(0, 10);
const SOON_DATE = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

const TABS = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "tasks", label: "Tasks", icon: List },
  { id: "board", label: "Board", icon: ColumnsIcon },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "timeline", label: "Timeline", icon: TrendingUp },
  { id: "workload", label: "Workload", icon: Users },
  { id: "sprints", label: "Sprints", icon: Flag },
  { id: "docs", label: "Docs", icon: FileText },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "files", label: "Files", icon: Paperclip },
  { id: "activity", label: "Activity", icon: ActivityIcon },
  { id: "time", label: "Time", icon: Timer },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function ColumnsIcon(props) { return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="9.5" y="4" width="5" height="11" rx="1" /><rect x="16" y="4" width="5" height="14" rx="1" /></svg>; }

export default function ProjectDetailPage({ project, onClose }) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const { filters, setFilters, set, reset } = useTaskFilters();
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [detailTask, setDetailTask] = useState(null);

  const patch = (changes) => dispatch({ type: "UPSERT_PROJECT", project: { ...project, ...changes } });
  const visible = useMemo(() => applyTaskFilters(project.tasks, filters), [project.tasks, filters]);
  const progress = progressFromTasks(project.tasks);
  const spent = state.expenses.filter(e => e.project === project.id).reduce((s, e) => s + Number(e.amount), 0);
  const logged = state.timeEntries.filter(e => e.project === project.id).reduce((s, e) => s + Number(e.hours), 0);
  const customer = state.customers.find(c => c.id === project.customerId);
  const days = daysRemaining(project.end);

  function moveTask(id, status) {
    const t = project.tasks.find(x => x.id === id);
    if (t) dispatch({ type: "UPSERT_TASK", projectId: project.id, task: { ...t, status } });
  }
  function bulk(action, value) {
    selected.forEach(id => {
      const t = project.tasks.find(x => x.id === id);
      if (!t) return;
      if (action === "delete") dispatch({ type: "DELETE_TASK", projectId: project.id, taskId: id });
      else if (action === "assign") dispatch({ type: "UPSERT_TASK", projectId: project.id, task: { ...t, assignees: [...new Set([...t.assignees, value])] } });
      else dispatch({ type: "UPSERT_TASK", projectId: project.id, task: { ...t, [action]: value } });
    });
    setSelected([]);
  }
  function openTask(t) { setDetailTask(project.tasks.find(x => x.id === t.id) || t); }
  function selectTab(id) {
    setTab(id);
    if (["board", "calendar", "timeline", "workload", "list"].includes(id)) setView(id);
    if (id === "tasks") setView("list");
  }
  function exportProject() {
    const rows = [["Task", "Status", "Priority", "Assignee", "Due"], ...project.tasks.map(t => [t.title, t.status, t.priority, t.assignees.map(id => state.members.find(m => m.id === id)?.name || id).join("; "), t.due])];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${project.name.replace(/\s+/g, "-").toLowerCase()}-tasks.csv`; a.click();
  }

  return (
    <div className="project-detail">
      <div className="pd-header">
        <div className="pd-header-top">
          <button className="btn sm ghost" onClick={onClose}><ArrowLeft size={15} /> All projects</button>
          <div className="row"><span className="small">{customer?.name || "Internal"}</span><ChevronRight size={13} className="faint" /><span className="small">{project.name}</span></div>
          <div className="row pd-header-actions">
            <button className="btn sm" onClick={exportProject}><Download size={14} /> Export</button>
            <button className="btn sm" onClick={() => setEditOpen(true)}><Pencil size={14} /> Edit</button>
            <button className="btn sm danger" onClick={() => { if (window.confirm(`Delete ${project.name}?`)) { dispatch({ type: "DELETE_PROJECT", id: project.id }); onClose(); } }}><Trash2 size={14} /></button>
          </div>
        </div>
        <div className="pd-title-row">
          <div>
            <div className="row" style={{ flexWrap: "wrap", gap: 10 }}><h2>{project.name}</h2><StatusBadge status={project.status} /><span className={cx("days-pill", days < 0 && "late")}>{daysLabel(project.end, project.status)}</span></div>
            <p className="small pd-description">{project.description || "No description yet."}</p>
            <div className="row" style={{ flexWrap: "wrap", marginTop: 10 }}>
              <AvatarStack ids={project.members} members={state.members} />
              <span className="tool-sep" />
              {project.labels.map(id => { const l = state.labels.find(x => x.id === id); return l && <span key={id} className="chip"><span className="label-dot" style={{ background: l.color, width: 8, height: 8 }} />{l.name}</span>; })}
              <span className="chip"><CalendarDays size={12} /> {fmtDate(project.start)} – {fmtDate(project.end)}</span>
              <span className="chip"><Flag size={12} /> {project.sprint}</span>
            </div>
          </div>
          <div className="pd-progress-ring" style={{ "--pct": `${progress}%` }}><div><b>{progress}%</b><span className="small">complete</span></div></div>
        </div>
        <div className="pd-metrics">
          <div><span>Budget</span><b>{money(project.budget)}</b></div>
          <div><span>Spent</span><b>{money(spent)}</b></div>
          <div><span>Logged time</span><b>{logged}h</b></div>
          <div><span>Tasks</span><b>{project.tasks.filter(t => t.status === "done").length}/{project.tasks.length}</b></div>
          <div><span>Milestones</span><b>{project.milestones?.filter(m => m.done).length || 0}/{project.milestones?.length || 0}</b></div>
        </div>
      </div>

      <nav className="pd-tabs" aria-label="Project sections">
        {TABS.map(t => { const Icon = t.icon; return <button key={t.id} className={cx("pd-tab", tab === t.id && "active")} onClick={() => selectTab(t.id)}><Icon size={15} /> {t.label}</button>; })}
      </nav>

      <div className="pd-body">
        {tab === "overview" && <OverviewTab project={project} patch={patch} spent={spent} progress={progress} onOpenTask={openTask} setTab={setTab} />}

        {(tab === "tasks" || tab === "board" || tab === "calendar" || tab === "timeline" || tab === "workload") && (
          <section className="pd-view-section">
            <TaskToolbar
              filters={filters} set={set} reset={reset} onRestore={setFilters}
              view={view} setView={setView} onAdd={() => setAddOpen(true)}
              savedViews={state.savedViews.filter(v => v.projectId === project.id || !v.projectId)}
              onSaveView={(name, f) => dispatch({ type: "SAVE_VIEW", view: { id: uid("view"), name, filters: f, projectId: project.id } })}
              count={visible.length}
            />
            <div className="todo-view-body">
              {view === "list" && <TaskList tasks={visible} projects={state.projects} group={filters.group} onOpen={openTask} selected={selected} setSelected={setSelected} onBulk={bulk} compact />}
              {view === "board" && <TaskBoard tasks={visible} projects={[project]} statuses={statusesFor(project)} onOpen={openTask} onMove={moveTask} onAdd={() => setAddOpen(true)} />}
              {view === "calendar" && <TaskCalendar tasks={visible} onOpen={openTask} />}
              {view === "timeline" && <TaskTimeline tasks={visible} projects={[project]} onOpen={openTask} />}
              {view === "workload" && <TaskWorkload tasks={visible} />}
            </div>
          </section>
        )}

        {tab === "sprints" && <SprintsTab project={project} patch={patch} onOpenTask={openTask} />}
        {tab === "docs" && <DocsTab project={project} patch={patch} />}
        {tab === "chat" && <ChatTab project={project} patch={patch} />}
        {tab === "files" && <FilesTab project={project} patch={patch} />}
        {tab === "activity" && <ActivityTab project={project} />}
        {tab === "time" && <TimeTab project={project} />}
        {tab === "settings" && <SettingsTab project={project} patch={patch} onClose={onClose} />}
      </div>

      {editOpen && <ProjectModal existing={project} onClose={() => setEditOpen(false)} />}
      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} projects={[project]} defaultProjectId={project.id} />}
      {detailTask && <TaskDetailModal task={detailTask} project={project} projects={state.projects} onClose={() => setDetailTask(null)} />}
    </div>
  );
}

function OverviewTab({ project, patch, spent, progress, onOpenTask, setTab }) {
  const { state, dispatch } = useStore();
  const [chatText, setChatText] = useState("");
  const upcoming = [...project.tasks].filter(t => t.status !== "done").sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 5);
  const health = daysRemaining(project.end) < 0 ? "At risk" : progress >= 75 ? "On track" : "Needs focus";

  function sendChat(e) {
    e.preventDefault(); if (!chatText.trim()) return;
    dispatch({ type: "ADD_CHAT", projectId: project.id, author: "u1", authorName: "Maya Chen", text: chatText.trim(), time: "Just now" });
    setChatText("");
  }

  return (
    <div className="pd-overview">
      <div className="pd-overview-main">
        <div className={cx("health-banner", health === "At risk" && "risk", health === "Needs focus" && "focus")}>
          <div className="row"><span className="health-icon"><ActivityIcon size={16} /></span><div><b>Project health · {health}</b><div className="small">{health === "On track" ? "Delivery is aligned with the plan. Keep the momentum." : health === "At risk" ? "The end date has passed. Re-scope or extend the deadline." : "Progress is steady, but a few items need attention."}</div></div></div>
          <span className="health-score">{progress}%</span>
        </div>

        <section className="panel pd-panel">
          <div className="space-between"><h3>Milestones</h3><button className="btn sm ghost" onClick={() => setTab("sprints")}>Manage <ChevronRight size={14} /></button></div>
          <div className="milestone-track">
            {(project.milestones || []).map(m => (
              <button key={m.id} className={cx("milestone", m.done && "done")} onClick={() => patch({ milestones: project.milestones.map(x => x.id === m.id ? { ...x, done: !x.done } : x) })}>
                <span className="milestone-dot">{m.done && <Check size={12} />}</span><b>{m.title}</b><span className="small">{fmtDate(m.date)}</span>
              </button>
            ))}
            {!project.milestones?.length && <div className="small">No milestones yet. Add one in Sprints.</div>}
          </div>
        </section>

        <section className="panel pd-panel">
          <div className="space-between"><h3>Upcoming tasks</h3><button className="btn sm ghost" onClick={() => setTab("tasks")}>All tasks <ChevronRight size={14} /></button></div>
          <div className="list">
            {upcoming.map(t => <div key={t.id} className="list-row"><button className="row" onClick={() => onOpenTask(t)}><Circle size={16} className="muted" /><span style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</span></button><span className={cx("small", daysRemaining(t.due) < 0 && "overdue-text")}>{fmtDate(t.due)}</span></div>)}
            {!upcoming.length && <div className="empty">Nothing upcoming.</div>}
          </div>
        </section>

        <section className="panel pd-panel">
          <h3>Activity</h3>
          <div className="timeline-feed">{(project.activity || []).slice(0, 6).map(a => <div key={a.id} className="feed-item"><span className="feed-dot" /><div><b>{a.text}</b><span className="small">{a.time}</span></div></div>)}</div>
        </section>
      </div>

      <aside className="pd-overview-side">
        <section className="panel pd-panel">
          <h3>Team</h3>
          <div className="stack">{project.members.map(id => { const m = state.members.find(x => x.id === id); if (!m) return null; const load = state.members.find(x => x.id === id); return (
            <div key={id} className="row"><span className="avatar mini" style={{ background: m.color }}>{initials(m.name)}</span><div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>{m.name}</b><div className="small">{m.title}</div></div><span className="small">{load?.hours}h</span></div>
          ); })}</div>
        </section>
        <section className="panel pd-panel">
          <h3>Budget</h3>
          <div className="space-between"><span className="small">Spent / {money(project.budget)}</span><b>{money(spent)}</b></div>
          <div className="progress" style={{ margin: "10px 0" }}><span style={{ width: `${Math.min(100, Math.round(spent / Math.max(1, project.budget) * 100))}%`, background: spent > project.budget * .9 ? "#ef4444" : "var(--accent)" }} /></div>
          <div className="small">{money(Math.max(0, project.budget - spent))} remaining</div>
        </section>
        <section className="panel pd-panel">
          <h3>Custom fields</h3>
          {Object.entries(project.customFields || {}).map(([k, v]) => <div key={k} className="space-between small" style={{ padding: "5px 0" }}><span>{k}</span><b>{v}</b></div>)}
          {!Object.keys(project.customFields || {}).length && <div className="small">None defined.</div>}
        </section>
        <section className="pd-panel panel channel-panel">
          <div className="space-between"><h3># project-chat</h3><button className="btn sm ghost" onClick={() => setTab("chat")}>Open</button></div>
          <div className="channel-messages">{(project.chat || []).slice(-3).map(c => { const m = state.members.find(x => x.id === c.author); return <div key={c.id} className="channel-msg"><span className="avatar mini" style={{ background: m?.color }}>{initials(m?.name || "U")}</span><div><b>{m?.name.split(" ")[0]}</b> {c.text}<div className="small">{c.time}</div></div></div>; })}</div>
          <form className="row" onSubmit={sendChat}><input className="field" value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Message the channel…" /><button className="btn sm primary" type="submit"><Send size={14} /></button></form>
        </section>
      </aside>
    </div>
  );
}

function SprintsTab({ project, patch, onOpenTask }) {
  const [newSprint, setNewSprint] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const [milestoneDate, setMilestoneDate] = useState(SOON_DATE);
  const [sprints, setSprints] = useState(["Backlog", "Sprint 14", "Sprint 15"]);
  const current = project.sprint || "Backlog";
  const inSprint = project.tasks.filter(t => (t.sprint || "Backlog") === current);

  function assignSprint(taskId, sprint) {
    patch({ tasks: project.tasks.map(t => t.id === taskId ? { ...t, sprint } : t) });
  }

  return (
    <div className="pd-sprints">
      <div className="sprint-header">
        <div><h3>Sprint planning</h3><span className="small">Move work between the backlog and sprints. Track delivery milestones.</span></div>
        <div className="row"><input className="field" style={{ width: 160 }} value={newSprint} onChange={e => setNewSprint(e.target.value)} placeholder="New sprint name" /><button className="btn sm" onClick={() => { if (newSprint.trim() && !sprints.includes(newSprint.trim())) { setSprints([...sprints, newSprint.trim()]); setNewSprint(""); } }}><Plus size={14} /> Add sprint</button></div>
      </div>
      <div className="sprint-columns">
        {sprints.map(s => {
          const items = project.tasks.filter(t => (t.sprint || "Backlog") === s);
          return (
            <div key={s} className={cx("sprint-col", current === s && "current")}>
              <div className="space-between"><b>{s}</b><span className="chip">{items.length}</span></div>
              {current === s && <span className="small current-label">Current sprint</span>}
              <div className="stack" style={{ marginTop: 10 }}>
                {items.map(t => <div key={t.id} className="sprint-task">
                  <button onClick={() => onOpenTask(t)}><Circle size={14} /> {t.title}</button>
                  <select className="field" style={{ width: 92, minHeight: 28, height: 28, padding: "2px 6px", fontSize: 12 }} value={t.sprint || "Backlog"} onChange={e => assignSprint(t.id, e.target.value)}>{sprints.map(x => <option key={x}>{x}</option>)}</select>
                </div>)}
                {!items.length && <div className="drop-hint">No tasks in {s}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <section className="panel pd-panel" style={{ marginTop: 16 }}>
        <div className="space-between"><h3>Milestones</h3><form className="row" onSubmit={e => { e.preventDefault(); if (!newMilestone.trim()) return; patch({ milestones: [...(project.milestones || []), { id: uid("m"), title: newMilestone.trim(), date: milestoneDate, done: false }] }); setNewMilestone(""); }}><input className="field" style={{ width: 190 }} value={newMilestone} onChange={e => setNewMilestone(e.target.value)} placeholder="Milestone name" /><input className="field" type="date" style={{ width: 150 }} value={milestoneDate} onChange={e => setMilestoneDate(e.target.value)} /><button className="btn sm primary" type="submit"><Plus size={14} /> Add</button></form></div>
        <div className="milestone-list">{(project.milestones || []).map(m => <div key={m.id} className="milestone-row"><button className={cx("check-box", m.done && "on")} onClick={() => patch({ milestones: project.milestones.map(x => x.id === m.id ? { ...x, done: !x.done } : x) })}>{m.done && <Check size={12} />}</button><b className={m.done ? "struck" : ""}>{m.title}</b><span className="small">{fmtLong(m.date)}</span><button className="icon-btn" onClick={() => patch({ milestones: project.milestones.filter(x => x.id !== m.id) })}><X size={14} /></button></div>)}</div>
      </section>
      <div className="small" style={{ marginTop: 8 }}>{inSprint.length} tasks in the current sprint · {project.tasks.length - inSprint.length} in other sprints.</div>
    </div>
  );
}

function DocsTab({ project, patch }) {
  const docs = project.docs || [];
  const [activeId, setActiveId] = useState(docs[0]?.id || null);
  const active = docs.find(d => d.id === activeId) || docs[0];
  function addDoc() { const doc = { id: uid("d"), title: "Untitled page", body: "" }; patch({ docs: [...docs, doc] }); setActiveId(doc.id); }
  function updateDoc(patchDoc) { patch({ docs: docs.map(d => d.id === active.id ? { ...d, ...patchDoc } : d) }); }
  return (
    <div className="docs-view">
      <aside className="docs-sidebar"><div className="space-between"><b>Wiki pages</b><button className="icon-btn" onClick={addDoc}><Plus size={15} /></button></div>{docs.map(d => <button key={d.id} className={cx("doc-link", active?.id === d.id && "active")} onClick={() => setActiveId(d.id)}><FileText size={14} /> {d.title}</button>)}{!docs.length && <div className="small">No pages yet.</div>}</aside>
      <div className="docs-editor">
        {active ? <><input className="doc-title" value={active.title} onChange={e => updateDoc({ title: e.target.value })} /><textarea className="doc-body" value={active.body} onChange={e => updateDoc({ body: e.target.value })} placeholder="Write documentation, decisions, meeting notes…" /><div className="small">Saved locally as you type · Markdown-friendly plain text</div><button className="btn sm danger" onClick={() => { patch({ docs: docs.filter(d => d.id !== active.id) }); setActiveId(null); }}><Trash2 size={14} /> Delete page</button></>
          : <div className="empty">Create a wiki page to document decisions and keep context close to the work.</div>}
      </div>
    </div>
  );
}

function ChatTab({ project }) {
  const { state, dispatch } = useStore();
  const [text, setText] = useState("");
  const messages = project.chat || [];
  function send(e) { e.preventDefault(); if (!text.trim()) return; dispatch({ type: "ADD_CHAT", projectId: project.id, author: "u1", authorName: "Maya Chen", text: text.trim(), time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }); setText(""); }
  return (
    <div className="chat-view">
      <div className="chat-channel-head"><span className="channel-hash">#</span><div><h3>project-chat</h3><span className="small">Project discussion · {messages.length} messages · {project.members.length} members</span></div><span className="chip"><span className="online-dot" /> {project.members.length} online</span></div>
      <div className="chat-messages">{messages.map(c => { const m = state.members.find(x => x.id === c.author); const mine = c.author === "u1"; return <div key={c.id} className={cx("chat-msg", mine && "mine")}><span className="avatar mini" style={{ background: m?.color || "#94a3b8" }}>{initials(m?.name || "U")}</span><div className="chat-bubble"><div className="space-between"><b>{m?.name || "Unknown"}</b><span className="small">{c.time}</span></div><p>{c.text}</p></div></div>; })}{!messages.length && <div className="empty">No messages yet. Start the conversation.</div>}</div>
      <form className="chat-composer" onSubmit={send}><input className="field" value={text} onChange={e => setText(e.target.value)} placeholder="Message #project-chat… use @ to mention" /><button className="btn primary" type="submit"><Send size={15} /> Send</button></form>
    </div>
  );
}

function FilesTab({ project, patch }) {
  const { state } = useStore();
  const files = project.files || [];
  function upload(e) {
    const additions = [...e.target.files].map(f => ({ id: uid("f"), name: f.name, size: `${(f.size / 1024 / 1024).toFixed(1)} MB`, owner: "u1", type: f.type, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null }));
    patch({ files: [...files, ...additions] }); e.target.value = "";
  }
  return (
    <div className="files-view">
      <div className="space-between"><div><h3>Project files</h3><span className="small">Uploads live in this browser session (demo).</span></div><label className="btn primary"><Upload size={15} /> Upload files<input type="file" multiple hidden onChange={upload} /></label></div>
      <div className="file-grid">{files.map(f => { const owner = state.members.find(m => m.id === f.owner); return (
        <div key={f.id} className="file-card"><div className="file-preview">{f.url ? <img src={f.url} alt={f.name} /> : <FileIcon size={28} />}</div><div><b>{f.name}</b><div className="small">{f.size} · {owner?.name || "Team"}</div></div><button className="icon-btn" onClick={() => patch({ files: files.filter(x => x.id !== f.id) })}><Trash2 size={14} /></button></div>
      ); })}{!files.length && <div className="empty">No files yet. Upload a brief, asset or document.</div>}</div>
    </div>
  );
}

function ActivityTab({ project }) {
  const [filter, setFilter] = useState("all");
  const events = [
    ...(project.activity || []).map(a => ({ ...a, type: "activity" })),
    ...(project.chat || []).map(c => ({ id: c.id, text: `Message in #project-chat: ${c.text}`, time: c.time, type: "chat" })),
    ...(project.docs || []).map(d => ({ id: d.id, text: `Edited wiki page "${d.title}"`, time: "Recently", type: "docs" })),
    ...(project.files || []).map(f => ({ id: f.id, text: `Uploaded ${f.name}`, time: "Recently", type: "files" })),
  ];
  const shown = filter === "all" ? events : events.filter(e => e.type === filter);
  return (
    <div className="activity-view">
      <div className="toolbar"><div className="row">{["all", "activity", "chat", "docs", "files"].map(f => <button key={f} className={cx("tab", filter === f && "active")} onClick={() => setFilter(f)}>{f}</button>)}</div><span className="small">{shown.length} events</span></div>
      <div className="activity-timeline">{shown.map(e => <div key={e.type + e.id} className="activity-event"><span className="activity-icon">{e.type === "chat" ? <MessageSquare size={14} /> : e.type === "docs" ? <FileText size={14} /> : e.type === "files" ? <Paperclip size={14} /> : <ActivityIcon size={14} />}</span><div><b>{e.text}</b><span className="small">{e.time} · {e.type}</span></div></div>)}</div>
    </div>
  );
}

function TimeTab({ project }) {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState({ member: "u1", task: project.tasks[0]?.title || "", hours: 1, date: TODAY_DATE });
  const entries = state.timeEntries.filter(e => e.project === project.id);
  const total = entries.reduce((s, e) => s + Number(e.hours), 0);
  function add(e) { e.preventDefault(); dispatch({ type: "ADD_TIME_ENTRY", entry: { id: uid("te"), ...draft, project: project.id, hours: Number(draft.hours) } }); }
  return (
    <div className="time-view">
      <div className="grid-4">
        <div className="kpi"><span>Logged</span><b>{total}h</b><div className="small">on this project</div></div>
        <div className="kpi"><span>Entries</span><b>{entries.length}</b><div className="small">time records</div></div>
        <div className="kpi"><span>Budget</span><b>{money(project.budget)}</b><div className="small">project total</div></div>
        <div className="kpi"><span>Avg / entry</span><b>{entries.length ? (total / entries.length).toFixed(1) : 0}h</b><div className="small">per log</div></div>
      </div>
      <form className="panel toolbar" onSubmit={add} style={{ marginTop: 16 }}>
        <label className="lbl">Member<select className="field" value={draft.member} onChange={e => setDraft({ ...draft, member: e.target.value })}>{state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label className="lbl">Task<input className="field" value={draft.task} onChange={e => setDraft({ ...draft, task: e.target.value })} /></label>
        <label className="lbl">Hours<input className="field" type="number" step="0.25" value={draft.hours} onChange={e => setDraft({ ...draft, hours: e.target.value })} /></label>
        <label className="lbl">Date<input className="field" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
        <button className="btn primary" type="submit"><Plus size={15} /> Log time</button>
      </form>
      <section className="panel" style={{ marginTop: 16 }}><h3>Timesheet</h3><table className="table"><thead><tr><th>Date</th><th>Member</th><th>Task</th><th>Hours</th></tr></thead><tbody>{entries.map(e => <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{state.members.find(m => m.id === e.member)?.name || e.member}</td><td>{e.task}</td><td><b>{e.hours}h</b></td></tr>)}</tbody></table>{!entries.length && <div className="empty">No time logged yet.</div>}</section>
    </div>
  );
}

function SettingsTab({ project, patch, onClose }) {
  const { state, dispatch } = useStore();
  const [fieldName, setFieldName] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [statusName, setStatusName] = useState("");
  const [template, setTemplate] = useState("");
  const customFields = { ...(project.customFields || {}) };
  const customStatuses = [...(project.customStatuses || [])];

  return (
    <div className="pd-settings">
      <section className="panel pd-panel"><h3>Project details</h3><div className="form-grid">
        <label className="lbl">Name<input className="field" value={project.name} onChange={e => patch({ name: e.target.value })} /></label>
        <label className="lbl">Status<select className="field" value={project.status} onChange={e => patch({ status: e.target.value })}><option>To Do</option><option>In Progress</option><option>Completed</option></select></label>
        <label className="lbl">Start<input className="field" type="date" value={project.start} onChange={e => patch({ start: e.target.value })} /></label>
        <label className="lbl">End<input className="field" type="date" value={project.end} onChange={e => patch({ end: e.target.value })} /></label>
        <label className="lbl">Budget<input className="field" type="number" value={project.budget} onChange={e => patch({ budget: Number(e.target.value) })} /></label>
        <label className="lbl">Sprint<input className="field" value={project.sprint} onChange={e => patch({ sprint: e.target.value })} /></label>
        <label className="lbl full">Description<textarea className="field" value={project.description || ""} onChange={e => patch({ description: e.target.value })} /></label>
      </div></section>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="panel pd-panel"><h3>Custom fields</h3><div className="stack">{Object.entries(customFields).map(([k, v]) => <div key={k} className="list-row"><div><b>{k}</b><div className="small">{v}</div></div><button className="icon-btn" onClick={() => { const next = { ...customFields }; delete next[k]; patch({ customFields: next }); }}><X size={14} /></button></div>)}</div><div className="row" style={{ marginTop: 10 }}><input className="field" value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="Field name" /><input className="field" value={fieldValue} onChange={e => setFieldValue(e.target.value)} placeholder="Value" /><button className="btn sm" onClick={() => { if (fieldName.trim()) { patch({ customFields: { ...customFields, [fieldName.trim()]: fieldValue } }); setFieldName(""); setFieldValue(""); } }}><Plus size={14} /></button></div></section>
        <section className="panel pd-panel"><h3>Custom statuses</h3><div className="row" style={{ flexWrap: "wrap" }}>{customStatuses.map(s => <span key={s} className="chip">{s}<button className="icon-btn" onClick={() => patch({ customStatuses: customStatuses.filter(x => x !== s) })}><X size={11} /></button></span>)}</div><div className="row" style={{ marginTop: 10 }}><input className="field" value={statusName} onChange={e => setStatusName(e.target.value)} placeholder="New status" /><button className="btn sm" onClick={() => { if (statusName.trim() && !customStatuses.includes(statusName.trim())) { patch({ customStatuses: [...customStatuses, statusName.trim()] }); setStatusName(""); } }}><Plus size={14} /></button></div><div className="small" style={{ marginTop: 8 }}>Each status becomes a board column and task option.</div></section>
      </div>

      <section className="panel pd-panel" style={{ marginTop: 16 }}><h3>Task template</h3><div className="row"><select className="field" style={{ maxWidth: 280 }} value={template} onChange={e => setTemplate(e.target.value)}><option value="">Choose a template…</option><option>Design deliverable</option><option>Development task</option><option>Content piece</option><option>Campaign launch</option></select><button className="btn sm" onClick={() => { if (!template) return; const titles = { "Design deliverable": ["Brief & requirements", "Explore directions", "Internal review", "Final handoff"], "Development task": ["Scope", "Implement", "Test", "Deploy"], "Content piece": ["Outline", "Draft", "Edit", "Publish"], "Campaign launch": ["Assets", "Schedule", "QA", "Launch"] }; const added = (titles[template] || []).map(title => ({ ...{ id: uid("t"), projectId: project.id, status: "todo", priority: "Medium", labels: [], assignees: [], due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), subtasks: [], checklist: [], attachments: [], comments: [], dependencies: [], recurring: null, estimate: 4, spent: 0, description: "", sprint: project.sprint }, title })); patch({ tasks: [...project.tasks, ...added] }); setTemplate(""); }}><Plus size={14} /> Create tasks</button></div><div className="small" style={{ marginTop: 8 }}>Templates seed a checklist of tasks into this project.</div></section>

      <section className="panel pd-panel danger-zone" style={{ marginTop: 16 }}><h3>Danger zone</h3><div className="space-between"><div><b>Delete this project</b><div className="small">Removes all tasks, docs, chat and files in this demo workspace.</div></div><button className="btn danger" onClick={() => { if (window.confirm(`Delete ${project.name}?`)) { dispatch({ type: "DELETE_PROJECT", id: project.id }); onClose(); } }}><Trash2 size={14} /> Delete project</button></div></section>
      <div className="small" style={{ marginTop: 8 }}>Members: {project.members.map(id => state.members.find(m => m.id === id)?.name).filter(Boolean).join(", ") || "None"}</div>
    </div>
  );
}
