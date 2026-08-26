// The wording sent to the model lives in config/prompts.js, so it can be
// changed without touching the request code.
const {
  grammarSystemInstruction,
  prSystemInstruction,
  PR_OUTPUTS,
  DEFAULT_FORMAT,
} = require('../config/prompts');

const DEFAULT_MODEL = 'gemini-3.6-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 45_000;

// Raised for anything the client is allowed to see.
class GeminiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
  }
}

function apiKey() {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new GeminiError('The grammar helper is not configured: GEMINI_API_KEY is not set', 503);
  }

  return key;
}

// Models like to wrap a whole markdown or html answer in a fence even when
// told not to. Peel it off rather than making the user delete it every time.
function stripCodeFence(output) {
  const match = output.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : output;
}

/**
 * Undoes double-escaped line breaks in a JSON string field.
 *
 * Asked for JSON containing markdown, Gemini sometimes escapes the escape, so
 * the parsed value holds a literal backslash-n rather than a line break and the
 * whole document arrives as one unusable line.
 *
 * Only applied when the value has no real line breaks at all, so a backslash-n
 * that genuinely belongs in the prose is left alone.
 */
function repairEscapedNewlines(value) {
  if (value.includes('\n') || !/\\[nrt]/.test(value)) return value;

  return value.replace(/\\r\\n|\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\t/g, '\t');
}

/**
 * Sends text to Gemini for correction.
 *
 * The user's extra instructions go in the system turn, where they can actually
 * steer the model, while the text to correct stays in the user turn. Keeping
 * the two apart is what stops a pasted paragraph that happens to read like an
 * instruction from being followed as one.
 */
async function correct({ text, instructions, format = DEFAULT_FORMAT }) {
  const system = grammarSystemInstruction(instructions, format);
  const { output, model, data } = await callGemini({ system, text });

  return {
    text: stripCodeFence(output),
    model,
    format,
    usage: usageOf(data),
  };
}

/**
 * Generates the pull request artefacts the user ticked.
 *
 * Asks for JSON against a schema rather than parsing prose: the three outputs
 * have to come back separately so each can get its own copy button, and a
 * schema is far more reliable than splitting on headings the model may reword.
 */
async function pullRequest({ details, outputs }) {
  const system = prSystemInstruction(outputs);

  // Only the ticked outputs are in the schema, so the model cannot return a
  // field the user did not ask for.
  const properties = {};
  for (const id of outputs) {
    const entry = PR_OUTPUTS[id];
    if (entry) properties[entry.key] = { type: 'string' };
  }

  const { output, model, data } = await callGemini({
    system,
    text: details,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties,
        required: Object.keys(properties),
      },
    },
  });

  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(output));
  } catch {
    throw new GeminiError('Gemini returned something that was not valid JSON. Try again.', 502);
  }

  const result = {};
  for (const id of outputs) {
    const entry = PR_OUTPUTS[id];
    if (!entry) continue;

    const value = String(parsed[entry.key] ?? '').trim();
    // A fence can still appear inside an individual field.
    if (value) result[id] = stripCodeFence(repairEscapedNewlines(value));
  }

  return { outputs: result, model, usage: usageOf(data) };
}

const usageOf = (data) => ({
  promptTokens: data.usageMetadata?.promptTokenCount ?? null,
  outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
  totalTokens: data.usageMetadata?.totalTokenCount ?? null,
});

/**
 * One request to Gemini, with the timeout and error mapping every caller needs.
 */
async function callGemini({ system, text, generationConfig }) {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  // Without this a hung upstream request would hold the connection open until
  // something else gave up first.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        ...(generationConfig ? { generationConfig } : {}),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new GeminiError('Gemini took too long to answer. Try again, or send less text.', 504);
    }
    throw new GeminiError('Could not reach Gemini. Check the network and try again.', 502);
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `Gemini returned ${response.status}`;

    // Quota and key problems are worth naming; they are not transient.
    if (response.status === 429) {
      throw new GeminiError('Gemini rate limit or quota reached. Wait a moment and try again.', 429);
    }
    if (response.status === 401 || response.status === 403) {
      throw new GeminiError('Gemini rejected the API key.', 502);
    }

    throw new GeminiError(message, 502);
  }

  const candidate = data.candidates?.[0];
  const output = (candidate?.content?.parts ?? [])
    .map((part) => part.text)
    .filter(Boolean)
    .join('')
    .trim();

  if (!output) {
    // A blocked prompt comes back as a 200 with no text, so it has to be
    // checked for here rather than left to look like an empty answer.
    const reason = candidate?.finishReason || data.promptFeedback?.blockReason;
    throw new GeminiError(
      reason && reason !== 'STOP'
        ? `Gemini returned nothing (${reason}).`
        : 'Gemini returned nothing. Try again.',
      502
    );
  }

  return { output, model, data };
}

module.exports = { correct, pullRequest, GeminiError };
