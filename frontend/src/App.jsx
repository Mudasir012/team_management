import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BarChart3, Users, CheckSquare, FolderKanban, Target, Wallet, Receipt,
  Search, ChevronUp, ChevronDown, Plus, Sun, Moon, Pencil, Trash2, X, Command, Bell, Sparkles, LogOut, ShieldAlert
} from "lucide-react";
import { useAuth, ROLE_LABELS } from "./auth";
import { useStore } from "./store";
import { cx, initials } from "./utils";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ProjectCardsPage from "./pages/ProjectCardsPage";
import DashboardPage from "./pages/DashboardPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CustomersPage from "./pages/CustomersPage";
import TodoPage from "./pages/TodoPage";
import LeadsPage from "./pages/LeadsPage";
import EarningPage from "./pages/EarningPage";
import ExpensesPage from "./pages/ExpensesPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import { ProjectModal, CommandPalette, LabelModal, NotificationsDrawer, AiDrawer } from "./components/Overlays";
import AdminDrawer from "./components/AdminDrawer";

const mainItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3, permission: "analytics:read" },
  { id: "customer", label: "Customer", icon: Users, permission: "customers:read" },
  { id: "todo", label: "To Do List", icon: CheckSquare, permission: "tasks:read" },
  { id: "project", label: "Project", icon: FolderKanban, permission: "projects:read" },
  { id: "leads", label: "Leads", icon: Target, permission: "leads:read" },
  { id: "earning", label: "Earning", icon: Wallet, permission: "invoices:read" },
  { id: "expenses", label: "Expenses", icon: Receipt, permission: "expenses:read" },
];

const pagePermission = {
  dashboard: null,
  analytics: "analytics:read",
  customer: "customers:read",
  todo: "tasks:read",
  project: "projects:read",
  leads: "leads:read",
  earning: "invoices:read",
  expenses: "expenses:read",
  projectDetail: "projects:read",
};

const PAGE_PATH = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  analytics: "/analytics",
  customer: "/customers",
  todo: "/tasks",
  project: "/projects",
  leads: "/leads",
  earning: "/earnings",
  expenses: "/expenses",
};

const PATH_PAGE = Object.fromEntries(Object.entries(PAGE_PATH).map(([page, path]) => [path, page]));
PATH_PAGE["/signup"] = "login";

function pathForState(page, projectId, taskId) {
  if (page === "projectDetail") {
    if (taskId) return `/tasks/${taskId}`;
    return projectId ? `/projects/${projectId}` : "/projects";
  }
  return PAGE_PATH[page] || "/";
}

function Splash({ message = "Loading your workspace…" }) {
  return (
    <div className="app-loading">
      <div className="app-loading__brand">acme<span>.</span></div>
      <div className="app-loading__spinner" aria-hidden="true" />
      <div className="small">{message}</div>
    </div>
  );
}

function AccessDenied({ onBack }) {
  return (
    <div className="stack" style={{ maxWidth: 560, margin: "80px auto" }}>
      <div className="panel stack" style={{ textAlign: "center", padding: 40 }}>
        <span className="empty-icon"><ShieldAlert size={26} /></span>
        <h2 style={{ margin: 0 }}>This area is restricted</h2>
        <p className="small" style={{ margin: 0 }}>Your role does not include access to this page. Ask an owner or admin if you need it.</p>
        <div><button className="btn primary" onClick={onBack}>Back to dashboard</button></div>
      </div>
    </div>
  );
}

export default function App() {
  const { state, dispatch, syncError, clearSyncError } = useStore();
  const { user, loading, logout, hasPermission, notice, clearNotice } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [labelModal, setLabelModal] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [authMode, setAuthMode] = useState(() =>
    window.location.pathname === "/signup" ||
    new URLSearchParams(window.location.search).get("mode") === "signup"
      ? "signup"
      : "login"
  );
  const unread = state.notifications.filter(n => !n.read).length;
  const canManageWorkspace = hasPermission("team:read") || hasPermission("settings:write");
  const visibleNav = useMemo(
    () => mainItems.filter(item => !item.permission || hasPermission(item.permission)),
    [hasPermission]
  );

  useEffect(() => {
    if (!loading && user && (state.page === "home" || state.page === "login")) {
      dispatch({ type: "SET_PAGE", page: "dashboard" });
    }
  }, [loading, user, state.page, dispatch]);

  // Incoming deep links drive reducer state. /tasks/:id resolves to the
  // containing project once the workspace payload is available.
  useEffect(() => {
    if (!user) return;
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const projectMatch = path.match(/^\/projects\/([^/]+)$/);
    const taskMatch = path.match(/^\/tasks\/([^/]+)$/);

    if (projectMatch) {
      const id = decodeURIComponent(projectMatch[1]);
      if (state.page !== "projectDetail" || state.selectedProjectId !== id) {
        dispatch({ type: "SELECT_PROJECT", id });
        if (state.selectedTaskId) dispatch({ type: "SET_SELECTED_TASK", id: null });
        dispatch({ type: "SET_PAGE", page: "projectDetail" });
      } else if (state.selectedTaskId) {
        dispatch({ type: "SET_SELECTED_TASK", id: null });
      }
      return;
    }

    if (taskMatch) {
      const taskId = decodeURIComponent(taskMatch[1]);
      const project = state.projects.find(p => (p.tasks || []).some(t => t.id === taskId));
      if (state.page !== "projectDetail") dispatch({ type: "SET_PAGE", page: "projectDetail" });
      if (state.workspaceReady && !project) {
        dispatch({ type: "SET_PAGE", page: "project" });
        dispatch({ type: "SET_SELECTED_TASK", id: null });
        return;
      }
      if (project && state.selectedProjectId !== project.id) {
        dispatch({ type: "SELECT_PROJECT", id: project.id });
      }
      if (state.selectedTaskId !== taskId) dispatch({ type: "SET_SELECTED_TASK", id: taskId });
      return;
    }

    const page = PATH_PAGE[path] || (state.page === "home" || state.page === "login" ? state.page : "dashboard");
    if (page !== state.page) dispatch({ type: "SET_PAGE", page });
    if (page !== "projectDetail") {
      if (state.selectedProjectId) dispatch({ type: "SELECT_PROJECT", id: null });
      if (state.selectedTaskId) dispatch({ type: "SET_SELECTED_TASK", id: null });
    }
  }, [location.pathname, user, state.workspaceReady, state.projects, state.page, state.selectedProjectId, state.selectedTaskId, dispatch]);

  // Reducer-driven navigation mirrors state back into the URL.
  useEffect(() => {
    if (!user || loading) return;
    const page = state.page === "home" || state.page === "login" ? "dashboard" : state.page;
    const target = pathForState(page, state.selectedProjectId, state.selectedTaskId);
    const current = location.pathname.replace(/\/+$/, "") || "/";
    if (target !== current) navigate(target, { replace: true });
  }, [state.page, state.selectedProjectId, state.selectedTaskId, user, loading, location.pathname, navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if (!user) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(v => !v); }
      if (e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === "Escape") { setPaletteOpen(false); setShowProjectModal(false); setLabelModal(null); setNotifOpen(false); setAiOpen(false); setAdminOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user]);

  const filteredLabels = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return state.labels;
    return state.labels.filter(l => l.name.toLowerCase().includes(q));
  }, [state.labels, sidebarSearch]);

  const currentProject = state.projects.find(p => p.id === state.selectedProjectId);

  function openAddProject() { setShowProjectModal(true); }
  function openProject(p) {
    dispatch({ type: "SELECT_PROJECT", id: p.id });
    dispatch({ type: "SET_SELECTED_TASK", id: null });
    dispatch({ type: "SET_PAGE", page: "projectDetail" });
  }
  function closeProject() {
    dispatch({ type: "SELECT_PROJECT", id: null });
    dispatch({ type: "SET_SELECTED_TASK", id: null });
    dispatch({ type: "SET_PAGE", page: "project" });
  }
  async function handleLogout() {
    await logout();
    dispatch({ type: "SET_PAGE", page: "home" });
    navigate("/", { replace: true });
  }

  const pageTitle = {
    home: "Home",
    login: "Log in",
    dashboard: "Dashboard",
    analytics: "Analytics",
    customer: "Customer",
    todo: "To Do List",
    project: "Project",
    leads: "Leads",
    earning: "Earning",
    expenses: "Expenses",
    projectDetail: currentProject?.name || "Project",
  }[state.page] || "Project";

  if (loading) return <Splash message="Checking your session…" />;

  if (!user) {
    if (state.page === "home") {
      return (
        <HomePage
          onSignIn={() => { setAuthMode("login"); dispatch({ type: "SET_PAGE", page: "login" }); }}
          onSignUp={() => { setAuthMode("signup"); dispatch({ type: "SET_PAGE", page: "login" }); }}
        />
      );
    }
    return (
      <LoginPage
        initialMode={authMode}
        onBack={() => dispatch({ type: "SET_PAGE", page: "home" })}
        onEnter={() => dispatch({ type: "SET_PAGE", page: "dashboard" })}
      />
    );
  }

  if (state.page === "home" || state.page === "login") return <Splash message="Opening your workspace…" />;
  if (!state.workspaceReady) {
    return <Splash message={syncError || "Loading your workspace…"} />;
  }

  const requiredPermission = pagePermission[state.page];
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <AccessDenied onBack={() => dispatch({ type: "SET_PAGE", page: "dashboard" })} />;
  }

  const showAddProject = hasPermission("projects:write") && (state.page === "project" || state.page === "projectDetail");

  return (
    <div className="app-frame">
      <div className="app-shell">
        <aside className="sidebar">
          <button
            className="workspace-switcher"
            type="button"
            title={canManageWorkspace ? "Workspace admin & settings" : user.name}
            onClick={() => canManageWorkspace && setAdminOpen(true)}
          >
            <div className="ws-avatar" style={user.color ? { background: user.color } : undefined}>{initials(user.name)}</div>
            <div className="ws-meta"><strong>{state.settings.org || "Workspace"}</strong><span>{user.name} · {ROLE_LABELS[user.role] || user.role}</span></div>
            {canManageWorkspace && <div style={{display:"grid",color:"var(--faint)"}}><ChevronUp size={14}/><ChevronDown size={14} style={{marginTop:-4}}/></div>}
          </button>

          <div className="sidebar-search">
            <Search size={16} />
            <input
              value={sidebarSearch}
              onChange={e=>setSidebarSearch(e.target.value)}
              placeholder='Type "/" to search'
              aria-label="Sidebar search"
            />
          </div>

          <div className="nav-section">
            <div className="nav-title">MAIN</div>
            {visibleNav.map(item => {
              const Icon = item.icon;
              const active = state.page === item.id || (item.id === "project" && state.page === "projectDetail");
              return (
                <button key={item.id} type="button" className={cx("nav-item", active && "active")} onClick={() => { dispatch({ type:"SET_PAGE", page:item.id }); if(item.id!=="project") dispatch({type:"SELECT_PROJECT", id:null}); dispatch({type:"SET_SELECTED_TASK", id:null}); }}>
                  <Icon strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {hasPermission("projects:read") && (
            <div className="nav-section" style={{minHeight:0}}>
              <div className="nav-title" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>LABELS</span>
                {hasPermission("projects:write") && <button className="icon-btn" title="Add label" onClick={()=>setLabelModal({})}><Plus size={14}/></button>}
              </div>
              <div>
                {filteredLabels.map(l => (
                  <div key={l.id} className={cx("label-item", state.labelFilter === l.id && "active")} onClick={()=>dispatch({type:"SET_LABEL_FILTER", labelId: state.labelFilter===l.id ? null : l.id})} role="button" tabIndex={0}>
                    <span className="label-dot" style={{background:l.color}} />
                    <span>{l.name}</span>
                    {hasPermission("projects:write") && (
                      <div className="label-actions" onClick={e=>e.stopPropagation()}>
                        <button className="icon-btn" title="Edit" onClick={()=>setLabelModal(l)}><Pencil size={13}/></button>
                        <button className="icon-btn" title="Delete" onClick={()=>dispatch({type:"DELETE_LABEL", id:l.id})}><Trash2 size={13}/></button>
                      </div>
                    )}
                  </div>
                ))}
                {!filteredLabels.length && <div className="small" style={{padding:"8px 10px"}}>No labels yet</div>}
              </div>
            </div>
          )}

          <div className="sidebar-bottom">
            <div className="sidebar-user">
              <span className="avatar" style={{ background: user.color || "var(--accent)" }}>{initials(user.name)}</span>
              <div><strong>{user.name}</strong><span className="small">{ROLE_LABELS[user.role] || user.role}</span></div>
              <button className="icon-btn" type="button" title="Sign out" onClick={handleLogout}><LogOut size={15}/></button>
            </div>
            <div className="theme-toggle" role="group" aria-label="Theme">
              <button type="button" className={state.theme === "light" ? "active" : ""} onClick={()=>dispatch({type:"SET_THEME", theme:"light"})}><Sun size={15}/> Light</button>
              <button type="button" className={state.theme === "dark" ? "active" : ""} onClick={()=>dispatch({type:"SET_THEME", theme:"dark"})}><Moon size={15}/> Dark</button>
            </div>
          </div>
        </aside>

        <main className="main">
          <header className="main-header">
            <div className="row">
              {state.page === "projectDetail" && <button className="btn ghost sm" onClick={closeProject}><X size={16}/> Close</button>}
              <h1 className="page-title">{pageTitle}{state.labelFilter ? ` · ${state.labels.find(l=>l.id===state.labelFilter)?.name || "Label"}` : ""}</h1>
            </div>
            <div className="header-actions">
              <button className="btn ghost" onClick={()=>setPaletteOpen(true)} title="Command palette (Ctrl/Cmd+K)"><Command size={16}/> <span className="small">Ctrl K</span></button>
              {hasPermission("ai:use") && <button className="btn ghost" onClick={()=>setAiOpen(true)} title="AI assistant"><Sparkles size={16}/></button>}
              {hasPermission("notifications:read") && (
                <button className="btn ghost" onClick={()=>setNotifOpen(true)} title="Notifications" style={{position:"relative"}}>
                  <Bell size={16}/>{unread>0 && <span style={{position:"absolute",top:6,right:8,width:8,height:8,borderRadius:99,background:"#ef4444"}}/>}
                </button>
              )}
              {showAddProject && <button className="btn primary" onClick={openAddProject}><Plus size={16}/> Add Project</button>}
            </div>
          </header>
          <div className="main-body">
            {(syncError || notice) && (
              <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
                {notice && <div className="glass-note row" style={{ justifyContent: "space-between" }}><span>{notice}</span><button className="btn ghost sm" onClick={clearNotice}>Dismiss</button></div>}
                {syncError && <div className="glass-error row" style={{ justifyContent: "space-between" }}><span>{syncError}</span><button className="btn ghost sm" onClick={clearSyncError}>Dismiss</button></div>}
              </div>
            )}
            {state.page === "dashboard" && <DashboardPage />}
            {state.page === "analytics" && <AnalyticsPage />}
            {state.page === "customer" && <CustomersPage />}
            {state.page === "todo" && <TodoPage />}
            {state.page === "project" && <ProjectCardsPage onOpen={openProject} />}
            {state.page === "leads" && <LeadsPage />}
            {state.page === "earning" && <EarningPage />}
            {state.page === "expenses" && <ExpensesPage />}
            {state.page === "projectDetail" && currentProject && (
              <ProjectDetailPage
                project={currentProject}
                onClose={closeProject}
                initialTaskId={state.selectedTaskId}
                onTaskClose={() => dispatch({ type: "SET_SELECTED_TASK", id: null })}
              />
            )}
          </div>
        </main>
      </div>

      {showProjectModal && <ProjectModal onClose={()=>setShowProjectModal(false)} />}
      {paletteOpen && <CommandPalette onClose={()=>setPaletteOpen(false)} onAddProject={openAddProject} />}
      {labelModal && <LabelModal initial={labelModal.id ? labelModal : null} onClose={()=>setLabelModal(null)} />}
      {notifOpen && <NotificationsDrawer onClose={()=>setNotifOpen(false)} />}
      {aiOpen && <AiDrawer onClose={()=>setAiOpen(false)} />}
      {adminOpen && canManageWorkspace && <AdminDrawer onClose={()=>setAdminOpen(false)} />}
    </div>
  );
}
