# DEVOS-029 — Implement Agent Output Schemas

**Dependencies:** DEVOS-026. **Scope:** Structured-output validation for agent results, and defined failure handling when a model's output doesn't conform to its expected schema (distinct from a provider/network failure, which DEVOS-026's retry/attempt mechanics already cover). **Acceptance:** An agent output is validated against its schema before being accepted as a successful result; a non-conforming output is treated as a failure (not silently accepted), with tests covering both the valid and invalid paths.
