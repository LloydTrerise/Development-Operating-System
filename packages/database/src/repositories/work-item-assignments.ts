import type { WorkItemId } from '@devos/contracts';
import type { WorkItemAssignment, WorkItemAssignmentRepository } from '@devos/domain';
import type { WorkItemAssignmentsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: WorkItemAssignmentsTable): WorkItemAssignment {
  return {
    workItemId: row.work_item_id as WorkItemId,
    principalId: row.principal_id,
    role: row.role as WorkItemAssignment['role'],
    createdAt: row.created_at,
  };
}

export function createWorkItemAssignmentRepository(
  db: QueryExecutor,
): WorkItemAssignmentRepository {
  return {
    async listForWorkItem(workItemId) {
      const rows = await db
        .selectFrom('work_item_assignments')
        .selectAll()
        .where('work_item_id', '=', workItemId)
        .execute();
      return rows.map(toDomain);
    },

    async create(assignment) {
      await db
        .insertInto('work_item_assignments')
        .values({
          work_item_id: assignment.workItemId,
          principal_id: assignment.principalId,
          role: assignment.role,
          created_at: assignment.createdAt,
        })
        .onConflict((oc) => oc.columns(['work_item_id', 'principal_id', 'role']).doNothing())
        .execute();
    },

    async remove(workItemId, principalId, role) {
      await db
        .deleteFrom('work_item_assignments')
        .where('work_item_id', '=', workItemId)
        .where('principal_id', '=', principalId)
        .where('role', '=', role)
        .execute();
    },
  };
}
