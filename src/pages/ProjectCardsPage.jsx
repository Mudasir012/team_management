import { useMemo, useState } from "react";
import { useStore } from "../store";
import { money, daysLabel } from "../utils";
import { AvatarStack, ProjectPreview, StatusBadge } from "../components/ui";

export default function ProjectCardsPage({ onOpen }) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");

  const projects = useMemo(() => {
    let list = [...state.projects];
    if (state.labelFilter) list = list.filter(p => p.labels.includes(state.labelFilter));
    const term = (q || state.search).toLowerCase().trim();
    if (term) list = list.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
    if (sort === "budget") list.sort((a,b)=>b.budget-a.budget);
    else if (sort === "due") list.sort((a,b)=>new Date(a.end)-new Date(b.end));
    else if (sort === "progress") list.sort((a,b)=>b.progress-a.progress);
    return list;
  }, [state.projects, state.labelFilter, q, state.search, sort]);

  return (
    <div className="stack page-projects">
      <div className="toolbar" style={{justifyContent:"space-between"}}>
        <div className="row" style={{flexWrap:"wrap"}}>
          <input className="field" placeholder="Filter projects…" value={q} onChange={e=>setQ(e.target.value)} style={{minWidth:240}} />
          <select className="field" value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="recent">Sort: Recent</option>
            <option value="due">Sort: Due date</option>
            <option value="budget">Sort: Budget</option>
            <option value="progress">Sort: Progress</option>
          </select>
          {state.labelFilter && <span className="chip">Label filter active</span>}
        </div>
        <div className="small">{projects.length} projects</div>
      </div>

      {projects.length ? (
        <div className="project-grid">
          {projects.map(p => (
            <article key={p.id} className="project-card" onClick={()=>onOpen(p)} tabIndex={0} onKeyDown={(e)=>e.key==="Enter"&&onOpen(p)}>
              <div className="card-top">
                <div>
                  <h3 className="card-title">{p.name}</h3>
                  <div className="card-sub">{daysLabel(p.end, p.status)}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <ProjectPreview project={p} />
              <div className="card-footer">
                <AvatarStack ids={p.members} members={state.members} />
                <div className="budget">{money(p.budget)}</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">No projects match this view. Try clearing filters or create a new project.</div>
      )}
    </div>
  );
}
