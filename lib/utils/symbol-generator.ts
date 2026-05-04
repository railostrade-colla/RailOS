/**
 * Symbol generator — turns an Arabic project/company name into a
 * 3-letter UPPERCASE ticker symbol (e.g. "مزرعة الواحة" → "MAW").
 *
 * Algorithm:
 *   1. Transliterate the Arabic letters into ASCII using a basic
 *      Buckwalter-style mapping.
 *   2. Strip everything that isn't A-Z.
 *   3. Take the first 3 letters.
 *   4. If that collides with an existing symbol, try other 3-letter
 *      windows from the transliterated string.
 *   5. As a last resort, append a random letter to make it unique.
 *
 * Examples:
 *   "مزرعة الواحة"    → MZR (or MAR, MZA, etc. depending on rotation)
 *   "برج بغداد"        → BRJ
 *   "Al-Waha Farm"     → ALW
 */

const ARABIC_MAP: Record<string, string> = {
  // Standard letters
  ا: "A", أ: "A", إ: "I", آ: "A", ء: "A",
  ب: "B",
  ت: "T", ة: "H",
  ث: "T", // approximate
  ج: "J",
  ح: "H",
  خ: "K",
  د: "D",
  ذ: "D",
  ر: "R",
  ز: "Z",
  س: "S",
  ش: "S",
  ص: "S",
  ض: "D",
  ط: "T",
  ظ: "Z",
  ع: "A",
  غ: "G",
  ف: "F",
  ق: "Q",
  ك: "K",
  ل: "L",
  م: "M",
  ن: "N",
  ه: "H",
  و: "W",
  ي: "Y", ى: "Y", ئ: "Y",
  ؤ: "O",
  // Latin & punctuation are passed through; numerals are stripped.
}

/** Strip diacritics (harakat) the string might have. */
function stripDiacritics(s: string): string {
  // Arabic harakat are in U+064B – U+0652
  return s.replace(/[ً-ْٰ]/g, "")
}

export function transliterate(name: string): string {
  const cleaned = stripDiacritics(name).trim()
  return cleaned
    .split("")
    .map((c) => {
      if (ARABIC_MAP[c]) return ARABIC_MAP[c]
      // Pass through Latin letters as-is (uppercased later)
      if (/[A-Za-z]/.test(c)) return c
      // Spaces become spaces (used as word delimiters below)
      if (/\s/.test(c)) return " "
      return ""
    })
    .join("")
    .toUpperCase()
    .trim()
}

/**
 * Generate a unique 3-letter symbol from `name`, avoiding any
 * symbol in `taken` (case-insensitive).
 */
export function generateSymbol(
  name: string,
  taken: ReadonlyArray<string> = [],
): string {
  const takenSet = new Set(taken.map((s) => s.toUpperCase()))
  const transliterated = transliterate(name)
  const lettersOnly = transliterated.replace(/[^A-Z]/g, "")

  if (lettersOnly.length >= 3) {
    // Strategy 1: first letter of each of the first three words
    const words = transliterated.split(/\s+/).filter(Boolean)
    if (words.length >= 3) {
      const candidate = words.slice(0, 3).map((w) => w[0]).join("")
      if (candidate.length === 3 && !takenSet.has(candidate)) return candidate
    }

    // Strategy 2: first 3 letters
    const first3 = lettersOnly.slice(0, 3)
    if (!takenSet.has(first3)) return first3

    // Strategy 3: rotate windows through the transliteration
    for (let i = 1; i + 3 <= lettersOnly.length; i++) {
      const win = lettersOnly.slice(i, i + 3)
      if (!takenSet.has(win)) return win
    }

    // Strategy 4: first 2 letters + random uppercase
    const prefix = lettersOnly.slice(0, 2)
    for (let attempt = 0; attempt < 26; attempt++) {
      const letter = String.fromCharCode(65 + attempt)
      const candidate = prefix + letter
      if (!takenSet.has(candidate)) return candidate
    }
  }

  // Strategy 5: last-resort random 3-letter symbol
  const rand = (): string =>
    Array.from({ length: 3 }, () =>
      String.fromCharCode(65 + Math.floor(Math.random() * 26)),
    ).join("")
  let attempt = 0
  while (attempt < 1000) {
    const candidate = rand()
    if (!takenSet.has(candidate)) return candidate
    attempt++
  }
  // Truly degenerate — return a timestamp-derived string
  return rand()
}
