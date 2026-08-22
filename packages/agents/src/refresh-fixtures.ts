import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentConfiguration } from '@devos/contracts';
import type { AgentFixture } from './fixtures/fixture-repository.js';
import {
  createFilesystemPromptRepository,
  createFilesystemSchemaRepository,
  createGeminiModelAdapter,
  validateAgentOutput,
} from './index.js';
import type {
  AgentInvocationRequest,
  AgentInvocationResult,
  AgentModelAdapter,
} from './model-adapter.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini's free tier enforces a short rolling-window rate limit (observed:
 * one request per ~30-35s) on top of its documented daily cap — hit on
 * every real run of this script, not just an unlucky one. Retries a
 * handful of times with a fixed wait rather than failing the whole refresh
 * over what is, in practice, a routine and expected condition for this
 * specific tool.
 */
async function invokeWithRateLimitRetry(
  modelAdapter: AgentModelAdapter,
  request: AgentInvocationRequest,
  maxAttempts = 4,
  waitMs = 40_000,
): Promise<AgentInvocationResult> {
  let lastResult: AgentInvocationResult | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await modelAdapter.invoke(request);
    if (result.status === 'SUCCEEDED') return result;
    lastResult = result;
    const isRateLimit = result.errorMessage?.includes('429') ?? false;
    if (!isRateLimit || attempt === maxAttempts) break;
    console.log(
      `  rate-limited, waiting ${waitMs / 1000}s before retry ${attempt + 1}/${maxAttempts}...`,
    );
    await delay(waitMs);
  }
  return lastResult!;
}

/**
 * DEVOS-037's "documented (manual or scripted) path... for refreshing a
 * fixture against the real provider when a prompt or schema changes
 * deliberately". Run with:
 *
 *   GEMINI_API_KEY=... pnpm --filter @devos/agents refresh-fixtures
 *
 * Chains all four planning-path stages exactly like the real handlers do
 * (each consuming stage's input includes the previous stage's real
 * output), makes one real Gemini call per stage, validates each result
 * against the CURRENT schema before writing it (a fixture that doesn't
 * validate is a bug in this script or the schema, not something to record
 * silently), and overwrites the corresponding fixture.json.
 *
 * The representative work item is fixed and deliberately unglamorous —
 * refreshing is about re-recording real model behavior against the
 * current prompts/schemas, not designing a new scenario every time.
 */
const WORK_ITEM_TITLE = 'Add CSV export to the reporting dashboard';
const WORK_ITEM_DESCRIPTION =
  'Users on the analytics team need to export the current reporting dashboard view as a CSV file for offline analysis. No specific format or column list has been agreed yet.';

interface StageSpec {
  fixtureName: string;
  role: string;
  outputSchemaRef: string;
  promptReference: string;
  buildInput: (prior: Record<string, Record<string, unknown>>) => Record<string, unknown>;
}

const STAGES: StageSpec[] = [
  {
    fixtureName: 'discovery',
    role: 'DISCOVERY',
    outputSchemaRef: 'discovery-report-v1',
    promptReference: 'discovery/v1',
    buildInput: () => ({}),
  },
  {
    fixtureName: 'requirements',
    role: 'REQUIREMENTS',
    outputSchemaRef: 'prd-v1',
    promptReference: 'requirements/v1',
    buildInput: (prior) => ({ discoveryReport: prior.discovery }),
  },
  {
    fixtureName: 'technical-design',
    role: 'TECHNICAL_DESIGN',
    outputSchemaRef: 'technical-design-v1',
    promptReference: 'technical-design/v1',
    buildInput: (prior) => ({ prd: prior.requirements }),
  },
  {
    fixtureName: 'planning',
    role: 'PLANNING',
    outputSchemaRef: 'implementation-plan-v1',
    promptReference: 'planning/v1',
    buildInput: (prior) => ({ technicalDesign: prior['technical-design'] }),
  },
];

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required to refresh fixtures.');

  const modelAdapter = createGeminiModelAdapter({ apiKey });
  const prompts = createFilesystemPromptRepository();
  const schemas = createFilesystemSchemaRepository();
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const fixturesRoot = path.join(currentDir, '..', 'src', 'fixtures');

  const priorResults: Record<string, Record<string, unknown>> = {};

  for (const stage of STAGES) {
    console.log(`Refreshing "${stage.fixtureName}" fixture (role ${stage.role})...`);

    const configuration: AgentConfiguration = {
      role: stage.role,
      provider: 'gemini',
      modelRef: 'gemini-3.6-flash',
      outputSchemaRef: stage.outputSchemaRef,
      allowedCapabilities: [],
    };
    const systemInstructions = await prompts.resolve(stage.promptReference);
    const objective = `Perform the "${stage.role}" role for work item "${WORK_ITEM_TITLE}".`;
    const input = {
      workItemTitle: WORK_ITEM_TITLE,
      workItemDescription: WORK_ITEM_DESCRIPTION,
      runInput: {},
      ...stage.buildInput(priorResults),
    };

    const invocation = await invokeWithRateLimitRetry(modelAdapter, {
      configuration,
      promptReference: stage.promptReference,
      systemInstructions,
      objective,
      input,
    });

    if (invocation.status === 'FAILED') {
      throw new Error(`Refresh failed for "${stage.fixtureName}": ${invocation.errorMessage}`);
    }

    const schema = await schemas.resolve(stage.outputSchemaRef);
    const issues = validateAgentOutput(invocation.result ?? {}, schema);
    if (issues.length > 0) {
      throw new Error(
        `Refreshed "${stage.fixtureName}" output failed schema "${stage.outputSchemaRef}": ${issues
          .map((issue) => `${issue.field} ${issue.message}`)
          .join('; ')}`,
      );
    }

    const fixture: AgentFixture = {
      role: stage.role,
      recordedAt: new Date().toISOString(),
      provider: 'gemini',
      modelRef: configuration.modelRef,
      objective,
      input,
      result: invocation.result ?? {},
      ...(invocation.uncertainty !== undefined ? { uncertainty: invocation.uncertainty } : {}),
    };

    const filePath = path.join(fixturesRoot, stage.fixtureName, 'v1', 'fixture.json');
    await writeFile(filePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
    console.log(`  wrote ${filePath}`);

    priorResults[stage.fixtureName] = fixture.result;
  }

  console.log('All four fixtures refreshed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
