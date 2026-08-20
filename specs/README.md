# DevOS Specifications

This directory contains the authoritative specifications used to
design and build DevOS.

## Specification Hierarchy

### Product

Defines the purpose, objectives and boundaries of DevOS.

`/product`

### Functional

Defines what DevOS must do.

`/functional`

### Architecture

Defines the conceptual and structural architecture.

`/architecture`

### Domain

Defines the business and engineering domain model.

`/domain`

### Workflows

Defines how DevOS orchestrates engineering work.

`/workflows`

### Agents

Defines agent capabilities and execution behaviour.

`/agents`

### Knowledge

Defines knowledge and context management.

`/knowledge`

### Tools

Defines tool and integration capabilities.

`/tools`

### Artifacts

Defines engineering outputs and evidence.

`/artifacts`

### Security

Defines identity, access control and security boundaries.

`/security`

### UI

Defines the DevOS user experience.

`/ui`

### Technical

Defines implementation architecture and technical decisions.

`/technical`

### API

Defines API and data contracts.

`/api`

### Database

Defines persistence and data models.

`/database`

### Sprint Tasks

Defines individual implementation tasks.

`/sprints`

## Source of Truth

Specifications are version controlled alongside the source code.

Implementation must conform to the approved specifications.

If implementation reveals that a specification is incorrect or
incomplete, the specification must be updated through the normal
engineering process.

## Specification Priority

When specifications overlap:

1. DevOS Engineering Constitution
2. Product specification
3. Functional specification
4. Architecture specification
5. Technical specification
6. Workflow specification
7. Sprint/task specification

A lower-level specification must not silently contradict a
higher-level specification.
