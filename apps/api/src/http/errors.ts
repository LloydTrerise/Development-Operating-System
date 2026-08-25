export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends HttpError {
  constructor(path: string) {
    super(404, 'DEVOS_NOT_FOUND', `No route matches ${path}.`);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, 'DEVOS_BAD_REQUEST', message);
  }
}

export class AuthenticationError extends HttpError {
  constructor() {
    super(401, 'DEVOS_UNAUTHENTICATED', 'Authentication is required for this endpoint.');
  }
}

export class AuthorizationError extends HttpError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, 'DEVOS_FORBIDDEN', message);
  }
}

/**
 * DEVOS-091: closes a real, previously-unaddressed gap the security review
 * found — specs/api/poc-api-contracts.md §41 requires the API to
 * "rate-limit expensive endpoints," and no rate limiting existed anywhere.
 */
export class RateLimitError extends HttpError {
  constructor() {
    super(429, 'DEVOS_RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.');
  }
}
