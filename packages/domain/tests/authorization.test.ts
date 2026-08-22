import { describe, expect, it } from 'vitest';
import { canManageMembers, canUpdateProject } from '../src/projects/authorization.js';

describe('project authorization', () => {
  it('allows OWNER to manage members and update the project', () => {
    expect(canManageMembers('OWNER')).toBe(true);
    expect(canUpdateProject('OWNER')).toBe(true);
  });

  it('denies MEMBER from managing members or updating the project', () => {
    expect(canManageMembers('MEMBER')).toBe(false);
    expect(canUpdateProject('MEMBER')).toBe(false);
  });
});
