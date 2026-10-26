import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Button from '../../components/ui/Button.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import Modal from '../../components/ui/Modal.tsx'
import SearchBar from '../../components/ui/SearchBar.tsx'
import { startEditing } from '../reserve/cart.ts'
import { formatMoment } from '../reserve/period.ts'
import {
  cancelReservation,
  fetchAllReservations,
  fetchMyReservations,
  returnReservation,
  type Reservation,
  type ReservedItem,
} from './api.ts'

// The backend sends times as "09:00:00", only the hours and minutes are shown
function formatStart(reservation: Reservation) {
  return formatMoment(reservation.start_date, reservation.start_time.slice(0, 5))
}

function formatEnd(reservation: Reservation) {
  return formatMoment(reservation.end_date, reservation.end_time.slice(0, 5))
}

// Puts the reservation in the cart and opens it on the reserve page, where everything can be changed
function editReservation(reservation: Reservation) {
  const period = {
    start_date: reservation.start_date,
    start_time: reservation.start_time.slice(0, 5),
    end_date: reservation.end_date,
    end_time: reservation.end_time.slice(0, 5),
  }
  const cart = Object.fromEntries(reservation.items.map((item) => [item.item_id, item.count]))
  startEditing(reservation.reservation_id, period, cart, reservation.department_id)
  const query = new URLSearchParams({ ...period, reservation: String(reservation.reservation_id), view: 'cart' })
  window.location.href = `/reserve?${query}`
}

function isRunning(reservation: Reservation, now: Date) {
  return new Date(`${reservation.start_date}T${reservation.start_time}`) <= now
}

// Matches on everything an admin sees of a reservation: who, which department, when and which items
function matchesSearch(reservation: Reservation, search: string) {
  const query = search.trim().toLowerCase()
  if (!query) {
    return true
  }
  const fields = [
    reservation.user_name,
    reservation.department_name ?? '',
    reservation.department_mail ?? '',
    formatStart(reservation),
    formatEnd(reservation),
    ...reservation.items.flatMap((item) => [item.name, item.article_number ?? '']),
  ]
  return fields.some((field) => field.toLowerCase().includes(query))
}

// The items of a reservation with their article number and how many
function ItemList({ items }: { items: ReservedItem[] }) {
  return (
    <ul className="divide-y divide-gray-200 border-y border-gray-200">
      {items.map((item) => (
        <li className="flex items-center justify-between gap-4 py-3" key={item.item_id}>
          <span className="font-medium break-words">
            {item.name}
            {item.article_number && <> - {item.article_number}</>}
          </span>
          <span className="shrink-0 text-gray-700">{item.count}×</span>
        </li>
      ))}
    </ul>
  )
}

type ReservationCardProps = {
  reservation: Reservation
  isRunning: boolean
  // Admins see who placed the reservation and can also change a running one or confirm its items are given back
  isAdmin: boolean
  onShowItems: () => void
  onCancel: () => void
  onReturn: () => void
}

function ReservationCard({ reservation, isRunning, isAdmin, onShowItems, onCancel, onReturn }: ReservationCardProps) {
  const total = reservation.items.reduce((sum, item) => sum + item.count, 0)
  const canChange = isAdmin || !isRunning

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow">
      <div className="min-w-0">
        <p className="font-semibold break-words">
          {reservation.department_name ?? 'Geen afdeling'} - {formatStart(reservation)} - {formatEnd(reservation)}
        </p>
        <p className="text-sm text-gray-600">
          {isAdmin ? reservation.user_name : isRunning ? 'Bezig' : 'Gepland'} · {total}{' '}
          {total === 1 ? 'item' : 'items'}
        </p>
        {isAdmin && reservation.department_mail && (
          <a
            className="text-sm break-all text-primary hover:underline"
            href={`mailto:${reservation.department_mail}`}
          >
            {reservation.department_mail}
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onShowItems}>
          Bekijk items
        </Button>
        <Button
          variant="secondary"
          disabled={!canChange}
          title={canChange ? undefined : 'Een lopende reservering kan niet gewijzigd worden'}
          onClick={() => editReservation(reservation)}
        >
          Wijzigen
        </Button>
        {/* A running reservation is not cancelled but given back, which an admin confirms */}
        {!isRunning ? (
          <Button variant="danger" onClick={onCancel}>
            Annuleren
          </Button>
        ) : (
          isAdmin && <Button onClick={onReturn}>Teruggegeven</Button>
        )}
      </div>
    </li>
  )
}

// How many reservations a block shows before the rest has to be scrolled to
const VISIBLE_COUNT = 3

// A list that is exactly as high as its first few rows and scrolls for the rest
function ScrollingList({ children }: { children: ReactNode[] }) {
  const listRef = useRef<HTMLUListElement>(null)
  const [maxHeight, setMaxHeight] = useState<number>()

  // Measures again whenever the size changes, because rows get taller when their content wraps
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || children.length <= VISIBLE_COUNT) {
      setMaxHeight(undefined)
      return
    }
    function measure() {
      const lastVisible = list!.children[VISIBLE_COUNT - 1] as HTMLElement
      // A small extra room so the shadow of the last visible card is not cut off
      setMaxHeight(lastVisible.offsetTop + lastVisible.offsetHeight + 4)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [children.length])

  return (
    <ul
      className={`relative flex flex-col gap-4 ${maxHeight ? '-mx-1 overflow-y-auto px-1' : ''}`}
      style={{ maxHeight }}
      ref={listRef}
    >
      {children}
    </ul>
  )
}

type ReservationsPageProps = {
  isAdmin: boolean
}

function ReservationsPage({ isAdmin }: ReservationsPageProps) {
  const [reservations, setReservations] = useState<Reservation[] | null>(null)
  const [hasError, setHasError] = useState(false)
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [cancelling, setCancelling] = useState<Reservation | null>(null)
  const [cancelError, setCancelError] = useState('')
  const [returning, setReturning] = useState<Reservation | null>(null)
  const [returnError, setReturnError] = useState('')
  const [runningSearch, setRunningSearch] = useState('')
  const [upcomingSearch, setUpcomingSearch] = useState('')

  // Loads the reservations once, when the page first appears; admins get those of everyone
  useEffect(() => {
    ;(isAdmin ? fetchAllReservations() : fetchMyReservations())
      .then(setReservations)
      .catch(() => setHasError(true))
  }, [isAdmin])

  const now = new Date()

  function closeCancel() {
    setCancelling(null)
    setCancelError('')
  }

  async function handleCancel(reservation: Reservation) {
    try {
      await cancelReservation(reservation.reservation_id)
      setReservations((current) => current?.filter((r) => r.reservation_id !== reservation.reservation_id) ?? null)
      closeCancel()
    } catch (caught) {
      setCancelError(caught instanceof Error ? caught.message : 'Er ging iets mis.')
    }
  }

  function closeReturn() {
    setReturning(null)
    setReturnError('')
  }

  async function handleReturn(reservation: Reservation) {
    try {
      await returnReservation(reservation.reservation_id)
      // A returned reservation has ended, so it no longer belongs in the list
      setReservations((current) => current?.filter((r) => r.reservation_id !== reservation.reservation_id) ?? null)
      closeReturn()
    } catch (caught) {
      setReturnError(caught instanceof Error ? caught.message : 'Er ging iets mis.')
    }
  }

  function renderCard(reservation: Reservation) {
    return (
      <ReservationCard
        key={reservation.reservation_id}
        reservation={reservation}
        isRunning={isRunning(reservation, now)}
        isAdmin={isAdmin}
        onShowItems={() => setSelected(reservation)}
        onCancel={() => setCancelling(reservation)}
        onReturn={() => setReturning(reservation)}
      />
    )
  }

  // One block with a title and its own search, used by admins to split running from upcoming reservations
  function renderGroup(
    title: string,
    group: Reservation[],
    emptyText: string,
    search: string,
    onSearchChange: (search: string) => void,
  ) {
    const visible = group.filter((reservation) => matchesSearch(reservation, search))

    return (
      <section className="flex flex-col gap-4 rounded-xl bg-gray-100 p-4 sm:p-5">
        <h2 className="text-lg font-semibold">
          {title} <span className="font-normal text-gray-600">({group.length})</span>
        </h2>
        {group.length > 0 && (
          <SearchBar
            placeholder={`Zoeken in ${title.toLowerCase()}…`}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        )}
        {group.length === 0 ? (
          <p className="text-gray-600">{emptyText}</p>
        ) : visible.length === 0 ? (
          <p className="text-gray-600">Geen resultaten gevonden</p>
        ) : (
          <ScrollingList>{visible.map(renderCard)}</ScrollingList>
        )}
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{isAdmin ? 'Reserveringen' : 'Mijn Reserveringen'}</h1>

      {hasError && <FormMessage message={{ text: 'De reserveringen konden niet geladen worden.', isError: true }} />}

      {reservations && isAdmin && (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {renderGroup(
            'Lopende reserveringen',
            reservations.filter((reservation) => isRunning(reservation, now)),
            'Er zijn geen lopende reserveringen.',
            runningSearch,
            setRunningSearch,
          )}
          {renderGroup(
            'Aankomende reserveringen',
            reservations.filter((reservation) => !isRunning(reservation, now)),
            'Er zijn geen aankomende reserveringen.',
            upcomingSearch,
            setUpcomingSearch,
          )}
        </div>
      )}

      {reservations && !isAdmin && reservations.length === 0 && (
        <p className="text-gray-600">
          Je hebt geen lopende of komende reserveringen.{' '}
          <a className="text-primary hover:underline" href="/reserve">
            Nieuwe reservering maken
          </a>
        </p>
      )}

      {reservations && !isAdmin && reservations.length > 0 && (
        <ul className="flex flex-col gap-4">{reservations.map(renderCard)}</ul>
      )}

      {selected && (
        <Modal title={selected.department_name ?? 'Reservering'} onClose={() => setSelected(null)}>
          <p className="mb-4 text-sm text-gray-600">
            {isAdmin && <>{selected.user_name} · </>}
            {formatStart(selected)} tot {formatEnd(selected)}
            {isAdmin && selected.department_mail && (
              <>
                <br />
                <a className="break-all text-primary hover:underline" href={`mailto:${selected.department_mail}`}>
                  {selected.department_mail}
                </a>
              </>
            )}
          </p>
          <ItemList items={selected.items} />
        </Modal>
      )}

      {cancelling && (
        <Modal title="Reservering annuleren" onClose={closeCancel}>
          <div className="flex flex-col gap-5">
            <p>
              Weet je zeker dat je de reservering
              {isAdmin && <> van <strong>{cancelling.user_name}</strong></>} voor{' '}
              <strong>{cancelling.department_name ?? 'geen afdeling'}</strong> van {formatStart(cancelling)} tot{' '}
              {formatEnd(cancelling)} wilt annuleren?
            </p>

            {cancelError && <FormMessage message={{ text: cancelError, isError: true }} />}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeCancel}>
                Terug
              </Button>
              <Button variant="danger" onClick={() => handleCancel(cancelling)}>
                Ja, annuleren
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {returning && (
        <Modal title="Items teruggegeven" onClose={closeReturn}>
          <div className="flex flex-col gap-5">
            <p>
              Controleer of alle items van <strong>{returning.user_name}</strong> voor{' '}
              <strong>{returning.department_name ?? 'geen afdeling'}</strong> terug zijn.
            </p>

            <ItemList items={returning.items} />

            <p className="text-sm text-gray-600">
              Na het bevestigen is de reservering afgelopen en zijn de items meteen weer beschikbaar voor anderen.
            </p>

            {returnError && <FormMessage message={{ text: returnError, isError: true }} />}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeReturn}>
                Terug
              </Button>
              <Button onClick={() => handleReturn(returning)}>Bevestig teruggave</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default ReservationsPage
