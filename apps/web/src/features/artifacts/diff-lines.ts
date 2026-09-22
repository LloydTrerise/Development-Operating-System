/**
 * DEVOS-237: a small, pure, dependency-free line diff (classic LCS
 * backtrack) — no diff library exists anywhere in this monorepo today (see
 * specs/sprints/sprint-35/README.md's own grounding), and this need is
 * small and bounded (diffing two versions' pretty-printed `metadata` JSON,
 * not arbitrary large files), so one is written locally rather than adding
 * a new dependency, per AGENTS.md §11.
 */
export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

export function diffLines(a: string, b: string): DiffLine[] {
  const left = a.split('\n');
  const right = b.split('\n');
  const n = left.length;
  const m = right.length;

  // lcs[i][j] = length of the longest common subsequence of left[i:] and right[j:]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        left[i] === right[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      result.push({ type: 'unchanged', text: left[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      result.push({ type: 'removed', text: left[i]! });
      i++;
    } else {
      result.push({ type: 'added', text: right[j]! });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: 'removed', text: left[i]! });
    i++;
  }
  while (j < m) {
    result.push({ type: 'added', text: right[j]! });
    j++;
  }

  return result;
}
