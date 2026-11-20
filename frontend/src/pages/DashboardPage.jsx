import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronRight, Clock3, AlertTriangle, Eye } from "lucide-react";
import { useAuth } from "../auth";
import { useStore } from "../store";
import { daysRemaining, fmtDate, money } from "../utils";

const statusText = { todo: "To do", inprogress: "In progress", review: "Review", done: "Done" };
const priorityColor = { High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e" };
const priorityRank = { High: 0, Medium: 1, Low: 2 };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const now = new Date();
const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
const longDate = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export default function DashboardPage() {
  const { state, dispatch } = useStore();
  const { user, hasPermission } = useAuth();
  const [taskFilter, setTaskFilter] = useState("all");
  const firstName = user?.name?.split(" ")[0] || "there";

  const allTasks = state.projects.flatMap(p => p.tasks.map(t => ({ ...t, projectName: p.name, projectId: p.id })));
  const openTasks = allTasks.filter(t => t.status !== "done");
  const dueToday = openTasks.filter(t => daysRemaining(t.due) === 0);
  const overdue = openTasks.filter(t => daysRemaining(t.due) < 0);
  const awaitingReview = allTasks.filter(t => t.status === "review");
  const overdueInvoices = state.invoices.filter(i => i.status === "Overdue");
  const activeProjects = state.projects.filter(p => p.status !== "Completed");
  const utilization = Math.round(
    state.members.reduce((s, m) => s + m.hours, 0) / Math.max(1, state.members.reduce((s, m) => s + m.capacity, 0)) * 100
  );

  const myOpen = openTasks.filter(t => user?.id && t.assignees?.includes(user.id));
  const filteredMyTasks = myOpen
    .filter(t => taskFilter === "all" || (taskFilter === "today" && daysRemaining(t.due) <= 0) || (taskFilter === "overdue" && daysRemaining(t.due) < 0))
    .sort((a, b) => daysRemaining(a.due) - daysRemaining(b.due) || (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3));
  const visibleMyTasks = filteredMyTasks.slice(0, 5);
  const deadlines = [...openTasks]
    .sort((a, b) => daysRemaining(a.due) - daysRemaining(b.due))
    .slice(0, 5);

  function goTo(page) { dispatch({ type: "SET_PAGE", page }); }
  function openTask(task) {
    dispatch({ type: "SELECT_PROJECT", id: task.projectId });
    goTo("projectDetail");
  }
  function toggleDone(task) {
    dispatch({ type: "SET_TASK_STATUS", projectId: task.projectId, taskId: task.id, status: task.status === "done" ? "todo" : "done" });
  }

  const signals = [
    {
      id: "due",
      icon: Clock3,
      label: "Due today",
      value: dueToday.length,
      detail: dueToday.length ? dueToday.slice(0, 2).map(t => t.title).join(" · ") : "Nothing lands today",
      onClick: () => goTo("todo"),
    },
    {
      id: "overdue",
      icon: AlertTriangle,
      label: "Overdue",
      value: overdue.length,
      detail: overdue.length ? `${plural(overdue.length, "task")} past due` : "All caught up",
      alert: overdue.length > 0,
      onClick: () => goTo("todo"),
    },
    {
      id: "review",
      icon: Eye,
      label: "Awaiting review",
      value: awaitingReview.length,
      detail: awaitingReview.length ? "Across active projects" : "Review queue is clear",
      onClick: () => goTo("todo"),
    },
  ];

  return (
    <div className="stack page-dashboard">
      <section className="dash-brief">
        <div className="dash-brief-copy">
          <div className="dash-brief-eyebrow">{longDate}</div>
          <h2>{greeting}, {firstName}</h2>
          <p>
            You have {plural(dueToday.length, "task")} due today, {plural(overdue.length, "task")} overdue
            {awaitingReview.length ? `, and ${plural(awaitingReview.length, "review")} waiting` : ""}
            {overdueInvoices.length ? ` · ${plural(overdueInvoices.length, "invoice")} overdue` : ""}.
          </p>
          <div className="dash-brief-meta">
            <span>{plural(activeProjects.length, "active project")}</span>
            <i />
            <span>{utilization}% team load</span>
            <i />
            <span>{money(state.invoices.filter(i => i.status === "Paid").reduce((s, i) => s + i.amount, 0))} collected</span>
          </div>
          <div className="dash-brief-actions">
            {hasPermission("tasks:read") && <button className="btn primary" onClick={() => goTo("todo")}>Open my tasks <ArrowRight size={15} /></button>}
            {hasPermission("invoices:read") && <button className="btn ghost" onClick={() => goTo("earning")}>View invoices</button>}
          </div>
        </div>
        <div className="dash-signal-grid">
          {signals.map(s => (
            <button key={s.id} className={`dash-signal${s.alert ? " is-alert" : ""}`} onClick={s.onClick}>
              <span className="dash-signal-icon"><s.icon size={16} /></span>
              <b>{s.value}</b>
              <span>{s.label}</span>
              <small>{s.detail}</small>
              <ArrowUpRight className="dash-signal-arrow" size={14} />
            </button>
          ))}
        </div>
      </section>

      <div className="dash-main-grid">
        <section className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <h3>My tasks</h3>
              <p>Assigned to you · sorted by urgency</p>
            </div>
            <span className="dash-count">{myOpen.length}</span>
          </div>
          <div className="dash-panel-tools">
            <div className="dash-filters">
              {[["all", "All"], ["today", "Today"], ["overdue", "Overdue"]].map(([id, label]) => (
                <button key={id} className={`dash-filter${taskFilter === id ? " active" : ""}`} onClick={() => setTaskFilter(id)}>{label}</button>
              ))}
            </div>
            <button className="link-btn" onClick={() => goTo("todo")}>View all <ArrowUpRight size={14} /></button>
          </div>
          <div className="dash-task-list">
            {visibleMyTasks.map(t => {
              const days = daysRemaining(t.due);
              const dueClass = days < 0 ? "overdue" : days === 0 ? "today" : "";
              const dueText = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : fmtDate(t.due);
              return (
                <div className="dash-task-row" key={t.id}>
                  <button className="dash-check" onClick={() => toggleDone(t)} aria-label={t.status === "done" ? "Reopen task" : "Mark task done"}>
                    {t.status === "done" ? <CheckCheck size={14} /> : <Check size={14} />}
                  </button>
                  <button className="dash-task-main" onClick={() => openTask(t)}>
                    <span className="dash-task-title">{t.title}</span>
                    <span className="dash-task-meta">
                      <span>{t.projectName}</span><i />
                      <span className="dash-priority"><em style={{ background: priorityColor[t.priority] || "#9ca3af" }} />{t.priority}</span><i />
                      <span className={`dash-status s-${t.status}`}>{statusText[t.status] || t.status}</span>
                    </span>
                  </button>
                  <span className={`dash-due ${dueClass}`}>{dueText}</span>
                  <button className="dash-row-open" onClick={() => openTask(t)} aria-label="Open task"><ChevronRight size={16} /></button>
                </div>
              );
            })}
            {!visibleMyTasks.length && <div className="dash-empty">No tasks match this filter.</div>}
          </div>
          <div className="dash-panel-foot">
            <button className="link-btn" onClick={() => goTo("todo")}>See all assigned tasks <ArrowRight size={14} /></button>
            <span>{plural(filteredMyTasks.length, "task")}</span>
          </div>
        </section>

        <section className="dash-panel">
          <div className="dash-panel-head">
            <div>
              <h3>Upcoming deadlines</h3>
              <p>Nearest across every project</p>
            </div>
            <span className="dash-count">{deadlines.length}</span>
          </div>
          <div className="dash-deadline-list">
            {deadlines.map(t => {
              const days = daysRemaining(t.due);
              return (
                <button className="dash-deadline-row" key={t.id} onClick={() => openTask(t)}>
                  <span className="dash-deadline-mark" />
                  <span className="dash-deadline-main">
                    <b>{t.title}</b>
                    <small>{t.projectName} · {statusText[t.status] || t.status}</small>
                  </span>
                  <span className={`dash-due ${days < 0 ? "overdue" : days === 0 ? "today" : ""}`}>
                    {days < 0 ? `${Math.abs(days)}d late` : days === 0 ? "Today" : fmtDate(t.due)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="dash-panel-foot">
            <button className="link-btn" onClick={() => goTo("todo")}>Open task calendar <ArrowRight size={14} /></button>
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="dash-panel">
          <div className="dash-panel-head">
            <div><h3>Activity feed</h3><p>Latest project updates</p></div>
          </div>
          <div className="dash-deadline-list">
            {state.projects.flatMap(p => p.activity.map(a => ({ ...a, project: p.name }))).slice(0, 5).map(a => (
              <div className="dash-deadline-row is-static" key={a.id}>
                <span className="dash-deadline-mark" />
                <span className="dash-deadline-main"><b>{a.text}</b><small>{a.project}</small></span>
                <span className="small">{a.time}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="dash-panel">
          <div className="dash-panel-head">
            <div><h3>Goals / OKRs</h3><p>{state.goals[0]?.quarter || "Quarter"} progress</p></div>
          </div>
          <div className="stack" style={{ gap: 14 }}>
            {state.goals.map(g => (
              <div key={g.id} className="stack" style={{ gap: 6 }}>
                <div className="space-between">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{g.title}</div>
                    <div className="small">{g.quarter} · {state.members.find(m => m.id === g.owner)?.name}</div>
                  </div>
                  <b>{g.progress}%</b>
                </div>
                <div className="progress"><span style={{ width: `${g.progress}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="dash-presence">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Presence</div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {state.members.map(m => (
                <span key={m.id} className="chip">
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: m.status === "online" ? "#22c55e" : m.status === "away" ? "#f59e0b" : "#9ca3af" }} /> {m.name}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
