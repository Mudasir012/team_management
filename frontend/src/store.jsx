import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { initialProjects, members, defaultLabels, customers, leads, invoices, expenses, goals, notificationsSeed, auditSeed, uid } from "./data/seed";

const StoreContext = createContext(null);

const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
const initialPage = params.get("page") || "project";
const initialProjectId = params.get("project") || null;

const initialState = {
  theme: params.get("theme") === "dark" ? "dark" : "light",
  page: initialPage,
  projects: initialProjects,
  members,
  labels: defaultLabels,
  customers,
  leads,
  invoices,
  expenses,
  goals,
  notifications: notificationsSeed,
  audit: auditSeed,
  selectedProjectId: initialPage === "projectDetail" ? initialProjectId : null,
  labelFilter: null,
  search: "",
  savedViews: [],
  notificationsPrefs: { inApp: true, email: true, push: false, mentions: true, deadlines: true },
  automations: [
    { id: "a1", name: "Move to Review when checklist done", trigger: "Checklist completed", condition: "All items checked", action: "Set status Review", enabled: true },
    { id: "a2", name: "Notify on overdue", trigger: "Due date passed", condition: "Task not done", action: "Send in-app alert", enabled: true },
  ],
  settings: { org: "Acme Studio", plan: "Pro (demo)", sso: false, mfa: false, sessions: [{ id: "s1", device: "Windows · Chrome", active: true, last: "Now" }, { id: "s2", device: "iPhone · Safari", active: false, last: "2 days ago" }] },
  timeEntries: [
    { id: "te1", member: "u4", project: "p1", task: "Final brand proof approval", hours: 2.5, date: new Date().toISOString().slice(0,10) },
    { id: "te2", member: "u2", project: "p2", task: "Launch asset handoff", hours: 4, date: new Date().toISOString().slice(0,10) },
  ],
  activityPresence: ["u1", "u2", "u4"],
};

function addAudit(state, action) {
  return [{ id: uid("au"), actor: "Maya Chen", action, time: "Just now" }, ...state.audit].slice(0, 50);
}

function reducer(state, action) {
  switch (action.type) {
    case "SET_THEME": return { ...state, theme: action.theme };
    case "TOGGLE_THEME": return { ...state, theme: state.theme === "light" ? "dark" : "light" };
    case "SET_PAGE": return { ...state, page: action.page, search: action.resetSearch ? "" : state.search };
    case "SET_SEARCH": return { ...state, search: action.search };
    case "SET_LABEL_FILTER": return { ...state, labelFilter: action.labelId, page: "project" };
    case "SELECT_PROJECT": return { ...state, selectedProjectId: action.id };
    case "UPSERT_PROJECT": {
      const exists = state.projects.some(p => p.id === action.project.id);
      const projects = exists ? state.projects.map(p => p.id === action.project.id ? action.project : p) : [action.project, ...state.projects];
      return { ...state, projects, audit: addAudit(state, `${exists ? "updated" : "created"} project ${action.project.name}`) };
    }
    case "DELETE_PROJECT":
      return { ...state, projects: state.projects.filter(p => p.id !== action.id), selectedProjectId: state.selectedProjectId === action.id ? null : state.selectedProjectId, audit: addAudit(state, "deleted a project") };
    case "UPSERT_TASK": {
      const projects = state.projects.map(p => p.id === action.projectId ? { ...p, tasks: p.tasks.some(t => t.id === action.task.id) ? p.tasks.map(t => t.id === action.task.id ? action.task : t) : [...p.tasks, action.task] } : p);
      return { ...state, projects };
    }
    case "DELETE_TASK": {
      const projects = state.projects.map(p => p.id === action.projectId ? { ...p, tasks: p.tasks.filter(t => t.id !== action.taskId) } : p);
      return { ...state, projects };
    }
    case "SET_TASK_STATUS": {
      const projects = state.projects.map(p => p.id === action.projectId ? { ...p, tasks: p.tasks.map(t => t.id === action.taskId ? { ...t, status: action.status } : t) } : p);
      return { ...state, projects };
    }
    case "MOVE_TASK": {
      const projects = state.projects.map(p => {
        if (p.id !== action.projectId) return p;
        const tasks = [...p.tasks];
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
      const customer = { id: custId, name: lead.company, contact: lead.contact, email: `${lead.contact.split(" ")[0].toLowerCase()}@example.com`, status: "Active", projects: [projId], value: lead.value };
      const project = { id: projId, name: `${lead.company} Project`, status: "To Do", start: new Date().toISOString().slice(0,10), end: new Date(Date.now()+21*86400000).toISOString().slice(0,10), budget: lead.value, members: ["u1","u3"], labels: ["l2"], customerId: custId, progress: 0, preview: "skeleton", description: "Converted from lead.", milestones: [], sprint: "Backlog", docs: [], chat: [], files: [], activity: [{id:uid("a"), text:"Converted from lead", time:"Just now"}], customFields:{}, customStatuses:["Backlog","Todo","In Progress","Review","Done"], tasks: [] };
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
      const projects = state.projects.map(p => p.id === action.projectId ? { ...p, chat: [...p.chat, action.message], activity: [{id:uid("a"), text:`${action.authorName} sent a message`, time:"Just now"}, ...p.activity] } : p);
      return { ...state, projects };
    }
    case "ADD_DOC": {
      const projects = state.projects.map(p => p.id === action.projectId ? { ...p, docs: [...p.docs, action.doc] } : p);
      return { ...state, projects };
    }
    case "SAVE_VIEW": return { ...state, savedViews: [...state.savedViews.filter(v=>v.id!==action.view.id), action.view] };
    default: return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", state.theme === "dark");
    root.dataset.theme = state.theme;
  }, [state.theme]);

  const api = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
