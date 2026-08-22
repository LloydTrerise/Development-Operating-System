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
