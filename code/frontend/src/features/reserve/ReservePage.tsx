import { ArrowLeft, ShoppingCart } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import Button from '../../components/ui/Button.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import QuantityStepper from '../../components/ui/QuantityStepper.tsx'
import SearchBar from '../../components/ui/SearchBar.tsx'
import Tile from '../../components/ui/Tile.tsx'
import { fetchAvailableItems, fetchCategories, type AvailableItem, type Category, type Period } from './api.ts'
import { clearCart, loadCart, saveCart, type Cart } from './cart.ts'
import CartView from './CartView.tsx'
import { formatMoment, readPeriod } from './period.ts'
import PeriodForm from './PeriodForm.tsx'

const gridClasses = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'

type AvailabilityProps = {
  period: Period
  categoryId: number
  showCart: boolean
  // The reservation that is being changed, if any
  reservationId: number | null
}

function Availability({ period, categoryId, showCart, reservationId }: AvailabilityProps) {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [items, setItems] = useState<AvailableItem[]>([])
  const [hasError, setHasError] = useState(false)
  const [storedCart, setStoredCart] = useState<Cart>(() => loadCart(period, reservationId))
  const [search, setSearch] = useState('')

  // Loads the categories and the available items once, when this part first appears
  useEffect(() => {
    Promise.all([fetchCategories(), fetchAvailableItems(period, reservationId)])
      .then(([loadedCategories, loadedItems]) => {
        setCategories(loadedCategories)
        setItems(loadedItems)
      })
      .catch(() => setHasError(true))
  }, [period, reservationId])

  // Every link keeps the chosen period, and the reservation that is being changed, in the address
  const periodQuery = new URLSearchParams(
    reservationId ? { ...period, reservation: String(reservationId) } : period,
  ).toString()

  // The chosen period on the left, with room for the cart link on the right
  function renderHeader(cartLink?: ReactNode) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="font-medium">
            {formatMoment(period.start_date, period.start_time)} tot {formatMoment(period.end_date, period.end_time)}
          </span>
          <a className="text-primary hover:underline" href={`/reserve?${periodQuery}&view=period`}>
            Periode wijzigen
          </a>
        </p>
        {cartLink}
      </div>
    )
  }

  if (hasError) {
    return (
      <>
        {renderHeader()}
        <FormMessage message={{ text: 'De gegevens konden niet geladen worden.', isError: true }} />
      </>
    )
  }
  if (!categories) {
    return renderHeader()
  }

  function itemsIn(id: number) {
    return items.filter((item) => item.category_id === id)
  }

  // Leaves out items that are no longer available and never keeps more than is free
  const cart: Cart = {}
  for (const item of items) {
    const count = Math.min(storedCart[item.item_id] ?? 0, item.available)
    if (count > 0) {
      cart[item.item_id] = count
    }
  }
  const cartTotal = Object.values(cart).reduce((total, count) => total + count, 0)

  function changeCart(itemId: number, count: number) {
    const next = { ...cart, [itemId]: Math.max(count, 0) }
    setStoredCart(next)
    saveCart(period, next, reservationId)
  }

  const category = categories.find((candidate) => candidate.category_id === categoryId)
  // Only categories with at least one available item are shown
  const availableCategories = categories.filter((candidate) => itemsIn(candidate.category_id).length > 0)

  if (showCart) {
    return (
      <>
        {renderHeader()}
        <CartView
          period={period}
          items={items}
          cart={cart}
          reservationId={reservationId}
          onChange={changeCart}
          onReserved={() => {
            clearCart()
            setStoredCart({})
          }}
          backHref={`/reserve?${periodQuery}`}
        />
      </>
    )
  }

  const header = renderHeader(
    <a
      className="flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
      href={`/reserve?${periodQuery}&view=cart`}
    >
      <ShoppingCart className="size-4" aria-hidden="true" />
      Winkelmandje ({cartTotal})
    </a>,
  )

  const searchText = search.trim().toLowerCase()

  // An item matches when its name, article number or description contains the search text
  function matchesSearch(item: AvailableItem) {
    return [item.name, item.article_number, item.detail].some((text) => text?.toLowerCase().includes(searchText))
  }

  function renderItems(shownItems: AvailableItem[]) {
    return (
      <ul className={gridClasses}>
        {shownItems.map((item) => (
          <li key={item.item_id}>
            <Tile
              title={item.name}
              subtitle={`${item.available} beschikbaar`}
              imageUrl={item.photo ? `/api/items/photos/${item.photo}` : undefined}
            >
              {cart[item.item_id] ? (
                <QuantityStepper
                  value={cart[item.item_id]}
                  max={item.available}
                  onChange={(count) => changeCart(item.item_id, count)}
                />
              ) : (
                <Button onClick={() => changeCart(item.item_id, 1)}>Toevoegen</Button>
              )}
            </Tile>
          </li>
        ))}
      </ul>
    )
  }

  function renderCategories(shownCategories: Category[]) {
    return (
      <ul className={gridClasses}>
        {shownCategories.map((candidate) => (
          <li key={candidate.category_id}>
            <Tile
              title={candidate.name}
              actionLabel="Bekijk categorie"
              href={`/reserve?${periodQuery}&category=${candidate.category_id}`}
            />
          </li>
        ))}
      </ul>
    )
  }

  const searchBar = (
    <div className="w-full sm:max-w-sm">
      <SearchBar
        placeholder={category ? `Zoeken in ${category.name}…` : 'Zoek materiaal of categorie…'}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
    </div>
  )

  if (category) {
    const categoryItems = itemsIn(category.category_id)
    const shownItems = categoryItems.filter(matchesSearch)
    return (
      <section className="flex flex-col gap-4">
        {header}
        <a
          className="flex items-center gap-2 self-start text-sm font-medium text-primary hover:underline"
          href={`/reserve?${periodQuery}`}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Terug naar categorieën
        </a>
        <h2 className="text-lg font-semibold">{category.name}</h2>

        {categoryItems.length === 0 ? (
          <p className="text-gray-600">In deze categorie is niets beschikbaar in deze periode.</p>
        ) : (
          <>
            {searchBar}
            {shownItems.length === 0 ? <p className="text-gray-600">Geen resultaten gevonden.</p> : renderItems(shownItems)}
          </>
        )}
      </section>
    )
  }

  if (availableCategories.length === 0) {
    return (
      <>
        {header}
        <p className="text-gray-600">Er is geen materiaal beschikbaar in deze periode.</p>
      </>
    )
  }

  // While searching, matching categories and matching items from every category are shown together
  if (searchText) {
    const foundCategories = availableCategories.filter((candidate) => candidate.name.toLowerCase().includes(searchText))
    const foundItems = items.filter(matchesSearch)
    return (
      <section className="flex flex-col gap-4">
        {header}
        {searchBar}
        {foundCategories.length === 0 && foundItems.length === 0 && (
          <p className="text-gray-600">Geen resultaten gevonden.</p>
        )}
        {foundCategories.length > 0 && (
          <>
            <h2 className="text-lg font-semibold">Categorieën</h2>
            {renderCategories(foundCategories)}
          </>
        )}
        {foundItems.length > 0 && (
          <>
            <h2 className="text-lg font-semibold">Materiaal</h2>
            {renderItems(foundItems)}
          </>
        )}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      {header}
      {searchBar}
      <div>
        <h2 className="text-lg font-semibold">Categorieën</h2>
        <p className="text-gray-600">Kies een categorie om het beschikbare materiaal te bekijken.</p>
      </div>
      {renderCategories(availableCategories)}
    </section>
  )
}

function ReservePage() {
  // Read once, so the period stays the same object while the page is open
  const [params] = useState(() => new URLSearchParams(window.location.search))
  const [period] = useState(() => readPeriod(params))
  const view = params.get('view')
  const reservationId = Number(params.get('reservation')) || null

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{reservationId ? 'Reservering wijzigen' : 'Reserveer'}</h1>

      {reservationId && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          Je past een bestaande reservering aan. Wijzigingen worden pas opgeslagen in het winkelmandje.
          <a className="text-primary hover:underline" href="/reservations" onClick={clearCart}>
            Stoppen met wijzigen
          </a>
        </p>
      )}

      {!period || view === 'period' ? (
        <PeriodForm initial={period} reservationId={reservationId} />
      ) : (
        <Availability
          period={period}
          categoryId={Number(params.get('category'))}
          showCart={view === 'cart'}
          reservationId={reservationId}
        />
      )}
    </div>
  )
}

export default ReservePage
