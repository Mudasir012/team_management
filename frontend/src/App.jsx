import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, BarChart3, Users, CheckSquare, FolderKanban, Target, Wallet, Receipt,
  Search, ChevronUp, ChevronDown, Plus, Sun, Moon, Pencil, Trash2, Tag, X, Command, Bell, Sparkles
} from "lucide-react";
import { useStore } from "./store";
import { cx, money, daysLabel, initials } from "./utils";
import { uid } from "./data/seed";
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
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "customer", label: "Customer", icon: Users },
  { id: "todo", label: "To Do List", icon: CheckSquare },
  { id: "project", label: "Project", icon: FolderKanban },
  { id: "leads", label: "Leads", icon: Target },
  { id: "earning", label: "Earning", icon: Wallet },
  { id: "expenses", label: "Expenses", icon: Receipt },
];

export default function App() {
  const { state, dispatch } = useStore();
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [labelModal, setLabelModal] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const unread = state.notifications.filter(n => !n.read).length;

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(v => !v); }
      if (e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === "Escape") { setPaletteOpen(false); setShowProjectModal(false); setLabelModal(null); setNotifOpen(false); setAiOpen(false); setAdminOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredLabels = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return state.labels;
    return state.labels.filter(l => l.name.toLowerCase().includes(q));
  }, [state.labels, sidebarSearch]);

  const currentProject = state.projects.find(p => p.id === state.selectedProjectId);

  function openAddProject() { setShowProjectModal(true); }
  function openProject(p) { dispatch({ type: "SELECT_PROJECT", id: p.id }); dispatch({ type: "SET_PAGE", page: "projectDetail" }); }
  function closeProject() { dispatch({ type: "SELECT_PROJECT", id: null }); dispatch({ type: "SET_PAGE", page: "project" }); }

  const pageTitle = {
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

  const showAddProject = state.page === "project" || state.page === "projectDetail";

  return (
    <div className="app-frame">
      <div className="app-shell">
        <aside className="sidebar">
          <button className="workspace-switcher" type="button" title="Workspace admin & settings" onClick={() => setAdminOpen(true)}>
            <div className="ws-avatar">A</div>
            <div className="ws-meta"><strong>Acme Studio</strong><span>Maya Chen</span></div>
            <div style={{display:"grid",color:"var(--faint)"}}><ChevronUp size={14}/><ChevronDown size={14} style={{marginTop:-4}}/></div>
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
            {mainItems.map(item => {
              const Icon = item.icon;
              const active = state.page === item.id || (item.id === "project" && state.page === "projectDetail");
              return (
                <button key={item.id} type="button" className={cx("nav-item", active && "active")} onClick={() => { dispatch({ type:"SET_PAGE", page:item.id }); if(item.id!=="project") dispatch({type:"SELECT_PROJECT", id:null}); }}>
                  <Icon strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="nav-section" style={{minHeight:0}}>
            <div className="nav-title" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>LABELS</span>
              <button className="icon-btn" title="Add label" onClick={()=>setLabelModal({})}><Plus size={14}/></button>
            </div>
            <div>
              {filteredLabels.map(l => (
                <div key={l.id} className={cx("label-item", state.labelFilter === l.id && "active")} onClick={()=>dispatch({type:"SET_LABEL_FILTER", labelId: state.labelFilter===l.id ? null : l.id})} role="button" tabIndex={0}>
                  <span className="label-dot" style={{background:l.color}} />
                  <span>{l.name}</span>
                  <div className="label-actions" onClick={e=>e.stopPropagation()}>
                    <button className="icon-btn" title="Edit" onClick={()=>setLabelModal(l)}><Pencil size={13}/></button>
                    <button className="icon-btn" title="Delete" onClick={()=>dispatch({type:"DELETE_LABEL", id:l.id})}><Trash2 size={13}/></button>
                  </div>
                </div>
              ))}
              {!filteredLabels.length && <div className="small" style={{padding:"8px 10px"}}>No labels</div>}
            </div>
          </div>

          <div className="sidebar-bottom">
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
              <button className="btn ghost" onClick={()=>setAiOpen(true)} title="AI assistant"><Sparkles size={16}/></button>
              <button className="btn ghost" onClick={()=>setNotifOpen(true)} title="Notifications" style={{position:"relative"}}>
                <Bell size={16}/>{unread>0 && <span style={{position:"absolute",top:6,right:8,width:8,height:8,borderRadius:99,background:"#ef4444"}}/>}
              </button>
              {showAddProject && <button className="btn primary" onClick={openAddProject}><Plus size={16}/> Add Project</button>}
            </div>
          </header>
          <div className="main-body">
            {state.page === "dashboard" && <DashboardPage />}
            {state.page === "analytics" && <AnalyticsPage />}
            {state.page === "customer" && <CustomersPage />}
            {state.page === "todo" && <TodoPage />}
            {state.page === "project" && <ProjectCardsPage onOpen={openProject} />}
            {state.page === "leads" && <LeadsPage />}
            {state.page === "earning" && <EarningPage />}
            {state.page === "expenses" && <ExpensesPage />}
            {state.page === "projectDetail" && currentProject && <ProjectDetailPage project={currentProject} onClose={closeProject} />}
          </div>
        </main>
      </div>

      {showProjectModal && <ProjectModal onClose={()=>setShowProjectModal(false)} />}
      {paletteOpen && <CommandPalette onClose={()=>setPaletteOpen(false)} onAddProject={openAddProject} />}
      {labelModal && <LabelModal initial={labelModal.id ? labelModal : null} onClose={()=>setLabelModal(null)} />}
      {notifOpen && <NotificationsDrawer onClose={()=>setNotifOpen(false)} />}
      {aiOpen && <AiDrawer onClose={()=>setAiOpen(false)} />}
      {adminOpen && <AdminDrawer onClose={()=>setAdminOpen(false)} />}
    </div>
  );
}
