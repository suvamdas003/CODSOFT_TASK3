/**
 * Domain errors thrown by services. Server actions and route handlers turn
 * them into user-facing messages; anything else is logged and reported as a
 * generic failure so internals never leak to the client.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message, 400, fieldErrors);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many attempts. Please wait a moment and try again.") {
    super(message, 429);
  }
}
