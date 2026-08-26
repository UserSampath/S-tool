import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronIcon,
  CopyIcon,
  GrammarIcon,
  PlusIcon,
  TrashIcon,
} from "../components/icons";
import LoadingOverlay from "../components/LoadingOverlay";
import { apiFetch } from "../lib/api";
import "../styles/tool.css";
import "./GrammarPage.css";

const TEXT_MAX = 12000;
const INSTRUCTION_MAX = 200;

const shortDate = (value) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function HistoryEntry({ entry, onReuse, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="history-entry" data-open={open || undefined}>
      <button
        type="button"
        className="history-summary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="twisty" aria-hidden="true">
          <ChevronIcon />
        </span>
        <span className="history-preview">{entry.input}</span>
        <span className="history-meta">
          {entry.format !== "plain" && <span className="tag">{entry.format}</span>}
          {entry.instructions.length > 0 && <span className="tag">{entry.instructions.length}×</span>}
          <time dateTime={entry.createdAt}>{shortDate(entry.createdAt)}</time>
        </span>
      </button>

      {open && (
        <div className="history-detail">
          <div className="history-panes">
            <div className="history-pane">
              <h4 className="heading">Input</h4>
              <p>{entry.input}</p>
            </div>
            <div className="history-pane">
              <h4 className="heading">Output</h4>
              <p>{entry.output}</p>
            </div>
          </div>

          {entry.instructions.length > 0 && (
            <ul className="history-used">
              {entry.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
          )}

          <div className="history-actions">
            <button type="button" className="btn btn-quiet" onClick={() => onReuse(entry)}>
              Load into the editor
            </button>
            <button type="button" className="btn btn-quiet btn-danger" onClick={() => onDelete(entry)}>
              <TrashIcon />
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function GrammarPage({ tool, token, onBack }) {
  const [text, setText] = useState("");
  const [extra, setExtra] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [presets, setPresets] = useState([]);
  const [formats, setFormats] = useState([]);
  const [format, setFormat] = useState("plain");

  const [newPreset, setNewPreset] = useState("");
  const [addingPreset, setAddingPreset] = useState(false);

  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  // Collapsed by default: most runs are a plain correction, and the chips are
  // a detour when you just want to paste and go. The header still shows how
  // many are switched on, so a closed section never hides an active setting.
  const [showInstructions, setShowInstructions] = useState(false);

  const copyTimer = useRef(null);

  const call = useCallback((path, options) => apiFetch(path, { token, ...options }), [token]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [presetData, formatData, historyData] = await Promise.all([
          call("/grammar/presets"),
          call("/grammar/formats"),
          call("/grammar/history"),
        ]);
        if (cancelled) return;

        setPresets(presetData.data);
        setFormats(formatData.data);
        setFormat(formatData.default);
        setHistory(historyData.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [call]);

  // The chips that are switched on, plus anything typed in the one-off box.
  const chosenInstructions = () => {
    const list = presets.filter((preset) => selected.has(preset.id)).map((preset) => preset.text);
    const typed = extra.trim();
    return typed ? [...list, typed] : list;
  };

  const toggle = (preset) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(preset.id)) next.delete(preset.id);
      else next.add(preset.id);
      return next;
    });

  const canSend = text.trim().length > 0 && !busy;
  const activeCount = chosenInstructions().length;

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (!canSend) return;

    setBusy(true);
    setError(null);

    try {
      const data = await call("/grammar", {
        method: "POST",
        body: { text: text.trim(), instructions: chosenInstructions(), format },
      });
      setResult(data.data);

      const fresh = await call("/grammar/history");
      setHistory(fresh.data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const handleAddPreset = async (event) => {
    event.preventDefault();
    const value = newPreset.trim();
    if (!value || addingPreset) return;

    setAddingPreset(true);
    setError(null);

    try {
      const data = await call("/grammar/presets", { method: "POST", body: { text: value } });
      setPresets((current) => [...current, data.data]);
      // A just-added instruction is one you meant to use.
      setSelected((current) => new Set(current).add(data.data.id));
      setNewPreset("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingPreset(false);
    }
  };

  const handleRemovePreset = async (preset) => {
    const previous = presets;
    setPresets((current) => current.filter((entry) => entry.id !== preset.id));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(preset.id);
      return next;
    });

    try {
      await call(`/grammar/presets/${preset.id}`, { method: "DELETE" });
    } catch (err) {
      setPresets(previous);
      setError(err.message);
    }
  };

  const handleDeleteRun = async (entry) => {
    const previous = history;
    setHistory((current) => current.filter((run) => run.id !== entry.id));

    try {
      await call(`/grammar/history/${entry.id}`, { method: "DELETE" });
    } catch (err) {
      setHistory(previous);
      setError(err.message);
    }
  };

  const handleClearHistory = async () => {
    const previous = history;
    setHistory([]);

    try {
      await call("/grammar/history", { method: "DELETE" });
    } catch (err) {
      setHistory(previous);
      setError(err.message);
    }
  };

  const handleReuse = (entry) => {
    setText(entry.input);
    setFormat(entry.format);
    setResult({ text: entry.output, format: entry.format });
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopy = async () => {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy to the clipboard.");
    }
  };

  const handleClear = () => {
    setText("");
    setExtra("");
    setSelected(new Set());
    setResult(null);
    setError(null);
  };

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") handleSubmit();
  };

  return (
    <section className="tool grammar" data-accent={tool.accent}>
      <LoadingOverlay show={busy} accent={tool.accent} label="Checking your text" />

      <header className="tool-head">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeftIcon />
          All tools
        </button>

        <h1>{tool.name}</h1>
        <p className="tool-sub">{tool.description}</p>
      </header>

      <form className="card" onSubmit={handleSubmit}>
        <section className="block">
          <div className="block-head">
            <h2 className="heading">Your text</h2>
            <span className="meta">
              {text.length.toLocaleString()} / {TEXT_MAX.toLocaleString()}
            </span>
          </div>

          <textarea
            className="field field-area"
            value={text}
            rows={5}
            maxLength={TEXT_MAX}
            placeholder="Paste or type the text you want corrected..."
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </section>

        <section className="block" data-collapsed={!showInstructions || undefined}>
          <button
            type="button"
            className="block-head block-head-button"
            aria-expanded={showInstructions}
            onClick={() => setShowInstructions((value) => !value)}
          >
            <span className="twisty" data-open={showInstructions || undefined} aria-hidden="true">
              <ChevronIcon />
            </span>
            <h2 className="heading">Additional instructions</h2>
            {/* An active count reads as a tag so it is visible while closed;
                "none" stays quiet so it does not look like a setting. */}
            {activeCount > 0 ? (
              <span className="tag">{activeCount} on</span>
            ) : (
              <span className="meta">none</span>
            )}
          </button>

          {/* Chips are toggles, not a single choice - any number can be on at
              once, and they stack in the order they are listed. */}
          <div className="chips">
            {presets.map((preset) => (
              <span key={preset.id} className="chip" data-active={selected.has(preset.id) || undefined}>
                <button type="button" className="chip-toggle" onClick={() => toggle(preset)}>
                  <span className="chip-tick" aria-hidden="true">
                    <CheckIcon />
                  </span>
                  {preset.text}
                </button>
                <button
                  type="button"
                  className="chip-remove"
                  aria-label={`Remove instruction: ${preset.text}`}
                  title="Remove this instruction"
                  onClick={() => handleRemovePreset(preset)}
                >
                  ×
                </button>
              </span>
            ))}

            {presets.length === 0 && <span className="meta">No saved instructions yet.</span>}
          </div>

          <div className="row">
            <input
              className="field field-dashed"
              value={newPreset}
              maxLength={INSTRUCTION_MAX}
              placeholder="Save a new instruction, e.g. keep it under 100 words"
              aria-label="New saved instruction"
              onChange={(event) => setNewPreset(event.target.value)}
              onKeyDown={(event) => {
                // Enter here must not submit the whole form.
                if (event.key === "Enter") handleAddPreset(event);
              }}
            />
            <button
              type="button"
              className="btn btn-quiet"
              disabled={!newPreset.trim() || addingPreset}
              onClick={handleAddPreset}
            >
              <PlusIcon />
              Save
            </button>
          </div>

          <input
            className="field"
            value={extra}
            maxLength={500}
            placeholder="Or a one-off instruction, just for this run"
            aria-label="One-off instruction"
            onChange={(event) => setExtra(event.target.value)}
          />
        </section>

        {/* Everything that acts sits on one bar: what to produce on the left,
            what to do about it on the right. */}
        <footer className="bar">
          <label className="select">
            <span className="meta">Output</span>
            <select value={format} onChange={(event) => setFormat(event.target.value)}>
              {formats.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <div className="bar-end">
            {(text || result) && (
              <button type="button" className="btn btn-quiet btn-danger" onClick={handleClear}>
                Clear
              </button>
            )}

            <kbd className="kbd">Ctrl + Enter</kbd>

            {/* The overlay carries the loading signal now, so the button just
                goes quiet rather than running a second spinner of its own. */}
            <button type="submit" className="btn btn-primary" disabled={!canSend}>
              <GrammarIcon />
              Correct
            </button>
          </div>
        </footer>
      </form>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {result && (
        <section className="card card-result" aria-live="polite">
          <div className="card-head">
            <h2 className="heading">Corrected</h2>
            <div className="card-tools">
              {result.format !== "plain" && <span className="tag">{result.format}</span>}
              <button type="button" className="btn btn-quiet" data-copied={copied || undefined} onClick={handleCopy}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Markdown and HTML are shown as source on purpose - the point of
              asking for them is to take the raw text somewhere else. */}
          <p className="output" data-format={result.format}>
            {result.text}
          </p>
        </section>
      )}

      <section className="card card-history">
        <button
          type="button"
          className="card-head card-head-button"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((value) => !value)}
        >
          <span className="twisty" data-open={showHistory || undefined} aria-hidden="true">
            <ChevronIcon />
          </span>
          <h2 className="heading">Past fixes</h2>
          <span className="tag">{history.length}</span>
        </button>

        {showHistory &&
          (history.length === 0 ? (
            <p className="card-body meta">Nothing yet. Corrections you run are kept here.</p>
          ) : (
            <div className="card-body">
              <ul className="history-list">
                {history.map((entry) => (
                  <HistoryEntry
                    key={entry.id}
                    entry={entry}
                    onReuse={handleReuse}
                    onDelete={handleDeleteRun}
                  />
                ))}
              </ul>

              <button type="button" className="btn btn-quiet btn-danger" onClick={handleClearHistory}>
                <TrashIcon />
                Clear all history
              </button>
            </div>
          ))}
      </section>
    </section>
  );
}

export default GrammarPage;
