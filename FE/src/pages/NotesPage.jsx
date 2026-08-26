import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ChevronIcon,
  FolderIcon,
  FolderPlusIcon,
  NoteIcon,
  NotePlusIcon,
  TrashIcon,
} from "../components/icons";
import RichTextEditor from "../components/RichTextEditor";
import { apiFetch } from "../lib/api";
import "./NotesPage.css";

const SAVE_DELAY = 700;
const SPRING_OPEN_DELAY = 600;
const ROOT = "root";

function NotesPage({ tool, token, onBack }) {
  const [nodes, setNodes] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [armedId, setArmedId] = useState(null);
  const [saveState, setSaveState] = useState("idle");

  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const saveTimer = useRef(null);
  const pending = useRef(null);
  const springTimer = useRef(null);
  const renameRef = useRef(null);

  const call = useCallback((path, options) => apiFetch(path, { token, ...options }), [token]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("loading");
      try {
        const data = await call("/notes");
        if (cancelled) return;
        setNodes(data.data);
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

  useEffect(() => {
    if (renamingId) renameRef.current?.select();
  }, [renamingId]);

  // Children keyed by parent id, each already in order.
  const childrenOf = useMemo(() => {
    const map = new Map();

    for (const node of nodes) {
      const key = node.parent ?? ROOT;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(node);
    }

    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  }, [nodes]);

  const kids = useCallback((id) => childrenOf.get(id ?? ROOT) ?? [], [childrenOf]);

  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  // Ids at or below `id`. The server refuses a folder dropped into its own
  // subtree; knowing it here means the UI never offers the drop in the first
  // place.
  const subtreeOf = useCallback(
    (id) => {
      const out = new Set([id]);
      const walk = (parentId) => {
        for (const child of kids(parentId)) {
          out.add(child.id);
          if (child.kind === "folder") walk(child.id);
        }
      };
      walk(id);
      return out;
    },
    [kids],
  );

  /* ---------- saving ---------- */

  // Pending edits carry the id they belong to: switching notes mid-save must
  // write the text back to the note it was typed in, not the new one.
  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);

    const job = pending.current;
    if (!job) return;
    pending.current = null;

    setSaveState("saving");
    try {
      const data = await call(`/notes/${job.id}`, {
        method: "PATCH",
        body: { content: job.html },
      });
      setNodes((current) =>
        current.map((node) => (node.id === job.id ? { ...node, content: data.data.content } : node)),
      );
      setSaveState("saved");
    } catch (err) {
      setError(err.message);
      setSaveState("error");
    }
  }, [call]);

  const scheduleSave = (id, html) => {
    pending.current = { id, html };
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, SAVE_DELAY);
  };

  // Leaving the page with an unsaved edit would lose it.
  useEffect(() => () => flush(), [flush]);

  const selectNote = async (node) => {
    if (node.id === selectedId) return;
    await flush();
    setSelectedId(node.id);
    setSaveState("idle");
  };

  /* ---------- mutations ---------- */

  const optimistic = async (next, request) => {
    const previous = nodes;
    setNodes(next);
    setError(null);

    try {
      await request();
    } catch (err) {
      setNodes(previous);
      setError(err.message);
    }
  };

  const addNode = async (kind) => {
    // New items go inside the selected folder, or alongside the selected note.
    const parent = selected
      ? selected.kind === "folder"
        ? selected.id
        : selected.parent
      : null;

    setError(null);

    try {
      const data = await call("/notes", {
        method: "POST",
        body: { kind, title: kind === "folder" ? "New folder" : "Untitled note", parent },
      });

      setNodes((current) => [...current, data.data]);
      if (kind === "note") setSelectedId(data.data.id);
      // A new item is always named straight away, so open the rename inline.
      setRenamingId(data.data.id);
      setDraft(data.data.title);
    } catch (err) {
      setError(err.message);
    }
  };

  const rename = (node, title) =>
    optimistic(
      nodes.map((entry) => (entry.id === node.id ? { ...entry, title } : entry)),
      () => call(`/notes/${node.id}`, { method: "PATCH", body: { title } }),
    );

  const toggleCollapsed = (node) =>
    optimistic(
      nodes.map((entry) =>
        entry.id === node.id ? { ...entry, collapsed: !entry.collapsed } : entry,
      ),
      () => call(`/notes/${node.id}`, { method: "PATCH", body: { collapsed: !node.collapsed } }),
    );

  const remove = (node) => {
    setArmedId(null);

    const doomed = node.kind === "folder" ? subtreeOf(node.id) : new Set([node.id]);
    if (doomed.has(selectedId)) setSelectedId(null);
    // Do not write a pending edit back to a note that is being deleted.
    if (pending.current && doomed.has(pending.current.id)) pending.current = null;

    optimistic(
      nodes.filter((entry) => !doomed.has(entry.id)),
      () => call(`/notes/${node.id}`, { method: "DELETE" }),
    );
  };

  /* ---------- drag and drop ---------- */

  const clearSpring = () => clearTimeout(springTimer.current);

  const handleDragStart = (event, node) => {
    setDragId(node.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", node.id);
  };

  const handleDragOver = (event, node) => {
    if (!dragId) return;

    // Dropping a folder into its own subtree would detach the branch.
    const forbidden = subtreeOf(dragId);
    if (forbidden.has(node.id)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const { top, height } = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - top) / height;

    // A folder gets three zones - the middle means "put it inside". A note has
    // no inside, so it splits in two.
    let position;
    if (node.kind === "folder") position = ratio < 0.28 ? "before" : ratio > 0.72 ? "after" : "inside";
    else position = ratio < 0.5 ? "before" : "after";

    setDropTarget((current) =>
      current && current.id === node.id && current.position === position
        ? current
        : { id: node.id, position },
    );

    // Hovering over a closed folder opens it, so a drop can be aimed at
    // something the user cannot currently see.
    if (position === "inside" && node.collapsed) {
      if (!springTimer.current) {
        springTimer.current = setTimeout(() => {
          springTimer.current = null;
          toggleCollapsed(node);
        }, SPRING_OPEN_DELAY);
      }
    } else {
      clearSpring();
      springTimer.current = null;
    }
  };

  const endDrag = () => {
    clearSpring();
    springTimer.current = null;
    setDragId(null);
    setDropTarget(null);
  };

  const moveNode = (id, parent, index) =>
    optimistic(nodes, () =>
      call(`/notes/${id}/move`, { method: "PATCH", body: { parent, index } }),
    ).then(async () => {
      // Order and parentage are the server's to decide, so take the tree back
      // rather than guessing at it locally.
      try {
        const data = await call("/notes");
        setNodes(data.data);
      } catch (err) {
        setError(err.message);
      }
    });

  const handleDrop = (event, node) => {
    event.preventDefault();
    const position = dropTarget?.position;
    // subtreeOf includes the node itself, so this covers dropping a row on top
    // of itself as well as a folder into its own contents.
    if (!dragId || !position || subtreeOf(dragId).has(node.id)) return endDrag();

    let parent;
    let index;

    if (position === "inside") {
      parent = node.id;
      index = kids(node.id).filter((child) => child.id !== dragId).length;
    } else {
      parent = node.parent;
      // The index has to be read from the list *without* the dragged node,
      // which is what the server splices into. Counting it would put the row
      // one place too far down whenever it moves forward in its own folder.
      const siblings = kids(node.parent).filter((child) => child.id !== dragId);
      const at = siblings.findIndex((child) => child.id === node.id);
      // Not found means the target was the dragged row itself. Left alone, the
      // -1 would become index 0 and quietly send the row to the top.
      if (at === -1) return endDrag();

      index = position === "after" ? at + 1 : at;
    }

    moveNode(dragId, parent, index);
    endDrag();
  };

  // Dropping below the tree moves an item back out to the top level.
  const handleRootDrop = (event) => {
    event.preventDefault();
    if (!dragId) return endDrag();

    const siblings = kids(null).filter((child) => child.id !== dragId);
    moveNode(dragId, null, siblings.length);
    endDrag();
  };

  /* ---------- rendering ---------- */

  const renderRow = (node, depth) => {
    const isFolder = node.kind === "folder";
    const open = isFolder && !node.collapsed;
    const children = kids(node.id);

    return (
      <li key={node.id}>
        <div
          className="tree-row"
          data-kind={node.kind}
          data-selected={node.id === selectedId || undefined}
          data-dragging={node.id === dragId || undefined}
          data-drop={dropTarget?.id === node.id ? dropTarget.position : undefined}
          style={{ "--depth": depth }}
          draggable={renamingId !== node.id}
          onDragStart={(event) => handleDragStart(event, node)}
          onDragOver={(event) => handleDragOver(event, node)}
          onDrop={(event) => handleDrop(event, node)}
          onDragEnd={endDrag}
          onDragLeave={clearSpring}
        >
          {isFolder ? (
            <button
              type="button"
              className="tree-twisty"
              data-open={open || undefined}
              aria-label={open ? `Collapse ${node.title}` : `Expand ${node.title}`}
              aria-expanded={open}
              onClick={() => toggleCollapsed(node)}
            >
              <ChevronIcon />
            </button>
          ) : (
            <span className="tree-twisty" aria-hidden="true" />
          )}

          <span className="tree-icon" aria-hidden="true">
            {isFolder ? <FolderIcon open={open} /> : <NoteIcon />}
          </span>

          {renamingId === node.id ? (
            <input
              ref={renameRef}
              className="tree-rename"
              value={draft}
              maxLength={120}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                const next = draft.trim();
                if (next && next !== node.title) rename(node, next);
                setRenamingId(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  setDraft(node.title);
                  setRenamingId(null);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="tree-label"
              onClick={() => (isFolder ? toggleCollapsed(node) : selectNote(node))}
              onDoubleClick={() => {
                setRenamingId(node.id);
                setDraft(node.title);
              }}
              title={isFolder ? "Click to open, double-click to rename" : "Double-click to rename"}
            >
              {node.title}
            </button>
          )}

          <button
            type="button"
            className="tree-delete"
            data-armed={armedId === node.id || undefined}
            aria-label={
              armedId === node.id
                ? `Confirm delete ${node.title}`
                : `Delete ${node.title}`
            }
            title={
              isFolder && children.length
                ? `Deletes ${node.title} and everything inside it`
                : "Delete"
            }
            onClick={() => (armedId === node.id ? remove(node) : setArmedId(node.id))}
            onBlur={() => armedId === node.id && setArmedId(null)}
          >
            {armedId === node.id ? "Sure?" : <TrashIcon />}
          </button>
        </div>

        {open && children.length > 0 && (
          <ul className="tree-children">{children.map((child) => renderRow(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  const roots = kids(null);

  return (
    <section className="notes" data-accent={tool.accent}>
      <header className="notes-head">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeftIcon />
          All tools
        </button>

        <h1>{tool.name}</h1>
        <p className="notes-sub">{tool.description}</p>
      </header>

      {error && (
        <p className="notes-error" role="alert">
          {error}
        </p>
      )}

      <div className="notes-layout">
        <aside className="notes-tree" aria-label="Folders and notes">
          <div className="notes-tree-actions">
            <button type="button" onClick={() => addNode("folder")} title="New folder">
              <FolderPlusIcon />
              Folder
            </button>
            <button type="button" onClick={() => addNode("note")} title="New note">
              <NotePlusIcon />
              Note
            </button>
          </div>

          {status === "loading" && <p className="notes-note">Loading...</p>}

          {status === "ready" && roots.length === 0 && (
            <p className="notes-note">
              Nothing here yet. Make a folder, or start with a single note.
            </p>
          )}

          {roots.length > 0 && <ul className="tree-root">{roots.map((node) => renderRow(node, 0))}</ul>}

          {/* Somewhere to drop an item to get it back out to the top level. */}
          <div
            className="tree-rootzone"
            data-active={dragId ? true : undefined}
            onDragOver={(event) => {
              if (dragId) event.preventDefault();
            }}
            onDrop={handleRootDrop}
          >
            Drop here for the top level
          </div>
        </aside>

        <div className="notes-editor">
          {selected && selected.kind === "note" ? (
            <>
              <div className="notes-editor-head">
                <h2>{selected.title}</h2>
                <span className="notes-save" data-state={saveState}>
                  {
                    {
                      saving: "Saving...",
                      saved: "Saved",
                      error: "Not saved",
                      idle: "",
                    }[saveState]
                  }
                </span>
              </div>

              <RichTextEditor
                noteId={selected.id}
                initialHtml={selected.content}
                onChange={(html) => scheduleSave(selected.id, html)}
                onFlush={flush}
              />
            </>
          ) : (
            <div className="notes-placeholder">
              <NoteIcon />
              <p>Pick a note on the left, or make a new one.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default NotesPage;
