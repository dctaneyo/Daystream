/**
 * Display names are the human identity used for sharing: real names, not
 * handles. Letters in any script, combining marks, spaces, apostrophes,
 * hyphens and periods are allowed; digits, symbols and emoji are not.
 */
export function normalizeDisplayName(input) {
  const name = String(input ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 2 || name.length > 60) return null;
  if (!/^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u.test(name)) return null;
  if (!/\p{L}/u.test(name)) return null;
  return name;
}

/**
 * An invite may carry a six-digit ID or a name. Kept loose on purpose so
 * accounts backfilled before the naming rule can still be found by their
 * placeholder label; the database match is exact apart from case.
 */
export function cleanLookup(input) {
  const value = String(input ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return value.length >= 2 && value.length <= 60 ? value : null;
}
