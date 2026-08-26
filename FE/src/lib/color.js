/**
 * Colour conversion, contrast and palette maths.
 *
 * Plain functions, kept out of the component so the arithmetic can be checked
 * on its own - conversions are easy to get subtly wrong and hard to spot by eye.
 */

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round = (n) => Math.round(n * 10) / 10;

/* ---------- conversion ---------- */

export function hexToRgb(hex) {
  let value = String(hex).trim().replace(/^#/, "");

  // #abc is shorthand for #aabbcc.
  if (value.length === 3) value = value.split("").map((c) => c + c).join("");
  if (value.length !== 6 || !/^[0-9a-f]{6}$/i.test(value)) return null;

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const part = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;

    h *= 60;
    if (h < 0) h += 360;
  }

  // Deliberately unrounded. Rounding here loses enough precision that
  // hex -> hsl -> hex comes back a shade off, which then shows up as a hue
  // drift across a generated ramp. Round at the point of display instead.
  return { h, s: s * 100, l: l * 100 };
}

/** HSL rounded for showing to a person, or feeding a slider. */
export function roundHsl({ h, s, l }) {
  return { h: Math.round(h), s: Math.round(s), l: Math.round(l) };
}

export function hslToRgb({ h, s, l }) {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;

  const [r, g, b] = (() => {
    if (hn < 60) return [c, x, 0];
    if (hn < 120) return [x, c, 0];
    if (hn < 180) return [0, c, x];
    if (hn < 240) return [0, x, c];
    if (hn < 300) return [x, 0, c];
    return [c, 0, x];
  })();

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export const hexToHsl = (hex) => {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : null;
};

export const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

/* ---------- parsing ---------- */

/**
 * Accepts whatever gets pasted in: #abc, #aabbcc, rgb(1, 2, 3) or
 * hsl(200, 50%, 40%). Returns a hex string, or null if it is not a colour.
 */
export function parseColor(text) {
  const value = String(text ?? "").trim();
  if (!value) return null;

  const hex = hexToRgb(value);
  if (hex) return rgbToHex(hex);

  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(value);
  if (rgb) {
    return rgbToHex({ r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) });
  }

  const hsl = /^hsla?\(\s*(-?\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)%?[\s,]+(\d+(?:\.\d+)?)%?/i.exec(value);
  if (hsl) {
    return hslToHex({ h: Number(hsl[1]), s: Number(hsl[2]), l: Number(hsl[3]) });
  }

  return null;
}

/* ---------- formats for display ---------- */

export function formats(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];

  const hsl = roundHsl(rgbToHsl(rgb));

  return [
    { id: "hex", label: "HEX", value: hex.toUpperCase() },
    { id: "rgb", label: "RGB", value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
    { id: "hsl", label: "HSL", value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
  ];
}

/* ---------- contrast ---------- */

/** WCAG relative luminance. The channel curve is not a plain divide by 255. */
export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const channel = (v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);

  return round((light + 0.05) / (dark + 0.05));
}

/** Which of black or white is more readable on this colour, and by how much. */
export function readableOn(hex) {
  const onWhite = contrast(hex, "#ffffff");
  const onBlack = contrast(hex, "#000000");

  return onBlack >= onWhite
    ? { text: "#000000", label: "black", ratio: onBlack }
    : { text: "#ffffff", label: "white", ratio: onWhite };
}

/** WCAG grade for a contrast ratio against normal-size body text. */
export function grade(ratio) {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

/* ---------- derived palettes ---------- */

/**
 * A tint-to-shade ramp at fixed lightness steps, the way a design system names
 * its 50 to 900 scale. Hue and saturation are held so every step reads as the
 * same colour.
 */
export const SHADE_STEPS = [95, 87, 78, 68, 58, 48, 39, 30, 22, 14];

export function shades(hex) {
  const hsl = hexToHsl(hex);
  if (!hsl) return [];

  return SHADE_STEPS.map((l, index) => ({
    name: index === 0 ? "50" : `${index * 100}`,
    hex: hslToHex({ ...hsl, l }),
  }));
}

/** Classic hue relationships, all measured from the current colour. */
export const HARMONIES = [
  { id: "complementary", label: "Complementary", offsets: [0, 180] },
  { id: "analogous", label: "Analogous", offsets: [-30, 0, 30] },
  { id: "triadic", label: "Triadic", offsets: [0, 120, 240] },
  { id: "split", label: "Split complementary", offsets: [0, 150, 210] },
  { id: "tetradic", label: "Tetradic", offsets: [0, 90, 180, 270] },
];

export function harmony(hex, id) {
  const hsl = hexToHsl(hex);
  const entry = HARMONIES.find((h) => h.id === id);
  if (!hsl || !entry) return [];

  return entry.offsets.map((offset) => hslToHex({ ...hsl, h: hsl.h + offset }));
}
