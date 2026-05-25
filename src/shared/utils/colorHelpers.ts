/**
 * colorHelpers.ts
 * Hex removed completely. Colors are identified by name + family only.
 * Swatches use FAMILY_SWATCH_COLORS (one fixed CSS color per family).
 */

// ─── Family options (matches backend COLOR_FAMILY_MAP) ────────────────────────

export const COLOR_FAMILY_OPTIONS = [
  "Black",
  "White",
  "Grey",
  "Red",
  "Pink",
  "Purple",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Brown",
] as const;

export type ColorFamilyLabel = (typeof COLOR_FAMILY_OPTIONS)[number];

// ─── Fixed swatch color per family (display only) ─────────────────────────────
// Used everywhere a color circle/swatch is shown in the UI.

export const FAMILY_SWATCH_COLORS: Record<string, string> = {
  Black: "#1a1a1a",
  White: "#f0ebe4",
  Grey: "#9e9e9e",
  Red: "#c0392b",
  Pink: "#e91e8c",
  Purple: "#8e44ad",
  Blue: "#2980b9",
  Green: "#27ae60",
  Yellow: "#f1c40f",
  Orange: "#e67e22",
  Brown: "#795548",
};

/** Return the swatch CSS color for a family, or a neutral fallback. */
export function getFamilySwatch(
  colorFamily: string | null | undefined,
): string {
  if (!colorFamily) return "#d0c8c2";
  return FAMILY_SWATCH_COLORS[colorFamily] ?? "#d0c8c2";
}

// ─── Admin-form keyword guesser ───────────────────────────────────────────────
// Used ONLY to auto-suggest ColorFamily when admin types a color name.
// NEVER used for filtering — filter reads variant.colorFamily from DB directly.

const _FAMILY_KEYWORDS: [ColorFamilyLabel, string[]][] = [
  ["Black", ["black", "ebony", "onyx", "jet", "charcoal", "graphite"]],
  [
    "White",
    [
      "white",
      "ivory",
      "cream",
      "snow",
      "pearl",
      "off-white",
      "off white",
      "cloud",
    ],
  ],
  ["Grey", ["grey", "gray", "silver", "slate", "ash", "smoke", "mist"]],
  [
    "Red",
    [
      "wine",
      "burgundy",
      "maroon",
      "oxblood",
      "bordeaux",
      "claret",
      "sangria",
      "earth red",
      "red",
      "crimson",
      "scarlet",
      "cherry",
      "ruby",
      "coral red",
    ],
  ],
  [
    "Pink",
    [
      "pink",
      "blush",
      "rose",
      "flamingo",
      "magenta",
      "fuchsia",
      "desert rose",
      "dusty",
    ],
  ],
  [
    "Purple",
    [
      "purple",
      "violet",
      "lavender",
      "mauve",
      "lilac",
      "plum",
      "indigo",
      "grape",
      "amethyst",
      "orchid",
    ],
  ],
  [
    "Blue",
    [
      "blue",
      "navy",
      "cobalt",
      "sapphire",
      "denim",
      "teal",
      "turquoise",
      "aqua",
      "midnight",
      "deep blue",
      "jade",
    ],
  ],
  ["Green", ["green", "olive", "mint", "sage", "forest", "lime", "grass"]],
  ["Yellow", ["yellow", "gold", "mustard", "amber", "lemon"]],
  [
    "Orange",
    ["orange", "rust", "coral", "burnt", "terracotta", "tangerine", "apricot"],
  ],
  [
    "Brown",
    [
      "brown",
      "tan",
      "beige",
      "caramel",
      "chocolate",
      "mocha",
      "nude",
      "skin",
      "sand",
      "bark",
      "fudge",
      "waffle",
      "coffee",
      "cinnamon",
      "peach",
      "champagne",
    ],
  ],
];

/**
 * Suggest a ColorFamily from a typed color name — admin form auto-suggest only.
 * Returns the first matching family, or null.
 */
export function guessColorFamily(colorName: string): ColorFamilyLabel | null {
  if (!colorName) return null;
  const lower = colorName.toLowerCase().trim();
  for (const [family, keywords] of _FAMILY_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k) || k.includes(lower)))
      return family;
  }
  return null;
}
