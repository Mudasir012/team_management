import { useMemo, useState } from "react";
import { CheckCircle2, Clock, AlertTriangle, Circle, UserRoundX, Timer, Plus, Sparkles, ArrowUpRight } from "lucide-react";
import { useStore } from "../store";
import { uid } from "../data/seed";
import { cx, fmtDate, daysRemaining } from "../utils";
import {
  useTaskFilters, applyTaskFilters, TaskToolbar, TaskList, TaskBoard, TaskCalendar,
  TaskTimeline, TaskWorkload, AddTaskModal, TaskDetailModal, statusesFor
} from "../components/Workspace";

export default function TodoPage() {
  const { state, dispatch } = useStore();
  const { filters, setFilters, set, reset } = useTaskFilters();
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [detailTask, setDetailTask] = useState(null);
  const [addStatus, setAddStatus] = useState("todo");

  const allTasks = useMemo(() => state.projects.flatMap(p => p.tasks.map(t => ({ ...t, projectName: p.name }))), [state.projects]);
  const visible = useMemo(() => applyTaskFilters(allTasks, filters), [allTasks, filters]);
  const stats = useMemo(() => {
    const open = allTasks.filter(t => t.status !== "done" && t.status !== "completed");
    return [
      { label: "Open", value: open.length, icon: Circle, tone: "indigo", note: "across all projects" },
      { label: "Due today", value: open.filter(t => t.due === new Date().toISOString().slice(0, 10)).length, icon: Clock, tone: "amber", note: fmtDate(new Date()) },
      { label: "Overdue", value: open.filter(t => daysRemaining(t.due) < 0).length, icon: AlertTriangle, tone: "red", note: "needs attention" },
      { label: "Completed", value: allTasks.length - open.length, icon: CheckCircle2, tone: "green", note: "all time" },
      { label: "Unassigned", value: open.filter(t => !t.assignees?.length).length, icon: UserRoundX, tone: "slate", note: "claim one" },
      { label: "Logged time", value: `${state.timeEntries.reduce((s, e) => s + Number(e.hours || 0), 0)}h`, icon: Timer, tone: "violet", note: "this week" },
    ];
  }, [allTasks, state.timeEntries]);

  function openAdd(status = "todo") { setAddStatus(status); setAddOpen(true); }
  function openTask(t) { setDetailTask(state.projects.flatMap(p => p.tasks).find(x => x.id === t.id) || t); }

  function moveTask(id, status) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    dispatch({ type: "UPSERT_TASK", projectId: task.projectId, task: { ...task, status } });
  }

  function bulk(action, value) {
    selected.forEach(id => {
      const task = allTasks.find(t => t.id === id);
      if (!task) return;
      if (action === "delete") dispatch({ type: "DELETE_TASK", projectId: task.projectId, taskId: id });
      else if (action === "assign") dispatch({ type: "UPSERT_TASK", projectId: task.projectId, task: { ...task, assignees: [...new Set([...task.assignees, value])] } });
      else dispatch({ type: "UPSERT_TASK", projectId: task.projectId, task: { ...task, [action]: value } });
    });
    setSelected([]);
  }

  function saveView(name, viewFilters) {
    dispatch({ type: "SAVE_VIEW", view: { id: uid("view"), name, filters: viewFilters } });
  }

  const statuses = statusesFor({ customStatuses: ["Backlog", "Todo", "In Progress", "Review", "Done"] });
  const focus = allTasks.filter(t => t.status !== "done" && daysRemaining(t.due) < 3).slice(0, 4);

  return (
    <div className="todo-page">
      <div className="todo-hero">
        <div className="todo-hero-copy">
          <span className="eyebrow"><Sparkles size={13} /> Task command center</span>
          <h2>Everything that needs doing, in one place.</h2>
          <p>Triage across projects, switch views, and keep the team moving.</p>
        </div>
        <div className="todo-hero-focus">
          <div className="space-between"><span className="small">Needs attention</span><span className="chip">{focus.length} items</span></div>
          {focus.map(t => <button key={t.id} className="focus-row" onClick={() => openTask(t)}><span className={cx("focus-dot", daysRemaining(t.due) < 0 && "late")} /><span>{t.title}</span><span className="small">{daysRemaining(t.due) < 0 ? `${Math.abs(daysRemaining(t.due))}d late` : fmtDate(t.due)}</span><ArrowUpRight size={13} /></button>)}
          {!focus.length && <div className="small" style={{ padding: 12 }}>Nothing urgent. Nice work.</div>}
        </div>
      </div>

      <div className="todo-stat-strip">
        {stats.map(s => { const Icon = s.icon; return (
          <div key={s.label} className={cx("todo-stat", `tone-${s.tone}`)}>
            <div className="todo-stat-top"><span>{s.label}</span><Icon size={16} /></div>
            <b>{s.value}</b><div className="small">{s.note}</div>
          </div>
        ); })}
      </div>

      <section className="todo-workspace">
        <TaskToolbar
          filters={filters} set={set} reset={reset} onRestore={setFilters}
          view={view} setView={setView} onAdd={() => openAdd()}
          savedViews={state.savedViews} onSaveView={saveView} count={visible.length}
        />
        <div className="todo-view-body">
          {view === "list" && <TaskList tasks={visible} projects={state.projects} group={filters.group} onOpen={openTask} selected={selected} setSelected={setSelected} onBulk={bulk} />}
          {view === "board" && <TaskBoard tasks={visible} projects={state.projects} statuses={statuses} onOpen={openTask} onMove={moveTask} onAdd={openAdd} />}
          {view === "calendar" && <TaskCalendar tasks={visible} onOpen={openTask} />}
          {view === "timeline" && <TaskTimeline tasks={visible} projects={state.projects} onOpen={openTask} />}
          {view === "workload" && <TaskWorkload tasks={visible} />}
        </div>
      </section>

      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} projects={state.projects} defaultStatus={addStatus} onCreated={() => setSelected([])} />}
      {detailTask && <TaskDetailModal task={detailTask} project={state.projects.find(p => p.id === detailTask.projectId)} projects={state.projects} onClose={() => setDetailTask(null)} />}
    </div>
  );
}
