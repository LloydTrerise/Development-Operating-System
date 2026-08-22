import type { WorkflowDefinition, WorkflowVersion } from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { withTransaction } from './base.js';
import { createWorkflowDefinitionRepository } from './workflow-definitions.js';
import { createWorkflowVersionRepository } from './workflow-versions.js';

export type CreateWorkflowDraft = (
  definition: WorkflowDefinition,
  version: WorkflowVersion,
) => Promise<void>;

export function createWorkflowDraftCreator(db: Kysely<Database>): CreateWorkflowDraft {
  return async (definition, version) => {
    await withTransaction(db, async (trx) => {
      await createWorkflowDefinitionRepository(trx).create(definition);
      await createWorkflowVersionRepository(trx).create(version);
    });
  };
}
