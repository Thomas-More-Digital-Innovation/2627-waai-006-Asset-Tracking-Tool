import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import Footer from './components/layout/Footer.tsx'
import Navbar from './components/layout/Navbar.tsx'
import { adminLinks, defaultLinks } from './components/layout/navLinks.ts'
import LoginPage from './features/auth/LoginPage.tsx'
import { useAuth } from './features/auth/useAuth.ts'
import ManagePage from './features/manage/ManagePage.tsx'
import ProblemsPage from './features/problems/ProblemsPage.tsx'
import ReservationsPage from './features/reservations/ReservationsPage.tsx'
import ReservePage from './features/reserve/ReservePage.tsx'
import SettingsPage from './features/settings/SettingsPage.tsx'

function App() {
  const user = useAuth((state) => state.user)
  const isLoading = useAuth((state) => state.isLoading)
  const load = useAuth((state) => state.load)
  const logout = useAuth((state) => state.logout)

  useEffect(() => {
    load()
  }, [load])

  // Nothing is shown until it is known whether someone is logged in, so the login page does not flash
  if (isLoading) {
    return null
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <Navbar links={user.is_admin ? adminLinks : defaultLinks} onLogout={logout} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Routes>
          <Route path="/reserve" element={<ReservePage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {user.is_admin && <Route path="/manage" element={<ManagePage />} />}
          {user.is_admin && <Route path="/problems" element={<ProblemsPage />} />}
          {/* The root, an unknown address or an admin page for a normal user opens the reserve page */}
          <Route path="*" element={<Navigate to="/reserve" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
