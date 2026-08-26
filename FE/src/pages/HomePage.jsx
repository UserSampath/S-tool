import { useState } from "react";
import NavBar from "../components/NavBar";
import { ArrowLeftIcon, ArrowRightIcon } from "../components/icons";
import { tools } from "../data/tools";
import PlansPage from "./PlansPage";
import ProjectsPage from "./ProjectsPage";
import NotesPage from "./NotesPage";
import GrammarPage from "./GrammarPage";
import PrPage from "./PrPage";
import QuickNotePage from "./QuickNotePage";
import JsonPage from "./JsonPage";
import ColorPage from "./ColorPage";
import TodayPage from "./TodayPage";
import "./HomePage.css";

// A tool's `screen` names the component that opens for it. Anything without a
// screen falls through to the placeholder detail panel.
const SCREENS = {
  plans: PlansPage,
  projects: ProjectsPage,
  notes: NotesPage,
  grammar: GrammarPage,
  pr: PrPage,
  quicknote: QuickNotePage,
  json: JsonPage,
  color: ColorPage,
  today: TodayPage,
};

function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function ToolCard({ tool, onOpen }) {
  const Icon = tool.icon;

  return (
    <button
      type="button"
      className="tool-card"
      data-accent={tool.accent}
      onClick={() => onOpen(tool)}
    >
      <span className="tool-chip" aria-hidden="true">
        <Icon />
      </span>

      <span className="tool-name">{tool.name}</span>
      <span className="tool-description">{tool.description}</span>

      <span className="tool-foot">
        {tool.ready ? (
          <>
            Open <ArrowRightIcon />
          </>
        ) : (
          <span className="tool-soon">Coming soon</span>
        )}
      </span>
    </button>
  );
}

function ToolDetail({ tool, onBack }) {
  const Icon = tool.icon;

  return (
    <section className="tool-detail" data-accent={tool.accent}>
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeftIcon />
        All tools
      </button>

      <span className="tool-chip large" aria-hidden="true">
        <Icon />
      </span>

      <h1>{tool.name}</h1>
      <p>{tool.description}</p>

      <p className="tool-note">
        This one is not built yet — it is the next thing to drop into this slot.
      </p>
    </section>
  );
}

function HomePage({ user, token, onSignOut }) {
  const [openTool, setOpenTool] = useState(null);

  const OpenScreen = openTool ? SCREENS[openTool.screen] : null;
  const closeTool = () => setOpenTool(null);

  return (
    <div className="home">
      <NavBar user={user} onSignOut={onSignOut} />

      <main className="home-main">
        {OpenScreen ? (
          <OpenScreen tool={openTool} token={token} onBack={closeTool} />
        ) : openTool ? (
          <ToolDetail tool={openTool} onBack={closeTool} />
        ) : (
          <>
            <section className="home-head">
              <p className="eyebrow">Your workspace</p>
              <h1>
                {greetingFor(new Date())}, {user?.username}
              </h1>
              <p className="home-sub">
                Every day tools in one place. Pick one to get started.
              </p>
            </section>

            <section className="tool-grid" aria-label="Tools">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} onOpen={setOpenTool} />
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default HomePage;
