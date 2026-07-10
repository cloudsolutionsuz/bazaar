// Multi-char sequences must come before single-char to avoid partial replacements
const LAT_TO_CYR: [string, string][] = [
  ["shch", "щ"], ["sch", "щ"],
  ["sh", "ш"], ["ch", "ч"], ["zh", "ж"],
  ["kh", "х"], ["ts", "ц"], ["yu", "ю"],
  ["ya", "я"], ["yo", "ё"],
  ["a", "а"], ["b", "б"], ["v", "в"],
  ["g", "г"], ["d", "д"], ["e", "е"],
  ["z", "з"], ["i", "и"], ["j", "й"],
  ["k", "к"], ["l", "л"], ["m", "м"],
  ["n", "н"], ["o", "о"], ["p", "п"],
  ["r", "р"], ["s", "с"], ["t", "т"],
  ["u", "у"], ["f", "ф"], ["x", "х"],
  ["y", "й"],
];

const CYR_TO_LAT: [string, string][] = [
  ["щ", "shch"], ["ш", "sh"], ["ч", "ch"],
  ["ж", "zh"],   ["х", "kh"], ["ц", "ts"],
  ["ю", "yu"],   ["я", "ya"], ["ё", "yo"],
  ["а", "a"], ["б", "b"], ["в", "v"],
  ["г", "g"], ["д", "d"], ["е", "e"],
  ["з", "z"], ["и", "i"], ["й", "j"],
  ["к", "k"], ["л", "l"], ["м", "m"],
  ["н", "n"], ["о", "o"], ["п", "p"],
  ["р", "r"], ["с", "s"], ["т", "t"],
  ["у", "u"], ["ф", "f"], ["э", "e"],
  ["ы", "y"], ["ъ", ""], ["ь", ""],
];

function applyMap(input: string, map: [string, string][]): string {
  let result = "";
  let i = 0;
  const lower = input.toLowerCase();
  while (i < lower.length) {
    let matched = false;
    for (const [from, to] of map) {
      if (lower.startsWith(from, i)) {
        result += to;
        i += from.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += lower[i];
      i++;
    }
  }
  return result;
}

// Restore common Russian soft signs lost during transliteration.
// e.g. "холодилник" → "холодильник", "болница" → "больница"
function restoreSoftSigns(s: string): string {
  return s
    .replace(/лн/g, "льн")
    .replace(/лс/g, "льс")
    .replace(/нк/g, "ньк")
    .replace(/сн/g, "сьн");
}

function hasCyrillic(s: string): boolean {
  return /[а-яёА-ЯЁ]/.test(s);
}

function hasLatin(s: string): boolean {
  return /[a-zA-Z]/.test(s);
}

/**
 * Returns alternative search terms via transliteration.
 * If input is Latin → returns Cyrillic equivalent.
 * If input is Cyrillic → returns Latin equivalent.
 * If mixed → returns both.
 * Always returns at least the original term.
 */
export function getSearchTerms(query: string): string[] {
  const terms = new Set<string>([query.toLowerCase()]);
  if (hasLatin(query)) {
    const cyr = applyMap(query, LAT_TO_CYR);
    if (cyr !== query.toLowerCase()) {
      terms.add(cyr);
      const cyrRestored = restoreSoftSigns(cyr);
      if (cyrRestored !== cyr) terms.add(cyrRestored);
    }
  }
  if (hasCyrillic(query)) {
    const lat = applyMap(query, CYR_TO_LAT);
    if (lat !== query.toLowerCase()) terms.add(lat);
  }
  return [...terms];
}
