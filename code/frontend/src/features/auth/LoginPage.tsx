import { useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button.tsx'
import Input from '../../components/ui/Input.tsx'
import Logo from '../../components/ui/Logo.tsx'
import { login, type User } from './api.ts'

type LoginPageProps = {
  onLogin: (user: User) => void
}

function LoginPage({ onLogin }: LoginPageProps) {
  const [error, setError] = useState('')

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

        <form className="flex flex-col gap-5 p-6" onSubmit={handleSubmit}>
          <h1 className="text-xl font-semibold">Inloggen</h1>

          <Input label="E-mailadres" name="email" type="email" required />
          <Input label="Wachtwoord" name="password" type="password" required />

          {error && <p className="text-sm text-red-700">{error}</p>}

          <Button type="submit">Inloggen</Button>
        </form>
      </div>
    </main>
  )
}

export default LoginPage
