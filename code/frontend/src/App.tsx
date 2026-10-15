import { useEffect, useState } from 'react'
import Footer from './components/layout/Footer.tsx'
import Navbar from './components/layout/Navbar.tsx'
import { adminLinks, defaultLinks } from './components/layout/navLinks.ts'
import { fetchCurrentUser, logout, type User } from './features/auth/api.ts'
import LoginPage from './features/auth/LoginPage.tsx'
import ManagePage from './features/manage/ManagePage.tsx'
import ReservationsPage from './features/reservations/ReservationsPage.tsx'
import ReservePage from './features/reserve/ReservePage.tsx'
import SettingsPage from './features/settings/SettingsPage.tsx'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  async function handleLogout() {
    await logout()
    setUser(null)
  }

  if (isLoading) {
    return null
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />
  }

  const path = window.location.pathname
  let page = <h1 className="text-2xl font-semibold">Welkom, {user.firstname}</h1>
  if (path === '/reserve') {
    page = <ReservePage />
  } else if (path === '/reservations') {
    page = <ReservationsPage />
  } else if (path === '/settings') {
    page = <SettingsPage user={user} onUserChange={setUser} />
  } else if (path === '/manage' && user.is_admin) {
    page = <ManagePage />
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <Navbar links={user.is_admin ? adminLinks : defaultLinks} onLogout={handleLogout} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{page}</main>
      <Footer />
    </div>
  )
}

export default App
