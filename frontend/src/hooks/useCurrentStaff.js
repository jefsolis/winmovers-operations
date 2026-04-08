import { useEffect, useState } from 'react'
import { api } from '../api'

let _cached = undefined // module-level cache: undefined = not yet fetched, null = no match

/**
 * Returns the StaffMember record linked to the currently logged-in Azure AD user.
 * Returns null if the user has no matching StaffMember.
 * Result is cached for the lifetime of the page session.
 */
export function useCurrentStaff() {
  const [staff, setStaff] = useState(_cached)

  useEffect(() => {
    if (_cached !== undefined) {
      setStaff(_cached)
      return
    }
    api.get('/staff/me')
      .then(member => {
        _cached = member ?? null
        setStaff(_cached)
      })
      .catch(() => {
        _cached = null
        setStaff(null)
      })
  }, [])

  return staff
}
