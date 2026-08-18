# DevOS

DevOS is an agentic software development platform designed to orchestrate
software engineering workflows using AI agents, controlled tools,
engineering knowledge, human approvals and auditable artifacts.

## Project Status

POC — Under Development

## Development Approach

DevOS is being developed using a specification-driven, AI-assisted
software development process.

The specifications in `/specs` define the intended behaviour and
architecture of the system.

Individual implementation tasks are defined under:

`/specs/sprints/`

## Repository Structure

- `/apps` — Deployable applications
- `/packages` — Reusable application/domain packages
- `/specs` — Product, functional and technical specifications
- `/tests` — Cross-package and end-to-end tests
- `/infrastructure` — Local and deployment infrastructure
- `/docs` — Engineering documentation
- `/.ai` — AI development instructions and templates

## Development Principles

1. Specification first
2. Small implementation tasks
3. Human approval of material technical decisions
4. No invented requirements
5. Automated validation
6. Security enforced outside AI models
7. Traceability from requirements to implementation and tests