import type { IntegrationId, IntegrationStatus, ProjectId } from '@devos/contracts';

/**
 * "A configured connection between DevOS and an external engineering
 * system" (specs/architecture/domain-model.md §11.1) — source control,
 * issue tracking, CI/CD, etc. Matches
 * specs/database/poc-database-schema.md §13.1's exact column shape, with
 * one reconciliation: §13.1's column list has no `credential_reference`
 * column, despite specs/api/poc-api-contracts.md §33 requiring a
 * "credential reference" as part of the Integration contract
 * ("Credentials are references only"). Rather than adding an undocumented
 * column, `credentialReference` is nested inside the one JSONB column the
 * schema does provide (`configuration`) — a reference *name* is not itself
 * secret material, so this doesn't violate §13.1's "Secrets are referenced
 * through a secret-management mechanism and are not stored in this table
 * as plaintext."
 */
export interface Integration {
  id: IntegrationId;
  projectId: ProjectId;
  type: string;
  provider: string;
  name: string;
  status: IntegrationStatus;
  /** The name of an environment variable holding the secret — resolved via
   * `@devos/integrations`'s `CredentialResolver`, never the secret itself. */
  credentialReference: string;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationRepository {
  getById: (id: IntegrationId) => Promise<Integration | null>;
  listForProject: (projectId: ProjectId) => Promise<Integration[]>;
  create: (integration: Integration) => Promise<void>;
}
