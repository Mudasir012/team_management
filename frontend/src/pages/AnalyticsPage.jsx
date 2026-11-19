import { useMemo } from "react";
import { useStore } from "../store";
import { money } from "../utils";

function Bars({ values, color="var(--accent)", labels=[] }) {
  const max = Math.max(...values, 1);
  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-end",gap:8,height:140}}>
        {values.map((v,i)=>(<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
          <div style={{width:"100%",height:`${(v/max)*100}%`,background:color,borderRadius:6, minHeight:4, opacity:0.85}} title={String(v)} />
        </div>))}
      </div>
      {labels.length>0 && <div style={{display:"flex",gap:8,marginTop:6}}>{labels.map(l=><div key={l} className="small" style={{flex:1,textAlign:"center"}}>{l}</div>)}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { state } = useStore();
  const allTasks = state.projects.flatMap(p=>p.tasks);
  const revenue = state.invoices.filter(i=>i.status==="Paid").reduce((s,i)=>s+i.amount,0);
  const pending = state.invoices.filter(i=>i.status!=="Paid").reduce((s,i)=>s+i.amount,0);
  const expensesTotal = state.expenses.reduce((s,e)=>s+e.amount,0);
  const utilization = state.members.map(m => ({ name: m.name.split(" ")[0], pct: Math.round((m.hours/m.capacity)*100) }));
  const cycle = [7,6,8,5,6,5,6];
  const velocity = [18,22,20,24,26,23,28];
  const burndown = [40,35,32,26,20,14,8];
  const revExp = [12,15,9,14,18,16]; const expBars = [6,7,8,7,9,8];

  function exportCSV() {
    const rows = [["Project","Status","Budget","Progress"], ...state.projects.map(p=>[p.name,p.status,p.budget,p.progress])];
    const blob = new Blob([rows.map(r=>r.join(",")).join("\n")], {type:"text/csv"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "analytics.csv"; a.click();
  }
  function exportPDF() { window.print(); }

  return (
    <div className="stack page-analytics">
      <div className="toolbar" style={{justifyContent:"space-between"}}>
        <div className="row"><span className="chip">Burndown</span><span className="chip">Velocity</span><span className="chip">Cycle time</span><span className="chip">Utilization</span><span className="chip">Revenue vs expenses</span></div>
        <div className="row"><button className="btn sm" onClick={exportCSV}>Export CSV</button><button className="btn sm" onClick={exportPDF}>Export PDF</button></div>
      </div>
      <div className="grid-4">
        <div className="kpi"><span>Velocity (pts)</span><b>28</b><div className="small">+8% vs last sprint</div></div>
        <div className="kpi"><span>Cycle time</span><b>5.7d</b><div className="small">avg last 7 sprints</div></div>
        <div className="kpi"><span>Revenue vs expenses</span><b>{money(revenue-expensesTotal)}</b><div className="small">{money(revenue)} in · {money(expensesTotal)} out</div></div>
        <div className="kpi"><span>Completion rate</span><b>{Math.round(allTasks.filter(t=>t.status==="done").length/Math.max(1,allTasks.length)*100)}%</b><div className="small">{allTasks.filter(t=>t.status==="done").length}/{allTasks.length} tasks</div></div>
      </div>
      <div className="grid-2">
        <section className="panel stack"><h3>Burndown</h3><Bars values={burndown} labels={["S1","S2","S3","S4","S5","S6","S7"]} color="#6366f1" /><div className="small">Remaining work across current sprint.</div></section>
        <section className="panel stack"><h3>Velocity</h3><Bars values={velocity} labels={["S1","S2","S3","S4","S5","S6","S7"]} color="#22c55e" /><div className="small">Story points completed per sprint.</div></section>
      </div>
      <div className="grid-2">
        <section className="panel stack"><h3>Cycle time (days)</h3><Bars values={cycle} labels={["S1","S2","S3","S4","S5","S6","S7"]} color="#f59e0b" /></section>
        <section className="panel stack"><h3>Revenue vs expenses ($k)</h3><Bars values={revExp} labels={["Jun","Jul","Aug","Sep","Oct","Nov"]} color="#22c55e" /><div className="small">Expenses trend: {expBars.join(", ")}k (overlay simplified)</div></section>
      </div>
      <div className="grid-2">
        <section className="panel stack">
          <h3>Utilization by member</h3>
          <div className="stack">
            {utilization.map(u => (
              <div key={u.name} className="stack" style={{gap:6}}>
                <div className="space-between"><span>{u.name}</span><span className="small">{u.pct}%</span></div>
                <div className="progress"><span style={{width:`${Math.min(100,u.pct)}%`, background: u.pct>90?"#f59e0b":"var(--accent)"}}/></div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel stack">
          <h3>Audit log</h3>
          <div className="list">
            {state.audit.map(a => (
              <div key={a.id} className="list-row"><div><div style={{fontWeight:600,fontSize:14}}>{a.action}</div><div className="small">{a.actor}</div></div><span className="small">{a.time}</span></div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
