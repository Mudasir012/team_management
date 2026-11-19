import { useState } from "react";
import { useStore } from "../store";
import { money } from "../utils";
import { uid } from "../data/seed";

export default function CustomersPage() {
  const { state, dispatch } = useStore();
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({ name:"", contact:"", email:"", status:"Active", value:0 });
  const list = state.customers.filter(c => (c.name+c.contact+c.email).toLowerCase().includes(q.toLowerCase()));
  function add(e){ e.preventDefault(); if(!draft.name) return; dispatch({type:"ADD_CUSTOMER", customer:{ id:uid("c"), ...draft, value:Number(draft.value)||0, projects:[] }}); setDraft({name:"",contact:"",email:"",status:"Active",value:0}); setFormOpen(false); }
  return (
    <div className="stack page-customer">
      <div className="toolbar" style={{justifyContent:"space-between"}}>
        <input className="field" placeholder="Search clients & contacts…" value={q} onChange={e=>setQ(e.target.value)} style={{minWidth:280}} />
        <button className="btn primary" onClick={()=>setFormOpen(v=>!v)}>{formOpen?"Close":"Add client"}</button>
      </div>
      {formOpen && (
        <form className="panel grid-4" onSubmit={add} style={{alignItems:"end"}}>
          <label className="lbl">Company<input className="field" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} required/></label>
          <label className="lbl">Contact<input className="field" value={draft.contact} onChange={e=>setDraft({...draft,contact:e.target.value})}/></label>
          <label className="lbl">Email<input className="field" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})}/></label>
          <div className="row"><label className="lbl" style={{flex:1}}>Value<input className="field" type="number" value={draft.value} onChange={e=>setDraft({...draft,value:e.target.value})}/></label><button className="btn primary" type="submit">Save</button></div>
        </form>
      )}
      <div className="grid-3">
        {list.map(c => {
          const linked = state.projects.filter(p=>p.customerId===c.id || c.projects.includes(p.id));
          return (
            <div key={c.id} className="panel stack">
              <div className="space-between"><div><h3 style={{margin:0}}>{c.name}</h3><div className="small">{c.contact} · {c.email}</div></div><span className={"pill "+(c.status==="Active"?"green":c.status==="Prospect"?"blue":"")}>{c.status}</span></div>
              <div className="space-between"><span className="small">Lifetime value</span><b>{money(c.value)}</b></div>
              <div>
                <div className="small" style={{marginBottom:6}}>Linked projects</div>
                <div className="row" style={{flexWrap:"wrap"}}>
                  {linked.length ? linked.map(p=> <button key={p.id} className="chip" onClick={()=>{dispatch({type:"SELECT_PROJECT",id:p.id}); dispatch({type:"SET_PAGE",page:"projectDetail"});}}>{p.name}</button>) : <span className="small">No projects linked</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <section className="panel">
        <h3>Contacts directory</h3>
        <table className="table"><thead><tr><th>Client</th><th>Contact</th><th>Email</th><th>Status</th><th>Projects</th><th>Value</th></tr></thead><tbody>
          {list.map(c=> <tr key={c.id}><td><b>{c.name}</b></td><td>{c.contact}</td><td>{c.email}</td><td><span className={"pill "+(c.status==="Active"?"green":c.status==="Prospect"?"blue":"")}>{c.status}</span></td><td>{state.projects.filter(p=>p.customerId===c.id).length}</td><td>{money(c.value)}</td></tr>)}
        </tbody></table>
      </section>
    </div>
  );
}
