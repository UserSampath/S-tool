import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  PullRequestIcon,
} from "../components/icons";
import LoadingOverlay from "../components/LoadingOverlay";
import { apiFetch } from "../lib/api";
import "../styles/tool.css";
import "./PrPage.css";

const DETAILS_MAX = 12000;

// Branch name and commit message are single lines meant to be pasted into a
// terminal; the description is a markdown document.
const SINGLE_LINE = new Set(["branch", "commit"]);

function ResultCard({ id, label, value }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked - the text is on screen and selectable anyway */
    }
  };

  return (
    <section className="card card-result">
      <div className="card-head">
        <h2 className="heading">{label}</h2>
        <div className="card-tools">
          <button type="button" className="btn btn-quiet" data-copied={copied || undefined} onClick={copy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Everything here is source to be pasted somewhere else, so all three
          render as code rather than prose. */}
      <p className="output output-code" data-single={SINGLE_LINE.has(id) || undefined}>
        {value}
      </p>
    </section>
  );
}

function PrPage({ tool, token, onBack }) {
  const [details, setDetails] = useState("");
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(() => new Set());

  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const call = useCallback((path, opts) => apiFetch(path, { token, ...opts }), [token]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await call("/pr/outputs");
        if (cancelled) return;

        setOptions(data.data);
        // Everything ticked to begin with - opening a PR usually needs all three.
        setSelected(new Set(data.default));
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [call]);

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSend = details.trim().length > 0 && selected.size > 0 && !busy;

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (!canSend) return;

    setBusy(true);
    setError(null);

    try {
      const data = await call("/pr", {
        method: "POST",
        body: { details: details.trim(), outputs: [...selected] },
      });
      setResult(data.data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") handleSubmit();
  };

  return (
    <section className="tool pr" data-accent={tool.accent}>
      <LoadingOverlay show={busy} accent={tool.accent} label="Writing your PR" />

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
            <h2 className="heading">Details</h2>
            <span className="meta">
              {details.length.toLocaleString()} / {DETAILS_MAX.toLocaleString()}
            </span>
          </div>

          <textarea
            className="field field-area pr-details"
            value={details}
            rows={8}
            maxLength={DETAILS_MAX}
            placeholder={
              "Describe what you changed and why.\n\nWhat the change does, which areas it touches (UI, API, routing, components), and any files added, changed or removed."
            }
            onChange={(event) => setDetails(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </section>

        <section className="block">
          <div className="block-head">
            <h2 className="heading">Generate</h2>
            <span className="meta">{selected.size} of {options.length}</span>
          </div>

          <div className="pr-options">
            {options.map((option) => (
              <label key={option.id} className="pr-option" data-on={selected.has(option.id) || undefined}>
                <input
                  type="checkbox"
                  checked={selected.has(option.id)}
                  onChange={() => toggle(option.id)}
                />
                <span className="pr-box" aria-hidden="true">
                  <CheckIcon />
                </span>
                <span className="pr-option-label">{option.label}</span>
              </label>
            ))}
          </div>

          {/* Unticking everything is allowed while you decide, but there is
              nothing to ask for, so say why the button is off. */}
          {options.length > 0 && selected.size === 0 && (
            <p className="meta">Pick at least one thing to generate.</p>
          )}
        </section>

        <footer className="bar">
          <span className="meta">Written by Gemini from your description</span>

          <div className="bar-end">
            <kbd className="kbd">Ctrl + Enter</kbd>
            <button type="submit" className="btn btn-primary" disabled={!canSend}>
              <PullRequestIcon />
              Generate
            </button>
          </div>
        </footer>
      </form>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {result &&
        options
          // Rendered in the order the checkboxes are listed, not the order the
          // model happened to answer in.
          .filter((option) => result.outputs[option.id])
          .map((option) => (
            <ResultCard
              key={option.id}
              id={option.id}
              label={option.label}
              value={result.outputs[option.id]}
            />
          ))}
    </section>
  );
}

export default PrPage;
