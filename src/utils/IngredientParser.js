/**
 * Ingredient OCR pipeline for cylindrical cans: outer-comma splitting with
 * balanced `()` / `[]`, cross-frame parenthesis buffering, suffix–prefix shard
 * merging ("su" + "gar" → "sugar"), Levenshtein fuzzy dedupe, and nutrition
 * noise stripping. All functions are pure except explicit buffers managed by
 * the caller (`carryOver` for delimiters, optional pending alpha fragment).
 */

/** @param {string} s */
function squashSpaces(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classic Levenshtein edit distance (insert/delete/substitute), O(n·m).
 * @param {string} s1
 * @param {string} s2
 * @returns {number}
 */
export function levenshteinDistance(s1, s2) {
  const a = String(s1 || '');
  const b = String(s2 || '');
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  /** @type {number[]} */
  let prev = new Array(m + 1);
  /** @type {number[]} */
  let cur = new Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return prev[m];
}

/**
 * Largest k ≥ minOverlap such that s1.slice(-k) === s2.slice(0, k).
 * Used to glue OCR shards where the camera cut mid-token with real overlap.
 * @param {string} s1
 * @param {string} s2
 * @param {number} [minOverlap=2]
 * @returns {number} k, or 0 if none
 */
export function findSuffixPrefixOverlap(s1, s2, minOverlap = 2) {
  const a = String(s1 || '');
  const b = String(s2 || '');
  const max = Math.min(a.length, b.length);
  for (let k = max; k >= minOverlap; k--) {
    if (a.slice(-k) === b.slice(0, k)) return k;
  }
  return 0;
}

/** @param {string} t */
function tokenQualityScore(t) {
  const s = String(t || '');
  const letters = (s.match(/[a-z]/gi) || []).length;
  const digits = (s.match(/[0-9]/g) || []).length;
  const punct = (s.match(/[^a-z0-9\s]/gi) || []).length;
  return letters * 3 - digits * 4 - punct * 2 + Math.min(s.length, 12);
}

/**
 * Similarity in [0,1] from Levenshtein distance vs max length.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function stringSimilarity(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  const d = levenshteinDistance(s1, s2);
  const denom = Math.max(s1.length, s2.length);
  return denom === 0 ? 1 : 1 - d / denom;
}

/**
 * Merge two adjacent text blobs from consecutive frames: (1) whole-string
 * suffix–prefix overlap k≥2 (camera cut inside a repeated substring); (2) if
 * that fails, split each blob on **outer** commas and run `mergePairTokens` on
 * the last segment of `str1` and the first segment of `str2` — this is where
 * rotating-can line breaks usually land; (3) `mergePairTokens` tries word-level
 * overlap, then a guarded alphabetic-only concatenation for shards like
 * "su"+"gar" → "sugar" (no 2-char substring overlap).
 * @param {string} str1
 * @param {string} str2
 * @returns {string}
 */
export function mergeOverlappingWords(str1, str2) {
  const a = squashSpaces(String(str1));
  const b = squashSpaces(String(str2));
  if (!a) return b;
  if (!b) return a;

  const k0 = findSuffixPrefixOverlap(a, b, 2);
  if (k0 >= 2) return squashSpaces(a.slice(0, -k0) + b);

  const segsA = splitByOuterComma(a);
  const segsB = splitByOuterComma(b);
  if (!segsA.length) return b;
  if (!segsB.length) return a;

  const mergedPair = mergePairTokens(segsA[segsA.length - 1], segsB[0]);
  if (mergedPair == null) return squashSpaces(`${a}, ${b}`);

  const all = [...segsA.slice(0, -1), mergedPair, ...segsB.slice(1)];
  return squashSpaces(all.join(', '));
}

/**
 * Try to merge two comma-atomic segments (possibly multi-word) when OCR split
 * a token across frames. Returns a single merged segment, or null if no rule
 * fired (caller keeps them separate).
 * @param {string} left
 * @param {string} right
 * @returns {string | null}
 */
function mergePairTokens(left, right) {
  const L = squashSpaces(left);
  const R = squashSpaces(right);
  if (!L || !R) return L || R || null;

  const k = findSuffixPrefixOverlap(L, R, 2);
  if (k >= 2) return squashSpaces(L.slice(0, -k) + R);

  const lw = L.trim().split(/\s+/).filter(Boolean);
  const rw = R.trim().split(/\s+/).filter(Boolean);
  if (!lw.length || !rw.length) return null;

  const lwLast = lw[lw.length - 1];
  const rwFirst = rw[0];
  const kw = findSuffixPrefixOverlap(lwLast, rwFirst, 2);
  if (kw >= 2) {
    const w = lwLast.slice(0, -kw) + rwFirst;
    const merged = [...lw.slice(0, -1), w, ...rw.slice(1)].join(' ');
    return squashSpaces(merged);
  }

  /**
   * OCR shard stitch without character overlap: last word is a short alphabetic
   * prefix fragment and the first word completes it (e.g. "su" + "gar" → "sugar").
   * Guardrails: only letters, combined length ≤ 24, combined length ≥ 4.
   */
  if (
    /^[a-z]+$/i.test(lwLast) &&
    /^[a-z]+$/i.test(rwFirst) &&
    lwLast.length >= 2 &&
    lwLast.length <= 6 &&
    rwFirst.length >= 2 &&
    rwFirst.length <= 12
  ) {
    const cat = lwLast + rwFirst;
    if (cat.length >= 4 && cat.length <= 24 && /^[a-z]+$/i.test(cat)) {
      return squashSpaces([...lw.slice(0, -1), cat, ...rw.slice(1)].join(' '));
    }
  }

  return null;
}

/**
 * Spec-style split (regex-only); prefer `splitByOuterComma` for nested lists.
 * @param {string} text
 * @returns {string[]}
 */
export function splitByCommaIgnoreParensRegex(text) {
  const t = squashSpaces(text.replace(/\n/g, ' '));
  if (!t) return [];
  return t
    .split(/,(?![^(]*\))/)
    .map(x => x.trim())
    .filter(Boolean);
}

/**
 * Split on commas only when both `()` and `[]` nesting depths are zero.
 * @param {string} text
 * @returns {string[]}
 */
export function splitByOuterComma(text) {
  const src = String(text || '');
  if (!src.trim()) return [];
  const out = [];
  let cur = '';
  let depthParen = 0;
  let depthBracket = 0;

  for (const ch of src) {
    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);

    if (ch === ',' && depthParen === 0 && depthBracket === 0) {
      const piece = squashSpaces(cur.replace(/\n/g, ' '));
      if (piece) out.push(piece);
      cur = '';
    } else {
      cur += ch;
    }
  }
  const last = squashSpaces(cur.replace(/\n/g, ' '));
  if (last) out.push(last);
  return out;
}

export function normalizeOcrRaw(raw) {
  return squashSpaces(String(raw || '').replace(/\n/g, ' '));
}

/** Net `(` minus `)` depth; same for brackets (best-effort). */
function delimiterDepths(s) {
  let p = 0;
  let b = 0;
  for (const ch of s) {
    if (ch === '(') p++;
    else if (ch === ')') p = Math.max(0, p - 1);
    else if (ch === '[') b++;
    else if (ch === ']') b = Math.max(0, b - 1);
  }
  return { paren: p, bracket: b };
}

const MAX_PAREN_CARRY = 480;

/**
 * Concatenate prior carry (unclosed `(`, `[`) with new OCR until delimiters
 * balance, then emit comma-atomic ingredient strings. If still unbalanced,
 * returns `carryOver` for the next frame (Edge A/B: split emulsifier lines).
 *
 * @param {string} carryOver
 * @param {string} newRaw
 * @returns {{ tokens: string[], carryOver: string }}
 */
export function absorbIncompleteParenBuffer(carryOver, newRaw) {
  let merged = squashSpaces(`${carryOver || ''} ${normalizeOcrRaw(newRaw)}`);
  if (merged.length > MAX_PAREN_CARRY) {
    merged = merged.slice(-MAX_PAREN_CARRY);
  }
  if (!merged) return { tokens: [], carryOver: '' };

  const { paren, bracket } = delimiterDepths(merged);
  if (paren > 0 || bracket > 0) {
    return { tokens: [], carryOver: merged };
  }

  const parts = splitByOuterComma(merged);
  const tokens = parts
    .map(t => cleanAndSanitizeToken(t))
    .filter(t => t && isValidIngredientToken(t));
  return { tokens, carryOver: '' };
}

/**
 * Merge a pending alphabetic fragment (<3 chars, held in UI) with the next
 * frame’s OCR string so shard logic runs before delimiter absorption.
 * @param {string} pending
 * @param {string} newOcrRaw
 * @returns {{ text: string, consumedPending: boolean }}
 */
export function mergePendingFragmentWithOcr(pending, newOcrRaw) {
  const p = squashSpaces(pending);
  const o = normalizeOcrRaw(newOcrRaw);
  if (!p) return { text: o, consumedPending: false };
  if (p.length >= 3 || !/^[a-z]+$/i.test(p)) {
    return { text: squashSpaces(`${p} ${o}`), consumedPending: true };
  }
  const glued = mergeOverlappingWords(p, o);
  return { text: glued, consumedPending: true };
}

/** Nutrition / label noise — reject whole line or substring contexts. */
const NUTRITION_LINE = new RegExp(
  [
    '^\\s*calories\\b',
    '^\\s*energy\\b',
    '\\b\\d+\\s*(kcal|kj)\\b',
    '\\b\\d+\\s*(g|mg|kg|ml|l|oz)\\b\\s*$',
    '^\\s*\\d+%\\s*$',
    '\\bvitamin\\s+[a-z0-9]+\\s*\\d+\\s*(mg|mcg|iu|µg)\\b',
    '\\b\\d+\\s*(mg|mcg|iu|µg)\\s+vitamin\\b',
    '^\\s*fat\\s+\\d',
    '^\\s*protein\\s+\\d',
    '^\\s*carbohydrate',
    '^\\s*sodium\\s+\\d',
    '^\\s*sugars?\\s+\\d', // "Sugars 0g" fact line; ingredient "Sugar" kept elsewhere
    '^\\s*fiber\\s+\\d',
  ].join('|'),
  'i',
);

/**
 * Strip decorative punctuation and collapse inner spaces. Does not remove
 * legitimate inner hyphens inside words beyond edges.
 * @param {string} token
 * @returns {string}
 */
export function cleanAndSanitizeToken(token) {
  let s = squashSpaces(String(token || ''));
  if (!s) return '';

  s = s.replace(/^[\s.,;:\-_]+|[\s.,;:\-_]+$/g, '');
  s = s.replace(/^\(+|\)+$/g, '');
  s = s.replace(/^\[+|\]+$/g, '');

  if (NUTRITION_LINE.test(s)) return '';

  s = squashSpaces(s.replace(/^[\s.,;:\-_]+|[\s.,;:\-_]+$/g, ''));
  return s;
}

export function isValidIngredientToken(token) {
  const s = cleanAndSanitizeToken(token);
  if (!s) return false;
  if (s.length <= 1) return false;
  if (/^[0-9%\s.g]+$/i.test(s)) return false;
  if (/^\d+\s*(g|mg|kg|ml|l|oz)\b/i.test(s)) return false;
  if (/^\d+%$/.test(s)) return false;
  if (/^[0-9%\s.()[\],]+$/i.test(s)) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  if (NUTRITION_LINE.test(s)) return false;
  return true;
}

export function parseIngredientCandidatesFromOcr(rawText) {
  const normalized = normalizeOcrRaw(rawText);
  if (!normalized) return [];
  const parts = splitByOuterComma(normalized);
  return parts.map(p => cleanAndSanitizeToken(p)).filter(isValidIngredientToken);
}

/**
 * If similarity ≥ threshold, prefer the candidate with higher linguistic
 * quality (more letters, fewer digits).
 * @param {string} a
 * @param {string} b
 * @param {number} [threshold=0.8]
 * @returns {string}
 */
export function pickBetterFuzzyMatch(a, b, threshold = 0.8) {
  const s1 = cleanAndSanitizeToken(a);
  const s2 = cleanAndSanitizeToken(b);
  if (!s1) return s2;
  if (!s2) return s1;
  const sim = stringSimilarity(s1.toLowerCase(), s2.toLowerCase());
  if (sim < threshold) return s1;
  const q1 = tokenQualityScore(s1);
  const q2 = tokenQualityScore(s2);
  if (q2 > q1) return s2;
  if (q1 > q2) return s1;
  return s1.length >= s2.length ? s1 : s2;
}

/**
 * Collapse near-duplicate tokens (OCR typos "Sugar" vs "Sug4r") using
 * Levenshtein ≥ 80% similarity; keep higher-quality spelling.
 * @param {string[]} list
 * @param {number} [threshold=0.8]
 * @returns {string[]}
 */
export function fuzzyDedupeIngredientList(list, threshold = 0.8) {
  const arr = (Array.isArray(list) ? list : [])
    .map(t => cleanAndSanitizeToken(t))
    .filter(isValidIngredientToken);
  const out = [];
  for (const raw of arr) {
    let replaced = false;
    for (let i = 0; i < out.length; i++) {
      const sim = stringSimilarity(raw.toLowerCase(), out[i].toLowerCase());
      if (sim >= threshold) {
        out[i] = pickBetterFuzzyMatch(out[i], raw, threshold);
        replaced = true;
        break;
      }
    }
    if (!replaced) out.push(raw);
  }
  return out;
}

/**
 * Prefix-extension dedupe (Tomato ⊂ Tomato Paste): longer token replaces a
 * shorter strict prefix; shorter incoming fragments are dropped when a superset
 * already exists. Comma in the extension suffix blocks merge (two ingredients).
 * @param {string[]} list
 */
function prefixSupersetMerge(list) {
  const items = list.map(cleanAndSanitizeToken).filter(isValidIngredientToken);
  const out = [];
  for (const item of items) {
    const il = item.toLowerCase();
    let absorbed = false;
    for (let i = 0; i < out.length; i++) {
      const ex = out[i];
      const el = ex.toLowerCase();
      if (il === el) {
        out[i] = pickBetterFuzzyMatch(ex, item, 0.99);
        absorbed = true;
        break;
      }
      if (il.startsWith(el) && item.length > ex.length) {
        const suffix = item.slice(ex.length);
        if (/,/.test(suffix)) continue;
        out[i] = item;
        absorbed = true;
        break;
      }
      if (el.startsWith(il) && ex.length > item.length) {
        absorbed = true;
        break;
      }
    }
    if (!absorbed) out.push(item);
  }
  return out;
}

/**
 * Definitive merge pipeline:
 *  1. **Array boundary** — `mergeOverlappingWords(last, first)` on the seam
 *     between the previous frame’s last token and this frame’s first, then
 *     re-split on outer commas so multiple ingredients can appear in one glued
 *     string.
 *  2. **Sanitize** — every segment passes `cleanAndSanitizeToken` + validity.
 *  3. **Fuzzy dedupe** — Levenshtein similarity ≥ 0.8 collapses OCR typos
 *     (`Sugar` vs `Sug4r`); `pickBetterFuzzyMatch` keeps higher letter / lower digit score.
 *  4. **Prefix superset** — shorter strict prefixes are replaced or dropped
 *     (`Tomato` ⊂ `Tomato Paste`), unless a comma in the extension suggests two
 *     distinct ingredients.
 *  5. **Second fuzzy pass** — catches duplicates created by prefix pass.
 *
 * @param {string[]} currentArray
 * @param {string[]} newArray
 * @returns {string[]}
 */
export function advancedMergeEngine(currentArray, newArray) {
  const cur = (Array.isArray(currentArray) ? currentArray : [])
    .map(t => cleanAndSanitizeToken(t))
    .filter(isValidIngredientToken);
  const incoming = (Array.isArray(newArray) ? newArray : [])
    .map(t => cleanAndSanitizeToken(t))
    .filter(isValidIngredientToken);

  /** @type {string[]} */
  let combined;
  if (!cur.length) combined = [...incoming];
  else if (!incoming.length) combined = [...cur];
  else {
    const lastBlob = cur[cur.length - 1];
    const firstBlob = incoming[0];
    const stitchedBlob = mergeOverlappingWords(lastBlob, firstBlob);
    const tailParts = splitByOuterComma(stitchedBlob)
      .map(cleanAndSanitizeToken)
      .filter(isValidIngredientToken);
    combined = [...cur.slice(0, -1), ...tailParts, ...incoming.slice(1)];
  }

  let next = combined.map(cleanAndSanitizeToken).filter(isValidIngredientToken);
  next = fuzzyDedupeIngredientList(next, 0.8);
  next = prefixSupersetMerge(next);
  next = fuzzyDedupeIngredientList(next, 0.8);
  return next;
}

/**
 * After `advancedMergeEngine`, hold a trailing alphabetic fragment of length
 * &lt; 3 out of the **display** list so the UI can cache it for the next frame.
 * @param {string[]} mergedList
 * @returns {{ display: string[], pendingAlpha: string }}
 */
export function extractTrailingAlphaPending(mergedList) {
  const list = Array.isArray(mergedList) ? [...mergedList] : [];
  if (!list.length) return { display: [], pendingAlpha: '' };
  const last = list[list.length - 1];
  if (last && last.length < 3 && /^[a-z]+$/i.test(last)) {
    list.pop();
    return { display: list, pendingAlpha: last };
  }
  return { display: list, pendingAlpha: '' };
}

/** @deprecated Use `advancedMergeEngine` */
export function mergeIngredientLists(currentArray, incomingList) {
  return advancedMergeEngine(currentArray, incomingList);
}
