import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import SearchBar from '../../components/ui/SearchBar.tsx'
import { formatMoment } from '../reserve/period.ts'
import { fetchProblems, resolveProblem, type ItemWithProblems } from './api.ts'

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

function ProblemsPage() {
  const [items, setItems] = useState<ItemWithProblems[] | null>(null)
  const [hasError, setHasError] = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [search, setSearch] = useState('')

  // Loads the problems once, when the page first appears
  useEffect(() => {
    fetchProblems()
      .then(setItems)
      .catch(() => setHasError(true))
  }, [])

  async function handleResolve(problemId: number) {
    try {
      await resolveProblem(problemId)
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
                            <Button variant="secondary" onClick={() => handleResolve(problem.item_problem_id)}>
                              Opgelost
                            </Button>
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
    </div>
  )
}

export default ProblemsPage
