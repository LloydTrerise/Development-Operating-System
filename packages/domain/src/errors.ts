/**
 * Moved here from `@devos/application` while fixing a circular dependency
 * DEVOS-057 introduced (`@devos/application` -> `@devos/tools` for
 * `invokeTool`, `@devos/tools` -> `@devos/application` for these error
 * classes and `registerCapability`) — both `application` and `tools`
 * already depend on `domain`, so these classes now live where both can
 * reach them without depending on each other. `@devos/application`'s own
 * `errors.ts` re-exports these unchanged, so every existing import of
 * `NotFoundError`/`ValidationError`/`ForbiddenError` from `@devos/application`
 * still works exactly as before.
 */
export class ApplicationError extends Error {}

export class NotFoundError extends ApplicationError {
  constructor(resource: string) {
    super(`${resource} not found.`);
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * DEVOS-077: signals to the task dispatcher (`apps/worker/src/task-dispatcher.ts`)
 * that a task failure must not be automatically retried (§24 Retry Rules,
 * specs/workflows/software-change-workflow.md: "Do not automatically retry
 * permission denials"). Every task handler that throws a plain `Error`
 * (or any other error type) is retried up to `MAX_TASK_ATTEMPTS` exactly as
 * before — this is an opt-in narrowing for the specific case a handler
 * itself recognises as non-transient (e.g. a policy-denied Tool Gateway
 * invocation), not a default classification the dispatcher infers on its
 * own.
 */
export class NonRetryableTaskError extends ApplicationError {}
