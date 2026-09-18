import type {
  Agent,
  AgentVersion,
  Membership,
  Project,
  WorkflowDefinition,
  WorkflowVersion,
} from '@devos/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../database.js';
import { createAgentRepository } from './agents.js';
import { createAgentVersionRepository } from './agent-versions.js';
import { withTransaction } from './base.js';
import { createMembershipRepository } from './memberships.js';
import { createProjectRepository } from './projects.js';
import { createWorkflowDefinitionRepository } from './workflow-definitions.js';
import { createWorkflowVersionRepository } from './workflow-versions.js';

export interface ProjectWorkflowClone {
  definition: WorkflowDefinition;
  version: WorkflowVersion;
}

export interface ProjectAgentClone {
  agent: Agent;
  version: AgentVersion;
}

export type CreateProjectWithClones = (
  project: Project,
  membership: Membership,
  workflows: ProjectWorkflowClone[],
  agents: ProjectAgentClone[],
) => Promise<void>;

/**
 * specs/architecture/organisations-and-project-types.md §8: project creation,
 * its OWNER membership, and every cloned WorkflowDefinition/WorkflowVersion/
 * Agent/AgentVersion from the project's type happen in one transaction so a
 * project is never left half-cloned.
 */
export function createProjectWithClonesCreator(db: Kysely<Database>): CreateProjectWithClones {
  return async (project, membership, workflows, agents) => {
    await withTransaction(db, async (trx) => {
      await createProjectRepository(trx).create(project);
      await createMembershipRepository(trx).create(membership);

      const workflowDefinitions = createWorkflowDefinitionRepository(trx);
      const workflowVersions = createWorkflowVersionRepository(trx);
      for (const { definition, version } of workflows) {
        await workflowDefinitions.create(definition);
        await workflowVersions.create(version);
      }

      const agentRepository = createAgentRepository(trx);
      const agentVersionRepository = createAgentVersionRepository(trx);
      for (const { agent, version } of agents) {
        await agentRepository.create(agent);
        await agentVersionRepository.create(version);
      }
    });
  };
}
