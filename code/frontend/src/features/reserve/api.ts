import { request } from '../../lib/request.ts'

export type Category = {
  category_id: number
  name: string
}

export type Department = {
  department_id: number
  name: string
}

export type AvailableItem = {
  item_id: number
  article_number: string | null
  name: string
  photo: string | null
  detail: string | null
  count: number
  category_id: number
  // How many are still free in the chosen period
  available: number
}

export type Period = {
  start_date: string
  start_time: string
  end_date: string
  end_time: string
}

type ReservationLine = {
  item_id: number
  count: number
}

export function fetchCategories(): Promise<Category[]> {
  return request('/api/categories')
}

export function fetchDepartments(): Promise<Department[]> {
  return request('/api/departments')
}

// While a reservation is changed, its own items count as available
export function fetchAvailableItems(period: Period, reservationId: number | null): Promise<AvailableItem[]> {
  const query = new URLSearchParams(period)
  if (reservationId) {
    query.set('reservation_id', String(reservationId))
  }
  return request(`/api/items/available?${query}`)
}

export async function createReservation(period: Period, departmentId: number, items: ReservationLine[]): Promise<void> {
  await request('/api/reservations', 'POST', { ...period, department_id: departmentId, items })
}

export async function updateReservation(
  reservationId: number,
  period: Period,
  departmentId: number,
  items: ReservationLine[],
): Promise<void> {
  await request(`/api/reservations/${reservationId}`, 'PUT', { ...period, department_id: departmentId, items })
}
