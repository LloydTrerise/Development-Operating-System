# DevOS Build Roadmap

**Product:** DevOS
**Purpose:** Authoritative task-level implementation roadmap
**Last Updated:** 2026-08-20

## Authority

Sprint task specifications under `specs/sprints/` are the authority for task-level IDs, scope, dependencies, and acceptance criteria. Sprint 1 was recovered from its historical developer-ready task specification. The separate historical product backlog is strategic planning only because its DEVOS IDs conflict with Sprint 1.

## Current position

| Field                | Value                                                              |
| -------------------- | ------------------------------------------------------------------ |
| Current sprint       | Sprint 1 — Foundation and workflow skeleton                        |
| Current task         | DEVOS-005 — API Application                                        |
| Status               | NEXT; a partial API shell exists                                   |
| Completed foundation | DEVOS-001 and DEVOS-002                                            |
| Verification debt    | DEVOS-003 and DEVOS-004 integration criteria                       |
| Next action          | Prepare and obtain approval for the DEVOS-005 implementation plan. |

## Delivery roadmap

| Sprint | Tasks         | Intended outcome                                   | Status      |
| ------ | ------------- | -------------------------------------------------- | ----------- |
| 1      | DEVOS-001–024 | Durable deterministic control-plane vertical slice | IN PROGRESS |
| 2      | DEVOS-025–038 | Agent runtime and planning artifacts               | FUTURE      |
| 3      | DEVOS-039–050 | Knowledge, policy, and planning approval           | FUTURE      |
| 4      | DEVOS-051–061 | Controlled development and Git integration         | FUTURE      |
| 5      | DEVOS-062–071 | Validation, review, and rework                     | FUTURE      |
| 6      | DEVOS-072–081 | Release controls and complete workflow             | FUTURE      |
| 7      | DEVOS-082–092 | Security, observability, and recovery hardening    | FUTURE      |
| 8      | DEVOS-093–103 | Pilot, acceptance review, and post-POC roadmap     | FUTURE      |

## Sprint 1 implementation sequence

1. DEVOS-001–002 — monorepo and tooling
2. DEVOS-003–004 — shared contracts and configuration
3. DEVOS-005 — API Application
4. DEVOS-006 — Worker Application
5. DEVOS-007 — Web Application
6. DEVOS-008–009 — PostgreSQL foundation and migrations
7. DEVOS-010–024 — identity through hardening/demo, in the task catalogue order

## Governance

- Work only on the current task and stop after validation.
- A task is complete only when its documented acceptance criteria are demonstrated.
- Record cross-task verification as explicit debt; do not silently relax criteria.
- Convert and approve future-sprint task specifications before that sprint begins.
