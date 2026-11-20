import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useAuth } from "./auth";
import { supabase, supabaseConfigured } from "./supabase";
import { uid } from "./utils";
import * as sync from "./sync";

const StoreContext = createContext(null);

const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
const initialPage = params.get("page") || "home";
const initialProjectId = params.get("project") || null;

const emptySettings = { org: "Workspace", plan: "Local", sso: false, mfa: false, sessions: [] };
const emptyPrefs = { inApp: true, email: true, push: false, mentions: true, deadlines: true };

const initialState = {
  theme: params.get("theme") === "dark" ? "dark" : "light",
  page: initialPage,
  projects: [],
  members: [],
  labels: [],
  customers: [],
  leads: [],
  invoices: [],
  expenses: [],
  goals: [],
  notifications: [],
  audit: [],
  selectedProjectId: initialPage === "projectDetail" ? initialProjectId : null,
  labelFilter: null,
  search: "",
  savedViews: [],
  notificationsPrefs: emptyPrefs,
  automations: [],
  settings: emptySettings,
  timeEntries: [],
  activityPresence: [],
  workspaceReady: false,
};

function addAudit(state, action) {
  return [{ id: uid("au"), actor: state.currentUser?.name || "You", action, time: "Just now" }, ...state.audit].slice(0, 50);
}

function emptyWorkspace(state) {
  return {
    ...state,
    projects: [],
    members: [],
    labels: [],
    customers: [],
    leads: [],
    invoices: [],
    expenses: [],
    goals: [],
    notifications: [],
    audit: [],
    savedViews: [],
    automations: [],
    settings: emptySettings,
    timeEntries: [],
    activityPresence: [],
    notificationsPrefs: emptyPrefs,
    workspaceReady: false,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "RESTORE_STATE": return action.state || state;
    case "SET_THEME": return { ...state, theme: action.theme };
    case "TOGGLE_THEME": return { ...state, theme: state.theme === "light" ? "dark" : "light" };
    case "SET_PAGE": return { ...state, page: action.page, search: action.resetSearch ? "" : state.search };
    case "SET_SEARCH": return { ...state, search: action.search };
    case "SET_LABEL_FILTER": return { ...state, labelFilter: action.labelId, page: "project" };
    case "SELECT_PROJECT": return { ...state, selectedProjectId: action.id };
    case "SET_CURRENT_USER": return { ...state, currentUser: action.user };
    case "LOAD_WORKSPACE": {
      const payload = action.payload || {};
      return {
        ...state,
        projects: payload.projects || [],
        members: payload.members || [],
        labels: payload.labels || [],
        customers: payload.customers || [],
        leads: payload.leads || [],
        invoices: payload.invoices || [],
        expenses: payload.expenses || [],
        goals: payload.goals || [],
        notifications: payload.notifications || [],
        audit: payload.audit || [],
        savedViews: payload.savedViews || [],
        automations: payload.automations || [],
        settings: { ...emptySettings, ...(payload.settings || {}) },
        timeEntries: payload.timeEntries || [],
        notificationsPrefs: { ...emptyPrefs, ...(payload.notificationsPrefs || {}) },
        activityPresence: payload.activityPresence || [],
        currentUser: payload.user || state.currentUser,
        workspaceReady: true,
      };
    }
    case "RESET_WORKSPACE": return { ...emptyWorkspace(state), currentUser: action.keepUser ? state.currentUser : null };
    case "UPSERT_PROJECT": {
      const exists = state.projects.some(p => p.id === action.project.id);
      const projects = exists ? state.projects.map(p => p.id === action.project.id ? action.project : p) : [action.project, ...state.projects];
      return { ...state, projects, audit: addAudit(state, `${exists ? "updated" : "created"} project ${action.project.name}`) };
    }
    case "DELETE_PROJECT":
      return { ...state, projects: state.projects.filter(p => p.id !== action.id), selectedProjectId: state.selectedProjectId === action.id ? null : state.selectedProjectId, audit: addAudit(state, "deleted a project") };
    case "UPSERT_TASK": {
      const projects = state.projects.map(p => p.id === action.projectId ? { ...p, tasks: (p.tasks || []).some(t => t.id === action.task.id) ? p.tasks.map(t => t.id === action.task.id ? action.task : t) : [...(p.tasks || []), action.task] } : p);
      return { ...state, projects };
    }
    case "DELETE_TASK": {
      const projects = state.projects.map(p => p.id === action.projectId ? { ...p, tasks: (p.tasks || []).filter(t => t.id !== action.taskId) } : p);
      return { ...state, projects };
    }
    case "SET_TASK_STATUS": {
      const projects = state.projects.map(p => p.id === action.projectId ? { ...p, tasks: (p.tasks || []).map(t => t.id === action.taskId ? { ...t, status: action.status } : t) } : p);
      return { ...state, projects };
    }
    case "MOVE_TASK": {
      const projects = state.projects.map(p => {
        if (p.id !== action.projectId) return p;
        const tasks = [...(p.tasks || [])];
        const idx = tasks.findIndex(t => t.id === action.taskId);
        if (idx === -1) return p;
        const [t] = tasks.splice(idx, 1);
        t.status = action.status;
        tasks.push(t);
        return { ...p, tasks };
      });
      return { ...state, projects };
    }
    case "UPDATE_MEMBER": return { ...state, members: state.members.map(m => m.id === action.member.id ? { ...m, ...action.member } : m), audit: addAudit(state, `updated member ${action.member.name || ""}`.trim()) };
    case "ADD_LABEL": return { ...state, labels: [...state.labels, action.label], audit: addAudit(state, `created label ${action.label.name}`) };
    case "UPDATE_LABEL": return { ...state, labels: state.labels.map(l => l.id === action.label.id ? action.label : l), audit: addAudit(state, `updated label ${action.label.name}`) };
    case "DELETE_LABEL": return { ...state, labels: state.labels.filter(l => l.id !== action.id), labelFilter: state.labelFilter === action.id ? null : state.labelFilter, audit: addAudit(state, "deleted a label") };
    case "ADD_LEAD": return { ...state, leads: [action.lead, ...state.leads] };
    case "UPDATE_LEAD": return { ...state, leads: state.leads.map(l => l.id === action.lead.id ? action.lead : l) };
    case "CONVERT_LEAD": {
      const lead = state.leads.find(l => l.id === action.leadId);
      if (!lead) return state;
      const custId = uid("c");
      const projId = uid("p");
      const customer = { id: custId, name: lead.company, contact: lead.contact, email: `${String(lead.contact || "").split(" ")[0].toLowerCase()}@example.com`, status: "Active", projects: [projId], value: lead.value };
      const project = { id: projId, name: `${lead.company} Project`, status: "To Do", start: new Date().toISOString().slice(0, 10), end: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10), budget: lead.value, members: [state.currentUser?.id].filter(Boolean), labels: [], customerId: custId, progress: 0, preview: "skeleton", description: "Converted from lead.", milestones: [], sprint: "Backlog", docs: [], chat: [], files: [], activity: [{ id: uid("a"), text: "Converted from lead", time: "Just now" }], customFields: {}, customStatuses: ["Backlog", "Todo", "In Progress", "Review", "Done"], tasks: [] };
      return { ...state, leads: state.leads.map(l => l.id === action.leadId ? { ...l, stage: "Won" } : l), customers: [customer, ...state.customers], projects: [project, ...state.projects], audit: addAudit(state, `converted lead ${lead.company}`) };
    }
    case "ADD_CUSTOMER": return { ...state, customers: [action.customer, ...state.customers] };
    case "ADD_INVOICE": return { ...state, invoices: [action.invoice, ...state.invoices], audit: addAudit(state, `created invoice ${action.invoice.id}`) };
    case "UPDATE_INVOICE": return { ...state, invoices: state.invoices.map(i => i.id === action.invoice.id ? action.invoice : i) };
    case "ADD_EXPENSE": return { ...state, expenses: [action.expense, ...state.expenses] };
    case "MARK_NOTIFICATION_READ": return { ...state, notifications: state.notifications.map(n => n.id === action.id ? { ...n, read: true } : n) };
    case "MARK_ALL_READ": return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };
    case "SET_PREFS": return { ...state, notificationsPrefs: { ...state.notificationsPrefs, ...action.prefs } };
    case "TOGGLE_AUTOMATION": return { ...state, automations: state.automations.map(a => a.id === action.id ? { ...a, enabled: !a.enabled } : a) };
    case "ADD_AUTOMATION": return { ...state, automations: [...state.automations, action.automation] };
    case "ADD_TIME_ENTRY": return { ...state, timeEntries: [action.entry, ...state.timeEntries] };
    case "UPDATE_SETTINGS": return { ...state, settings: { ...state.settings, ...action.settings } };
    case "ADD_CHAT": {
      const message = action.message || {
        id: action.id || uid("chat"),
        author: action.author,
        text: action.text,
        time: action.time || "Just now",
      };
      const projects = state.projects.map(p => p.id === action.projectId ? {
        ...p,
        chat: [...(p.chat || []), message],
        activity: [{ id: uid("a"), text: `${action.authorName || "Someone"} sent a message`, time: "Just now" }, ...(p.activity || [])],
      } : p);
      return { ...state, projects };
    }
    case "ADD_DOC": {
      const projects = state.projects.map(p => p.id === action.projectId ? { ...p, docs: [...(p.docs || []), action.doc] } : p);
      return { ...state, projects };
    }
    case "SAVE_VIEW": return { ...state, savedViews: [...state.savedViews.filter(v => v.id !== action.view.id), action.view] };
    default: return state;
  }
}

const SYNC_ACTIONS = new Set([
  "UPSERT_PROJECT", "DELETE_PROJECT", "UPSERT_TASK", "DELETE_TASK", "SET_TASK_STATUS", "MOVE_TASK",
  "UPDATE_MEMBER", "ADD_LABEL", "UPDATE_LABEL", "DELETE_LABEL", "ADD_LEAD", "UPDATE_LEAD",
  "CONVERT_LEAD", "ADD_CUSTOMER", "ADD_INVOICE", "UPDATE_INVOICE", "ADD_EXPENSE",
  "ADD_TIME_ENTRY", "ADD_CHAT", "ADD_DOC", "SAVE_VIEW", "TOGGLE_AUTOMATION",
]);

function syncJobFor(action, next, userId) {
  switch (action.type) {
    case "UPSERT_PROJECT": return { label: "project", task: () => sync.saveProject(action.project, userId) };
    case "DELETE_PROJECT": return { label: "project deletion", task: () => sync.deleteProject(action.id) };
    case "UPSERT_TASK": return { label: "task", task: () => sync.saveTask(action.task, action.projectId) };
    case "DELETE_TASK": return { label: "task deletion", task: () => sync.deleteTask(action.taskId) };
    case "SET_TASK_STATUS":
    case "MOVE_TASK": return { label: "task status", task: () => sync.setTaskStatus(action.taskId, action.status) };
    case "UPDATE_MEMBER": return { label: "member", task: () => sync.updateMember(action.member) };
    case "ADD_LABEL":
    case "UPDATE_LABEL": return { label: "label", task: () => sync.saveLabel(action.label) };
    case "DELETE_LABEL": return { label: "label deletion", task: () => sync.deleteLabel(action.id) };
    case "ADD_LEAD":
    case "UPDATE_LEAD": return { label: "lead", task: () => sync.saveLead(action.lead) };
    case "CONVERT_LEAD": {
      const customer = next.customers[0];
      const project = next.projects[0];
      return { label: "lead conversion", task: () => sync.convertLead({ leadId: action.leadId, customer, project }, userId) };
    }
    case "ADD_CUSTOMER": return { label: "customer", task: () => sync.saveCustomer(action.customer) };
    case "ADD_INVOICE":
    case "UPDATE_INVOICE": return { label: "invoice", task: () => sync.saveInvoice(action.invoice) };
    case "ADD_EXPENSE": return { label: "expense", task: () => sync.saveExpense(action.expense) };
    case "ADD_TIME_ENTRY": return { label: "time entry", task: () => sync.addTimeEntry(action.entry, userId) };
    case "ADD_CHAT": {
      const project = next.projects.find(p => p.id === action.projectId);
      const message = project?.chat?.[project.chat.length - 1];
      if (!message) return null;
      return { label: "message", task: () => sync.addChat({ id: message.id, projectId: action.projectId, author: message.author, authorName: action.authorName, text: message.text }) };
    }
    case "ADD_DOC": {
      const project = next.projects.find(p => p.id === action.projectId);
      if (!project) return null;
      return { label: "document", task: () => sync.saveProject(project, userId) };
    }
    case "SAVE_VIEW": return { label: "saved view", task: () => sync.saveView(action.view, userId) };
    case "TOGGLE_AUTOMATION": {
      const automation = next.automations.find(a => a.id === action.id);
      if (!automation) return null;
      return { label: "automation", task: () => sync.toggleAutomation(action.id, automation.enabled) };
    }
    default: return null;
  }
}

export function StoreProvider({ children }) {
  const { user, loading, setWorkspacePermissionsUser } = useAuth();
  const [state, realDispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(initialState);
  const queueRef = useRef(Promise.resolve());
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [syncError, setSyncError] = useState("");

  const enqueue = useCallback((label, task) => {
    queueRef.current = queueRef.current
      .catch(() => {})
      .then(async () => {
        try {
          await task();
          setSyncError("");
        } catch (error) {
          console.warn(`[sync] Could not save ${label}`, error);
          setSyncError(`Could not save ${label}: ${error?.message || error}`);
        }
      });
    return queueRef.current;
  }, []);

  const dispatch = useCallback((action) => {
    const next = reducer(stateRef.current, action);
    stateRef.current = next;
    realDispatch(action);

    if (!supabaseConfigured || !SYNC_ACTIONS.has(action.type)) return;
    const activeUserId = user?.id;
    if (!activeUserId) return;
    const job = syncJobFor(action, next, activeUserId);
    if (job) enqueue(job.label, job.task);
  }, [enqueue, user?.id]);

  const applyPayload = useCallback((payload) => {
    setWorkspacePermissionsUser(payload?.user || null);
    const action = { type: "LOAD_WORKSPACE", payload };
    stateRef.current = reducer(stateRef.current, action);
    realDispatch(action);
  }, [setWorkspacePermissionsUser]);

  const reloadWorkspace = useCallback(async () => {
    if (!user || !supabaseConfigured || !supabase) {
      setWorkspacePermissionsUser(null);
      const action = { type: "RESET_WORKSPACE", keepUser: true };
      stateRef.current = reducer(stateRef.current, action);
      realDispatch(action);
      return null;
    }
    setWorkspaceLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_workspace");
      if (error) throw error;
      applyPayload(data);
      setSyncError("");
      return data;
    } catch (error) {
      console.warn("[workspace] Could not load", error);
      setSyncError(`Could not load the workspace: ${error?.message || error}`);
      return null;
    } finally {
      setWorkspaceLoading(false);
    }
  }, [user, applyPayload, setWorkspacePermissionsUser]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setWorkspacePermissionsUser(null);
      const action = { type: "RESET_WORKSPACE" };
      stateRef.current = reducer(stateRef.current, action);
      realDispatch(action);
      return;
    }
    dispatch({ type: "SET_CURRENT_USER", user });
    reloadWorkspace();
  }, [loading, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", state.theme === "dark");
    root.dataset.theme = state.theme;
  }, [state.theme]);

  const clearSyncError = useCallback(() => setSyncError(""), []);

  const api = useMemo(
    () => ({ state, dispatch, reloadWorkspace, workspaceLoading, syncError, clearSyncError }),
    [state, dispatch, reloadWorkspace, workspaceLoading, syncError, clearSyncError]
  );
  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
