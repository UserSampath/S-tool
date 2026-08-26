const sanitizeHtml = require('sanitize-html');

// Notes are stored as HTML produced by a contentEditable surface, which means
// anything the user pastes could carry script with it. Sanitising is done with
// a maintained library rather than by hand: an allowlist written with regexes
// is one of the classic ways to ship an XSS hole.
const OPTIONS = {
  allowedTags: [
    'p', 'br', 'div', 'span',
    'h1', 'h2', 'h3', 'h4',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark', 'sub', 'sup',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code', 'hr',
    'a',
  ],

  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    '*': ['style'],
  },

  // Only formatting properties, and only values that cannot carry a url().
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\(\s*[\d\s.,%]+\)$/, /^[a-zA-Z]+$/],
      'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\(\s*[\d\s.,%]+\)$/, /^[a-zA-Z]+$/],
      'text-align': [/^(left|right|center|justify)$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'font-style': [/^(normal|italic)$/],
      'text-decoration': [/^[a-zA-Z\s-]+$/],
      'font-size': [/^\d+(\.\d+)?(px|em|rem|%)$/],
    },
  },

  // javascript: and data: urls cannot survive this.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,

  // Any link that does get through opens detached from this tab.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

function sanitize(html) {
  return sanitizeHtml(String(html ?? ''), OPTIONS);
}

// A one-line preview for the tree, derived from the same html the note stores
// so the two can never disagree.
function excerpt(html, length = 90) {
  // Block boundaries are word boundaries; without this "<h1>Title</h1><p>Body"
  // would come back as "TitleBody".
  const spaced = String(html ?? '').replace(/<\/(p|div|h[1-4]|li|blockquote|pre|tr)>|<br\s*\/?>/gi, ' ');

  const text = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > length ? `${text.slice(0, length).trimEnd()}...` : text;
}

module.exports = { sanitize, excerpt };
