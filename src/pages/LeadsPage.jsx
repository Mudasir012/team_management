import { useState } from "react";
import { useStore } from "../store";
import { money } from "../utils";
import { uid } from "../data/seed";

const stages = ["New","Qualified","Proposal","Negotiation","Won","Lost"];

export default function LeadsPage() {
  const { state, dispatch } = useStore();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState({ company:"", contact:"", value:5000, stage:"New", owner:"u1", source:"Inbound" });
  const [dragId, setDragId] = useState(null);
  const filtered = state.leads.filter(l => (l.company+l.contact+l.source).toLowerCase().includes(q.toLowerCase()));
  function add(e){ e.preventDefault(); if(!draft.company) return; dispatch({type:"ADD_LEAD", lead:{id:uid("ld"), ...draft, value:Number(draft.value)||0}}); setDraft({company:"",contact:"",value:5000,stage:"New",owner:"u1",source:"Inbound"}); }
  function move(id, stage){ const lead = state.leads.find(l=>l.id===id); if(lead) dispatch({type:"UPDATE_LEAD", lead:{...lead, stage}}); }
  return (
    <div className="stack page-leads">
      <div className="panel stack">
        <div className="space-between"><h3>Pipeline</h3><span className="small">Drag cards between stages · convert won leads into clients & projects</span></div>
        <form className="toolbar" onSubmit={add} style={{margin:0}}>
          <input className="field" placeholder="Company" value={draft.company} onChange={e=>setDraft({...draft,company:e.target.value})} required />
          <input className="field" placeholder="Contact" value={draft.contact} onChange={e=>setDraft({...draft,contact:e.target.value})} />
          <input className="field" type="number" placeholder="Value" value={draft.value} onChange={e=>setDraft({...draft,value:e.target.value})} />
          <select className="field" value={draft.owner} onChange={e=>setDraft({...draft,owner:e.target.value})}>{state.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <button className="btn primary sm" type="submit">Add lead</button>
          <input className="field" placeholder="Search pipeline…" value={q} onChange={e=>setQ(e.target.value)} style={{marginLeft:"auto"}} />
        </form>
      </div>
      <div className="kanban">
        {stages.map(stage => {
          const items = filtered.filter(l=>l.stage===stage);
          const total = items.reduce((s,l)=>s+l.value,0);
          return (
            <div key={stage} className="kan-col" onDragOver={e=>e.preventDefault()} onDrop={()=>{ if(dragId) move(dragId, stage); setDragId(null); }}>
              <h4><span>{stage}</span><span>{items.length}</span></h4>
              <div className="small" style={{margin:"0 4px 8px"}}>{money(total)}</div>
              {items.map(l => (
                <div key={l.id} className="task-card" draggable onDragStart={()=>setDragId(l.id)}>
                  <strong>{l.company}</strong>
                  <div className="small">{l.contact} · {l.source}</div>
                  <div className="space-between" style={{marginTop:8}}>
                    <span className="chip">{money(l.value)}</span>
                    <span className="small">{state.members.find(m=>m.id===l.owner)?.name.split(" ")[0]}</span>
                  </div>
                  <div className="row" style={{marginTop:8, flexWrap:"wrap"}}>
                    {stage!=="Won" && <button className="btn sm" onClick={()=>move(l.id,"Won")}>Mark won</button>}
                    <button className="btn sm primary" onClick={()=>dispatch({type:"CONVERT_LEAD", leadId:l.id})}>Convert</button>
                  </div>
                </div>
              ))}
              {!items.length && <div className="drop-hint">Drop leads here</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
