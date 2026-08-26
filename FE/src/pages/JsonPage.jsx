import { useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  BracesIcon,
  CheckIcon,
  CopyIcon,
} from "../components/icons";
import {
  INDENTS,
  byteSize,
  describe,
  format,
  formatBytes,
  inspect,
  minify,
} from "../lib/json";
import "../styles/tool.css";
import "./JsonPage.css";

const SAMPLE = `{
  "name": "my-tools",
  "version": "1.0.0",
  "tools": ["plans", "notes", "json"],
  "private": true
}`;

function JsonPage({ tool, onBack }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState(null);
  const [indent, setIndent] = useState("2");
  const [copied, setCopied] = useState(false);

  const copyTimer = useRef(null);
  const inputRef = useRef(null);

  /*
   * Validation is not a button. It runs on every keystroke, so the panel below
   * the box always reflects what is in it - a validator you have to ask is a
   * validator you forget to ask.
   */
  const check = useMemo(() => inspect(input), [input]);
  const stats = useMemo(
    () => (check.state === "valid" ? describe(check.value) : null),
    [check],
  );

  const inputBytes = byteSize(input);
  const valid = check.state === "valid";

  const run = (transform) => {
    const result = transform();
    if (result.state !== "valid") return;

    setOutput({ text: result.text, bytes: byteSize(result.text) });
  };

  const handleCopy = async () => {
    if (!output) return;

    try {
      await navigator.clipboard.writeText(output.text);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked - the text is on screen and selectable anyway */
    }
  };

  const useAsInput = () => {
    if (!output) return;
    setInput(output.text);
    setOutput(null);
    inputRef.current?.focus();
  };

  const clear = () => {
    setInput("");
    setOutput(null);
  };

  const indentValue = INDENTS.find((entry) => entry.id === indent)?.value ?? 2;
  const saved = output && inputBytes > 0 ? inputBytes - output.bytes : 0;

  return (
    <section className="tool json" data-accent={tool.accent}>
      <header className="tool-head">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeftIcon />
          All tools
        </button>

        <h1>{tool.name}</h1>
        <p className="tool-sub">{tool.description}</p>
      </header>

      <div className="card">
        <section className="block">
          <div className="block-head">
            <h2 className="heading">JSON</h2>
            <span className="meta">
              {input.length.toLocaleString()} chars · {formatBytes(inputBytes)}
            </span>
          </div>

          <textarea
            ref={inputRef}
            className="field field-area json-input"
            value={input}
            rows={12}
            spellCheck={false}
            placeholder="Paste your JSON here..."
            onChange={(event) => setInput(event.target.value)}
          />

          {input.trim() === "" && (
            <button type="button" className="btn btn-quiet json-sample" onClick={() => setInput(SAMPLE)}>
              Try a sample
            </button>
          )}
        </section>

        {/* The verdict sits directly under the box it describes, not off in a
            results panel you have to go looking for. */}
        {check.state !== "empty" && (
          <section className="json-verdict" data-valid={valid || undefined} aria-live="polite">
            <p className="json-verdict-head">
              <span className="json-dot" aria-hidden="true" />
              {valid ? "Valid JSON" : "Invalid JSON"}
              {!valid && check.line != null && (
                <span className="json-where">
                  line {check.line}, column {check.column}
                </span>
              )}
            </p>

            {valid ? (
              <p className="meta json-stats">
                {stats.objects} object{stats.objects === 1 ? "" : "s"} · {stats.arrays} array
                {stats.arrays === 1 ? "" : "s"} · {stats.values} value
                {stats.values === 1 ? "" : "s"} · {stats.depth} level
                {stats.depth === 1 ? "" : "s"} deep
              </p>
            ) : (
              <>
                <p className="json-message">{check.message}</p>
                {/* Showing the offending line is the whole point - a character
                    offset is useless on a 400-line payload. */}
                {check.frame && <pre className="json-frame">{check.frame}</pre>}
              </>
            )}
          </section>
        )}

        <footer className="bar">
          <label className="select">
            <span className="meta">Indent</span>
            <select value={indent} onChange={(event) => setIndent(event.target.value)}>
              {INDENTS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <div className="bar-end">
            {input && (
              <button type="button" className="btn btn-quiet btn-danger" onClick={clear}>
                Clear
              </button>
            )}
            <button
              type="button"
              className="btn btn-quiet"
              disabled={!valid}
              onClick={() => run(() => minify(input))}
            >
              Minify
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!valid}
              onClick={() => run(() => format(input, indentValue))}
            >
              <BracesIcon />
              Format
            </button>
          </div>
        </footer>
      </div>

      {output && (
        <section className="card card-result">
          <div className="card-head">
            <h2 className="heading">Result</h2>
            <div className="card-tools">
              <span className="meta">
                {formatBytes(output.bytes)}
                {saved > 0 && ` · ${formatBytes(saved)} smaller`}
              </span>
              <button type="button" className="btn btn-quiet" onClick={useAsInput}>
                Use as input
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                data-copied={copied || undefined}
                onClick={handleCopy}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <pre className="json-output">{output.text}</pre>
        </section>
      )}
    </section>
  );
}

export default JsonPage;
