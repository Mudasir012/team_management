import { useState } from "react";
import { useStore } from "../store";
import { money } from "../utils";
import { uid } from "../data/seed";

const TODAY = new Date().toISOString().slice(0, 10);

export default function ExpensesPage() {
  const { state, dispatch } = useStore();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState({ project: state.projects[0]?.id || "", category:"Software", vendor:"", amount:0, date:TODAY, receipt:"receipt.pdf", note:"" });
  const list = state.expenses.filter(e => (e.vendor+e.category+e.note).toLowerCase().includes(q.toLowerCase()));

  const byProject = state.projects.map(p => {
    const spent = state.expenses.filter(e=>e.project===p.id).reduce((s,e)=>s+e.amount,0);
    return { project: p, spent, budget: p.budget, pct: p.budget ? Math.min(100, Math.round(spent/p.budget*100)) : 0 };
  });
  const categories = ["Software","Contractor","Ads","Travel","Printing","Other"];
  function add(e){ e.preventDefault(); dispatch({type:"ADD_EXPENSE", expense:{ id:uid("e"), ...draft, amount:Number(draft.amount)||0 }}); setDraft({...draft, vendor:"", amount:0, note:""}); }
  return (
    <div className="stack page-expenses">
      <div className="grid-2">
        <form className="panel stack" onSubmit={add}>
          <h3>Add expense</h3>
          <div className="grid-2">
            <label className="lbl">Project<select className="field" value={draft.project} onChange={e=>setDraft({...draft,project:e.target.value})}>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="lbl">Category<select className="field" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
            <label className="lbl">Vendor<input className="field" value={draft.vendor} onChange={e=>setDraft({...draft,vendor:e.target.value})} required/></label>
            <label className="lbl">Amount<input className="field" type="number" value={draft.amount} onChange={e=>setDraft({...draft,amount:e.target.value})} /></label>
            <label className="lbl">Date<input className="field" type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
            <label className="lbl">Receipt<input className="field" value={draft.receipt} onChange={e=>setDraft({...draft,receipt:e.target.value})} placeholder="filename.pdf"/></label>
          </div>
          <label className="lbl">Note<input className="field" value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label>
          <div><button className="btn primary" type="submit">Add expense</button></div>
        </form>
        <section className="panel stack">
          <h3>Budget vs actual (per project)</h3>
          <div className="stack">
            {byProject.map(({project, spent, budget, pct}) => (
              <div key={project.id} className="stack" style={{gap:6}}>
                <div className="space-between"><span style={{fontWeight:600,fontSize:14}}>{project.name}</span><span className="small">{money(spent)} / {money(budget)}</span></div>
                <div className="progress"><span style={{width:`${pct}%`, background: pct>90?"#ef4444":pct>70?"#f59e0b":"#22c55e"}}/></div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel stack">
        <div className="space-between"><h3>Expenses</h3><input className="field" placeholder="Search category, vendor, note…" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:280}} /></div>
        <table className="table"><thead><tr><th>Date</th><th>Project</th><th>Category</th><th>Vendor</th><th>Note</th><th>Receipt</th><th>Amount</th></tr></thead><tbody>
          {list.map(e => <tr key={e.id}><td>{e.date}</td><td>{state.projects.find(p=>p.id===e.project)?.name}</td><td><span className="chip">{e.category}</span></td><td>{e.vendor}</td><td>{e.note}</td><td className="small">{e.receipt}</td><td><b>{money(e.amount)}</b></td></tr>)}
        </tbody></table>
      </section>
    </div>
  );
}
