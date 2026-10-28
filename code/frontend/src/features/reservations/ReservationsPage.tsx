import { AlertTriangle, Check, Plus, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Button from '../../components/ui/Button.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import Input from '../../components/ui/Input.tsx'
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

// The search text and the dates an admin filters a group of reservations on, an empty date means no limit
type GroupFilter = { search: string; from: string; to: string }

const emptyFilter: GroupFilter = { search: '', from: '', to: '' }

// Keeps the reservations whose period touches the chosen dates; dates as "2026-10-20" compare correctly as text
function matchesDates(reservation: Reservation, from: string, to: string) {
  return (!from || reservation.end_date >= from) && (!to || reservation.start_date <= to)
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

// The reported problems per item id, one note for every piece that has a problem
type ProblemNotes = Record<number, string[]>

type ReturnItemListProps = {
  items: ReservedItem[]
  problems: ProblemNotes
  onProblemsChange: (problems: ProblemNotes) => void
  // After a failed confirm the reports that are still empty get marked
  showEmpty: boolean
}

// The items of a reservation being given back; every piece with a problem gets its own report
function ReturnItemList({ items, problems, onProblemsChange, showEmpty }: ReturnItemListProps) {
  function setNotes(itemId: number, notes: string[]) {
    onProblemsChange({ ...problems, [itemId]: notes })
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const notes = problems[item.item_id] ?? []
        // There cannot be more broken pieces than were lent out
        const canAdd = notes.length < item.count
        const hasProblems = notes.length > 0
        return (
          <li
            className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors ${hasProblems ? 'border-red-200 bg-red-50/60' : 'border-gray-200'}`}
            key={item.item_id}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="font-medium break-words">
                  {item.name}
                  {item.article_number && <> - {item.article_number}</>}
                </span>
                <p className="flex items-center gap-1.5 text-sm text-gray-600">
                  {item.count}×
                  {hasProblems ? (
                    <span className="inline-flex items-center gap-1 font-medium text-red-700">
                      · <AlertTriangle className="size-3.5" aria-hidden="true" />
                      {notes.length} {notes.length === 1 ? 'probleem' : 'problemen'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      · <Check className="size-3.5" aria-hidden="true" />
                      In orde
                    </span>
                  )}
                </p>
              </div>
              {canAdd && (
                <button
                  className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                  type="button"
                  onClick={() => setNotes(item.item_id, [...notes, ''])}
                >
                  {hasProblems ? (
                    <Plus className="size-4" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="size-4" aria-hidden="true" />
                  )}
                  {hasProblems ? 'Nog een stuk' : 'Probleem melden'}
                </button>
              )}
            </div>
            {notes.map((note, index) => {
              const isMissing = showEmpty && !note.trim()
              return (
                <div className="flex flex-col gap-2 rounded-md border border-red-100 bg-white p-3" key={index}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700">
                      {item.count > 1 ? `Stuk ${index + 1} van ${item.count}` : 'Probleem'}
                    </span>
                    <button
                      className="flex size-8 cursor-pointer items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-700"
                      type="button"
                      aria-label={`Melding voor ${item.name}, stuk ${index + 1} verwijderen`}
                      onClick={() => setNotes(item.item_id, notes.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <textarea
                    className={`min-h-20 w-full rounded-md border bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:outline-none ${isMissing ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : 'border-gray-300 focus:border-primary focus:ring-primary/30'}`}
                    aria-label={`Probleem met ${item.name}, stuk ${index + 1}`}
                    aria-invalid={isMissing}
                    placeholder="Wat is er mis? Bijvoorbeeld: rits kapot, scheur in het doek…"
                    value={note}
                    onChange={(event) =>
                      setNotes(item.item_id, notes.map((n, i) => (i === index ? event.target.value : n)))
                    }
                    autoFocus
                  />
                  {isMissing && <p className="text-sm text-red-700">Beschrijf wat er mis is, of verwijder deze melding.</p>}
                </div>
              )
            })}
          </li>
        )
      })}
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
  const [problems, setProblems] = useState<ProblemNotes>({})
  const [showEmptyProblems, setShowEmptyProblems] = useState(false)
  const [runningFilter, setRunningFilter] = useState(emptyFilter)
  const [upcomingFilter, setUpcomingFilter] = useState(emptyFilter)

  // Loads the reservations once, when the page first appears; admins get those of everyone
  useEffect(() => {
    ;(isAdmin ? fetchAllReservations() : fetchMyReservations())
      .then(setReservations)
      .catch(() => setHasError(true))
  }, [isAdmin])

  const now = new Date()
  const problemCount = Object.values(problems).reduce((sum, notes) => sum + notes.length, 0)

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
    setProblems({})
    setShowEmptyProblems(false)
  }

  async function handleReturn(reservation: Reservation) {
    const reported = Object.entries(problems).flatMap(([itemId, notes]) =>
      notes.map((note) => ({ item_id: Number(itemId), note: note.trim() })),
    )
    if (reported.some((problem) => !problem.note)) {
      setShowEmptyProblems(true)
      setReturnError('Beschrijf elk probleem, of verwijder het.')
      return
    }
    try {
      await returnReservation(reservation.reservation_id, reported)
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

  // One block with a title and its own search and date filter, used by admins to split running from upcoming reservations
  function renderGroup(
    title: string,
    group: Reservation[],
    emptyText: string,
    filter: GroupFilter,
    onFilterChange: (filter: GroupFilter) => void,
  ) {
    const visible = group.filter(
      (reservation) =>
        matchesSearch(reservation, filter.search) && matchesDates(reservation, filter.from, filter.to),
    )

    return (
      <section className="flex flex-col gap-4 rounded-xl bg-gray-100 p-4 sm:p-5">
        <h2 className="text-lg font-semibold">
          {title} <span className="font-normal text-gray-600">({group.length})</span>
        </h2>
        {group.length > 0 && (
          <div className="flex flex-col gap-3">
            <SearchBar
              placeholder={`Zoeken in ${title.toLowerCase()}…`}
              value={filter.search}
              onChange={(event) => onFilterChange({ ...filter, search: event.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Van"
                type="date"
                value={filter.from}
                max={filter.to || undefined}
                onChange={(event) => onFilterChange({ ...filter, from: event.target.value })}
              />
              <Input
                label="Tot"
                type="date"
                value={filter.to}
                min={filter.from || undefined}
                onChange={(event) => onFilterChange({ ...filter, to: event.target.value })}
              />
            </div>
            {(filter.from || filter.to) && (
              <button
                className="cursor-pointer self-start text-sm text-primary hover:underline"
                type="button"
                onClick={() => onFilterChange({ ...filter, from: '', to: '' })}
              >
                Datums wissen
              </button>
            )}
          </div>
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
            runningFilter,
            setRunningFilter,
          )}
          {renderGroup(
            'Aankomende reserveringen',
            reservations.filter((reservation) => !isRunning(reservation, now)),
            'Er zijn geen aankomende reserveringen.',
            upcomingFilter,
            setUpcomingFilter,
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
              <Button variant="neutral" onClick={closeCancel}>
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

            <ReturnItemList
              items={returning.items}
              problems={problems}
              onProblemsChange={setProblems}
              showEmpty={showEmptyProblems}
            />

            <p className="text-sm text-gray-600">
              Na het bevestigen is de reservering afgelopen en zijn de items meteen weer beschikbaar voor anderen.
              Gemelde problemen worden bij het item bewaard.
            </p>

            {returnError && <FormMessage message={{ text: returnError, isError: true }} />}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button variant="neutral" onClick={closeReturn}>
                Terug
              </Button>
              <Button onClick={() => handleReturn(returning)}>
                {problemCount === 0
                  ? 'Bevestig teruggave'
                  : `Bevestig teruggave (${problemCount} ${problemCount === 1 ? 'probleem' : 'problemen'})`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default ReservationsPage
