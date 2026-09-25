import type { AgentInvocationRequest } from '../model-adapter.js';

/**
 * DEVOS-315 (Sprint 53): extracted from `gemini.ts` (DEVOS-027) unchanged —
 * both real provider adapters build their prompt text identically, so a
 * second provider doesn't silently drift from the first's own prompt
 * shape. Byte-for-byte the same text Gemini already sends; Anthropic's own
 * adapter is the first new caller.
 */
export function buildAgentPrompt(request: AgentInvocationRequest): string {
  return [
    // DEVOS-028: resolved prompt text (from the agent version's
    // promptReference) leads, when present, so it genuinely shapes the
    // model's behavior rather than being inert metadata.
    request.systemInstructions,
    `You are an agent performing the "${request.configuration.role}" role in an automated software engineering pipeline.`,
    `Objective: ${request.objective}`,
    `Input (JSON): ${JSON.stringify(request.input)}`,
    'Respond with a single JSON object containing your result. Do not include any text outside the JSON object.',
    'If required information is missing or uncertain, include an "uncertainty" array of { "statement": string, "severity": "LOW" | "MEDIUM" | "HIGH" } entries rather than inventing a value.',
  ]
    .filter((part): part is string => part !== undefined)
    .join('\n\n');
}

/** DEVOS-315: extracted from `gemini.ts` unchanged — see `buildAgentPrompt` above. */
export function parseJsonResultText(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { text };
  }
}
