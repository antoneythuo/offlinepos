/**
 * Custom application error classes.
 *
 * Each error carries a machine-readable `code` that IPC handlers can include
 * in the `IpcResult` error envelope so the renderer can react appropriately.
 */

export class AuthenticationError extends Error {
  readonly code = 'AUTH_FAILED'

  constructor(message = 'Authentication failed') {
    super(message)
    this.name = 'AuthenticationError'
    // Restore prototype chain (required when extending built-in Error in TS)
    Object.setPrototypeOf(this, AuthenticationError.prototype)
  }
}

export class AuthorizationError extends Error {
  readonly code = 'FORBIDDEN'

  constructor(message = 'Access denied') {
    super(message)
    this.name = 'AuthorizationError'
    Object.setPrototypeOf(this, AuthorizationError.prototype)
  }
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR'

  constructor(message = 'Validation failed') {
    super(message)
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND'

  constructor(message = 'Resource not found') {
    super(message)
    this.name = 'NotFoundError'
    Object.setPrototypeOf(this, NotFoundError.prototype)
  }
}

export class ConflictError extends Error {
  readonly code = 'CONFLICT'

  constructor(message = 'Resource already exists') {
    super(message)
    this.name = 'ConflictError'
    Object.setPrototypeOf(this, ConflictError.prototype)
  }
}
