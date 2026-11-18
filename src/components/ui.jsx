import { Check } from "lucide-react";
import { initials } from "../utils";

export function AvatarStack({ ids, members, max = 4 }) {
  const list = ids.map(id => members.find(m => m.id === id)).filter(Boolean);
  const show = list.slice(0, max);
  const extra = list.length - show.length;
  return (
    <div className="avatar-stack">
      {show.map(m => (
        <span key={m.id} className="avatar" title={m.name} style={{background:m.color}}>{initials(m.name)}</span>
      ))}
      {extra > 0 && <span className="avatar" style={{background:"var(--surface-3)", color:"var(--muted)", fontWeight:600}}>+{extra}</span>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const cls = status === "Completed" ? "completed" : status === "In Progress" ? "inprogress" : "todo";
  return <span className={"badge "+cls}>{status}</span>;
}

export function ProjectPreview({ project }) {
  const done = project.tasks.filter(t=>t.status==="done").length;
  const total = project.tasks.length || 1;
  const pct = Math.round((done/total)*100);
  if (project.preview === "kanban") {
    const cols = ["todo","inprogress","done"];
    return (
      <div className="card-preview"><div className="pv-kanban">
        {cols.map(c=>(
          <div key={c} className="pv-col">
            <i style={{width: c==="todo"? "70%": c==="inprogress"? "50%":"60%"}} />
            {project.tasks.filter(t=>t.status===c).slice(0,2).map(t=> <b key={t.id} title={t.title} />)}
            {project.tasks.filter(t=>t.status===c).length===0 && <b style={{opacity:.4}}/>}
          </div>
        ))}
      </div></div>
    );
  }
  if (project.preview === "checklist") {
    const items = project.tasks.slice(0,4);
    return (
      <div className="card-preview"><div className="pv-check">
        {items.map((t,i)=>(
          <div key={t.id} className="rowline"><span className={"pv-box "+(t.status==="done"||i===0?"on":"")}>{(t.status==="done"||i===0)&&<Check size={10} strokeWidth={3}/>}</span><span style={{textDecoration:t.status==="done"?"line-through":"none"}}>{t.title.slice(0,22)}</span></div>
        ))}
        <div className="pv-progress"><span style={{width:`${pct}%`}}/></div>
      </div></div>
    );
  }
  if (project.preview === "months") {
    const months = ["Sep","Oct","Nov","Dec"];
    return (
      <div className="card-preview"><div className="pv-months">
        {months.map((m,i)=>(
          <div key={m} className="pv-month"><em>{m}</em><b style={{width:`${40+i*15}%`, background: i===2?"#6366f1":undefined}}/><b style={{width:`${30+i*10}%`, opacity:.6}}/></div>
        ))}
      </div></div>
    );
  }
  if (project.preview === "skeleton") {
    return (
      <div className="card-preview"><div className="pv-skel">
        <div style={{width:"80%"}}/><div style={{width:"100%"}}/><div style={{width:"65%"}}/><div style={{width:"90%"}}/><div style={{width:"50%"}}/>
      </div></div>
    );
  }
  // stats
  const bars = [30,55,40,80,60,45,70];
  return (
    <div className="card-preview"><div className="pv-stats">
      <div className="pv-stat"><span className="small">Progress</span><b>{project.progress}%</b><div className="progress" style={{marginTop:8}}><span style={{width:`${project.progress}%`}}/></div></div>
      <div className="pv-stat"><span className="small">Tasks</span><b>{done}/{total}</b><div className="small" style={{marginTop:6}}>completed</div></div>
      <div className="pv-stat" style={{gridColumn:"1 / -1"}}><span className="small">Activity</span><div className="pv-bars">{bars.map((h,i)=><span key={i} style={{height:`${h}%`}}/>)}</div></div>
    </div></div>
  );
}
