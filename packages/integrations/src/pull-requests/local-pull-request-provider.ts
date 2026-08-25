import { randomUUID } from 'node:crypto';
import type {
  CreatePullRequestRequest,
  PullRequestProvider,
  PullRequestRecord,
} from './pull-request-provider.js';

/**
 * The fake/local `PullRequestProvider` this sprint's user-authorized
 * scoping decision requires: records a pull request in memory rather than
 * calling a real GitHub API. Idempotent on `idempotencyKey` — a repeated
 * request with the same key returns the original record rather than
 * creating a second one, satisfying DEVOS-058's own acceptance criterion
 * directly at the provider (a capability-specific concern, narrower than
 * DEVOS-059's later, general-purpose mutation-safety controls at the Tool
 * Gateway level).
 */
export function createLocalPullRequestProvider(): PullRequestProvider {
  const recordsByIdempotencyKey = new Map<string, PullRequestRecord>();

  return {
    async createPullRequest(request: CreatePullRequestRequest): Promise<PullRequestRecord> {
      const existing = recordsByIdempotencyKey.get(request.idempotencyKey);
      if (existing) return existing;

      const id = randomUUID();
      const record: PullRequestRecord = {
        id,
        title: request.title,
        sourceBranch: request.sourceBranch,
        targetBranch: request.targetBranch,
        ...(request.description !== undefined ? { description: request.description } : {}),
        url: `local-pr://${id}`,
      };
      recordsByIdempotencyKey.set(request.idempotencyKey, record);
      return record;
    },
  };
}
