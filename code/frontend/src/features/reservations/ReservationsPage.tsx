import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import Modal from '../../components/ui/Modal.tsx'
import { formatMoment } from '../reserve/period.ts'
import { fetchMyReservations, type Reservation } from './api.ts'

// The backend sends times as "09:00:00", only the hours and minutes are shown
function formatStart(reservation: Reservation) {
  return formatMoment(reservation.start_date, reservation.start_time.slice(0, 5))
}

function formatEnd(reservation: Reservation) {
  return formatMoment(reservation.end_date, reservation.end_time.slice(0, 5))
}

function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[] | null>(null)
  const [hasError, setHasError] = useState(false)
  const [selected, setSelected] = useState<Reservation | null>(null)

  // Loads the reservations once, when the page first appears
  useEffect(() => {
    fetchMyReservations()
      .then(setReservations)
      .catch(() => setHasError(true))
  }, [])

  const now = new Date()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Mijn Reserveringen</h1>

      {hasError && <FormMessage message={{ text: 'De reserveringen konden niet geladen worden.', isError: true }} />}

      {reservations?.length === 0 && (
        <p className="text-gray-600">
          Je hebt geen lopende of komende reserveringen.{' '}
          <a className="text-primary hover:underline" href="/reserve">
            Nieuwe reservering maken
          </a>
        </p>
      )}

      {reservations && reservations.length > 0 && (
        <ul className="flex flex-col gap-4">
          {reservations.map((reservation) => {
            const isRunning = new Date(`${reservation.start_date}T${reservation.start_time}`) <= now
            const total = reservation.items.reduce((sum, item) => sum + item.count, 0)
            return (
              <li
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow"
                key={reservation.reservation_id}
              >
                <div className="min-w-0">
                  <p className="font-semibold break-words">
                    {reservation.department_name ?? 'Geen afdeling'} - {formatStart(reservation)} -{' '}
                    {formatEnd(reservation)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {isRunning ? 'Bezig' : 'Gepland'} · {total} {total === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setSelected(reservation)}>
                  Bekijk items
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {selected && (
        <Modal title={selected.department_name ?? 'Reservering'} onClose={() => setSelected(null)}>
          <p className="mb-4 text-sm text-gray-600">
            {formatStart(selected)} tot {formatEnd(selected)}
          </p>
          <ul className="divide-y divide-gray-200 border-y border-gray-200">
            {selected.items.map((item) => (
              <li className="flex items-center justify-between gap-4 py-3" key={item.item_id}>
                <span className="font-medium break-words">{item.name}</span>
                <span className="shrink-0 text-gray-700">{item.count}×</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  )
}

export default ReservationsPage
