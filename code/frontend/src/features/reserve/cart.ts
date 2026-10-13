import type { Period } from './api.ts'

// The cart: per item id, how many the visitor wants
export type Cart = Record<number, number>

const STORAGE_KEY = 'waaitrack-cart'

// The cart is kept in the browser, so it survives moving between pages.
// It belongs to one period: a cart saved for another period is ignored.
export function loadCart(period: Period): Cart {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return stored && JSON.stringify(stored.period) === JSON.stringify(period) ? stored.cart : {}
  } catch {
    return {}
  }
}

export function saveCart(period: Period, cart: Cart): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ period, cart }))
  } catch {
    // Without browser storage the cart still works, it only does not survive a page change
  }
}

export function clearCart(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear
  }
}
