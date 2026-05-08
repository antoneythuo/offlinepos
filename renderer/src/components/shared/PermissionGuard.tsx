import React from 'react'
import { Navigate } from 'react-router-dom'
import { useSessionStore } from '../../store/sessionStore'

interface PermissionGuardProps {
  /** The permission key that must be present in the current user's role. */
  permission: string
  /** The route content to render when the user has the required permission. */
  children: React.ReactNode
}

/**
 * PermissionGuard — wraps a route element and checks whether the currently
 * authenticated user holds the required permission.
 *
 * - If the user has the permission, the children are rendered normally.
 * - If the user lacks the permission, they are redirected to /access-denied.
 * - If there is no authenticated user at all, they are redirected to /login.
 *
 * Requirement 22.4: The system SHALL deny access and display an "Access Denied"
 * message when a user attempts to access a feature outside their role's permissions.
 * Requirement 22.5: The system SHALL require authentication before accessing the system.
 * Requirement 30.1: Consistent UI behaviour across theme modes.
 */
function PermissionGuard({ permission, children }: PermissionGuardProps): React.ReactElement {
  const { currentUser, hasPermission } = useSessionStore()

  // No session at all — send to login
  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  // Session exists but role lacks the required permission
  if (!hasPermission(permission)) {
    return <Navigate to="/access-denied" replace />
  }

  // All checks passed — render the protected content
  return <>{children}</>
}

export default PermissionGuard
