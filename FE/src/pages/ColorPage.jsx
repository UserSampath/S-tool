import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  PlusIcon,
  TrashIcon,
} from "../components/icons";
import {
  HARMONIES,
  contrast,
  formats,
  grade,
  harmony,
  hexToHsl,
  hslToHex,
  parseColor,
  readableOn,
  roundHsl,
  shades,
} from "../lib/color";
import { apiFetch } from "../lib/api";
import "../styles/tool.css";
import "./ColorPage.css";

const SLIDERS = [
  { key: "h", label: "Hue", max: 360, unit: "deg" },
  { key: "s", label: "Saturation", max: 100, unit: "%" },
  { key: "l", label: "Lightness", max: 100, unit: "%" },
];

function Swatch({ hex, label, onPick }) {
  return (
    <button
      type="button"
      className="swatch"
      style={{ "--swatch": hex, "--ink": readableOn(hex).text }}
      title={`${hex} - click to use`}
      onClick={() => onPick(hex)}
    >
      <span className="swatch-hex">{hex.toUpperCase()}</span>
      {label && <span className="swatch-label">{label}</span>}
    </button>
  );
}

function ColorPage({ tool, token, onBack }) {
  const [hex, setHex] = useState("#6d28d9");
  const [typed, setTyped] = useState("#6d28d9");
  const [harmonyId, setHarmonyId] = useState("analogous");
  const [copiedId, setCopiedId] = useState(null);

  const [saved, setSaved] = useState([]);
  const [error, setError] = useState(null);

  const copyTimer = useRef(null);
  const call = useCallback((path, options) => apiFetch(path, { token, ...options }), [token]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await call("/swatches");
        if (!cancelled) setSaved(data.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [call]);

  // Hex is the single source of truth; HSL is derived for the sliders and
  // rounded only on the way to the screen.
  const hsl = useMemo(() => roundHsl(hexToHsl(hex)), [hex]);
  const readable = useMemo(() => readableOn(hex), [hex]);
  const ramp = useMemo(() => shades(hex), [hex]);
  const scheme = useMemo(() => harmony(hex, harmonyId), [hex, harmonyId]);
  const values = useMemo(() => formats(hex), [hex]);

  const pick = (next) => {
    setHex(next);
    setTyped(next.toUpperCase());
  };

  // Typing is free-form until it parses; the swatch only moves once it does,
  // so a half-typed hex does not flash through nonsense colours.
  const handleTyped = (value) => {
    setTyped(value);
    const parsed = parseColor(value);
    if (parsed) setHex(parsed);
  };

  const nudge = (key, value) => pick(hslToHex({ ...hsl, [key]: Number(value) }));

  const copy = async (id, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* clipboard blocked - the value is on screen and selectable anyway */
    }
  };

  const save = async () => {
    setError(null);

    try {
      const data = await call("/swatches", { method: "POST", body: { hex } });
      setSaved((current) => [data.data, ...current]);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (swatch) => {
    const previous = saved;
    setSaved((current) => current.filter((entry) => entry.id !== swatch.id));

    try {
      await call(`/swatches/${swatch.id}`, { method: "DELETE" });
    } catch (err) {
      setSaved(previous);
      setError(err.message);
    }
  };

  const alreadySaved = saved.some((entry) => entry.hex === hex);

  return (
    <section className="tool colour" data-accent={tool.accent}>
      <header className="tool-head">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeftIcon />
          All tools
        </button>

        <h1>{tool.name}</h1>
        <p className="tool-sub">{tool.description}</p>
      </header>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="card">
        {/* The colour itself is the biggest thing on the page, and the text on
            it is the colour a reader would actually get - so the preview
            doubles as a legibility check. */}
        <div
          className="colour-preview"
          style={{ "--picked": hex, "--ink": readable.text }}
        >
          <span className="colour-preview-hex">{hex.toUpperCase()}</span>
          <span className="colour-preview-note">
            {readable.label} text · {readable.ratio}:1 · {grade(readable.ratio)}
          </span>
        </div>

        <section className="block">
          <div className="block-head">
            <h2 className="heading">Pick</h2>
            <span className="meta">
              on white {contrast(hex, "#ffffff")}:1 · on black {contrast(hex, "#000000")}:1
            </span>
          </div>

          <div className="row colour-pick">
            <label className="colour-native" style={{ "--picked": hex }}>
              <input type="color" value={hex} aria-label="Pick a colour" onChange={(event) => pick(event.target.value)} />
            </label>

            <input
              className="field colour-hex"
              value={typed}
              spellCheck={false}
              aria-label="Colour value"
              placeholder="#6d28d9, rgb(...) or hsl(...)"
              onChange={(event) => handleTyped(event.target.value)}
              onBlur={() => setTyped(hex.toUpperCase())}
            />

            <button
              type="button"
              className="btn btn-quiet"
              disabled={alreadySaved}
              title={alreadySaved ? "Already in your palette" : "Save to your palette"}
              onClick={save}
            >
              <PlusIcon />
              {alreadySaved ? "Saved" : "Save"}
            </button>
          </div>
        </section>

        <section className="block">
          <div className="block-head">
            <h2 className="heading">Adjust</h2>
            <span className="meta">
              {hsl.h}deg · {hsl.s}% · {hsl.l}%
            </span>
          </div>

          {SLIDERS.map((slider) => (
            <label key={slider.key} className="colour-slider" data-channel={slider.key}>
              <span className="meta">{slider.label}</span>
              <input
                type="range"
                min={0}
                max={slider.max}
                value={hsl[slider.key]}
                style={{ "--picked": hex, "--track-hue": hsl.h }}
                onChange={(event) => nudge(slider.key, event.target.value)}
              />
              <output className="meta">
                {hsl[slider.key]}
                {slider.unit === "%" ? "%" : ""}
              </output>
            </label>
          ))}
        </section>

        <section className="block">
          <div className="block-head">
            <h2 className="heading">Values</h2>
          </div>

          <div className="colour-values">
            {values.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="colour-value"
                data-copied={copiedId === entry.id || undefined}
                onClick={() => copy(entry.id, entry.value)}
              >
                <span className="meta">{entry.label}</span>
                <code>{entry.value}</code>
                {copiedId === entry.id ? <CheckIcon /> : <CopyIcon />}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="heading">Shades</h2>
          <span className="meta">Same hue, ten lightness steps</span>
        </div>
        <div className="card-body">
          <div className="swatch-row">
            {ramp.map((step) => (
              <Swatch key={step.name} hex={step.hex} label={step.name} onPick={pick} />
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="heading">Harmony</h2>
          <div className="card-tools">
            <label className="select">
              <select value={harmonyId} onChange={(event) => setHarmonyId(event.target.value)}>
                {HARMONIES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="card-body">
          <div className="swatch-row">
            {scheme.map((colour, index) => (
              <Swatch key={`${colour}-${index}`} hex={colour} onPick={pick} />
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="heading">My palette</h2>
          <span className="meta">{saved.length} saved</span>
        </div>
        <div className="card-body">
          {saved.length === 0 ? (
            <p className="meta">Nothing saved yet. Pick a colour and press Save.</p>
          ) : (
            <div className="swatch-row">
              {saved.map((entry) => (
                <div key={entry.id} className="saved">
                  <Swatch hex={entry.hex} label={entry.name} onPick={pick} />
                  <button
                    type="button"
                    className="saved-remove"
                    aria-label={`Remove ${entry.hex}`}
                    title="Remove"
                    onClick={() => remove(entry)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

export default ColorPage;
