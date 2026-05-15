/**
 * 성분 문자열: 괄호 밖의 콤마만 분할 ((), [] 깊이 추적).
 * 예: "정제수, 혼합제제(제일인산나트륨, 탄산나트륨), 백설탕"
 *  -> ["정제수", "혼합제제(제일인산나트륨, 탄산나트륨)", "백설탕"]
 */
export function splitByOuterComma(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  let cur = '';
  let depthParen = 0;
  let depthBracket = 0;

  for (const ch of text) {
    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);

    if (ch === ',' && depthParen === 0 && depthBracket === 0) {
      const t = cur.trim();
      if (t) out.push(t);
      cur = '';
    } else {
      cur += ch;
    }
  }
  const last = cur.trim();
  if (last) out.push(last);
  return out;
}

function normalizeSegment(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function normKey(s: string): string {
  return normalizeSegment(s).toLowerCase();
}

/**
 * 숫자·기호만 있는 파편 등 제외. 성분 조각(su/gar)은 길이 1~2도 통과.
 */
export function isValidIngredient(text: string): boolean {
  const cleaned = normalizeSegment(text);
  if (!cleaned) return false;
  if (/^[0-9%\s.()[\],]+$/i.test(cleaned)) return false;
  if (!/[a-zA-Z가-힣]/.test(cleaned)) return false;
  return true;
}

/**
 * 기존 성분 배열(순서 유지)에 새 OCR 배열을 반영.
 * - 정확 중복(대소문자 무시) 스킵
 * - 짧은 조각이 긴 조각의 접두면 긴 쪽으로 교체(OCR 확장). 단, 확장부에 콤마가 있으면
 *   두 성분이 붙은 경우로 보고 교체하지 않음(보수적).
 * - 긴 조각이 짧은 조각을 이미 포함(접두)하면 짧은 쪽 무시
 */
export function mergeIngredientLists(currentList: string[], newList: string[]): string[] {
  const merged = currentList.map(normalizeSegment).filter(Boolean);
  const seen = new Set(merged.map(normKey));

  for (const raw of newList) {
    const item = normalizeSegment(raw);
    if (!item || !isValidIngredient(item)) continue;
    const key = normKey(item);
    if (seen.has(key)) continue;

    let handled = false;
    for (let i = merged.length - 1; i >= 0; i--) {
      const existing = merged[i];
      const exKey = normKey(existing);
      if (exKey === key) {
        handled = true;
        break;
      }

      const exLower = existing.toLowerCase();
      const itemLower = item.toLowerCase();

      if (itemLower.startsWith(exLower) && item.length > existing.length) {
        const suffix = item.slice(existing.length);
        if (/,/.test(suffix)) continue;
        merged[i] = item;
        seen.delete(exKey);
        seen.add(key);
        handled = true;
        break;
      }
      if (exLower.startsWith(itemLower) && existing.length > item.length) {
        handled = true;
        break;
      }
    }

    if (!handled) {
      merged.push(item);
      seen.add(key);
    }
  }

  return merged;
}

/**
 * 서버가 준 성분 배열을 커밋 직전에 정리: 각 행을 괄호 밖 콤마 기준으로 펼치고,
 * `mergeIngredientLists`로 순서 유지·접두 확장·중복 제거.
 */
export function normalizeScanIngredientList(ingredients: string[]): string[] {
  const flat: string[] = [];
  for (const row of ingredients) {
    for (const part of splitByOuterComma(row)) {
      const t = normalizeSegment(part);
      if (t) flat.push(t);
    }
  }
  return mergeIngredientLists([], flat);
}

/** 이름 호환 — `mergeIngredientLists`와 동일 */
export const mergeIngredients = mergeIngredientLists;
