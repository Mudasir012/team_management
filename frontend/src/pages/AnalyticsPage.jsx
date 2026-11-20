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

function monthKey(date) {
  return String(date || "").slice(0, 7);
}

export default function AnalyticsPage() {
  const { state } = useStore();
  const allTasks = state.projects.flatMap(p=>p.tasks);
  const doneTasks = allTasks.filter(t=>t.status==="done");
  const revenue = state.invoices.filter(i=>i.status==="Paid").reduce((s,i)=>s+i.amount,0);
  const pending = state.invoices.filter(i=>i.status!=="Paid").reduce((s,i)=>s+i.amount,0);
  const expensesTotal = state.expenses.reduce((s,e)=>s+e.amount,0);
  const utilization = state.members.map(m => ({ name: m.name.split(" ")[0], pct: Math.round((m.hours/m.capacity)*100) }));

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
      };
    });
  }, []);

  const revenueSeries = months.map(({ key }) => state.invoices.filter(i => i.status === "Paid" && monthKey(i.issued) === key).reduce((s, i) => s + Number(i.amount || 0), 0));
  const expenseSeries = months.map(({ key }) => state.expenses.filter(e => monthKey(e.date) === key).reduce((s, e) => s + Number(e.amount || 0), 0));
  const completionRate = allTasks.length ? Math.round(doneTasks.length / allTasks.length * 100) : 0;

  function exportCSV() {
    const rows = [["Project","Status","Budget","Progress"], ...state.projects.map(p=>[p.name,p.status,p.budget,p.progress])];
    const blob = new Blob([rows.map(r=>r.join(",")).join("\n")], {type:"text/csv"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "analytics.csv"; a.click();
  }
  function exportPDF() { window.print(); }

  return (
    <div className="stack page-analytics">
      <div className="toolbar" style={{justifyContent:"space-between"}}>
        <div className="row"><span className="chip">Revenue</span><span className="chip">Expenses</span><span className="chip">Utilization</span><span className="chip">Completion</span></div>
        <div className="row"><button className="btn sm" onClick={exportCSV} disabled={!state.projects.length}>Export CSV</button><button className="btn sm" onClick={exportPDF}>Export PDF</button></div>
      </div>
      <div className="grid-4">
        <div className="kpi"><span>Active projects</span><b>{state.projects.filter(p => p.status !== "Completed").length}</b><div className="small">{state.projects.length} total</div></div>
        <div className="kpi"><span>Open tasks</span><b>{allTasks.length - doneTasks.length}</b><div className="small">{doneTasks.length} completed</div></div>
        <div className="kpi"><span>Revenue vs expenses</span><b>{money(revenue-expensesTotal)}</b><div className="small">{money(revenue)} in · {money(expensesTotal)} out</div></div>
        <div className="kpi"><span>Completion rate</span><b>{completionRate}%</b><div className="small">{doneTasks.length}/{allTasks.length} tasks</div></div>
      </div>
      <div className="grid-2">
        <section className="panel stack"><h3>Collected revenue</h3><Bars values={revenueSeries} labels={months.map(m => m.label)} color="#22c55e" /><div className="small">{money(revenue)} collected · {money(pending)} outstanding</div></section>
        <section className="panel stack"><h3>Expenses</h3><Bars values={expenseSeries} labels={months.map(m => m.label)} color="#f59e0b" /><div className="small">{money(expensesTotal)} recorded across {state.expenses.length} entries.</div></section>
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
            {!utilization.length && <div className="empty">No team members yet.</div>}
          </div>
        </section>
        <section className="panel stack">
          <h3>Audit log</h3>
          <div className="list">
            {state.audit.map(a => (
              <div key={a.id} className="list-row"><div><div style={{fontWeight:600,fontSize:14}}>{a.action}</div><div className="small">{a.actor}</div></div><span className="small">{typeof a.time === "string" ? a.time : new Date(a.time).toLocaleString()}</span></div>
            ))}
            {!state.audit.length && <div className="empty">No activity yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
