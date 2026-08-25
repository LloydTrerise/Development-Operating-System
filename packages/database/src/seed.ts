import { createDatabaseClient } from './client.js';
import {
  SEED_AGENT_RUNTIME_MEMBERSHIP_ID,
  SEED_AGENT_RUNTIME_PRINCIPAL_ID,
  SEED_DEVELOPMENT_AGENT_CONFIGURATION,
  SEED_DEVELOPMENT_AGENT_ID,
  SEED_DEVELOPMENT_AGENT_KEY,
  SEED_DEVELOPMENT_AGENT_PROMPT_REFERENCE,
  SEED_DEVELOPMENT_AGENT_VERSION_ID,
  SEED_REVIEW_AGENT_CONFIGURATION,
  SEED_REVIEW_AGENT_ID,
  SEED_REVIEW_AGENT_KEY,
  SEED_REVIEW_AGENT_PROMPT_REFERENCE,
  SEED_REVIEW_AGENT_VERSION_ID,
  SEED_DEVELOPMENT_PATH_WORKFLOW_DEFINITION_ID,
  SEED_DEVELOPMENT_PATH_WORKFLOW_GRAPH,
  SEED_DEVELOPMENT_PATH_WORKFLOW_KEY,
  SEED_DEVELOPMENT_PATH_WORKFLOW_V2_GRAPH,
  SEED_DEVELOPMENT_PATH_WORKFLOW_V2_VERSION_ID,
  SEED_DEVELOPMENT_PATH_WORKFLOW_VERSION_ID,
  SEED_DISCOVERY_AGENT_CONFIGURATION,
  SEED_DISCOVERY_AGENT_ID,
  SEED_DISCOVERY_AGENT_KEY,
  SEED_DISCOVERY_AGENT_PROMPT_REFERENCE,
  SEED_DISCOVERY_AGENT_VERSION_ID,
  SEED_MEMBERSHIP_ID,
  SEED_ORGANISATION_ID,
  SEED_PLANNING_AGENT_CONFIGURATION,
  SEED_PLANNING_AGENT_ID,
  SEED_PLANNING_AGENT_KEY,
  SEED_PLANNING_AGENT_PROMPT_REFERENCE,
  SEED_PLANNING_AGENT_VERSION_ID,
  SEED_PLANNING_PATH_WORKFLOW_DEFINITION_ID,
  SEED_PLANNING_PATH_WORKFLOW_GRAPH,
  SEED_PLANNING_PATH_WORKFLOW_KEY,
  SEED_PLANNING_PATH_WORKFLOW_VERSION_ID,
  SEED_PRINCIPAL_ID,
  SEED_PROJECT_ID,
  SEED_RELEASE_PATH_WORKFLOW_DEFINITION_ID,
  SEED_RELEASE_PATH_WORKFLOW_GRAPH,
  SEED_RELEASE_PATH_WORKFLOW_KEY,
  SEED_RELEASE_PATH_WORKFLOW_V2_GRAPH,
  SEED_RELEASE_PATH_WORKFLOW_V2_VERSION_ID,
  SEED_RELEASE_PATH_WORKFLOW_VERSION_ID,
  SEED_REQUIREMENTS_AGENT_CONFIGURATION,
  SEED_REQUIREMENTS_AGENT_ID,
  SEED_REQUIREMENTS_AGENT_KEY,
  SEED_REQUIREMENTS_AGENT_PROMPT_REFERENCE,
  SEED_REQUIREMENTS_AGENT_VERSION_ID,
  SEED_TECHNICAL_DESIGN_AGENT_CONFIGURATION,
  SEED_TECHNICAL_DESIGN_AGENT_ID,
  SEED_TECHNICAL_DESIGN_AGENT_KEY,
  SEED_TECHNICAL_DESIGN_AGENT_PROMPT_REFERENCE,
  SEED_TECHNICAL_DESIGN_AGENT_VERSION_ID,
  SEED_TOOL_CAPABILITIES,
  SEED_WORKFLOW_DEFINITION_ID,
  SEED_WORKFLOW_GRAPH,
  SEED_WORKFLOW_KEY,
  SEED_WORKFLOW_VERSION_ID,
} from './seed-constants.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined) {
    throw new Error('DATABASE_URL is required to run the seed.');
  }

  const { db, close } = createDatabaseClient({ connectionString });
  const now = new Date().toISOString();

  await db
    .insertInto('organisations')
    .values({
      id: SEED_ORGANISATION_ID,
      name: 'DevOS Development',
      slug: 'devos-development',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('projects')
    .values({
      id: SEED_PROJECT_ID,
      organisation_id: SEED_ORGANISATION_ID,
      name: 'DevOS POC',
      slug: 'devos-poc',
      description: 'Seeded development project for the DevOS POC vertical slice.',
      status: 'ACTIVE',
      repository_id: null,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('memberships')
    .values({
      id: SEED_MEMBERSHIP_ID,
      organisation_id: SEED_ORGANISATION_ID,
      project_id: SEED_PROJECT_ID,
      principal_id: SEED_PRINCIPAL_ID,
      role: 'OWNER',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('memberships')
    .values({
      id: SEED_AGENT_RUNTIME_MEMBERSHIP_ID,
      organisation_id: SEED_ORGANISATION_ID,
      project_id: SEED_PROJECT_ID,
      principal_id: SEED_AGENT_RUNTIME_PRINCIPAL_ID,
      role: 'OWNER',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('workflow_definitions')
    .values({
      id: SEED_WORKFLOW_DEFINITION_ID,
      project_id: SEED_PROJECT_ID,
      key: SEED_WORKFLOW_KEY,
      name: SEED_WORKFLOW_GRAPH.name,
      description: SEED_WORKFLOW_GRAPH.description,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('workflow_versions')
    .values({
      id: SEED_WORKFLOW_VERSION_ID,
      workflow_definition_id: SEED_WORKFLOW_DEFINITION_ID,
      version: 1,
      status: 'PUBLISHED',
      definition: JSON.stringify(SEED_WORKFLOW_GRAPH),
      published_at: now,
      created_by: SEED_PRINCIPAL_ID,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agents')
    .values({
      id: SEED_DISCOVERY_AGENT_ID,
      project_id: SEED_PROJECT_ID,
      key: SEED_DISCOVERY_AGENT_KEY,
      name: 'Discovery Agent',
      description: 'Produces a factual discovery report from a work item (DEVOS-031).',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agent_versions')
    .values({
      id: SEED_DISCOVERY_AGENT_VERSION_ID,
      agent_id: SEED_DISCOVERY_AGENT_ID,
      version: 1,
      status: 'PUBLISHED',
      configuration: JSON.stringify(SEED_DISCOVERY_AGENT_CONFIGURATION),
      prompt_reference: SEED_DISCOVERY_AGENT_PROMPT_REFERENCE,
      created_by: SEED_PRINCIPAL_ID,
      published_at: now,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agents')
    .values({
      id: SEED_REQUIREMENTS_AGENT_ID,
      project_id: SEED_PROJECT_ID,
      key: SEED_REQUIREMENTS_AGENT_KEY,
      name: 'Requirements Agent',
      description: 'Produces a validated PRD from a discovery report (DEVOS-032).',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agent_versions')
    .values({
      id: SEED_REQUIREMENTS_AGENT_VERSION_ID,
      agent_id: SEED_REQUIREMENTS_AGENT_ID,
      version: 1,
      status: 'PUBLISHED',
      configuration: JSON.stringify(SEED_REQUIREMENTS_AGENT_CONFIGURATION),
      prompt_reference: SEED_REQUIREMENTS_AGENT_PROMPT_REFERENCE,
      created_by: SEED_PRINCIPAL_ID,
      published_at: now,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agents')
    .values({
      id: SEED_TECHNICAL_DESIGN_AGENT_ID,
      project_id: SEED_PROJECT_ID,
      key: SEED_TECHNICAL_DESIGN_AGENT_KEY,
      name: 'Technical Design Agent',
      description: 'Produces a validated technical design from a PRD (DEVOS-033).',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agent_versions')
    .values({
      id: SEED_TECHNICAL_DESIGN_AGENT_VERSION_ID,
      agent_id: SEED_TECHNICAL_DESIGN_AGENT_ID,
      version: 1,
      status: 'PUBLISHED',
      configuration: JSON.stringify(SEED_TECHNICAL_DESIGN_AGENT_CONFIGURATION),
      prompt_reference: SEED_TECHNICAL_DESIGN_AGENT_PROMPT_REFERENCE,
      created_by: SEED_PRINCIPAL_ID,
      published_at: now,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agents')
    .values({
      id: SEED_PLANNING_AGENT_ID,
      project_id: SEED_PROJECT_ID,
      key: SEED_PLANNING_AGENT_KEY,
      name: 'Planning Agent',
      description: 'Produces an implementation plan from a technical design (DEVOS-034).',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agent_versions')
    .values({
      id: SEED_PLANNING_AGENT_VERSION_ID,
      agent_id: SEED_PLANNING_AGENT_ID,
      version: 1,
      status: 'PUBLISHED',
      configuration: JSON.stringify(SEED_PLANNING_AGENT_CONFIGURATION),
      prompt_reference: SEED_PLANNING_AGENT_PROMPT_REFERENCE,
      created_by: SEED_PRINCIPAL_ID,
      published_at: now,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agents')
    .values({
      id: SEED_DEVELOPMENT_AGENT_ID,
      project_id: SEED_PROJECT_ID,
      key: SEED_DEVELOPMENT_AGENT_KEY,
      name: 'Development Agent',
      description: 'Proposes a code change from an approved implementation plan (DEVOS-057).',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agent_versions')
    .values({
      id: SEED_DEVELOPMENT_AGENT_VERSION_ID,
      agent_id: SEED_DEVELOPMENT_AGENT_ID,
      version: 1,
      status: 'PUBLISHED',
      configuration: JSON.stringify(SEED_DEVELOPMENT_AGENT_CONFIGURATION),
      prompt_reference: SEED_DEVELOPMENT_AGENT_PROMPT_REFERENCE,
      created_by: SEED_PRINCIPAL_ID,
      published_at: now,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agents')
    .values({
      id: SEED_REVIEW_AGENT_ID,
      project_id: SEED_PROJECT_ID,
      key: SEED_REVIEW_AGENT_KEY,
      name: 'Review Agent',
      description:
        'Independently assesses a code change against approved requirements/design/plan (DEVOS-065).',
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('agent_versions')
    .values({
      id: SEED_REVIEW_AGENT_VERSION_ID,
      agent_id: SEED_REVIEW_AGENT_ID,
      version: 1,
      status: 'PUBLISHED',
      configuration: JSON.stringify(SEED_REVIEW_AGENT_CONFIGURATION),
      prompt_reference: SEED_REVIEW_AGENT_PROMPT_REFERENCE,
      created_by: SEED_PRINCIPAL_ID,
      published_at: now,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('workflow_definitions')
    .values({
      id: SEED_PLANNING_PATH_WORKFLOW_DEFINITION_ID,
      project_id: SEED_PROJECT_ID,
      key: SEED_PLANNING_PATH_WORKFLOW_KEY,
      name: SEED_PLANNING_PATH_WORKFLOW_GRAPH.name,
      description: SEED_PLANNING_PATH_WORKFLOW_GRAPH.description,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('workflow_versions')
    .values({
      id: SEED_PLANNING_PATH_WORKFLOW_VERSION_ID,
      workflow_definition_id: SEED_PLANNING_PATH_WORKFLOW_DEFINITION_ID,
      version: 1,
      status: 'PUBLISHED',
      definition: JSON.stringify(SEED_PLANNING_PATH_WORKFLOW_GRAPH),
      published_at: now,
      created_by: SEED_PRINCIPAL_ID,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('workflow_definitions')
    .values({
      id: SEED_DEVELOPMENT_PATH_WORKFLOW_DEFINITION_ID,
      project_id: SEED_PROJECT_ID,
      key: SEED_DEVELOPMENT_PATH_WORKFLOW_KEY,
      name: SEED_DEVELOPMENT_PATH_WORKFLOW_GRAPH.name,
      description: SEED_DEVELOPMENT_PATH_WORKFLOW_GRAPH.description,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('workflow_versions')
    .values({
      id: SEED_DEVELOPMENT_PATH_WORKFLOW_VERSION_ID,
      workflow_definition_id: SEED_DEVELOPMENT_PATH_WORKFLOW_DEFINITION_ID,
      version: 1,
      status: 'PUBLISHED',
      definition: JSON.stringify(SEED_DEVELOPMENT_PATH_WORKFLOW_GRAPH),
      published_at: now,
      created_by: SEED_PRINCIPAL_ID,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('workflow_versions')
    .values({
      id: SEED_DEVELOPMENT_PATH_WORKFLOW_V2_VERSION_ID,
      workflow_definition_id: SEED_DEVELOPMENT_PATH_WORKFLOW_DEFINITION_ID,
      version: 2,
      status: 'PUBLISHED',
      definition: JSON.stringify(SEED_DEVELOPMENT_PATH_WORKFLOW_V2_GRAPH),
      published_at: now,
      created_by: SEED_PRINCIPAL_ID,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('workflow_definitions')
    .values({
      id: SEED_RELEASE_PATH_WORKFLOW_DEFINITION_ID,
      project_id: SEED_PROJECT_ID,
      key: SEED_RELEASE_PATH_WORKFLOW_KEY,
      name: SEED_RELEASE_PATH_WORKFLOW_GRAPH.name,
      description: SEED_RELEASE_PATH_WORKFLOW_GRAPH.description,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('workflow_versions')
    .values({
      id: SEED_RELEASE_PATH_WORKFLOW_VERSION_ID,
      workflow_definition_id: SEED_RELEASE_PATH_WORKFLOW_DEFINITION_ID,
      version: 1,
      status: 'PUBLISHED',
      definition: JSON.stringify(SEED_RELEASE_PATH_WORKFLOW_GRAPH),
      published_at: now,
      created_by: SEED_PRINCIPAL_ID,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('workflow_versions')
    .values({
      id: SEED_RELEASE_PATH_WORKFLOW_V2_VERSION_ID,
      workflow_definition_id: SEED_RELEASE_PATH_WORKFLOW_DEFINITION_ID,
      version: 2,
      status: 'PUBLISHED',
      definition: JSON.stringify(SEED_RELEASE_PATH_WORKFLOW_V2_GRAPH),
      published_at: now,
      created_by: SEED_PRINCIPAL_ID,
      created_at: now,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  for (const capability of SEED_TOOL_CAPABILITIES) {
    await db
      .insertInto('tool_capabilities')
      .values({
        id: capability.id,
        project_id: SEED_PROJECT_ID,
        key: capability.key,
        name: capability.name,
        risk_class: capability.riskClass,
        input_schema: JSON.stringify(capability.inputSchema),
        output_schema: JSON.stringify(capability.outputSchema),
        status: 'ACTIVE',
        created_at: now,
      })
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();
  }

  console.log('Seed data applied (or already present).');
  await close();
}

void main();
