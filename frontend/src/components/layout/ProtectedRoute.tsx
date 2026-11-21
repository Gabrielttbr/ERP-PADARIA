import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import LicencaGuard from '@/components/licenca/LicencaGuard'

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <LicencaGuard />
}
