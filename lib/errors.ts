// Typed error hierarchy. See docs/11-error-handling-and-observability.md.
// Each error carries a stable `code` for clients + an HTTP status for route handlers.

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 500,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ValidationError extends AppError {
  constructor(fields: Record<string, string[]>, message = 'Validation failed') {
    super(message, 'VALIDATION', 400, fields)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
  }
}

export class TransitionError extends AppError {
  constructor(from: string, to: string) {
    super(`Invalid state transition ${from} → ${to}`, 'INVALID_TRANSITION', 422)
  }
}

export class RateLimitError extends AppError {
  constructor(public readonly retryAfter: number) {
    super('Too many requests', 'RATE_LIMIT', 429)
  }
}
