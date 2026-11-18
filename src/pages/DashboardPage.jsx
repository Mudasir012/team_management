import { useMemo } from "react";
import { useStore } from "../store";
import { money, fmtDate } from "../utils";

export default function DashboardPage() {
  const { state, dispatch } = useStore();
  const allTasks = state.projects.flatMap(p => p.tasks.map(t => ({ ...t, projectName: p.name, projectId: p.id })));
  const myTasks = allTasks.filter(t => t.assignees?.includes("u1") && t.status !== "done").slice(0, 6);
  const deadlines = [...allTasks].filter(t => t.status !== "done").sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,6);
  const active = state.projects.filter(p => p.status !== "Completed");
  const revenue = state.invoices.filter(i=>i.status==="Paid").reduce((s,i)=>s+i.amount,0);
  const overdueInv = state.invoices.filter(i=>i.status==="Overdue").length;
  const kpis = [
    { label: "Active projects", value: active.length, note: `${state.projects.length} total` },
    { label: "Open tasks", value: allTasks.filter(t=>t.status!=="done").length, note: `${allTasks.filter(t=>t.status==="done").length} done` },
    { label: "Revenue collected", value: money(revenue), note: `${overdueInv} overdue invoices` },
    { label: "Team utilization", value: `${Math.round(state.members.reduce((s,m)=>s+m.hours,0)/state.members.reduce((s,m)=>s+m.capacity,0)*100)}%`, note: "Capacity used this week" },
  ];
  return (
    <div className="stack page-dashboard">
      <div className="grid-4">
        {kpis.map(k => (
          <div key={k.label} className="kpi"><span>{k.label}</span><b>{k.value}</b><div className="small" style={{marginTop:4}}>{k.note}</div></div>
        ))}
      </div>
      <div className="grid-2">
        <section className="panel stack">
          <div className="space-between"><h3>My tasks</h3><button className="btn sm ghost" onClick={()=>dispatch({type:"SET_PAGE", page:"todo"})}>View all</button></div>
          <div className="list">
            {myTasks.map(t => (
              <div key={t.id} className="list-row">
                <div>
                  <div style={{fontWeight:600, fontSize:14}}>{t.title}</div>
                  <div className="small">{t.projectName} · due {fmtDate(t.due)} · {t.priority}</div>
                </div>
                <span className={"pill "+(t.status==="inprogress"?"blue":t.status==="review"?"orange":"")}>{t.status}</span>
              </div>
            ))}
            {!myTasks.length && <div className="empty">No tasks assigned to you.</div>}
          </div>
        </section>
        <section className="panel stack">
          <div className="space-between"><h3>Upcoming deadlines</h3><span className="small">Next 6 items</span></div>
          <div className="list">
            {deadlines.map(t => (
              <div key={t.id} className="list-row">
                <div><div style={{fontWeight:600,fontSize:14}}>{t.title}</div><div className="small">{t.projectName}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontWeight:600,fontSize:13}}>{fmtDate(t.due)}</div><div className="small">{t.status}</div></div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid-2">
        <section className="panel stack">
          <h3>Activity feed</h3>
          <div className="list">
            {state.projects.flatMap(p=>p.activity.map(a=>({...a, project:p.name}))).slice(0,8).map(a=>(
              <div key={a.id} className="list-row"><div><div style={{fontWeight:600,fontSize:14}}>{a.text}</div><div className="small">{a.project}</div></div><span className="small">{a.time}</span></div>
            ))}
          </div>
        </section>
        <section className="panel stack">
          <h3>Goals / OKRs</h3>
          <div className="stack">
            {state.goals.map(g => (
              <div key={g.id} className="stack" style={{gap:6}}>
                <div className="space-between"><div><div style={{fontWeight:600,fontSize:14}}>{g.title}</div><div className="small">{g.quarter} · {state.members.find(m=>m.id===g.owner)?.name}</div></div><b>{g.progress}%</b></div>
                <div className="progress"><span style={{width:`${g.progress}%`}}/></div>
              </div>
            ))}
          </div>
          <div className="panel" style={{background:"var(--surface-2)"}}>
            <div style={{fontWeight:600, marginBottom:4}}>Presence</div>
            <div className="row" style={{flexWrap:"wrap"}}>{state.members.map(m=>(
              <span key={m.id} className="chip"><span style={{width:8,height:8,borderRadius:99,background:m.status==="online"?"#22c55e":m.status==="away"?"#f59e0b":"#9ca3af"}}/> {m.name}</span>
            ))}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
