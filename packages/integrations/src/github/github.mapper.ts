/** Converts raw `git` CLI output into clean values ("mapper: converts
 * provider models", specs/architecture/repository-code-structure.md §36). */
export function extractCommitSha(revParseStdout: string): string {
  return revParseStdout.trim();
}
