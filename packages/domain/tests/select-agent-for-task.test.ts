import { describe, expect, it } from 'vitest';
import { selectAgentForTask } from '../src/agents/select-agent-for-task.js';
import type { Agent } from '../src/agents/agent.js';
import type { AgentVersion } from '../src/agents/agent-version.js';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1' as Agent['id'],
    projectId: 'project-1' as Agent['projectId'],
    key: 'agent-1',
    name: 'Agent One',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeVersion(overrides: Partial<AgentVersion> = {}): AgentVersion {
  return {
    id: 'version-1' as AgentVersion['id'],
    agentId: 'agent-1' as AgentVersion['agentId'],
    version: 1,
    status: 'PUBLISHED',
    configuration: {
      role: 'DEVELOPMENT',
      provider: 'gemini',
      modelRef: 'gemini-pro',
      allowedCapabilities: ['repo-read', 'repo-write'],
    },
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('selectAgentForTask', () => {
  it('returns null when no candidates match the required role', () => {
    const candidates = [
      {
        agent: makeAgent(),
        version: makeVersion({ configuration: { ...makeVersion().configuration, role: 'REVIEW' } }),
      },
    ];
    expect(selectAgentForTask(candidates, 'DEVELOPMENT', [])).toBeNull();
  });

  it('returns null when the only candidate is not PUBLISHED', () => {
    const candidates = [{ agent: makeAgent(), version: makeVersion({ status: 'DRAFT' }) }];
    expect(selectAgentForTask(candidates, 'DEVELOPMENT', [])).toBeNull();
  });

  it('returns null when a candidate is missing one required capability', () => {
    const candidates = [
      {
        agent: makeAgent(),
        version: makeVersion({
          configuration: { ...makeVersion().configuration, allowedCapabilities: ['repo-read'] },
        }),
      },
    ];
    expect(selectAgentForTask(candidates, 'DEVELOPMENT', ['repo-read', 'repo-write'])).toBeNull();
  });

  it('matches a single real candidate by role and capability', () => {
    const candidates = [{ agent: makeAgent(), version: makeVersion() }];
    const result = selectAgentForTask(candidates, 'DEVELOPMENT', ['repo-read']);
    expect(result?.agent.key).toBe('agent-1');
  });

  it('picks the lowest agent.key among multiple matching candidates', () => {
    const candidates = [
      { agent: makeAgent({ id: 'agent-b' as Agent['id'], key: 'zeta' }), version: makeVersion() },
      { agent: makeAgent({ id: 'agent-a' as Agent['id'], key: 'alpha' }), version: makeVersion() },
    ];
    const result = selectAgentForTask(candidates, 'DEVELOPMENT', []);
    expect(result?.agent.key).toBe('alpha');
  });

  it('treats an empty requiredCapabilities list as role-match-only', () => {
    const candidates = [
      {
        agent: makeAgent(),
        version: makeVersion({
          configuration: { ...makeVersion().configuration, allowedCapabilities: [] },
        }),
      },
    ];
    const result = selectAgentForTask(candidates, 'DEVELOPMENT', []);
    expect(result?.agent.key).toBe('agent-1');
  });

  describe('DEVOS-179: quality-aware tie-break', () => {
    it('prefers the real higher-pass-rate candidate over the lexicographically-earlier key', () => {
      const candidates = [
        {
          agent: makeAgent({ id: 'agent-a' as Agent['id'], key: 'alpha' }),
          version: makeVersion({ id: 'version-a' as AgentVersion['id'] }),
        },
        {
          agent: makeAgent({ id: 'agent-b' as Agent['id'], key: 'zeta' }),
          version: makeVersion({ id: 'version-b' as AgentVersion['id'] }),
        },
      ];
      const quality = new Map([
        ['version-a', 0.2],
        ['version-b', 0.9],
      ]);
      const result = selectAgentForTask(candidates, 'DEVELOPMENT', [], quality);
      expect(result?.agent.key).toBe('zeta');
    });

    it("reproduces today's exact ascending-key behaviour when no quality data exists", () => {
      const candidates = [
        { agent: makeAgent({ id: 'agent-b' as Agent['id'], key: 'zeta' }), version: makeVersion() },
        {
          agent: makeAgent({ id: 'agent-a' as Agent['id'], key: 'alpha' }),
          version: makeVersion(),
        },
      ];
      const result = selectAgentForTask(candidates, 'DEVELOPMENT', [], new Map());
      expect(result?.agent.key).toBe('alpha');
    });

    it('never numerically compares a candidate with no known rate against one that has one — falls through to ascending key', () => {
      const candidates = [
        {
          agent: makeAgent({ id: 'agent-a' as Agent['id'], key: 'zeta' }),
          version: makeVersion({ id: 'version-a' as AgentVersion['id'] }),
        },
        {
          agent: makeAgent({ id: 'agent-b' as Agent['id'], key: 'alpha' }),
          version: makeVersion({ id: 'version-b' as AgentVersion['id'] }),
        },
      ];
      // Only version-a (key "zeta") has a real, known 0% rate; version-b has none.
      const quality = new Map([['version-a', 0]]);
      const result = selectAgentForTask(candidates, 'DEVELOPMENT', [], quality);
      expect(result?.agent.key).toBe('alpha');
    });

    it('falls back to ascending key when both candidates have the same real rate', () => {
      const candidates = [
        {
          agent: makeAgent({ id: 'agent-a' as Agent['id'], key: 'zeta' }),
          version: makeVersion({ id: 'version-a' as AgentVersion['id'] }),
        },
        {
          agent: makeAgent({ id: 'agent-b' as Agent['id'], key: 'alpha' }),
          version: makeVersion({ id: 'version-b' as AgentVersion['id'] }),
        },
      ];
      const quality = new Map([
        ['version-a', 0.5],
        ['version-b', 0.5],
      ]);
      const result = selectAgentForTask(candidates, 'DEVELOPMENT', [], quality);
      expect(result?.agent.key).toBe('alpha');
    });
  });
});
