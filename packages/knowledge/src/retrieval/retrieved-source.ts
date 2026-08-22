/**
 * A normalized retrieval result — the unit `packages/knowledge`'s retrieval
 * functions return, regardless of the underlying kind (knowledge source,
 * project context, or artifact). Shares its `{ type, ref }` shape with
 * `ContextManifestSource` (specs/api/poc-api-contracts.md §28) so a
 * retrieved source can be recorded into a context manifest without
 * translation (DEVOS-041/042).
 */
export interface RetrievedSource {
  type: string;
  ref: string;
  name: string;
  content: unknown;
}
