// True when two names are *almost* the same (one typo apart) but not identical,
// e.g. "Shanon" vs "Shannon". Used to ask "did you mean...?" instead of silently
// creating a second person who would block the everyone-has-submitted reveal.
export function isSimilarName(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x === y || Math.min(x.length, y.length) < 4) return false;
  if (Math.abs(x.length - y.length) > 1) return false;

  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;

  if (x.length === y.length) {
    // one substitution, or one adjacent transposition
    if (x.slice(i + 1) === y.slice(i + 1)) return true;
    return x[i] === y[i + 1] && x[i + 1] === y[i] && x.slice(i + 2) === y.slice(i + 2);
  }
  // one insertion/deletion
  return x.length > y.length ? x.slice(i + 1) === y.slice(i) : y.slice(i + 1) === x.slice(i);
}
