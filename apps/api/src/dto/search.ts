import type { ProjectSearchResults } from '@devos/application';
import { toAgentDto } from './agent.js';
import { toArtifactDto } from './artifact.js';
import { toWorkItemDto } from './work-item.js';
import { toWorkflowDefinitionDto } from './workflow.js';

// DEVOS-262: reuses each entity's already-existing `to*Dto` function rather
// than inventing a new shape, per the epic's own delivery principle.
export function toProjectSearchResultsDto(results: ProjectSearchResults) {
  return {
    projectId: results.projectId,
    query: results.query,
    workItems: results.workItems.map(toWorkItemDto),
    artifacts: results.artifacts.map(toArtifactDto),
    workflows: results.workflows.map(toWorkflowDefinitionDto),
    agents: results.agents.map(toAgentDto),
  };
}
