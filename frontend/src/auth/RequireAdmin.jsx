import { Navigate } from 'react-router-dom'
import { useCurrentStaff } from '../hooks/useCurrentStaff'

/**
 * Restricts a route to staff members with role === 'ADMIN'.
 * While the staff record is loading (undefined), renders nothing.
 * If the user has no staff record or is not an admin, redirects to /dashboard.
 */
export default function RequireAdmin({ children }) {
  const currentStaff = useCurrentStaff()

  // Still loading — render nothing to avoid a flash
  if (currentStaff === undefined) return null

  if (!currentStaff || currentStaff.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
