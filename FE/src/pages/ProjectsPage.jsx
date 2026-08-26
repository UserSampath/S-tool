import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, PinIcon, PlusIcon, TrashIcon } from "../components/icons";
import { apiFetch } from "../lib/api";
import "./ProjectsPage.css";

// Mirrors the server's sort (pinned first, then newest) so an optimistic
// update lands the row exactly where the server would have put it.
const inOrder = (list) =>
  [...list].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt) - new Date(a.createdAt),
  );

function ProjectRow({ project, armed, onPin, onRename, onDelete, onArm }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const save = () => {
    setEditing(false);
    const next = draft.trim();
    // An empty edit is a slip, not a request to delete; keep what was there.
    if (next && next !== project.name) onRename(project, next);
    else setDraft(project.name);
  };

  return (
    <li className="project-row" data-pinned={project.pinned || undefined}>
      <button
        type="button"
        className="project-pin"
        aria-pressed={project.pinned}
        aria-label={project.pinned ? `Unpin ${project.name}` : `Pin ${project.name} to the top`}
        title={project.pinned ? "Unpin" : "Pin to the top"}
        onClick={() => onPin(project, !project.pinned)}
      >
        <PinIcon filled={project.pinned} />
      </button>

      {editing ? (
        <input
          ref={inputRef}
          className="project-name-input"
          value={draft}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") {
              setDraft(project.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="project-name"
          onClick={() => {
            setDraft(project.name);
            setEditing(true);
          }}
          title="Click to rename"
        >
          {project.name}
        </button>
      )}

      <button
        type="button"
        className="project-delete"
        data-armed={armed || undefined}
        aria-label={armed ? `Confirm delete ${project.name}` : `Delete ${project.name}`}
        onClick={() => (armed ? onDelete(project) : onArm(project.id))}
        onBlur={() => armed && onArm(null)}
      >
        {armed ? "Sure?" : <TrashIcon />}
      </button>
    </li>
  );
}

function ProjectsPage({ tool, token, onBack }) {
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [armedId, setArmedId] = useState(null);

  const addRef = useRef(null);

  const call = useCallback((path, options) => apiFetch(path, { token, ...options }), [token]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("loading");
      try {
        const data = await call("/projects");
        if (cancelled) return;
        setProjects(data.data);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [call]);

  const [pinned, rest] = useMemo(
    () => [projects.filter((p) => p.pinned), projects.filter((p) => !p.pinned)],
    [projects],
  );

  // Applies a change locally first so the UI never waits on the network. On
  // failure the previous list is restored and the reason is shown.
  const optimistic = async (next, request) => {
    const previous = projects;
    setProjects(next);
    setError(null);

    try {
      await request();
    } catch (err) {
      setProjects(previous);
      setError(err.message);
    }
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    const value = name.trim();
    if (!value || adding) return;

    setAdding(true);
    setError(null);

    try {
      const data = await call("/projects", { method: "POST", body: { name: value } });
      setProjects((current) => inOrder([...current, data.data]));
      setName("");
      // Adding one project usually means adding several; keep the cursor here.
      addRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const patchProject = (project, patch, resort = false) => {
    const next = projects.map((entry) =>
      entry.id === project.id ? { ...entry, ...patch } : entry,
    );

    return optimistic(resort ? inOrder(next) : next, () =>
      call(`/projects/${project.id}`, { method: "PATCH", body: patch }),
    );
  };

  const handleDelete = (project) => {
    setArmedId(null);
    optimistic(
      projects.filter((entry) => entry.id !== project.id),
      () => call(`/projects/${project.id}`, { method: "DELETE" }),
    );
  };

  const renderRows = (list) =>
    list.map((project) => (
      <ProjectRow
        key={project.id}
        project={project}
        armed={armedId === project.id}
        onPin={(entry, next) => patchProject(entry, { pinned: next }, true)}
        onRename={(entry, next) => patchProject(entry, { name: next })}
        onDelete={handleDelete}
        onArm={setArmedId}
      />
    ));

  return (
    <section className="projects" data-accent={tool.accent}>
      <header className="projects-head">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeftIcon />
          All tools
        </button>

        <h1>{tool.name}</h1>
        <p className="projects-sub">{tool.description}</p>
      </header>

      <form className="project-add" onSubmit={handleAdd}>
        <input
          ref={addRef}
          value={name}
          maxLength={120}
          placeholder="Name a project"
          onChange={(event) => setName(event.target.value)}
          aria-label="New project"
        />
        <button type="submit" disabled={!name.trim() || adding}>
          <PlusIcon />
          {adding ? "Adding" : "Add"}
        </button>
      </form>

      {error && (
        <p className="projects-error" role="alert">
          {error}
        </p>
      )}

      {status === "loading" && <p className="projects-note">Loading your projects...</p>}

      {status === "ready" && projects.length === 0 && (
        <div className="projects-empty">
          <p className="projects-empty-title">No projects yet</p>
          <p>Add the things you are actually working on. Pin the ones you are in right now.</p>
        </div>
      )}

      {pinned.length > 0 && (
        <section className="projects-group">
          <h2 className="projects-group-title">
            <PinIcon filled />
            Pinned
          </h2>
          <ul className="project-list">{renderRows(pinned)}</ul>
        </section>
      )}

      {rest.length > 0 && (
        <section className="projects-group">
          {/* Only worth a heading once something is pinned above it. */}
          {pinned.length > 0 && <h2 className="projects-group-title">Everything else</h2>}
          <ul className="project-list">{renderRows(rest)}</ul>
        </section>
      )}
    </section>
  );
}

export default ProjectsPage;
