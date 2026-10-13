import { useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import Input from '../../components/ui/Input.tsx'
import type { Period } from './api.ts'

// Today's date as YYYY-MM-DD in the visitor's own time zone
function today() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

type PeriodFormProps = {
  // Fills in the form when the visitor comes back to change the period
  initial?: Period | null
}

function PeriodForm({ initial }: PeriodFormProps) {
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Prevents the browser from reloading the page when the form is submitted
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const start = `${form.get('start_date')}T${form.get('start_time')}`
    const end = `${form.get('end_date')}T${form.get('end_time')}`

    if (end <= start) {
      setError('Het einde moet na het begin liggen.')
      return
    }

    // The chosen period goes into the address, so it survives moving between categories
    const params = new URLSearchParams()
    for (const [name, value] of form.entries()) {
      params.set(name, String(value))
    }
    window.location.search = params.toString()
  }

  return (
    <form className="flex w-full max-w-2xl flex-col gap-5 rounded-xl bg-white p-6 shadow" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">Wanneer wil je reserveren?</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Startdatum" name="start_date" type="date" min={today()} defaultValue={initial?.start_date} required />
        <Input label="Starttijd" name="start_time" type="time" defaultValue={initial?.start_time} required />
        <Input label="Einddatum" name="end_date" type="date" min={today()} defaultValue={initial?.end_date} required />
        <Input label="Eindtijd" name="end_time" type="time" defaultValue={initial?.end_time} required />
      </div>

      {error && <FormMessage message={{ text: error, isError: true }} />}

      <Button className="sm:self-start" type="submit">
        Reserveer items
      </Button>
    </form>
  )
}

export default PeriodForm
