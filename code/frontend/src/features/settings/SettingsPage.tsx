import { useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button.tsx'
import Input from '../../components/ui/Input.tsx'
import { changePassword, updateProfile, type User } from '../auth/api.ts'

type Message = {
  text: string
  isError: boolean
}

type SettingsPageProps = {
  user: User
  onUserChange: (user: User) => void
}

function FormMessage({ message }: { message: Message | null }) {
  if (!message) {
    return null
  }
  return <p className={`text-sm ${message.isError ? 'text-red-700' : 'text-green-700'}`}>{message.text}</p>
}

function ProfileForm({ user, onUserChange }: SettingsPageProps) {
  const [message, setMessage] = useState<Message | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Prevents the browser from reloading the page when the form is submitted
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    try {
      onUserChange(await updateProfile(String(form.get('firstname')).trim(), String(form.get('lastname')).trim()))
      setMessage({ text: 'Je gegevens zijn opgeslagen.', isError: false })
    } catch {
      setMessage({ text: 'Opslaan is mislukt.', isError: true })
    }
  }

  return (
    <form className="flex flex-col gap-5 rounded-xl bg-white p-6 shadow" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">Persoonlijke gegevens</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Voornaam" name="firstname" defaultValue={user.firstname} maxLength={255} required />
        <Input label="Achternaam" name="lastname" defaultValue={user.lastname} maxLength={255} required />
      </div>

      <FormMessage message={message} />

      <Button className="sm:self-start" type="submit">
        Opslaan
      </Button>
    </form>
  )
}

function PasswordForm() {
  const [message, setMessage] = useState<Message | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Prevents the browser from reloading the page when the form is submitted
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const newPassword = String(form.get('newPassword'))

    if (newPassword !== form.get('confirmPassword')) {
      setMessage({ text: 'De nieuwe wachtwoorden komen niet overeen.', isError: true })
      return
    }

    try {
      await changePassword(String(form.get('currentPassword')), newPassword)
      formElement.reset()
      setMessage({ text: 'Je wachtwoord is gewijzigd.', isError: false })
    } catch {
      setMessage({ text: 'Wijzigen is mislukt. Controleer je huidige wachtwoord.', isError: true })
    }
  }

  return (
    <form className="flex flex-col gap-5 rounded-xl bg-white p-6 shadow" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">Wachtwoord wijzigen</h2>

      <Input label="Huidig wachtwoord" name="currentPassword" type="password" required />
      <Input label="Nieuw wachtwoord (minstens 8 tekens)" name="newPassword" type="password" minLength={8} maxLength={72} required />
      <Input label="Nieuw wachtwoord herhalen" name="confirmPassword" type="password" required />

      <FormMessage message={message} />

      <Button className="sm:self-start" type="submit">
        Wachtwoord wijzigen
      </Button>
    </form>
  )
}

function SettingsPage({ user, onUserChange }: SettingsPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Instellingen</h1>
      <ProfileForm user={user} onUserChange={onUserChange} />
      <PasswordForm />
    </div>
  )
}

export default SettingsPage
