# DevOS Engineering Constitution

## Status

Approved for POC development.

## Purpose

This constitution defines the non-negotiable principles governing
the development of DevOS.

It applies to human developers and AI development agents.

---

# Principle 1 — Specification First

The approved specification is the source of truth for intended
system behaviour and architecture.

Implementation must conform to the approved specification.

Code must not silently redefine requirements.

---

# Principle 2 — No Invented Requirements

Developers and AI agents must not invent requirements when
information is missing.

If the available information is insufficient to make a correct
decision, the required response is:

"I do not have enough information to determine this."

The uncertainty must then be surfaced to the appropriate human.

---

# Principle 3 — Human Authority

AI agents may:

- analyse
- propose
- plan
- implement
- test
- review

AI agents do not have final authority over:

- business requirements
- architecture
- security policy
- production release
- access control
- consequential external actions

Human approval is required where defined by the workflow.

---

# Principle 4 — Architecture Compliance

Implementation must conform to the approved DevOS architecture.

Developers and AI agents must not introduce:

- new architectural patterns
- infrastructure components
- frameworks
- databases
- external services

without an approved architectural decision.

---

# Principle 5 — Small, Controlled Changes

Implementation work must be divided into small, independently
testable tasks.

A task must have:

- a clear objective
- defined scope
- acceptance criteria
- dependencies
- validation requirements

---

# Principle 6 — Security Is Outside the Model

Security controls must not depend solely on the AI model behaving
correctly.

Authorisation, access control, tool permissions and security
boundaries must be enforced by software outside the model.

---

# Principle 7 — Controlled External Actions

Agents must not directly perform uncontrolled external mutations.

External actions must occur through approved tool interfaces.

Examples include:

- Git operations
- pull request creation
- deployment
- database changes
- external API mutations

---

# Principle 8 — Traceability

Material engineering decisions must be traceable from:

Requirement
→ Specification
→ Task
→ Implementation
→ Test
→ Review
→ Result

---

# Principle 9 — Testable Requirements

Acceptance criteria must be objectively testable.

A task is not complete merely because:

- the code compiles
- the AI says it is complete
- the implementation looks correct

The required behaviour must be validated.

---

# Principle 10 — Evidence

Material DevOS operations must produce evidence.

Examples include:

- workflow execution
- agent execution
- tool execution
- artifact creation
- approval
- rejection
- deployment
- validation

---

# Principle 11 — Immutability of Evidence

Engineering evidence must not be silently overwritten.

Where an artifact changes, a new version must be created.

Where a decision changes, the new decision must be recorded.

---

# Principle 12 — Provider Independence

AI providers, external services and infrastructure components
should be accessed through appropriate abstractions.

The DevOS domain and workflow engine must not become unnecessarily
coupled to a single provider.

---

# Principle 13 — Fail Safely

When DevOS cannot safely determine what to do, it must stop,
surface the problem and request clarification or human intervention.

It must not guess.

---

# Principle 14 — Observability

Important DevOS operations must be observable.

The system should provide sufficient information to determine:

- what happened
- when it happened
- who initiated it
- which agent acted
- which tools were used
- what artifacts were produced
- what decisions were made
- why the workflow moved to its next state

---

# Principle 15 — Specification Changes Are Engineering Changes

Specifications are version-controlled engineering artifacts.

If implementation reveals that a specification is incorrect or
incomplete, the specification must be corrected through the normal
engineering process.

Code must not silently become the only source of truth.

---

# Principle 16 — Prefer Simplicity

DevOS is initially a POC.

Do not introduce complexity simply because it may be useful at
future scale.

Prefer:

- modular design
- clear interfaces
- simple deployment
- replaceable infrastructure
- explicit boundaries

over premature distributed architecture.

---

# Principle 17 — Build DevOS Using DevOS Principles

DevOS itself must be developed using the same specification-driven
and controlled agentic development process that DevOS is intended
to provide.

The development process is therefore part of the DevOS POC.

---

# Principle 18 — POC Before Platform

The objective of the POC is to prove the core DevOS concept.

The team should prioritise a working vertical slice over building
every theoretical platform capability.

---

# Final Rule

When in doubt:

1. Check the specification.
2. Check the architecture.
3. Check the task.
4. Identify the uncertainty.
5. Ask for clarification.

Never silently invent the answer.
