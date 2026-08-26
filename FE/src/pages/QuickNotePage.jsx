import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  PlusIcon,
  TrashIcon,
} from "../components/icons";
import { apiFetch } from "../lib/api";
import "../styles/tool.css";
import "./QuickNotePage.css";

const TEXT_MAX = 2000;

const when = (value) => {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();

  // A note written today only needs a time; older ones need the date.
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

function NoteCard({ note, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [copied, setCopied] = useState(false);
  const [armed, setArmed] = useState(false);

  const areaRef = useRef(null);
  const copyTimer = useRef(null);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (editing) areaRef.current?.focus();
  }, [editing]);

  const save = () => {
    setEditing(false);
    const next = draft.trim();
    // An empty edit is a slip, not a request to delete; keep what was there.
    if (next && next !== note.text) onSave(note, next);
    else setDraft(note.text);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note.text);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked - the text is on screen and selectable anyway */
    }
  };

  return (
    <li className="qn-card" data-editing={editing || undefined}>
      {editing ? (
        <textarea
          ref={areaRef}
          className="field field-area qn-edit"
          value={draft}
          maxLength={TEXT_MAX}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(note.text);
              setEditing(false);
            }
            // Enter makes a new line here; Ctrl+Enter is "done".
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") event.currentTarget.blur();
          }}
        />
      ) : (
        <button
          type="button"
          className="qn-text"
          title="Click to edit"
          onClick={() => {
            setDraft(note.text);
            setEditing(true);
          }}
        >
          {note.text}
        </button>
      )}

      <footer className="qn-foot">
        <time className="meta" dateTime={note.createdAt}>
          {when(note.createdAt)}
          {note.updatedAt !== note.createdAt && " · edited"}
        </time>

        <div className="qn-foot-actions">
          <button
            type="button"
            className="qn-action"
            data-copied={copied || undefined}
            aria-label={`Copy note`}
            title="Copy"
            onClick={copy}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>

          <button
            type="button"
            className="qn-action qn-delete"
            data-armed={armed || undefined}
            aria-label={armed ? "Confirm delete note" : "Delete note"}
            onClick={() => (armed ? onDelete(note) : setArmed(true))}
            onBlur={() => setArmed(false)}
          >
            {armed ? "Sure?" : <TrashIcon />}
          </button>
        </div>
      </footer>
    </li>
  );
}

function QuickNotePage({ tool, token, onBack }) {
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState("loading");
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const inputRef = useRef(null);

  const call = useCallback((path, options) => apiFetch(path, { token, ...options }), [token]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await call("/quick-notes");
        if (cancelled) return;
        setNotes(data.data);
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

  const optimistic = async (next, request) => {
    const previous = notes;
    setNotes(next);
    setError(null);

    try {
      await request();
    } catch (err) {
      setNotes(previous);
      setError(err.message);
    }
  };

  const handleAdd = async (event) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value || adding) return;

    setAdding(true);
    setError(null);

    try {
      const data = await call("/quick-notes", { method: "POST", body: { text: value } });
      // Newest first, matching the order the server returns.
      setNotes((current) => [data.data, ...current]);
      setText("");
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleSave = (note, next) =>
    optimistic(
      notes.map((entry) => (entry.id === note.id ? { ...entry, text: next } : entry)),
      () => call(`/quick-notes/${note.id}`, { method: "PATCH", body: { text: next } }),
    );

  const handleDelete = (note) =>
    optimistic(
      notes.filter((entry) => entry.id !== note.id),
      () => call(`/quick-notes/${note.id}`, { method: "DELETE" }),
    );

  // The whole point is speed, so Ctrl+Enter saves without reaching for the
  // button, and Enter alone still makes a new line.
  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") handleAdd();
  };

  return (
    <section className="tool qn" data-accent={tool.accent}>
      <header className="tool-head">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeftIcon />
          All tools
        </button>

        <h1>{tool.name}</h1>
        <p className="tool-sub">{tool.description}</p>
      </header>

      <form className="card" onSubmit={handleAdd}>
        <section className="block">
          <div className="block-head">
            <h2 className="heading">New note</h2>
            <span className="meta">
              {text.length} / {TEXT_MAX}
            </span>
          </div>

          <textarea
            ref={inputRef}
            className="field field-area qn-input"
            value={text}
            rows={3}
            maxLength={TEXT_MAX}
            placeholder="Jot it down before it goes..."
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </section>

        <footer className="bar">
          <span className="meta">
            {notes.length === 0
              ? "Nothing saved yet"
              : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
          </span>

          <div className="bar-end">
            <kbd className="kbd">Ctrl + Enter</kbd>
            <button type="submit" className="btn btn-primary" disabled={!text.trim() || adding}>
              <PlusIcon />
              {adding ? "Adding" : "Add note"}
            </button>
          </div>
        </footer>
      </form>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {status === "loading" && <p className="meta qn-status">Loading your notes...</p>}

      {status === "ready" && notes.length === 0 && (
        <div className="qn-empty">
          <p className="qn-empty-title">No quick notes</p>
          <p>
            This one is for things that need catching, not filing. Anything worth keeping properly
            belongs in the Notepad.
          </p>
        </div>
      )}

      {notes.length > 0 && <ul className="qn-list">{notes.map((note) => (
        <NoteCard key={note.id} note={note} onSave={handleSave} onDelete={handleDelete} />
      ))}</ul>}
    </section>
  );
}

export default QuickNotePage;
