/**
 * "schemas: validates provider responses" (specs/architecture/repository-code-structure.md
 * §36). No concrete GitHub API contract exists anywhere in the spec corpus
 * (flagged in DEVOS-054's own task spec), and the core adapter operations
 * here talk to the real `git` CLI, not a JSON provider API — there is no
 * "provider response" to validate in the usual sense. This validates the
 * adapter's own *input* shapes instead (a repository path, a branch name),
 * which is the closest equivalent for a CLI-backed, not HTTP-backed,
 * provider.
 */
export function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty.`);
  }
}
