import { useState } from "react";
import { useStore } from "../store";
import { money, fmtDate } from "../utils";

export default function EarningPage() {
  const { state, dispatch } = useStore();
  const [status, setStatus] = useState("all");
  const [draft, setDraft] = useState({ client: state.customers[0]?.name || "", project: state.projects[0]?.id || "", amount: 1000, status:"Draft", due: new Date(Date.now()+14*86400000).toISOString().slice(0,10) });
  const list = state.invoices.filter(i => status==="all" || i.status===status);
  const totals = {
    Paid: state.invoices.filter(i=>i.status==="Paid").reduce((s,i)=>s+i.amount,0),
    Sent: state.invoices.filter(i=>i.status==="Sent").reduce((s,i)=>s+i.amount,0),
    Overdue: state.invoices.filter(i=>i.status==="Overdue").reduce((s,i)=>s+i.amount,0),
    Draft: state.invoices.filter(i=>i.status==="Draft").reduce((s,i)=>s+i.amount,0),
  };
  function add(e){ e.preventDefault(); dispatch({type:"ADD_INVOICE", invoice:{ id:`INV-${String(state.invoices.length+101)}`, ...draft, amount:Number(draft.amount)||0, issued:new Date().toISOString().slice(0,10) }}); }
  const badge = (s) => s==="Paid"?"green":s==="Sent"?"blue":s==="Overdue"?"red":"orange";
  return (
    <div className="stack page-earning">
      <div className="grid-4">
        {Object.entries(totals).map(([k,v])=> <div key={k} className="kpi"><span>{k}</span><b>{money(v)}</b><div className="small">{state.invoices.filter(i=>i.status===k).length} invoices</div></div>)}
      </div>
      <form className="panel toolbar" onSubmit={add} style={{alignItems:"end"}}>
        <label className="lbl">Client<select className="field" value={draft.client} onChange={e=>setDraft({...draft,client:e.target.value})}>{state.customers.map(c=><option key={c.id}>{c.name}</option>)}</select></label>
        <label className="lbl">Project<select className="field" value={draft.project} onChange={e=>setDraft({...draft,project:e.target.value})}>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="lbl">Amount<input className="field" type="number" value={draft.amount} onChange={e=>setDraft({...draft,amount:e.target.value})}/></label>
        <label className="lbl">State<select className="field" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option>Draft</option><option>Sent</option><option>Paid</option><option>Overdue</option></select></label>
        <label className="lbl">Due<input className="field" type="date" value={draft.due} onChange={e=>setDraft({...draft,due:e.target.value})}/></label>
        <button className="btn primary" type="submit">Create invoice</button>
      </form>
      <section className="panel stack">
        <div className="toolbar" style={{margin:0}}>
          {["all","Draft","Sent","Paid","Overdue"].map(s=> <button key={s} className={"tab "+(status===s?"active":"")} onClick={()=>setStatus(s)}>{s==="all"?"All":s}</button>)}
        </div>
        <table className="table"><thead><tr><th>Invoice</th><th>Client</th><th>Project</th><th>Issued</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>
          {list.map(i=> (
            <tr key={i.id}><td><b>{i.id}</b></td><td>{i.client}</td><td>{state.projects.find(p=>p.id===i.project)?.name || i.project}</td><td>{fmtDate(i.issued)}</td><td>{fmtDate(i.due)}</td><td>{money(i.amount)}</td><td><span className={"pill "+badge(i.status)}>{i.status}</span></td><td>
              <select className="field" style={{height:32,minHeight:32,padding:"4px 8px"}} value={i.status} onChange={e=>dispatch({type:"UPDATE_INVOICE", invoice:{...i,status:e.target.value}})}><option>Draft</option><option>Sent</option><option>Paid</option><option>Overdue</option></select>
            </td></tr>
          ))}
        </tbody></table>
      </section>
    </div>
  );
}
