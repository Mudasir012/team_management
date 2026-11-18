import { useState } from "react";
import {
  X, Users, Zap, Bell, ShieldCheck, Plug, Code2, CreditCard, Building2, Plus, Trash2,
  Copy, Check, Key, Mail, GitBranch, Globe, Smartphone, Monitor, Globe2, CalendarDays,
  MessageCircle, RefreshCw, ToggleLeft, ToggleRight, Crown, Lock
} from "lucide-react";
import { useStore } from "../store";
import { uid } from "../data/seed";
import { cx, initials, money } from "../utils";

const TABS = [
  { id: "team", label: "Team", icon: Users },
  { id: "automation", label: "Automation", icon: Zap },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "api", label: "API", icon: Code2 },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "org", label: "Organization", icon: Building2 },
];

const ROLES = ["owner", "admin", "manager", "member", "guest"];

export default function AdminDrawer({ onClose }) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState("team");
  const [integrations, setIntegrations] = useState({ Slack: true, GitHub: false, "Google Calendar": true, Figma: false });
  const [copied, setCopied] = useState("");

  function copy(text, key) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1400);
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal admin-modal">
        <div className="admin-head">
          <div className="row"><span className="admin-mark"><Building2 size={18} /></span><div><h2>Workspace admin</h2><div className="small">{state.settings.org} · {state.settings.plan}</div></div></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="admin-layout">
          <nav className="admin-nav">{TABS.map(t => { const Icon = t.icon; return <button key={t.id} className={cx("admin-nav-item", tab === t.id && "active")} onClick={() => setTab(t.id)}><Icon size={15} /> {t.label}</button>; })}</nav>
          <div className="admin-content">
            {tab === "team" && <TeamTab />}
            {tab === "automation" && <AutomationTab />}
            {tab === "notifications" && <NotificationsTab />}
            {tab === "security" && <SecurityTab copy={copy} copied={copied} />}
            {tab === "integrations" && <IntegrationsTab integrations={integrations} setIntegrations={setIntegrations} />}
            {tab === "api" && <ApiTab copy={copy} copied={copied} />}
            {tab === "billing" && <BillingTab />}
            {tab === "org" && <OrgTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminSection({ title, note, children, action }) {
  return <section className="admin-section"><div className="space-between" style={{ marginBottom: 12 }}><div><h3>{title}</h3>{note && <div className="small">{note}</div>}</div>{action}</div>{children}</section>;
}

function TeamTab() {
  const { state, dispatch } = useStore();
  return <AdminSection title="Team directory" note="Roles, capacity, leave and availability. Changes apply to this demo workspace.">
    <div className="admin-team-list">
      {state.members.map(m => (
        <div key={m.id} className="admin-member">
          <span className="avatar" style={{ background: m.color }}>{initials(m.name)}</span>
          <div className="admin-member-name"><b>{m.name}</b><span className="small">{m.title}</span></div>
          <div className="admin-member-meta"><span className="small">Capacity</span><b>{m.hours}/{m.capacity}h</b></div>
          <label className="lbl compact-lbl">Leave<input className="field" style={{ width: 88, minHeight: 32, height: 32, padding: "4px 8px" }} value={m.leave || ""} placeholder="None" onChange={e => dispatch({ type: "UPDATE_MEMBER", member: { id: m.id, leave: e.target.value || null } })} /></label>
          <select className="field role-select" value={m.role} onChange={e => dispatch({ type: "UPDATE_MEMBER", member: { id: m.id, role: e.target.value } })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
          <span className={cx("presence", m.status)}>{m.status}</span>
        </div>
      ))}
    </div>
    <div className="role-legend">{ROLES.map(r => <span key={r} className="chip">{r} · {r === "owner" ? "full control" : r === "admin" ? "manage all" : r === "manager" ? "manage projects" : r === "guest" ? "scoped access" : "standard access"}</span>)}</div>
  </AdminSection>;
}

function AutomationTab() {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState({ name: "", trigger: "Task created", condition: "Priority is High", action: "Notify assignee" });
  const triggers = ["Task created", "Due date passed", "Checklist completed", "Status changed", "Comment added"];
  const conditions = ["Priority is High", "All items checked", "Task not done", "Assignee is me", "Always"];
  const actions = ["Notify assignee", "Set status Review", "Send in-app alert", "Add label Follow-up", "Create subtask"];
  return <AdminSection title="Automation rules" note="Trigger → condition → action. Rules run locally in this demo." action={<span className="chip">{state.automations.filter(a => a.enabled).length} active</span>}>
    <div className="automation-list">{state.automations.map(a => (
      <div key={a.id} className={cx("automation-row", !a.enabled && "off")}>
        <button className="icon-btn" onClick={() => dispatch({ type: "TOGGLE_AUTOMATION", id: a.id })}>{a.enabled ? <ToggleRight size={22} className="on-icon" /> : <ToggleLeft size={22} />}</button>
        <div className="automation-flow"><b>{a.name}</b><div className="small"><span className="flow-chip">{a.trigger}</span><span className="flow-arrow">→</span><span className="flow-chip">{a.condition}</span><span className="flow-arrow">→</span><span className="flow-chip">{a.action}</span></div></div>
        <button className="icon-btn" onClick={() => dispatch({ type: "TOGGLE_AUTOMATION", id: a.id })} title="Disable/enable"><Zap size={14} /></button>
      </div>
    ))}</div>
    <div className="automation-add">
      <input className="field" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Rule name" />
      <select className="field" value={draft.trigger} onChange={e => setDraft({ ...draft, trigger: e.target.value })}>{triggers.map(x => <option key={x}>{x}</option>)}</select>
      <select className="field" value={draft.condition} onChange={e => setDraft({ ...draft, condition: e.target.value })}>{conditions.map(x => <option key={x}>{x}</option>)}</select>
      <select className="field" value={draft.action} onChange={e => setDraft({ ...draft, action: e.target.value })}>{actions.map(x => <option key={x}>{x}</option>)}</select>
      <button className="btn primary sm" onClick={() => { if (!draft.name.trim()) return; dispatch({ type: "ADD_AUTOMATION", automation: { id: uid("a"), ...draft, name: draft.name.trim(), enabled: true } }); setDraft({ ...draft, name: "" }); }}><Plus size={14} /> Add rule</button>
    </div>
  </AdminSection>;
}

function NotificationsTab() {
  const { state, dispatch } = useStore();
  const labels = { inApp: "In-app notifications", email: "Email digests", push: "Push notifications", mentions: "@mentions", deadlines: "Deadline reminders" };
  return <AdminSection title="Notification preferences" note="Choose where and when the workspace reaches you.">
    <div className="preference-list">{Object.entries(state.notificationsPrefs).map(([k, v]) => (
      <label key={k} className="preference-row"><span>{labels[k] || k}</span><button className={cx("switch", v && "on")} onClick={() => dispatch({ type: "SET_PREFS", prefs: { [k]: !v } })}><span /></button></label>
    ))}</div>
    <div className="panel" style={{ marginTop: 14, background: "var(--surface-2)" }}><b style={{ fontSize: 13 }}>Recent activity</b><div className="list" style={{ marginTop: 8 }}>{state.notifications.map(n => <div key={n.id} className="list-row"><span>{n.text}</span><span className="small">{n.time}</span></div>)}</div></div>
  </AdminSection>;
}

function SecurityTab({ copy, copied }) {
  const { state, dispatch } = useStore();
  const s = state.settings;
  return <AdminSection title="Security & sessions" note="Sign-in methods, multi-factor authentication and active devices.">
    <div className="security-grid">
      <div className="security-card"><span className="security-icon"><Mail size={17} /></span><div><b>Email & password</b><div className="small">Primary sign-in method</div></div><span className="pill green">Enabled</span></div>
      <div className="security-card"><span className="security-icon"><Globe size={17} /></span><div><b>Google OAuth</b><div className="small">Connect a Google account</div></div><span className="pill blue">Available</span></div>
      <div className="security-card"><span className="security-icon"><GitBranch size={17} /></span><div><b>GitHub OAuth</b><div className="small">Connect a GitHub account</div></div><span className="pill blue">Available</span></div>
      <div className="security-card"><span className="security-icon"><Lock size={17} /></span><div><b>Multi-factor authentication</b><div className="small">Require a second step at sign-in</div></div><button className={cx("switch", s.mfa && "on")} onClick={() => dispatch({ type: "UPDATE_SETTINGS", settings: { mfa: !s.mfa } })}><span /></button></div>
      <div className="security-card"><span className="security-icon"><ShieldCheck size={17} /></span><div><b>Single sign-on (SSO)</b><div className="small">SAML for organization accounts</div></div><button className={cx("switch", s.sso && "on")} onClick={() => dispatch({ type: "UPDATE_SETTINGS", settings: { sso: !s.sso } })}><span /></button></div>
    </div>
    <h4 style={{ margin: "18px 0 8px", fontSize: 13 }}>Active sessions</h4>
    <div className="list">{s.sessions.map(session => <div key={session.id} className="list-row"><div className="row">{session.device.includes("iPhone") ? <Smartphone size={16} /> : <Monitor size={16} />}<div><b style={{ fontSize: 13 }}>{session.device}</b><div className="small">Last active {session.last}</div></div></div><div className="row">{session.active && <span className="pill green">This device</span>}<button className="btn sm" onClick={() => dispatch({ type: "UPDATE_SETTINGS", settings: { sessions: s.sessions.filter(x => x.id !== session.id) } })}>Revoke</button></div></div>)}</div>
    <div className="row" style={{ marginTop: 12 }}><button className="btn sm" onClick={() => copy("sk_demo_••••••••••••4f2a", "key")}>{copied === "key" ? <Check size={14} /> : <Copy size={14} />} Copy recovery code</button><button className="btn sm" onClick={() => dispatch({ type: "UPDATE_SETTINGS", settings: { sessions: [...s.sessions, { id: uid("s"), device: "New session · Chrome", active: false, last: "Just now" }] } })}><RefreshCw size={14} /> New session</button></div>
  </AdminSection>;
}

function IntegrationsTab({ integrations, setIntegrations }) {
  const meta = {
    Slack: { icon: MessageCircle, note: "Project updates and mentions in channels" },
    GitHub: { icon: GitBranch, note: "Link commits and pull requests to tasks" },
    "Google Calendar": { icon: CalendarDays, note: "Sync due dates to your calendar" },
    Figma: { icon: Globe2, note: "Attach design files as previews" },
  };
  return <AdminSection title="Integrations" note="Connect the tools your team already uses. Demo toggles store locally.">
    <div className="integration-grid">{Object.entries(meta).map(([name, m]) => { const Icon = m.icon; const on = integrations[name]; return (
      <div key={name} className="integration-card"><span className="integration-icon"><Icon size={19} /></span><div><b>{name}</b><div className="small">{m.note}</div></div><button className={cx("btn sm", on ? "primary" : "")} onClick={() => setIntegrations(v => ({ ...v, [name]: !v[name] }))}>{on ? "Connected" : "Connect"}</button></div>
    ); })}</div>
  </AdminSection>;
}

function ApiTab({ copy, copied }) {
  const [webhook, setWebhook] = useState("https://hooks.example.com/team-management");
  const [events, setEvents] = useState(["task.created", "task.status_changed", "project.completed"]);
  const allEvents = ["task.created", "task.status_changed", "task.assigned", "project.completed", "invoice.paid"];
  return <AdminSection title="Public API & webhooks" note="Programmatic access and event delivery (demo credentials).">
    <div className="api-block"><div className="space-between"><b style={{ fontSize: 13 }}>API key</b><span className="pill">Server-side only</span></div><div className="row" style={{ marginTop: 8 }}><code className="api-code">sk_demo_••••••••••••••••4f2a</code><button className="btn sm" onClick={() => copy("sk_demo_4f2a", "api")}>{copied === "api" ? <Check size={14} /> : <Copy size={14} />} Copy</button></div></div>
    <div className="api-block"><b style={{ fontSize: 13 }}>Webhook endpoint</b><div className="row" style={{ marginTop: 8 }}><input className="field" value={webhook} onChange={e => setWebhook(e.target.value)} /><button className="btn sm primary">Save</button></div></div>
    <div className="api-block"><b style={{ fontSize: 13 }}>Subscribed events</b><div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>{allEvents.map(e => <button key={e} className={cx("chip", events.includes(e) && "chip-on")} onClick={() => setEvents(v => v.includes(e) ? v.filter(x => x !== e) : [...v, e])}>{events.includes(e) && <Check size={12} />} {e}</button>)}</div></div>
    <div className="row" style={{ marginTop: 12 }}><button className="btn sm"><Code2 size={14} /> View API docs</button><button className="btn sm"><RefreshCw size={14} /> Send test event</button></div>
  </AdminSection>;
}

function BillingTab() {
  const { state } = useStore();
  const seats = state.members.length;
  const total = state.invoices.reduce((s, i) => s + i.amount, 0);
  return <AdminSection title="Billing & subscription" note="Plan, seats and payment history for this workspace.">
    <div className="billing-hero"><span className="billing-crown"><Crown size={20} /></span><div><b>{state.settings.plan}</b><div className="small">{seats} seats · billed monthly</div></div><button className="btn sm">Manage plan</button></div>
    <div className="grid-3" style={{ marginTop: 14 }}>
      <div className="kpi"><span>Monthly spend</span><b>{money(seats * 18)}</b><div className="small">${18} per seat</div></div>
      <div className="kpi"><span>Invoiced</span><b>{money(total)}</b><div className="small">{state.invoices.length} invoices</div></div>
      <div className="kpi"><span>Next renewal</span><b>Nov 30</b><div className="small">Auto-renew on</div></div>
    </div>
    <div className="list" style={{ marginTop: 14 }}>{state.invoices.slice(0, 4).map(i => <div key={i.id} className="list-row"><div><b>{i.id}</b><div className="small">{i.client} · {i.issued}</div></div><div className="row"><b>{money(i.amount)}</b><span className={cx("pill", i.status === "Paid" ? "green" : i.status === "Overdue" ? "red" : "blue")}>{i.status}</span></div></div>)}</div>
  </AdminSection>;
}

function OrgTab() {
  const { state, dispatch } = useStore();
  return <AdminSection title="Organization settings" note="Workspace identity, defaults and audit trail.">
    <div className="grid-2">
      <label className="lbl">Organization name<input className="field" value={state.settings.org} onChange={e => dispatch({ type: "UPDATE_SETTINGS", settings: { org: e.target.value } })} /></label>
      <label className="lbl">Plan label<input className="field" value={state.settings.plan} onChange={e => dispatch({ type: "UPDATE_SETTINGS", settings: { plan: e.target.value } })} /></label>
    </div>
    <div className="row" style={{ marginTop: 12 }}><button className="btn sm"><Key size={14} /> Rotate workspace key</button><button className="btn sm danger"><Trash2 size={14} /> Archive workspace</button></div>
    <h4 style={{ margin: "18px 0 8px", fontSize: 13 }}>Audit log</h4>
    <div className="list">{state.audit.slice(0, 8).map(a => <div key={a.id} className="list-row"><div><b style={{ fontSize: 13 }}>{a.action}</b><div className="small">{a.actor}</div></div><span className="small">{a.time}</span></div>)}</div>
  </AdminSection>;
}
