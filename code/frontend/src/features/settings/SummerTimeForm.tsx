import { useEffect, useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button.tsx'
import Dropdown from '../../components/ui/Dropdown.tsx'
import FormMessage, { type Message } from '../../components/ui/FormMessage.tsx'
import Input from '../../components/ui/Input.tsx'
import Toggle from '../../components/ui/Toggle.tsx'
import { fetchDaysOfWeek, fetchSettings, updateSettings, type ApplicationSettings, type DayOfWeek } from './api.ts'

function SummerTimeForm() {
  const [settings, setSettings] = useState<ApplicationSettings | null>(null)
  const [days, setDays] = useState<DayOfWeek[]>([])
  const [message, setMessage] = useState<Message | null>(null)

  // Loads the settings and the weekdays once, when the form first appears
  useEffect(() => {
    // Sends both requests at the same time and waits until both have finished
    Promise.all([fetchSettings(), fetchDaysOfWeek()])
      .then(([loadedSettings, loadedDays]) => {
        setSettings(loadedSettings)
        setDays(loadedDays)
      })
      .catch(() => setMessage({ text: 'De instellingen konden niet geladen worden.', isError: true }))
  }, [])

  if (!settings) {
    return <FormMessage message={message} />
  }

  const current = settings
  const dayOptions = days.map((day) => ({ value: String(day.day_of_week_id), label: day.name }))

  function change(changes: Partial<ApplicationSettings>) {
    setSettings({ ...current, ...changes })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Prevents the browser from reloading the page when the form is submitted
    event.preventDefault()

    const startTime = current.summer_start_time?.slice(0, 5) ?? ''
    const endTime = current.summer_end_time?.slice(0, 5) ?? ''
    if (startTime && endTime && startTime >= endTime) {
      setMessage({ text: 'De eindtijd moet na de starttijd liggen.', isError: true })
      return
    }

    try {
      setSettings(await updateSettings(current))
      setMessage({ text: 'De zomerregeling is opgeslagen.', isError: false })
    } catch {
      setMessage({ text: 'Opslaan is mislukt.', isError: true })
    }
  }

  return (
    <form className="flex flex-col gap-5 rounded-xl bg-white p-6 shadow" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">Zomerregeling</h2>

      <Toggle
        label="Zomerregeling actief"
        checked={settings.is_summer_time}
        onChange={(event) => change({ is_summer_time: event.target.checked })}
      />

      {settings.is_summer_time && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Starttijd"
            type="time"
            value={settings.summer_start_time?.slice(0, 5) ?? ''}
            onChange={(event) => change({ summer_start_time: event.target.value || null })}
          />
          <Input
            label="Eindtijd"
            type="time"
            value={settings.summer_end_time?.slice(0, 5) ?? ''}
            onChange={(event) => change({ summer_end_time: event.target.value || null })}
          />
          <Dropdown
            label="Startdag"
            options={dayOptions}
            placeholder="Kies een dag"
            value={settings.summer_start_date_of_week ?? ''}
            onChange={(event) => change({ summer_start_date_of_week: Number(event.target.value) || null })}
          />
          <Dropdown
            label="Einddag"
            options={dayOptions}
            placeholder="Kies een dag"
            value={settings.summer_end_date_of_week ?? ''}
            onChange={(event) => change({ summer_end_date_of_week: Number(event.target.value) || null })}
          />
        </div>
      )}

      <FormMessage message={message} />

      <Button className="sm:self-start" type="submit">
        Opslaan
      </Button>
    </form>
  )
}

export default SummerTimeForm
