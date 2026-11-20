import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Mic,
  MousePointer2,
  PhoneOff,
  Plus,
  Users,
  Video,
  X,
} from "lucide-react";
import { useStore } from "../store";

const capabilities = [
  { label: "Projects", icon: FolderKanban },
  { label: "Tasks", icon: CheckSquare },
  { label: "People", icon: Users },
  { label: "Dashboards", icon: LayoutDashboard },
  { label: "Chat", icon: MessageSquare },
  { label: "Video calls", icon: Video },
];

function CursorTag({ label, tone }) {
  return (
    <div className={`cursor-tag ${tone}`} aria-hidden="true">
      <MousePointer2 />
      <span>{label}</span>
    </div>
  );
}

function InlineAvatars({ members }) {
  return (
    <span className="inline-avatars" aria-label="Team members">
      {members.map((member) => (
        <span key={member.id}>{(member.avatar || member.name.slice(0, 2)).slice(0, 2)}</span>
      ))}
    </span>
  );
}

export default function HomePage({ onSignIn, onSignUp }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { state } = useStore();
  const members = state.members.slice(0, 3);
  const callMember = state.members[0];
  const tasks = state.projects
    .flatMap((project) => (project.tasks || []).map((task) => ({ ...task, project: project.name })))
    .slice(0, 3);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="glass-site">
      <div className="glass-grain" aria-hidden="true" />

      <div className="glass-frame">
        <header className="glass-nav">
          <a className="glass-brand" href="#top" aria-label="Acme Studio home" onClick={closeMenu}>
            acme<span>.</span>
          </a>

          <nav className="nav-pill" aria-label="Primary">
            <a className="nav-link active" href="#top"><span className="nav-dot" />Home</a>
            <a className="nav-link" href="#workspace">Workspace</a>
            <a className="nav-link" href="#platform">Platform</a>
          </nav>

          <div className="glass-nav__actions">
            <button className="glass-btn light" type="button" onClick={onSignIn}>
              Log in <ArrowRight aria-hidden="true" />
            </button>
            <button
              className="menu-toggle"
              type="button"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={20} strokeWidth={1.6} /> : <Menu size={20} strokeWidth={1.6} />}
            </button>
          </div>
        </header>

        {menuOpen && (
          <div className="mobile-menu">
            <button className="glass-btn primary" type="button" onClick={onSignUp}>Create account</button>
            <button className="glass-btn glass" type="button" onClick={onSignIn}>Log in</button>
          </div>
        )}

        <main className="home-main" id="top">
          <section className="hero" aria-labelledby="hero-title">
            <div className="aurora aurora--borealis" aria-hidden="true">
              <span className="aurora-ribbon ribbon-one" />
              <span className="aurora-ribbon ribbon-two" />
              <span className="aurora-ribbon ribbon-three" />
              <span className="aurora-veil" />
            </div>
            <div className="hero__scrim" aria-hidden="true" />

            <div className="hero__inner">
              <div className="hero__eyebrow"><span className="nav-dot" /> {state.settings.org || "Acme Studio"} workspace</div>
              <h1 id="hero-title">
                Where <em>teams</em> <InlineAvatars members={members} /> find <em>momentum.</em>
              </h1>
              <p className="hero__sub">
                Projects, tasks, people, dashboards, chat, and calls in one calm place. Log in to continue where
                your team left off.
              </p>
              <div className="hero__actions">
                <button className="glass-btn primary" type="button" onClick={onSignUp}>
                  Create account <ArrowRight aria-hidden="true" />
                </button>
                <button className="glass-btn glass" type="button" onClick={onSignIn}>
                  Log in
                </button>
              </div>
            </div>

            <div className="float-card float-card--call">
              <div className="float-card__label">Project call</div>
              <div className="call-person">
                <span className="call-person__avatar">{(callMember?.avatar || "AS").slice(0, 2)}</span>
                <span className="call-person__name">{callMember?.name || "Your team"}</span>
                <span className="call-person__time">04:12</span>
              </div>
              <div className="call-actions" aria-label="Call controls">
                <button type="button" aria-label="Mute"><Mic aria-hidden="true" /></button>
                <button type="button" aria-label="Camera"><Video aria-hidden="true" /></button>
                <button className="end" type="button" aria-label="End call"><PhoneOff aria-hidden="true" /></button>
              </div>
              <CursorTag label="Developer" tone="yellow" />
            </div>

            <div className="float-card float-card--tasks">
              <div className="checklist-title">
                <span>Weekly handoff</span>
                <span className="ghost-chip"><Plus size={11} aria-hidden="true" /> Add subtask</span>
              </div>
              {tasks.map((task, index) => (
                <div className={`check-row${index === 0 ? " done" : ""}`} key={task.id}>
                  <span className={`check-box${index === 0 ? " on" : ""}`} aria-hidden="true">
                    {index === 0 && <Check aria-hidden="true" />}
                  </span>
                  <span>{task.title}</span>
                </div>
              ))}
              <CursorTag label="Designer" tone="orange" />
            </div>
          </section>

          <section className="capability-strip" aria-label="Workspace capabilities">
            {capabilities.map(({ label, icon: Icon }) => (
              <div className="capability" key={label}>
                <i aria-hidden="true" />
                <Icon size={15} strokeWidth={1.5} aria-hidden="true" />
                {label}
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
