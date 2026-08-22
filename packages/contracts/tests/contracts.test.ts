import { describe, expect, it } from 'vitest';
import {
  artifactStatuses,
  validateCreateWorkItemRequest,
  validateStartWorkflowRunRequest,
  workflowRunStatuses,
  workflowTaskStatuses,
  workflowVersionStatuses,
} from '../src/index.js';

describe('shared contract definitions', () => {
  it('contains the specified workflow lifecycle states', () => {
    expect(workflowVersionStatuses).toEqual([
      'DRAFT',
      'VALIDATING',
      'PUBLISHED',
      'DEPRECATED',
      'ARCHIVED',
    ]);
    expect(workflowRunStatuses).toEqual([
      'PENDING',
      'RUNNING',
      'WAITING',
      'AWAITING_APPROVAL',
      'PAUSED',
      'FAILED',
      'CANCELLED',
      'COMPLETED',
    ]);
    expect(workflowTaskStatuses).toContain('SUCCEEDED');
  });

  it('contains the specified artifact lifecycle states', () => {
    expect(artifactStatuses).toContain('APPROVED');
    expect(artifactStatuses).toContain('SUPERSEDED');
  });

  it('validates a work item creation request', () => {
    const result = validateCreateWorkItemRequest({
      title: 'Add status',
      source: 'jira',
    });

    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('Add status');
  });

  it('rejects an invalid work item creation request', () => {
    const result = validateCreateWorkItemRequest({
      title: '',
      source: '',
    });

    expect(result.success).toBe(false);
    expect(result.issues).toHaveLength(2);
  });

  it('validates a workflow run start request', () => {
    const result = validateStartWorkflowRunRequest({
      workItemId: '550e8400-e29b-41d4-a716-446655440000',
      inputs: {},
      idempotencyKey: 'request-1',
    });

    expect(result.success).toBe(true);
  });
});
