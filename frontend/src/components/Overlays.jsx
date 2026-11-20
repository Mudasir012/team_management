import { useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { useAuth } from "../auth";
import { useStore } from "../store";
import { markAllNotificationsRead, markNotificationRead, savePreferences } from "../sync";
import { money, daysLabel, progressFromTasks, uid } from "../utils";

export function Modal({ title, subtitle, children, onClose, wide }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e)=> e.target===e.currentTarget && onClose()}>
      <div className="modal" style={wide ? {width:"min(900px,100%)"} : undefined}>
        <div className="space-between" style={{marginBottom:6}}>
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="small">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ProjectModal({ onClose, existing }) {
  const { state, dispatch } = useStore();
  const { user } = useAuth();
  const [form, setForm] = useState(existing || {
    id: uid("p"), name: "", status: "To Do", start: new Date().toISOString().slice(0,10),
    end: new Date(Date.now()+14*86400000).toISOString().slice(0,10), budget: 5000,
    members: [user.id], labels: [], customerId: state.customers[0]?.id || "", progress: 0,
    preview: "stats", description: "", milestones: [], sprint: "Backlog", docs: [], chat: [], files: [], activity: [],
    customFields: {}, customStatuses: ["Backlog","Todo","In Progress","Review","Done"], tasks: [],
  });
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));
  const toggleArr = (k, id) => set(k, form[k].includes(id) ? form[k].filter(x=>x!==id) : [...form[k], id]);

  function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    dispatch({ type: "UPSERT_PROJECT", project: { ...form, budget: Number(form.budget)||0 } });
    onClose();
  }

  return (
    <Modal title={existing ? "Edit Project" : "New Project"} subtitle="Status, dates, budget, members and labels." onClose={onClose}>
      <form onSubmit={save} className="form-grid">
        <label className="lbl full">Name<input className="field" value={form.name} onChange={e=>set("name", e.target.value)} required placeholder="Project name" /></label>
        <label className="lbl">Status<select className="field" value={form.status} onChange={e=>set("status", e.target.value)}><option>To Do</option><option>In Progress</option><option>Completed</option></select></label>
        <label className="lbl">Budget ($)<input className="field" type="number" value={form.budget} onChange={e=>set("budget", e.target.value)} /></label>
        <label className="lbl">Start<input className="field" type="date" value={form.start} onChange={e=>set("start", e.target.value)} /></label>
        <label className="lbl">End<input className="field" type="date" value={form.end} onChange={e=>set("end", e.target.value)} /></label>
        <label className="lbl">Customer<select className="field" value={form.customerId} onChange={e=>set("customerId", e.target.value)}><option value="">None</option>{state.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="lbl">Preview<select className="field" value={form.preview} onChange={e=>set("preview", e.target.value)}><option value="stats">Stats & chart</option><option value="kanban">Mini kanban</option><option value="checklist">Checklist</option><option value="months">Month columns</option><option value="skeleton">Skeleton rows</option></select></label>
        <div className="lbl full">Members
          <div className="row" style={{flexWrap:"wrap"}}>{state.members.filter(m=>m.role!=="guest").map(m=>(
            <button type="button" key={m.id} className={"chip "+(form.members.includes(m.id)?"active":"")} style={form.members.includes(m.id)?{borderColor:m.color,color:"var(--text)"}:{}} onClick={()=>toggleArr("members", m.id)}>{m.name}</button>
          ))}</div>
        </div>
        <div className="lbl full">Labels
          <div className="row" style={{flexWrap:"wrap"}}>{state.labels.map(l=>(
            <button type="button" key={l.id} className="chip" style={form.labels.includes(l.id)?{borderColor:l.color,color:"var(--text)"}:{}} onClick={()=>toggleArr("labels", l.id)}><span className="label-dot" style={{background:l.color,width:8,height:8,borderRadius:3}}/> {l.name}</button>
          ))}</div>
        </div>
        <label className="lbl full">Description<textarea className="field" value={form.description} onChange={e=>set("description", e.target.value)} placeholder="What is this project about?" /></label>
        <div className="full" style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">{existing?"Save":"Create project"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function LabelModal({ initial, onClose }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || "#6366f1");
  const colors = ["#ef4444","#f97316","#f59e0b","#22c55e","#06b6d4","#3b82f6","#6366f1","#8b5cf6","#ec4899","#64748b"];
  function save(e){
    e.preventDefault(); if(!name.trim()) return;
    const label = { id: initial?.id || uid("l"), name: name.trim(), color };
    dispatch({ type: initial?.id ? "UPDATE_LABEL" : "ADD_LABEL", label });
    onClose();
  }
  return (
    <Modal title={initial?"Edit label":"New label"} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="lbl">Name<input className="field" value={name} onChange={e=>setName(e.target.value)} autoFocus /></label>
        <div className="lbl">Color<div className="row" style={{flexWrap:"wrap"}}>{colors.map(c=>(
          <button key={c} type="button" onClick={()=>setColor(c)} style={{width:28,height:28,borderRadius:8,border: color===c?"2px solid var(--text)":"1px solid var(--border)", background:c}} aria-label={c}/>
        ))}</div></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" type="submit">Save</button></div>
      </form>
    </Modal>
  );
}

export function CommandPalette({ onClose, onAddProject }) {
  const { state, dispatch } = useStore();
  const { hasPermission } = useAuth();
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const term = q.toLowerCase();
    const pages = [
      ["dashboard","Dashboard"],["analytics","Analytics"],["customer","Customer"],["todo","To Do List"],["project","Project"],["leads","Leads"],["earning","Earning"],["expenses","Expenses"]
    ].filter(([id]) => hasPermission({
      dashboard: "projects:read", analytics: "analytics:read", customer: "customers:read", todo: "tasks:read",
      project: "projects:read", leads: "leads:read", earning: "invoices:read", expenses: "expenses:read",
    }[id]));
    const list = [
      ...pages.map(([id,label])=>({type:"page", id, label:`Go to ${label}`, action:()=>{dispatch({type:"SET_PAGE",page:id}); onClose();}})),
      ...(hasPermission("projects:write") ? [{type:"action", id:"new", label:"Create new project", action:()=>{onClose(); onAddProject();}}] : []),
      ...(hasPermission("projects:read") ? state.projects.map(p=>({type:"project", id:p.id, label:`Open project: ${p.name}`, meta: daysLabel(p.end,p.status), action:()=>{dispatch({type:"SELECT_PROJECT",id:p.id}); dispatch({type:"SET_PAGE",page:"projectDetail"}); onClose();}})) : []),
      ...(hasPermission("customers:read") ? state.customers.map(c=>({type:"customer", id:c.id, label:`Customer: ${c.name}`, meta:c.status, action:()=>{dispatch({type:"SET_PAGE",page:"customer"}); onClose();}})) : []),
    ];
    if (!term) return list.slice(0,12);
    return list.filter(i => i.label.toLowerCase().includes(term)).slice(0,12);
  }, [q, state.projects, state.customers, hasPermission, dispatch, onClose, onAddProject]);

  return (
    <div className="palette-backdrop" onMouseDown={(e)=>e.target===e.currentTarget && onClose()}>
      <div className="palette">
        <input autoFocus placeholder="Search pages, projects, customers, actions…" value={q} onChange={e=>setQ(e.target.value)} />
        <div className="palette-list">
          {items.map((i,idx)=>(
            <button key={i.type+i.id+idx} className="palette-item" onClick={i.action}>
              <span>{i.label}</span><span className="small">{i.meta || i.type}</span>
            </button>
          ))}
          {!items.length && <div className="small" style={{padding:12}}>No results</div>}
        </div>
      </div>
    </div>
  );
}

export function NotificationsDrawer({ onClose }) {
  const { state, dispatch } = useStore();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function markAll() {
    setBusy(true); setError("");
    try {
      await markAllNotificationsRead(user.id);
      dispatch({ type: "MARK_ALL_READ" });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function markRead(notification) {
    setError("");
    try {
      await markNotificationRead(notification.id);
      dispatch({ type: "MARK_NOTIFICATION_READ", id: notification.id });
    } catch (e) { setError(e.message); }
  }

  async function togglePreference(key, value) {
    setError("");
    try {
      await savePreferences(user.id, { ...state.notificationsPrefs, [key]: value });
      dispatch({ type: "SET_PREFS", prefs: { [key]: value } });
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="drawer">
      <div className="drawer-head"><div><h3 style={{margin:0}}>Notifications</h3><div className="small">In-app · email · push preferences</div></div><div className="row"><button className="btn sm" disabled={busy || !state.notifications.some(n => !n.read)} onClick={markAll}>Mark all read</button><button className="icon-btn" onClick={onClose}><X size={18}/></button></div></div>
      <div className="drawer-body stack">
        {error && <div className="glass-error">{error}</div>}
        <div className="panel stack">
          <strong style={{fontSize:14}}>Preferences</strong>
          {Object.entries(state.notificationsPrefs).map(([k,v])=>(
            <label key={k} className="row" style={{justifyContent:"space-between"}}><span style={{textTransform:"capitalize"}}>{k.replace(/([A-Z])/g," $1")}</span><input type="checkbox" checked={v} onChange={e=>togglePreference(k, e.target.checked)} /></label>
          ))}
        </div>
        <div className="list">
          {state.notifications.map(n=>(
            <div key={n.id} className="list-row" style={{opacity:n.read?0.7:1}}>
              <div><div style={{fontWeight:600,fontSize:14}}>{n.text}</div><div className="small">{n.time ? new Date(n.time).toLocaleString() : ""}</div></div>
              {!n.read && <button className="btn sm" onClick={()=>markRead(n)}>Read</button>}
            </div>
          ))}
          {!state.notifications.length && <div className="empty">No notifications yet.</div>}
        </div>
      </div>
    </div>
  );
}

export function AiDrawer({ onClose }) {
  const { state } = useStore();
  const [mode, setMode] = useState("standup");
  const allTasks = state.projects.flatMap(p=>p.tasks.map(t=>({...t, project:p.name})));
  const overdue = allTasks.filter(t=>t.status!=="done" && new Date(t.due) < new Date());
  const todayTasks = allTasks.filter(t=>t.status!=="done").slice(0,5);
  const output = mode === "standup"
    ? `Standup summary (local):\n- In progress: ${allTasks.filter(t=>t.status==="inprogress").length} tasks across ${state.projects.filter(p=>p.status==="In Progress").length} projects.\n- Blockers/overdue: ${overdue.length || 0} items need attention.\n- Focus today: ${todayTasks.map(t=>t.title).slice(0,3).join("; ") || "clear backlog"}.`
    : mode === "subtasks"
    ? `Suggested subtasks for “${todayTasks[0]?.title || "selected task"}”:\n1. Clarify scope and acceptance criteria\n2. Draft first version\n3. Review with owner\n4. Address feedback\n5. Mark done and share update`
    : `Task summary (local): ${allTasks.length} total tasks · ${allTasks.filter(t=>t.status==="done").length} done · ${Math.round((allTasks.filter(t=>t.status==="done").length/Math.max(1,allTasks.length))*100)}% complete. Top priority: keep ${state.projects.find(p=>p.status!=="Completed")?.name || "active projects"} on track.`;
  return (
    <div className="drawer">
      <div className="drawer-head"><div><h3 style={{margin:0}}>AI Assistant</h3><div className="small">Local summaries (no external API)</div></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
      <div className="drawer-body stack">
        <div className="row" style={{flexWrap:"wrap"}}>
          <button className={"tab "+(mode==="standup"?"active":"")} onClick={()=>setMode("standup")}>Standup summary</button>
          <button className={"tab "+(mode==="subtasks"?"active":"")} onClick={()=>setMode("subtasks")}>Generate subtasks</button>
          <button className={"tab "+(mode==="summary"?"active":"")} onClick={()=>setMode("summary")}>Task summary</button>
        </div>
        <pre className="panel" style={{whiteSpace:"pre-wrap",margin:0,fontFamily:"inherit",fontSize:14,lineHeight:1.6}}>{output}</pre>
        <div className="small">Tip: use rule-based automation and saved views to operationalize these insights.</div>
      </div>
    </div>
  );
}
