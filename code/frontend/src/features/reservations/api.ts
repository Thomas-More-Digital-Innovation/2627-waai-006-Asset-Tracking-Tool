import { request } from '../../lib/request.ts'

export type ReservedItem = {
  item_id: number
  name: string
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

// The reservations of the current user that are still running or have yet to start
export function fetchMyReservations(): Promise<Reservation[]> {
  return request('/api/reservations')
}

// The running and upcoming reservations of everyone, only for admins
export function fetchAllReservations(): Promise<Reservation[]> {
  return request('/api/reservations/all')
}

export function cancelReservation(reservationId: number): Promise<void> {
  return request(`/api/reservations/${reservationId}`, 'DELETE')
}
