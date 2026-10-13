import { useEffect, useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import Input from '../../components/ui/Input.tsx'
import { fetchSettings, type ApplicationSettings } from '../settings/api.ts'
import type { Period } from './api.ts'

// The weekday ids of the backend run from 1 (Monday) to 7 (Sunday)
const dayNames = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']

// A date as YYYY-MM-DD in the visitor's own time zone
function toDateText(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// The weekday of a date as 1 (Monday) to 7 (Sunday)
function weekdayOf(date: Date) {
  return date.getDay() === 0 ? 7 : date.getDay()
}

// The first date from today that falls on the given weekday; without a weekday that is today
function firstDateOn(weekday?: number | null) {
  const date = new Date()
  if (!weekday) {
    return toDateText(date)
  }
  date.setDate(date.getDate() + ((weekday - weekdayOf(date) + 7) % 7))
  return toDateText(date)
}

type PeriodFormProps = {
  // Fills in the form when the visitor comes back to change the period
  initial?: Period | null
}

function PeriodForm({ initial }: PeriodFormProps) {
  const [settings, setSettings] = useState<ApplicationSettings | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState('')

  // Loads the settings once, to know whether the summer rules apply
  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      // Without settings the form still works, the backend checks the rules again when reserving
      .catch(() => setSettings(null))
      .finally(() => setIsLoaded(true))
  }, [])

  if (!isLoaded) {
    return null
  }

  // The summer rules only count while the summer arrangement is switched on
  const summer = settings?.is_summer_time ? settings : null
  const fixedStartTime = summer?.summer_start_time?.slice(0, 5)
  const fixedEndTime = summer?.summer_end_time?.slice(0, 5)
  const startDay = summer?.summer_start_date_of_week
  const endDay = summer?.summer_end_date_of_week

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Prevents the browser from reloading the page when the form is submitted
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    // A disabled field is not part of the form, so a fixed time is filled in here
    const period: Period = {
      start_date: String(form.get('start_date')),
      start_time: fixedStartTime ?? String(form.get('start_time')),
      end_date: String(form.get('end_date')),
      end_time: fixedEndTime ?? String(form.get('end_time')),
    }

    if (startDay && weekdayOf(new Date(`${period.start_date}T00:00`)) !== startDay) {
      setError(`De startdatum moet een ${dayNames[startDay - 1]} zijn.`)
      return
    }
    if (endDay && weekdayOf(new Date(`${period.end_date}T00:00`)) !== endDay) {
      setError(`De einddatum moet een ${dayNames[endDay - 1]} zijn.`)
      return
    }
    if (`${period.end_date}T${period.end_time}` <= `${period.start_date}T${period.start_time}`) {
      setError('Het einde moet na het begin liggen.')
      return
    }

    // The chosen period goes into the address, so it survives moving between categories
    window.location.search = new URLSearchParams(period).toString()
  }

  // With a fixed weekday the calendar starts on the first such day and moves in steps of a week,
  // so the browser only accepts dates on that weekday
  function dateProps(weekday: number | null | undefined) {
    return { min: firstDateOn(weekday), step: weekday ? 7 : undefined }
  }

  return (
    <form className="flex w-full max-w-2xl flex-col gap-5 rounded-xl bg-white p-6 shadow" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold">Wanneer wil je reserveren?</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label={startDay ? `Startdatum (alleen ${dayNames[startDay - 1]})` : 'Startdatum'}
          name="start_date"
          type="date"
          defaultValue={initial?.start_date}
          required
          {...dateProps(startDay)}
        />
        <Input
          label="Starttijd"
          name="start_time"
          type="time"
          defaultValue={fixedStartTime ?? initial?.start_time}
          disabled={Boolean(fixedStartTime)}
          required
        />
        <Input
          label={endDay ? `Einddatum (alleen ${dayNames[endDay - 1]})` : 'Einddatum'}
          name="end_date"
          type="date"
          defaultValue={initial?.end_date}
          required
          {...dateProps(endDay)}
        />
        <Input
          label="Eindtijd"
          name="end_time"
          type="time"
          defaultValue={fixedEndTime ?? initial?.end_time}
          disabled={Boolean(fixedEndTime)}
          required
        />
      </div>

      {error && <FormMessage message={{ text: error, isError: true }} />}

      <Button className="sm:self-start" type="submit">
        Reserveer items
      </Button>
    </form>
  )
}

export default PeriodForm
