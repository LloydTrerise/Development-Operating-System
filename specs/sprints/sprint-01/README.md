# Sprint 1 — Foundation and Workflow Skeleton

**Historical source:** `Analysis/DevOS_POC_Sprint_1_Implementation_Tasks_v1.0.docx`
**Conversion date:** 2026-08-20

## Goal

Build the minimum durable DevOS control plane required to execute a simple workflow from a work item to a persisted engineering artifact. Sprint 1 proves the control loop before real autonomous agents or consequential external mutations are introduced.

## Architecture

`Web → REST API → Application Services → Domain → PostgreSQL + Outbox → Queue/Worker → Deterministic Task Stub → Artifact Store`

## Task authority

The task files in this directory are concise, version-controlled conversions of the historical developer-ready specification. Where the source did not state separate acceptance criteria, the converted task says so rather than inventing them.

## Sprint-wide acceptance criteria

- A developer can clone and start DevOS locally.
- An authorised user can create a work item and start the Software Change workflow.
- Durable run/task state, artifact creation, events, audit, restart safety, project isolation, and CI are demonstrated.

## Quality gates

Architecture dependency rules, migration/constraint checks, API contract tests, authentication/project isolation, worker restart/retry evidence, artifact provenance, outbox tests, workflow visibility, and vertical-slice E2E evidence.
