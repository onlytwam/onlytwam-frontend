// src/shared/utils/colorHelpers.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all color resolution across the app.
//
// Rule:
//   colorName → human label ("Bark")   — used for labels, aria, search, filter
//   colorHex  → CSS value  ("#C8A882") — used for background in every swatch/dot
//
// Auto-resolution (both directions):
//   nameToHex("Bark")       → "#C8A882"
//   hexToName("#C8A882")    → "Bark"
//   resolveHex(name|hex)    → always returns a valid hex string
//   resolveColorSwatch(raw) → { colorName, colorHex }
// ─────────────────────────────────────────────────────────────────────────────

// ── Master map: name (lowercase) → hex ───────────────────────────────────────
// Keep this in sync with seed.py > COLOR_HEX.
// Adding a color here makes it work everywhere automatically.
export const COLOR_NAME_TO_HEX: Record<string, string> = {
  // ── seed-defined colours ──────────────────────────────────────────────────
  'aqua':         '#00BCD4',
  'ash grey':     '#9E9E9E',
  'bark':         '#C8A882',
  'beige':        '#C8A882',
  'black':        '#1A1A1A',
  'blue':         '#1565C0',
  'chocolate':    '#7B3F00',
  'cinnamon':     '#D2691E',
  'cloud':        '#E8E0D8',
  'coffee':       '#6F4E37',
  'coffee cream': '#D4A574',
  'coral':        '#E53935',
  'coral red':    '#E53935',
  'dark skin':    '#A0522D',
  'deep blue':    '#1B2A4A',
  'desert rose':  '#E8A598',
  'earth red':    '#8B4513',
  'fudge':        '#7D5A4F',
  'grass':        '#558B2F',
  'grey':         '#9E9E9E',
  'gray':         '#9E9E9E',
  'lemon':        '#FFF176',
  'maroon':       '#800000',
  'midnight':     '#1A237E',
  'mist':         '#B0BEC5',
  'nude':         '#F5CBA7',
  'purple':       '#9C27B0',
  'red':          '#D32F2F',
  'skin':         '#F5CBA7',
  'teal':         '#00695C',
  'waffle':       '#C9B99A',
  'white':        '#F5F5F5',
  // ── additional standard colours ───────────────────────────────────────────
  'navy':         '#000080',
  'green':        '#2E7D32',
  'yellow':       '#F9A825',
  'orange':       '#E65100',
  'pink':         '#E91E8C',
  'rose':         '#FF007F',
  'silver':       '#C0C0C0',
  'brown':        '#6D4C41',
  'burgundy':     '#800020',
  'wine':         '#722F37',
  'peach':        '#FFCBA4',
  'lavender':     '#E6E6FA',
  'ivory':        '#FFFFF0',
  'cream':        '#FFFDD0',
  'gold':         '#FFD700',
  'mustard':      '#FFDB58',
  'cyan':         '#00BCD4',
  'magenta':      '#FF00FF',
  'mint':         '#98FF98',
  'lilac':        '#C8A2C8',
  'mauve':        '#E0B0FF',
  'olive':        '#808000',
  'sage':         '#BCB88A',
  'sand':         '#C2B280',
  'taupe':        '#483C32',
  'tan':          '#D2B48C',
  'rust':         '#B7410E',
  'indigo':       '#4B0082',
  'violet':       '#EE82EE',
  'charcoal':     '#36454F',
  'smoke':        '#738276',
  'pearl':        '#EAE0C8',
  'caramel':      '#C68642',
  'mocha':        '#967117',
  'copper':       '#B87333',
};

// ── Reverse map: hex (uppercase) → name ──────────────────────────────────────
// Built once at import time — no runtime cost.
const HEX_TO_NAME: Record<string, string> = {};
for (const [name, hex] of Object.entries(COLOR_NAME_TO_HEX)) {
  const key = hex.toUpperCase();
  // First entry wins (preserves priority for duplicates like grey/ash grey)
  if (!HEX_TO_NAME[key]) HEX_TO_NAME[key] = name.charAt(0).toUpperCase() + name.slice(1);
}

const HEX_RE = /^#[0-9a-f]{3,8}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a color name to its hex value.
 * Returns brand fallback (#9E6070) when nothing matches — never blank.
 *
 *   nameToHex("Bark")        → "#C8A882"
 *   nameToHex("coffee cream")→ "#D4A574"
 *   nameToHex("#C8A882")     → "#C8A882"  (already hex, passed through)
 */
export function nameToHex(name: string): string {
  if (!name) return '#9E6070';
  const trimmed = name.trim();
  // Already a valid hex — return as-is
  if (HEX_RE.test(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  // Exact match
  if (COLOR_NAME_TO_HEX[lower]) return COLOR_NAME_TO_HEX[lower];
  // Partial match — longest key that appears in the input wins
  let best = '';
  let bestHex = '';
  for (const [k, v] of Object.entries(COLOR_NAME_TO_HEX)) {
    if ((lower.includes(k) || k.includes(lower)) && k.length > best.length) {
      best = k;
      bestHex = v;
    }
  }
  return bestHex || '#9E6070';
}

/**
 * Resolve a hex value to its closest color name.
 * Exact match first, then nearest by Euclidean distance in RGB space.
 *
 *   hexToName("#C8A882")  → "Bark"
 *   hexToName("#1A1A1A")  → "Black"
 *   hexToName("bark")     → "Bark"  (name passed through)
 */
export function hexToName(hex: string): string {
  if (!hex) return '';
  const trimmed = hex.trim();
  // Not a hex — treat as a name and title-case it
  if (!HEX_RE.test(trimmed)) {
    const lower = trimmed.toLowerCase();
    const known = COLOR_NAME_TO_HEX[lower];
    if (known) return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return trimmed; // return unchanged
  }
  const upper = trimmed.toUpperCase();
  // Exact match in reverse map
  if (HEX_TO_NAME[upper]) return HEX_TO_NAME[upper];
  // Nearest color by RGB distance
  const rgb = hexToRgb(trimmed);
  if (!rgb) return '';
  let nearestName = '';
  let minDist = Infinity;
  for (const [k, v] of Object.entries(COLOR_NAME_TO_HEX)) {
    const candidate = hexToRgb(v);
    if (!candidate) continue;
    const dist = Math.sqrt(
      (rgb.r - candidate.r) ** 2 +
      (rgb.g - candidate.g) ** 2 +
      (rgb.b - candidate.b) ** 2
    );
    if (dist < minDist) {
      minDist = dist;
      nearestName = k.charAt(0).toUpperCase() + k.slice(1);
    }
  }
  return nearestName;
}

/**
 * Always returns a valid CSS hex string for use in `background:`.
 * Accepts either a name ("Bark") or a hex ("#C8A882").
 *
 *   resolveHex("Bark")     → "#C8A882"
 *   resolveHex("#C8A882")  → "#C8A882"
 *   resolveHex(undefined)  → "#9E6070"  (brand fallback)
 */
export function resolveHex(nameOrHex: string | null | undefined): string {
  if (!nameOrHex) return '#9E6070';
  const trimmed = nameOrHex.trim();
  if (HEX_RE.test(trimmed)) return trimmed;
  return nameToHex(trimmed);
}

/**
 * Given any raw color input (name, hex, or undefined), returns both
 * { colorName, colorHex } — safe to use everywhere.
 *
 * Priority:
 *   - If colorHex is a valid hex → derive name from it if colorName is missing
 *   - If colorName is given      → derive hex from it if colorHex is missing
 *   - If both given              → use as-is (hex wins for swatch, name for label)
 */
export function resolveColorSwatch(
  colorName?: string | null,
  colorHex?: string | null
): { colorName: string; colorHex: string } {
  const hasHex  = colorHex  && HEX_RE.test(colorHex.trim());
  const hasName = colorName && colorName.trim().length > 0;

  if (hasHex && hasName) {
    return {
      colorName: colorName!.trim(),
      colorHex:  colorHex!.trim(),
    };
  }
  if (hasHex && !hasName) {
    return {
      colorName: hexToName(colorHex!.trim()),
      colorHex:  colorHex!.trim(),
    };
  }
  if (hasName && !hasHex) {
    return {
      colorName: colorName!.trim(),
      colorHex:  nameToHex(colorName!.trim()),
    };
  }
  return { colorName: '', colorHex: '#9E6070' };
}

// ── Internal helper ───────────────────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}