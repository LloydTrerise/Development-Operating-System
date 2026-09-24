import type { AgentId } from '@devos/contracts';

/**
 * DEVOS-295 (Sprint 48, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.3,
 * decision §9.4): the `AGENT_PROFILE` side of the `PRINCIPAL` unification —
 * one row per named `agents` row, shared across that agent's own
 * `agent_versions` history (publishing a new version is a config change,
 * not a new identity). `principalId` is always the exact same string as
 * `agentId` (mirroring `HumanProfile.principalId`'s reuse convention,
 * `packages/domain/src/principals/principal.ts`) — a real backing
 * `Principal` row with `principalType: 'AGENT'` always exists at that id.
 *
 * `accountableOwnerId` (DEVOS-296) is the agent's real, resolved human
 * owner — a `Principal.id` with `principalType: 'HUMAN'` — where one can be
 * resolved; absent, not fabricated, when it cannot (see
 * `specs/sprints/sprint-48/DEVOS-296.md` for which agents, if any, this
 * applied to against real data).
 *
 * This is attribution/ownership metadata only — an agent never
 * authenticates as itself (decision §9.7): no credential, no login, no
 * bearer token is added anywhere in this epic.
 */
export interface AgentProfile {
  agentId: AgentId;
  principalId: string;
  accountableOwnerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProfileRepository {
  getByAgentId: (agentId: AgentId) => Promise<AgentProfile | null>;
  create: (profile: AgentProfile) => Promise<void>;
}
