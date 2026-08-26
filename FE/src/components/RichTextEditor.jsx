import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignIcon,
  BulletListIcon,
  ClearFormatIcon,
  CodeIcon,
  LinkIcon,
  NumberListIcon,
  QuoteIcon,
} from "./icons";

const BLOCKS = [
  { value: "p", label: "Body" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
];

// Text rather than glyphs: a bold "B" says what it does better than any icon,
// and it styles itself.
const MARKS = [
  { command: "bold", label: "B", title: "Bold (Ctrl+B)", className: "mark-bold" },
  { command: "italic", label: "I", title: "Italic (Ctrl+I)", className: "mark-italic" },
  { command: "underline", label: "U", title: "Underline (Ctrl+U)", className: "mark-underline" },
  { command: "strikeThrough", label: "S", title: "Strikethrough", className: "mark-strike" },
];

const LISTS = [
  { command: "insertUnorderedList", Icon: BulletListIcon, title: "Bullet list" },
  { command: "insertOrderedList", Icon: NumberListIcon, title: "Numbered list" },
];

const ALIGNMENTS = [
  { command: "justifyLeft", align: "left", title: "Align left" },
  { command: "justifyCenter", align: "center", title: "Align centre" },
  { command: "justifyRight", align: "right", title: "Align right" },
];

/**
 * A contentEditable surface driven by execCommand.
 *
 * execCommand is deprecated but is still the only thing every browser
 * implements without pulling in an editor framework; the alternative here was
 * a ProseMirror-sized dependency for bold and bullet points.
 *
 * The editable div is deliberately *uncontrolled*. Writing React state back
 * into innerHTML on every keystroke would reset the caret to the start of the
 * document, so the DOM owns the content and the html only flows outward.
 */
function RichTextEditor({ noteId, initialHtml, onChange, onFlush }) {
  const bodyRef = useRef(null);
  const savedRange = useRef(null);
  const [active, setActive] = useState({});
  const [block, setBlock] = useState("p");

  // Load content only when the note changes. Reacting to initialHtml as well
  // would overwrite what is being typed the moment a save came back.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    body.innerHTML = initialHtml || "";
    // Emit colours as inline styles instead of <font> tags, which is what the
    // server's sanitiser allowlists.
    document.execCommand("styleWithCSS", false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const readState = useCallback(() => {
    if (!bodyRef.current?.contains(document.getSelection()?.anchorNode ?? null)) return;

    const next = {};
    for (const { command } of [...MARKS, ...LISTS, ...ALIGNMENTS]) {
      try {
        next[command] = document.queryCommandState(command);
      } catch {
        next[command] = false;
      }
    }
    setActive(next);

    try {
      const value = document.queryCommandValue("formatBlock").toLowerCase();
      setBlock(BLOCKS.some((entry) => entry.value === value) ? value : "p");
    } catch {
      setBlock("p");
    }
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", readState);
    return () => document.removeEventListener("selectionchange", readState);
  }, [readState]);

  const emit = () => onChange(bodyRef.current?.innerHTML ?? "");

  // The colour inputs take focus, which drops the selection. Stash it on the
  // way out and put it back before running the command.
  const rememberSelection = () => {
    const selection = document.getSelection();
    if (selection?.rangeCount) savedRange.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const range = savedRange.current;
    if (!range) return;

    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const run = (command, value = null) => {
    bodyRef.current?.focus();
    document.execCommand(command, false, value);
    readState();
    emit();
  };

  const runOnSaved = (command, value) => {
    bodyRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    emit();
  };

  const handleLink = () => {
    const selection = document.getSelection();
    const selected = selection?.toString().trim();

    if (!selected) {
      window.alert("Select the text you want to turn into a link first.");
      return;
    }

    rememberSelection();
    const url = window.prompt("Link to:", "https://");
    if (!url) return;

    // Anything the sanitiser would strip is worth rejecting up front, so the
    // link does not silently vanish on save.
    if (!/^(https?:\/\/|mailto:)/i.test(url)) {
      window.alert("Links must start with http://, https:// or mailto:");
      return;
    }

    runOnSaved("createLink", url);
  };

  // Pasted html can carry markup the toolbar would never produce. The server
  // sanitises it anyway; stripping to text here also stops other sites' fonts
  // and colours leaking into the note.
  const handlePaste = (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
  };

  const Button = ({ onClick, title, isActive, className = "", children }) => (
    <button
      type="button"
      className={`rte-button ${className}`.trim()}
      data-active={isActive || undefined}
      title={title}
      aria-label={title}
      aria-pressed={Boolean(isActive)}
      // mousedown, not click: the default would move focus out of the editable
      // area and collapse the selection before the command could apply.
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        <select
          className="rte-block"
          value={block}
          aria-label="Paragraph style"
          onChange={(event) => run("formatBlock", `<${event.target.value}>`)}
        >
          {BLOCKS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>

        <span className="rte-divider" />

        {MARKS.map((mark) => (
          <Button
            key={mark.command}
            title={mark.title}
            className={mark.className}
            isActive={active[mark.command]}
            onClick={() => run(mark.command)}
          >
            {mark.label}
          </Button>
        ))}

        <span className="rte-divider" />

        {LISTS.map(({ command, Icon, title }) => (
          <Button
            key={command}
            title={title}
            isActive={active[command]}
            onClick={() => run(command)}
          >
            <Icon />
          </Button>
        ))}

        <Button title="Quote" onClick={() => run("formatBlock", "<blockquote>")}>
          <QuoteIcon />
        </Button>
        <Button title="Code block" onClick={() => run("formatBlock", "<pre>")}>
          <CodeIcon />
        </Button>

        <span className="rte-divider" />

        {ALIGNMENTS.map(({ command, align, title }) => (
          <Button
            key={command}
            title={title}
            isActive={active[command]}
            onClick={() => run(command)}
          >
            <AlignIcon align={align} />
          </Button>
        ))}

        <span className="rte-divider" />

        <label className="rte-colour" title="Text colour">
          <span className="rte-colour-chip" aria-hidden="true">
            A
          </span>
          <input
            type="color"
            defaultValue="#1f1233"
            aria-label="Text colour"
            onMouseDown={rememberSelection}
            onChange={(event) => runOnSaved("foreColor", event.target.value)}
          />
        </label>

        <label className="rte-colour" title="Highlight">
          <span className="rte-colour-chip highlight" aria-hidden="true">
            A
          </span>
          <input
            type="color"
            defaultValue="#fde68a"
            aria-label="Highlight colour"
            onMouseDown={rememberSelection}
            onChange={(event) => runOnSaved("hiliteColor", event.target.value)}
          />
        </label>

        <span className="rte-divider" />

        <Button title="Add link" onClick={handleLink}>
          <LinkIcon />
        </Button>
        <Button title="Clear formatting" onClick={() => run("removeFormat")}>
          <ClearFormatIcon />
        </Button>
      </div>

      <div
        ref={bodyRef}
        className="rte-body"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Note body"
        spellCheck
        onInput={emit}
        onBlur={onFlush}
        onPaste={handlePaste}
        onKeyUp={readState}
        onMouseUp={readState}
      />
    </div>
  );
}

export default RichTextEditor;
