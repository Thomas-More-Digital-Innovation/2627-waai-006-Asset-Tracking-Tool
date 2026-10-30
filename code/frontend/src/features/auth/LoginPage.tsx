import { useState, type FormEvent } from 'react'
import { FaMicrosoft } from 'react-icons/fa'
import Button from '../../components/ui/Button.tsx'
import Input from '../../components/ui/Input.tsx'
import Logo from '../../components/ui/Logo.tsx'
import { login, type AuthMethod, type User } from './api.ts'

type LoginPageProps = {
  authMethod: AuthMethod
  onLogin: (user: User) => void
}

const ssoErrors: Record<string, string> = {
  sso_failed: 'Inloggen met Microsoft is mislukt. Probeer het opnieuw.',
  sso_no_email: 'Je Microsoft-account heeft geen e-mailadres.',
  inactive: 'Je account is niet actief. Neem contact op met een beheerder.',
}

// The backend sends the reason of a failed Microsoft login back in the address
function initialError() {
  const code = new URLSearchParams(window.location.search).get('login_error')
  if (code) {
    window.history.replaceState(null, '', window.location.pathname)
  }
  return code ? (ssoErrors[code] ?? ssoErrors.sso_failed) : ''
}

function LoginPage({ authMethod, onLogin }: LoginPageProps) {
  const [error, setError] = useState(initialError)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Prevents the browser from reloading the page when the form is submitted
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    try {
      onLogin(await login(String(form.get('email')), String(form.get('password'))))
    } catch {
      setError('E-mailadres of wachtwoord is onjuist.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="flex justify-center bg-primary p-6">
          <Logo />
        </div>

        {authMethod === 'sso' ? (
          <div className="flex flex-col gap-5 p-6">
            <h1 className="text-xl font-semibold text-center">Inloggen</h1>

            {error && <p className="text-sm text-red-700">{error}</p>}

            {/* A full page visit, because the backend sends the browser on to Microsoft */}
            <Button onClick={() => (window.location.href = '/api/auth/sso/login')}>
              <FaMicrosoft className="size-4" aria-hidden="true" />
              Inloggen met Microsoft
            </Button>
          </div>
        ) : (
          <form className="flex flex-col gap-5 p-6" onSubmit={handleSubmit}>
            <h1 className="text-xl font-semibold">Inloggen</h1>

            <Input label="E-mailadres" name="email" type="email" required />
            <Input label="Wachtwoord" name="password" type="password" required />

            {error && <p className="text-sm text-red-700">{error}</p>}

            <Button type="submit">Inloggen</Button>
          </form>
        )}
      </div>
    </main>
  )
}

export default LoginPage
