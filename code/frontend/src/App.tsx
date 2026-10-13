import { useEffect, useState } from 'react'
import Footer from './components/layout/Footer.tsx'
import Navbar from './components/layout/Navbar.tsx'
import { fetchCurrentUser, logout, type User } from './features/auth/api.ts'
import LoginPage from './features/auth/LoginPage.tsx'
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

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <Navbar onLogout={handleLogout} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {window.location.pathname === '/settings' ? (
          <SettingsPage user={user} onUserChange={setUser} />
        ) : (
          <h1 className="text-2xl font-semibold">Welkom, {user.firstname}</h1>
        )}
      </main>
      <Footer />
    </div>
  )
}

export default App
