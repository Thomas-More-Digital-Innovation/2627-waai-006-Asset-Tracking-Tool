import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import Modal from '../../components/ui/Modal.tsx'
import SearchBar from '../../components/ui/SearchBar.tsx'
import { formatMoment } from '../reserve/period.ts'
import {
  checkWriteOff,
  fetchProblems,
  resolveProblem,
  writeOffProblem,
  type ItemWithProblems,
  type ProblemNote,
  type WriteOffShortage,
} from './api.ts'

// Matches on the item name, article number and the text of its problems
function matchesSearch(item: ItemWithProblems, search: string) {
  const query = search.trim().toLowerCase()
  if (!query) {
    return true
  }
  const fields = [item.name, item.article_number ?? '', ...item.problems.map((problem) => problem.note)]
  return fields.some((field) => field.toLowerCase().includes(query))
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
    </div>
  )
}

// What the admin wants to do with a problem, asked for confirmation first
type PendingAction = {
  kind: 'resolve' | 'writeOff'
  item: ItemWithProblems
  problem: ProblemNote
}

function ProblemsPage() {
  const [items, setItems] = useState<ItemWithProblems[] | null>(null)
  const [hasError, setHasError] = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  // The reservations that block removing a piece, null while they are still being checked
  const [shortages, setShortages] = useState<WriteOffShortage[] | null>(null)
  const [checkError, setCheckError] = useState('')

  // Loads the problems once, when the page first appears
  useEffect(() => {
    fetchProblems()
      .then(setItems)
      .catch(() => setHasError(true))
  }, [])

  function openResolve(item: ItemWithProblems, problem: ProblemNote) {
    setPending({ kind: 'resolve', item, problem })
  }

  // Before a piece can leave the stock, the reservations that would get too few are looked up
  async function openWriteOff(item: ItemWithProblems, problem: ProblemNote) {
    setPending({ kind: 'writeOff', item, problem })
    setShortages(null)
    setCheckError('')
    try {
      setShortages(await checkWriteOff(problem.item_problem_id))
    } catch (caught) {
      setCheckError(caught instanceof Error ? caught.message : 'Er ging iets mis.')
    }
  }

  async function handleConfirm(action: PendingAction) {
    const problemId = action.problem.item_problem_id
    setIsBusy(true)
    try {
      await (action.kind === 'resolve' ? resolveProblem(problemId) : writeOffProblem(problemId))
      setResolveError('')
      // An item without problems left no longer belongs on the page
      setItems(
        (current) =>
          current
            ?.map((item) => ({
              ...item,
              problems: item.problems.filter((problem) => problem.item_problem_id !== problemId),
            }))
            .filter((item) => item.problems.length > 0) ?? null,
      )
    } catch (caught) {
      setResolveError(caught instanceof Error ? caught.message : 'Er ging iets mis.')
    } finally {
      setIsBusy(false)
      setPending(null)
    }
  }

  const total = items?.reduce((sum, item) => sum + item.problems.length, 0) ?? 0
  // Only the problems that leave the next reservation short count, at most as many as are missing for it
  const upcoming =
    items?.reduce((sum, item) => {
      const missing = item.next_booking ? Math.max(item.next_booking.count - item.next_booking.available, 0) : 0
      return sum + Math.min(item.problems.length, missing)
    }, 0) ?? 0
  const visible = items?.filter((item) => matchesSearch(item, search)) ?? []

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Problemen</h1>

      {hasError && <FormMessage message={{ text: 'De problemen konden niet geladen worden.', isError: true }} />}
      {resolveError && <FormMessage message={{ text: resolveError, isError: true }} />}

      {items && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile label="Gemelde problemen" value={total} />
            <StatTile label="Problemen bij een komende reservering" value={upcoming} />
          </div>

          {items.length === 0 ? (
            <p className="text-gray-600">Er zijn geen gemelde problemen.</p>
          ) : (
            <section className="flex flex-col gap-4">
              <SearchBar
                placeholder="Zoeken op item, artikelcode of probleem…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {visible.length === 0 ? (
                <p className="text-gray-600">Geen resultaten gevonden</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {visible.map((item) => (
                    <li className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow" key={item.item_id}>
                      <div>
                        <p className="font-semibold break-words">
                          {item.name}
                          {item.article_number && <> - {item.article_number}</>}
                          {!item.is_active && <span className="font-normal text-gray-500"> (inactief)</span>}
                        </p>
                        {item.next_booking && (
                          <p className="text-sm text-gray-600">
                            Volgende reservering:{' '}
                            {formatMoment(item.next_booking.start_date, item.next_booking.start_time.slice(0, 5))} ·{' '}
                            {item.next_booking.department_name ?? 'Geen afdeling'} · {item.next_booking.count}×
                          </p>
                        )}
                        {item.next_booking && item.next_booking.available < item.next_booking.count && (
                          <p className="mt-1 text-sm font-medium text-red-700">
                            Niet genoeg voor deze reservering: nog {item.next_booking.count - item.next_booking.available}{' '}
                            nodig
                          </p>
                        )}
                      </div>
                      <ul className="divide-y divide-gray-200 border-y border-gray-200">
                        {item.problems.map((problem) => (
                          <li className="flex items-center justify-between gap-4 py-3" key={problem.item_problem_id}>
                            <span className="break-words whitespace-pre-line">{problem.note}</span>
                            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                              <Button
                                variant="secondary"
                                onClick={() => openResolve(item, problem)}
                              >
                                Opgelost
                              </Button>
                              <Button variant="danger" onClick={() => openWriteOff(item, problem)}>
                                Verwijderen
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {pending && (
        <Modal
          title={pending.kind === 'resolve' ? 'Probleem opgelost' : 'Kapot item verwijderen'}
          onClose={() => setPending(null)}
        >
          <div className="flex flex-col gap-5">
            <p className="break-words">
              {pending.kind === 'resolve' ? (
                <>
                  Is het probleem bij <strong>{pending.item.name}</strong> opgelost? Het stuk kan daarna weer
                  gereserveerd worden.
                </>
              ) : (
                <>
                  Is dit stuk van <strong>{pending.item.name}</strong> kapot? Het probleem wordt verwijderd en de
                  voorraad gaat met 1 omlaag. Is er daarna geen stuk meer over, dan wordt het item verwijderd.
                </>
              )}
            </p>
            <p className="rounded-md bg-gray-100 p-3 text-sm break-words whitespace-pre-line">{pending.problem.note}</p>

            {pending.kind === 'writeOff' && (
              <>
                {checkError && <FormMessage message={{ text: checkError, isError: true }} />}
                {!checkError && shortages === null && <p className="text-sm text-gray-600">Reserveringen controleren…</p>}
                {shortages && shortages.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-red-700">
                      Dit stuk kan nog niet uit de voorraad. Deze reserveringen hebben dan te weinig, pas ze eerst aan:
                    </p>
                    <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 text-sm">
                      {shortages.map((shortage) => (
                        <li className="flex flex-col gap-1 px-3 py-2" key={shortage.reservation_id}>
                          <span className="font-medium break-words">
                            {shortage.department_name ?? 'Geen afdeling'} · {shortage.user_name}
                          </span>
                          <span className="text-gray-600">
                            {formatMoment(shortage.start_date, shortage.start_time.slice(0, 5))} tot{' '}
                            {formatMoment(shortage.end_date, shortage.end_time.slice(0, 5))}
                          </span>
                          <span className="text-red-700">
                            {shortage.count}× nodig, nog {shortage.available} beschikbaar
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="neutral" onClick={() => setPending(null)}>
                Annuleren
              </Button>
              <Button
                variant={pending.kind === 'resolve' ? 'secondary' : 'danger'}
                disabled={
                  isBusy || (pending.kind === 'writeOff' && (checkError !== '' || !shortages || shortages.length > 0))
                }
                onClick={() => handleConfirm(pending)}
              >
                {pending.kind === 'resolve' ? 'Opgelost' : 'Uit voorraad halen'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default ProblemsPage
