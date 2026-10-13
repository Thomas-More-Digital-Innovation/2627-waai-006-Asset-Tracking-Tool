import { ArrowLeft, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button.tsx'
import Dropdown from '../../components/ui/Dropdown.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import QuantityStepper from '../../components/ui/QuantityStepper.tsx'
import { createReservation, fetchDepartments, type AvailableItem, type Department, type Period } from './api.ts'
import type { Cart } from './cart.ts'

type CartViewProps = {
  period: Period
  items: AvailableItem[]
  cart: Cart
  onChange: (itemId: number, count: number) => void
  onReserved: () => void
  backHref: string
}

function CartView({ period, items, cart, onChange, onReserved, backHref }: CartViewProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [error, setError] = useState('')
  const [isDone, setIsDone] = useState(false)

  // Loads the departments once, when the cart first appears
  useEffect(() => {
    fetchDepartments()
      .then(setDepartments)
      .catch(() => setError('De afdelingen konden niet geladen worden.'))
  }, [])

  const lines = items.filter((item) => cart[item.item_id] > 0)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Prevents the browser from reloading the page when the form is submitted
    event.preventDefault()
    try {
      await createReservation(
        period,
        Number(departmentId),
        lines.map((item) => ({ item_id: item.item_id, count: cart[item.item_id] })),
      )
      onReserved()
      setIsDone(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Er ging iets mis.')
    }
  }

  if (isDone) {
    return (
      <section className="flex w-full max-w-2xl flex-col gap-3 rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold">Je reservering is geplaatst</h2>
        <a className="self-start text-primary hover:underline" href="/reserve">
          Nieuwe reservering maken
        </a>
      </section>
    )
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4">
      <a className="flex items-center gap-2 self-start text-sm font-medium text-primary hover:underline" href={backHref}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Verder kiezen
      </a>

      <form className="flex flex-col gap-5 rounded-xl bg-white p-6 shadow" onSubmit={handleSubmit}>
        <h2 className="text-lg font-semibold">Winkelmandje</h2>

        {lines.length === 0 ? (
          <p className="text-gray-600">Je mandje is leeg.</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-200 border-y border-gray-200">
              {lines.map((item) => (
                <li className="flex flex-wrap items-center gap-3 py-3" key={item.item_id}>
                  <p className="min-w-32 flex-1 font-medium break-words">{item.name}</p>
                  <div className="ml-auto flex items-center gap-1">
                    <QuantityStepper
                      value={cart[item.item_id]}
                      max={item.available}
                      onChange={(count) => onChange(item.item_id, count)}
                    />
                    <button
                      className="flex size-10 cursor-pointer items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-red-700"
                      type="button"
                      aria-label={`${item.name} verwijderen`}
                      onClick={() => onChange(item.item_id, 0)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <Dropdown
              label="Voor welke afdeling reserveer je?"
              options={departments.map((department) => ({
                value: String(department.department_id),
                label: department.name,
              }))}
              placeholder="Kies een afdeling"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              required
            />

            {error && <FormMessage message={{ text: error, isError: true }} />}

            <Button className="sm:self-start" type="submit">
              Reserveren
            </Button>
          </>
        )}
      </form>
    </section>
  )
}

export default CartView
