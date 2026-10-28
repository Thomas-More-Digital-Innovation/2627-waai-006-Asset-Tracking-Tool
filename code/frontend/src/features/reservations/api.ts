import { request } from '../../lib/request.ts'

export type ReservedItem = {
  item_id: number
  name: string
  article_number: string | null
  count: number
}

export type Reservation = {
  reservation_id: number
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  department_id: number | null
  department_name: string | null
  department_mail: string | null
  user_name: string
  items: ReservedItem[]
}

// The reservations of the current user whose items are not given back yet, also when they are past their end
export function fetchMyReservations(): Promise<Reservation[]> {
  return request('/api/reservations')
}

// The reservations of everyone whose items are not given back yet, only for admins
export function fetchAllReservations(): Promise<Reservation[]> {
  return request('/api/reservations/all')
}

export function cancelReservation(reservationId: number): Promise<void> {
  return request(`/api/reservations/${reservationId}`, 'DELETE')
}

export type ItemProblem = {
  item_id: number
  note: string
}

// Marks the items of a started reservation as given back, also after its end, with one problem for every piece that has one, only for admins
export function returnReservation(reservationId: number, problems: ItemProblem[]): Promise<void> {
  return request(`/api/reservations/${reservationId}/return`, 'POST', { problems })
}
