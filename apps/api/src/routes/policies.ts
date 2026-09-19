import type { OrganisationId, PolicyId, ProjectId } from '@devos/contracts';
import {
  createOrganisationPolicy,
  createPolicy,
  getPolicyForPrincipal,
  listPoliciesForOrganisation,
  listPoliciesForProject,
  publishPolicy,
  simulatePolicy,
  type PolicyUseCaseDeps,
} from '@devos/application';
import { parseCreatePolicyBody, toPolicyDto } from '../dto/policy.js';
import { requirePrincipal, type Route } from '../http/router.js';

export function createPolicyRoutes(prefix: string, deps: PolicyUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/policies`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const policies = await listPoliciesForProject(deps, user.id, params.projectId as ProjectId);
        return policies.map(toPolicyDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects/:projectId/policies`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseCreatePolicyBody(body);
        const policy = await createPolicy(deps, user.id, params.projectId as ProjectId, input);
        return toPolicyDto(policy);
      },
    },
    // DEVOS-139: the organisation-scoped mirror of the two routes above.
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/policies`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const policies = await listPoliciesForOrganisation(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
        return policies.map(toPolicyDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/organisations/:organisationId/policies`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseCreatePolicyBody(body);
        const policy = await createOrganisationPolicy(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          input,
        );
        return toPolicyDto(policy);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/policies/:policyId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const policy = await getPolicyForPrincipal(deps, user.id, params.policyId as PolicyId);
        return toPolicyDto(policy);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/policies/:policyId/publish`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const policy = await publishPolicy(deps, user.id, params.policyId as PolicyId);
        return toPolicyDto(policy);
      },
    },
    // DEVOS-141: policy simulation against real historical requests.
    {
      method: 'GET',
      pattern: `${prefix}/policies/:policyId/simulate`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return simulatePolicy(deps, user.id, params.policyId as PolicyId);
      },
    },
  ];
}
