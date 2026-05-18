import { Navigate } from 'react-router-dom'
import { useCurrentStaff } from '../hooks/useCurrentStaff'

/**
 * Restricts a route to staff with canAccessSchedule === true OR role === 'ADMIN'.
 * While the staff record is loading (undefined), renders nothing.
 */
export default function RequireScheduleAccess({ children }) {
  const currentStaff = useCurrentStaff()

  if (currentStaff === undefined) return null

  if (!currentStaff || (!currentStaff.canAccessSchedule && currentStaff.role !== 'ADMIN' && currentStaff.role !== 'BODEGA')) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
