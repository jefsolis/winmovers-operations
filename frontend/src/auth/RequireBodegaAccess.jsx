import { Navigate } from 'react-router-dom'
import { useCurrentStaff } from '../hooks/useCurrentStaff'

/**
 * Redirects home based on staff role.
 * BODEGA users land on /schedule; everyone else lands on /dashboard.
 */
export function HomeRedirect() {
  const currentStaff = useCurrentStaff()

  if (currentStaff === undefined) return null

  if (currentStaff?.role === 'BODEGA') {
    return <Navigate to="/schedule" replace />
  }

  return <Navigate to="/dashboard" replace />
}

/**
 * Blocks BODEGA users from non-allowed modules.
 */
export default function RequireNonBodega({ children }) {
  const currentStaff = useCurrentStaff()

  if (currentStaff === undefined) return null

  if (currentStaff?.role === 'BODEGA') {
    return <Navigate to="/schedule" replace />
  }

  return children
}
