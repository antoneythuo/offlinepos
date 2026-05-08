import React from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * AccessDeniedPage — shown when a user navigates to a route that requires
 * a permission their role does not have.
 *
 * Requirement 22.4: The system SHALL deny access and display an "Access Denied"
 * message when a user attempts to access a feature outside their role's permissions.
 */
function AccessDeniedPage(): React.ReactElement {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-gray-900 px-4">
      {/* Icon */}
      <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 text-red-600 dark:text-red-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Access Denied
      </h1>

      {/* Description */}
      <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm mb-8">
        You don't have permission to view this page. Contact your administrator if
        you believe this is a mistake.
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px] min-w-[44px]"
        >
          Go Back
        </button>
        <button
          type="button"
          onClick={() => navigate('/sales', { replace: true })}
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors min-h-[44px] min-w-[44px]"
        >
          Go to Sales
        </button>
      </div>
    </div>
  )
}

export default AccessDeniedPage
