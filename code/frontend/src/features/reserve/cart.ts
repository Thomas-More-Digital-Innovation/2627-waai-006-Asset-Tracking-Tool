import type { Period } from './api.ts'

// The cart: per item id, how many the visitor wants
export type Cart = Record<number, number>

type StoredCart = {
  period: Period
  cart: Cart
  // Set while an existing reservation is being changed
  reservationId?: number
  departmentId?: number | null
}

const STORAGE_KEY = 'waaitrack-cart'

function loadStored(): StoredCart | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return null
  }
}

function store(stored: StoredCart): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Without browser storage the cart still works, it only does not survive a page change
  }
}

// The cart is kept in the browser, so it survives moving between pages.
// A new cart belongs to one period: a cart saved for another period is ignored.
// While a reservation is changed, the cart belongs to that reservation, so it survives changing the period.
export function loadCart(period: Period, reservationId: number | null): Cart {
  const stored = loadStored()
  if (!stored) {
    return {}
  }
  const matches = reservationId
    ? stored.reservationId === reservationId
    : !stored.reservationId && JSON.stringify(stored.period) === JSON.stringify(period)
  return matches ? stored.cart : {}
}

export function saveCart(period: Period, cart: Cart, reservationId: number | null): void {
  const stored = loadStored()
  // The department of the reservation that is being changed is kept
  const departmentId = reservationId && stored?.reservationId === reservationId ? stored.departmentId : undefined
  store({ period, cart, reservationId: reservationId ?? undefined, departmentId })
}

// Fills the cart with an existing reservation, so it can be changed on the reserve page
export function startEditing(reservationId: number, period: Period, cart: Cart, departmentId: number | null): void {
  store({ period, cart, reservationId, departmentId })
}

// The department the reservation that is being changed was placed for
export function loadEditedDepartment(reservationId: number): number | null {
  const stored = loadStored()
  return stored?.reservationId === reservationId ? (stored.departmentId ?? null) : null
}

export function clearCart(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear
  }
}
