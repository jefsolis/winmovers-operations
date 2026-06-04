import { Navigate } from 'react-router-dom'
import { useCurrentStaff } from '../hooks/useCurrentStaff'

/**
 * Blocks BODEGA users from write routes under Jobs.
 * While staff data is loading, renders nothing.
 */
export default function RequireJobWriteAccess({ children }) {
  const currentStaff = useCurrentStaff()

  if (currentStaff === undefined) return null

  if (currentStaff?.role === 'BODEGA') {
    return <Navigate to="/jobs" replace />
  }

  return children
}
