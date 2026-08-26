/**
 * JSON parsing, formatting and minifying.
 *
 * Kept out of the component so the awkward part - turning a parser error into
 * something a person can act on - is plain functions that can be reasoned about
 * on their own.
 */

export const INDENTS = [
  { id: "2", label: "2 spaces", value: 2 },
  { id: "4", label: "4 spaces", value: 4 },
  { id: "tab", label: "Tab", value: "\t" },
];

/** Byte length, not character count - what actually matters for a payload. */
export function byteSize(text) {
  return new TextEncoder().encode(text ?? "").length;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Character offset -> line and column, both 1-based. */
function locate(text, position) {
  const before = text.slice(0, position).split("\n");
  return { line: before.length, column: before[before.length - 1].length + 1 };
}

/**
 * A few lines of the source around the error with a caret under the column.
 *
 * "Unexpected token } at position 402" is useless on a 400-line payload; being
 * shown the actual line is the whole value of a validator.
 */
function frame(text, line, column, context = 2) {
  const lines = text.split("\n");
  const from = Math.max(1, line - context);
  const to = Math.min(lines.length, line + context);
  const gutter = String(to).length;

  const out = [];
  for (let n = from; n <= to; n += 1) {
    const marker = n === line ? ">" : " ";
    out.push(`${marker} ${String(n).padStart(gutter)} | ${lines[n - 1]}`);

    if (n === line) {
      // Line up the caret with the reported column.
      out.push(`  ${" ".repeat(gutter)} | ${" ".repeat(Math.max(0, column - 1))}^`);
    }
  }

  return out.join("\n");
}

/**
 * Tidies a parser message for display.
 *
 * Engines phrase these differently and tack the offset on the end; the position
 * is shown separately as line and column, so it is dropped from the sentence.
 */
function tidy(message) {
  const cleaned = message
    .replace(/^JSON\.parse:\s*/, "")
    .replace(/\s*in JSON at position \d+.*$/, "")
    .replace(/\s*at position \d+.*$/, "")
    .trim();

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Parses `text` and reports what happened.
 *
 * Returns { state: "empty" } | { state: "valid", value } |
 * { state: "invalid", message, line, column, frame }
 */
export function inspect(text) {
  const source = text ?? "";
  if (!source.trim()) return { state: "empty" };

  try {
    return { state: "valid", value: JSON.parse(source) };
  } catch (err) {
    const match = /position (\d+)/.exec(err.message);

    // Firefox reports "line 3 column 5" instead of an offset.
    const lineCol = /line (\d+) column (\d+)/.exec(err.message);

    let line;
    let column;

    if (match) {
      ({ line, column } = locate(source, Number(match[1])));
    } else if (lineCol) {
      line = Number(lineCol[1]);
      column = Number(lineCol[2]);
    } else {
      // Some messages carry no offset at all - "Unexpected token 'o',
      // "notjson" is not valid JSON" is the common one. Pointing at the start
      // is still more use than showing no location.
      line = 1;
      column = 1;
    }

    return {
      state: "invalid",
      message: tidy(err.message),
      line,
      column,
      frame: line ? frame(source, line, column) : null,
    };
  }
}

/** Counts objects, arrays and values, and how deep the nesting goes. */
export function describe(value) {
  let objects = 0;
  let arrays = 0;
  let values = 0;
  let depth = 0;

  const walk = (node, level) => {
    depth = Math.max(depth, level);

    if (Array.isArray(node)) {
      arrays += 1;
      node.forEach((entry) => walk(entry, level + 1));
    } else if (node && typeof node === "object") {
      objects += 1;
      Object.values(node).forEach((entry) => walk(entry, level + 1));
    } else {
      values += 1;
    }
  };

  walk(value, 1);
  return { objects, arrays, values, depth };
}

export function format(text, indent = 2) {
  const result = inspect(text);
  if (result.state !== "valid") return result;

  return { state: "valid", text: JSON.stringify(result.value, null, indent) };
}

export function minify(text) {
  const result = inspect(text);
  if (result.state !== "valid") return result;

  return { state: "valid", text: JSON.stringify(result.value) };
}
