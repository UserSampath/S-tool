/**
 * Prompt text for the AI tools, kept in one place so it can be read and edited
 * without going near the code that sends it.
 *
 * Edit the strings below and restart the server - nothing else needs changing.
 */

/**
 * The grammar helper's standing instruction. This is the rule the tool exists
 * for, and it is always sent, whatever else the user selects.
 *
 * Written as an array purely so each rule sits on its own line; the lines are
 * joined with a space before sending. Add, remove or reword lines freely.
 */
const GRAMMAR_SYSTEM_INSTRUCTION = [
  'Correct English and grammar mistakes in the text the user sends.',
  'Fix spelling, punctuation, verb tense, articles and word order.',
  'Preserve the original meaning, tone and formatting. Do not add new ideas,',
  'do not answer questions contained in the text, and do not comment on it.',
  'Reply with the corrected text only - no preamble, no explanation, no quotes',
  'around it. If the text is already correct, reply with it unchanged.',
].join(' ');

/**
 * How the user's chosen instructions are introduced to the model. Their
 * selections are listed underneath this line, one per line.
 *
 * The "as long as they do not conflict" clause is what stops an off-hand extra
 * instruction from overriding the tool's whole purpose.
 */
const GRAMMAR_EXTRA_INSTRUCTIONS_PREAMBLE =
  'Also follow these instructions from the user, as long as they do not conflict with returning corrected text only:';

/**
 * The instruction chips a new account starts with. These are copied into the
 * user's own list the first time they open the tool, after which they own them
 * - they can be removed, and new ones added, without touching this file.
 *
 * Changing this list only affects accounts that have not used the tool yet.
 */
const GRAMMAR_DEFAULT_PRESETS = [
  'Make it sound formal and professional.',
  'Keep it casual and friendly.',
  'Make it shorter and more direct.',
  'Use British English spelling.',
];

/**
 * Output formats offered in the UI.
 *
 * Add an entry here and it appears in the dropdown automatically - `label` is
 * what the user sees, `extension` is used when downloading the result, and
 * `instruction` is appended to the prompt (leave it empty for no extra rule).
 */
const GRAMMAR_FORMATS = {
  plain: {
    label: 'Plain text',
    extension: 'txt',
    instruction: '',
  },
  markdown: {
    label: 'Markdown (.md)',
    extension: 'md',
    instruction: [
      'Format the corrected text as Markdown.',
      'Use Markdown syntax for headings, emphasis, lists, quotes and links where the text calls for it.',
      'Reply with raw Markdown source, not rendered text, and do not wrap the whole reply in a code fence.',
    ].join(' '),
  },
  html: {
    label: 'HTML',
    extension: 'html',
    instruction: [
      'Format the corrected text as clean semantic HTML.',
      'Use only formatting tags such as p, h1-h3, strong, em, ul, ol, li, blockquote, pre, code and a.',
      'Do not include a doctype, html, head or body wrapper, and do not wrap the reply in a code fence.',
    ].join(' '),
  },
};

const DEFAULT_FORMAT = 'plain';

/**
 * Builds the full system instruction for one request.
 *
 * `instructions` is the list the user selected (or typed), and `format` is one
 * of the keys in GRAMMAR_FORMATS.
 */
function grammarSystemInstruction(instructions, format = DEFAULT_FORMAT) {
  const parts = [GRAMMAR_SYSTEM_INSTRUCTION];

  const chosen = GRAMMAR_FORMATS[format] ?? GRAMMAR_FORMATS[DEFAULT_FORMAT];
  if (chosen.instruction) parts.push(chosen.instruction);

  const list = (Array.isArray(instructions) ? instructions : [instructions])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);

  if (list.length) {
    parts.push(
      `${GRAMMAR_EXTRA_INSTRUCTIONS_PREAMBLE}\n${list.map((entry) => `- ${entry}`).join('\n')}`
    );
  }

  return parts.join('\n\n');
}

module.exports = {
  GRAMMAR_SYSTEM_INSTRUCTION,
  GRAMMAR_EXTRA_INSTRUCTIONS_PREAMBLE,
  GRAMMAR_DEFAULT_PRESETS,
  GRAMMAR_FORMATS,
  DEFAULT_FORMAT,
  grammarSystemInstruction,
};

/* ============================================================
 * PR generator
 * ============================================================ */

/**
 * The standing instruction for the PR generator. Always sent, whichever
 * outputs are ticked.
 */
const PR_SYSTEM_INSTRUCTION = [
  'You help a software engineer turn a description of their changes into the',
  'artefacts needed to open a pull request on a professional production repository.',
  'Work only from what the user describes. Do not invent features, files, ticket',
  'numbers or test results they did not mention. If a detail is not given, leave',
  'that section out rather than guessing.',
].join(' ');

/**
 * One entry per checkbox in the UI.
 *
 * `key`      - the field name in the JSON the model returns
 * `label`    - the checkbox label
 * `instruction` - the rules for that output, sent only when it is ticked
 *
 * Reword any `instruction` below to change how that output is written.
 */
const PR_OUTPUTS = {
  branch: {
    key: 'branchName',
    label: 'Branch name',
    instruction: [
      'BRANCH NAME:',
      'Give a single git branch name for these changes.',
      'Use a conventional type prefix followed by a slash: feat/, fix/, chore/,',
      'refactor/, docs/ or test/.',
      'After the prefix use lowercase kebab-case, words separated by hyphens.',
      'Keep it under 50 characters, no spaces, no uppercase, no trailing slash.',
      'Output the branch name only.',
    ].join(' '),
  },

  commit: {
    key: 'commitMessage',
    label: 'Commit message',
    instruction: [
      'COMMIT MESSAGE:',
      'Write exactly ONE LINE. No body, no blank lines, no bullet points.',
      'Follow the Conventional Commits standard: start with a type such as',
      'feat:, fix:, chore:, refactor:, docs: or test:, followed by a space.',
      'After the type, start the subject with a capital letter.',
      'Use the imperative mood - Add, Fix, Update, Remove, Refactor - not past tense.',
      'Do not end the line with a full stop.',
      'Keep the whole line to 50 characters or fewer.',
      'Output the single line only, with no surrounding quotes or code fence.',
    ].join(' '),
  },

  description: {
    key: 'prDescription',
    label: 'PR description',
    instruction: [
      'PR DESCRIPTION:',
      'Write a pull request description in Markdown for a professional production',
      'repository. Clear, concise, reviewer-friendly.',
      '',
      'RULES:',
      '- Do NOT include code snippets.',
      '- Do NOT include low-level implementation details.',
      '- Focus on WHAT changed and WHY, not HOW.',
      '- Use bullet points, not long paragraphs.',
      '',
      'STRUCTURE - use only the sections that actually apply to what the user',
      'described, and omit every other heading entirely. Never emit a heading with',
      'nothing under it, and never write "N/A" or "None".',
      '',
      '# <PR Title>',
      '',
      '## Overview',
      'The purpose of the PR in 1-2 sentences. Always include this section.',
      '',
      '## New Features',
      'New user-facing or system features, at a high level.',
      '',
      '## API Integration',
      'API-related additions or changes.',
      '',
      '## Technical Improvements',
      'Refactors, performance work, compatibility fixes.',
      '',
      '## Component Enhancements',
      'Reusable component updates or UI consistency improvements.',
      '',
      '## File Structure Changes',
      'With ### New Files, ### Modified Files and ### Removed Files beneath it.',
      'Only include the sub-headings the user actually gave information for.',
      '',
      '## Impact',
      'The scope of the PR in concise bullets.',
      '',
      'Finish with this exact line, on its own, as the last line:',
      'Ready for Review ✅ | Build Passing ✅ | Tests Completed ✅',
    ].join('\n'),
  },
};

const PR_OUTPUT_IDS = Object.keys(PR_OUTPUTS);

/**
 * Builds the system instruction for one PR request, containing only the rules
 * for the outputs that were ticked.
 */
function prSystemInstruction(outputs) {
  const chosen = outputs.filter((id) => PR_OUTPUTS[id]);

  return [
    PR_SYSTEM_INSTRUCTION,
    ...chosen.map((id) => PR_OUTPUTS[id].instruction),
    'Return a JSON object containing only the requested fields. Do not wrap it in a code fence.',
  ].join('\n\n');
}

module.exports.PR_SYSTEM_INSTRUCTION = PR_SYSTEM_INSTRUCTION;
module.exports.PR_OUTPUTS = PR_OUTPUTS;
module.exports.PR_OUTPUT_IDS = PR_OUTPUT_IDS;
module.exports.prSystemInstruction = prSystemInstruction;
