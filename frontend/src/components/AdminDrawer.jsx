import { useMemo, useState } from "react";
import { X, Users, Bell, ShieldCheck, Building2, Plus, Trash2, RefreshCw, Crown, Check } from "lucide-react";
import { ROLES, ROLE_LABELS, useAuth } from "../auth";
import { useStore } from "../store";
import { supabase } from "../supabase";
import { savePreferences, saveSettings } from "../sync";
import { cx, initials } from "../utils";

const TABS = [
  { id: "team", label: "Team", icon: Users, permission: "team:read" },
  { id: "workspace", label: "Workspace", icon: Building2, permission: "settings:write" },
  { id: "notifications", label: "Notifications", icon: Bell, permission: "notifications:read" },
  { id: "security", label: "Access", icon: ShieldCheck, permission: "team:read" },
];

export default function AdminDrawer({ onClose }) {
  const { state, reloadWorkspace } = useStore();
  const { user, hasPermission } = useAuth();
  const visibleTabs = useMemo(() => TABS.filter(tab => hasPermission(tab.permission)), [hasPermission]);
  const [tab, setTab] = useState(visibleTabs[0]?.id || "team");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await reloadWorkspace();
    setRefreshing(false);
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal admin-modal">
        <div className="admin-head">
          <div className="row">
            <span className="admin-mark"><Building2 size={18} /></span>
            <div>
              <h2>Workspace admin</h2>
              <div className="small">{state.settings.org || "Workspace"} · {user.name} · {ROLE_LABELS[user.role] || user.role}</div>
            </div>
          </div>
          <div className="row">
            <button className="icon-btn" title="Refresh" onClick={refresh} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "spin" : ""} /></button>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="admin-layout">
          <nav className="admin-nav">
            {visibleTabs.map(t => {
              const Icon = t.icon;
              return <button key={t.id} className={cx("admin-nav-item", tab === t.id && "active")} onClick={() => setTab(t.id)}><Icon size={15} /> {t.label}</button>;
            })}
          </nav>
          <div className="admin-content">
            {tab === "team" && <TeamTab />}
            {tab === "workspace" && <WorkspaceTab />}
            {tab === "notifications" && <NotificationsTab />}
            {tab === "security" && <AccessTab />}
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
  const { state, reloadWorkspace } = useStore();
  const { user, hasPermission } = useAuth();
  const canWrite = hasPermission("team:write");
  const isOwner = user.role === "owner";
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", password: "", role: "member", title: "" });
  const [inviting, setInviting] = useState(false);

  async function changeRole(member, role) {
    setBusyId(member.id); setError(""); setNotice("");
    try {
      const { error: rpcError } = await supabase.rpc("set_member_role", { p_member: member.id, p_role: role });
      if (rpcError) throw rpcError;
      await reloadWorkspace();
      setNotice(`${member.name} is now ${ROLE_LABELS[role] || role}.`);
    } catch (e) { setError(e.message); } finally { setBusyId(""); }
  }

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.name} from the workspace?`)) return;
    setBusyId(member.id); setError(""); setNotice("");
    try {
      const { error: rpcError } = await supabase.rpc("remove_member", { p_member: member.id });
      if (rpcError) throw rpcError;
      await reloadWorkspace();
      setNotice(`${member.name} was removed.`);
    } catch (e) { setError(e.message); } finally { setBusyId(""); }
  }

  async function invite(event) {
    event.preventDefault();
    setInviting(true); setError(""); setNotice("");
    try {
      const { data, error: rpcError } = await supabase.rpc("invite_member", {
        p_email: draft.email,
        p_name: draft.name,
        p_role: draft.role,
        p_title: draft.title,
      });
      if (rpcError) throw rpcError;
      setDraft({ name: "", email: "", password: "", role: "member", title: "" });
      await reloadWorkspace();
      setNotice(`${data?.email || "Teammate"} can now sign up with the role ${ROLE_LABELS[data?.role || draft.role] || data?.role || draft.role}.`);
    } catch (e) { setError(e.message); } finally { setInviting(false); }
  }

  return (
    <AdminSection title="Team directory" note="Every account and the role it signs in with.">
      {error && <div className="glass-error" style={{ marginBottom: 10 }}>{error}</div>}
      {notice && <div className="glass-note" style={{ marginBottom: 10 }}>{notice}</div>}
      <div className="admin-team-list">
        {state.members.map(m => (
          <div key={m.id} className="admin-member">
            <span className="avatar" style={{ background: m.color }}>{initials(m.name)}</span>
            <div className="admin-member-name"><b>{m.name}{m.id === user.id ? " (you)" : ""}</b><span className="small">{m.email}</span></div>
            {canWrite && m.role !== "owner" ? (
              <select className="field role-select" value={m.role} disabled={busyId === m.id} onChange={e => changeRole(m, e.target.value)}>
                {ROLES.filter(r => r.id !== "owner").map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            ) : (
              <span className="pill">{ROLE_LABELS[m.role] || m.role}</span>
            )}
            <span className={cx("presence", m.status)}>{m.status || "offline"}</span>
            {isOwner && m.id !== user.id && (
              <button className="icon-btn" title={`Remove ${m.name}`} disabled={busyId === m.id} onClick={() => removeMember(m)}><Trash2 size={14} /></button>
            )}
          </div>
        ))}
        {!state.members.length && <div className="empty">No teammates yet.</div>}
      </div>
      {canWrite && (
        <form className="panel stack" onSubmit={invite} style={{ marginTop: 16, background: "var(--surface-2)" }}>
          <div className="space-between"><b style={{ fontSize: 13 }}>Invite a teammate</b><span className="small">They sign up with this email and get the role you choose.</span></div>
          <div className="grid-4">
            <label className="lbl">Name<input className="field" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} required /></label>
            <label className="lbl">Email<input className="field" type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} required /></label>
            <label className="lbl">Title<input className="field" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
            <label className="lbl">Role<select className="field" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })}>{ROLES.filter(r => r.id !== "owner").map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
          </div>
          <div><button className="btn primary" type="submit" disabled={inviting}>{inviting ? "Adding…" : <><Plus size={15} /> Add teammate</>}</button></div>
        </form>
      )}
      {!canWrite && <div className="small" style={{ marginTop: 12 }}>Only owners and admins can change roles or add people.</div>}
    </AdminSection>
  );
}

function WorkspaceTab() {
  const { state, dispatch, reloadWorkspace } = useStore();
  const [org, setOrg] = useState(state.settings.org || "Workspace");
  const [plan, setPlan] = useState(state.settings.plan || "Local");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setStatus("saving"); setError("");
    try {
      await saveSettings({ org, plan });
      dispatch({ type: "UPDATE_SETTINGS", settings: { org, plan } });
      await reloadWorkspace();
      setStatus("saved");
    } catch (e) { setError(e.message); setStatus("error"); }
  }

  return <AdminSection title="Organization settings" note="Workspace identity and plan label.">
    <form className="stack" onSubmit={save}>
      <div className="grid-2">
        <label className="lbl">Organization name<input className="field" value={org} onChange={e => setOrg(e.target.value)} /></label>
        <label className="lbl">Plan label<input className="field" value={plan} onChange={e => setPlan(e.target.value)} /></label>
      </div>
      {error && <div className="glass-error">{error}</div>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save settings"}</button>
        {status === "saved" && <span className="small row"><Check size={14} /> Saved</span>}
      </div>
    </form>
    <h4 style={{ margin: "18px 0 8px", fontSize: 13 }}>Audit log</h4>
    <div className="list">
      {state.audit.map(a => <div key={a.id} className="list-row"><div><b style={{ fontSize: 13 }}>{a.action}</b><div className="small">{a.actor}</div></div><span className="small">{typeof a.time === "string" ? a.time : new Date(a.time).toLocaleString()}</span></div>)}
      {!state.audit.length && <div className="empty">No activity recorded yet.</div>}
    </div>
  </AdminSection>;
}

function NotificationsTab() {
  const { state, dispatch } = useStore();
  const { user } = useAuth();
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const labels = { inApp: "In-app notifications", email: "Email digests", push: "Push notifications", mentions: "@mentions", deadlines: "Deadline reminders" };

  async function toggle(key, value) {
    setSaving(key); setError("");
    try {
      await savePreferences(user.id, { ...state.notificationsPrefs, [key]: value });
      dispatch({ type: "SET_PREFS", prefs: { [key]: value } });
    } catch (e) { setError(e.message); } finally { setSaving(""); }
  }

  return <AdminSection title="Notification preferences" note="Choose where and when the workspace reaches you.">
    {error && <div className="glass-error" style={{ marginBottom: 10 }}>{error}</div>}
    <div className="preference-list">
      {Object.entries(state.notificationsPrefs).map(([key, value]) => (
        <div key={key} className="preference-row">
          <span>{labels[key] || key}</span>
          <button type="button" className={cx("switch", value && "on")} disabled={saving === key} onClick={() => toggle(key, !value)}><span /></button>
        </div>
      ))}
    </div>
  </AdminSection>;
}

function AccessTab() {
  const { state } = useStore();
  const { user } = useAuth();
  return <AdminSection title="Roles and access" note="What each role can open and change in this workspace.">
    <div className="security-grid">
      {ROLES.map(role => (
        <div key={role.id} className={cx("security-card", role.id === user.role && "is-current")}>
          <span className="security-icon">{role.id === "owner" ? <Crown size={17} /> : <ShieldCheck size={17} />}</span>
          <div><b>{role.label}{role.id === user.role ? " · you" : ""}</b><div className="small">{role.note}</div></div>
        </div>
      ))}
    </div>
    <h4 style={{ margin: "18px 0 8px", fontSize: 13 }}>Current sessions</h4>
    <div className="panel" style={{ background: "var(--surface-2)" }}>
      <div className="space-between"><span className="small">Your session is managed by Supabase Auth and stays signed in across visits on this device.</span><span className="pill green">Active</span></div>
      <div className="small" style={{ marginTop: 6 }}>Signed in as {user.name} · {user.email || "no email on file"}</div>
    </div>
    <div className="small" style={{ marginTop: 12 }}>{state.members.length} account{state.members.length === 1 ? "" : "s"} in this workspace.</div>
  </AdminSection>;
}
