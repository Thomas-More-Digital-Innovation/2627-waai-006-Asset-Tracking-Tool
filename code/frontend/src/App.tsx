import { useEffect } from 'react'
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

  // The root path has no page of its own, so send it to the reserve page
  if (window.location.pathname === '/') {
    window.history.replaceState(null, '', '/reserve')
  }

  const path = window.location.pathname
  let page = <h1 className="text-2xl font-semibold">Welkom, {user.firstname}</h1>
  if (path === '/reserve') {
    page = <ReservePage />
  } else if (path === '/reservations') {
    page = <ReservationsPage />
  } else if (path === '/settings') {
    page = <SettingsPage />
  } else if (path === '/manage' && user.is_admin) {
    page = <ManagePage />
  } else if (path === '/problems' && user.is_admin) {
    page = <ProblemsPage />
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <Navbar links={user.is_admin ? adminLinks : defaultLinks} onLogout={logout} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{page}</main>
      <Footer />
    </div>
  )
}

export default App
