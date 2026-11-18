import { request } from '../../lib/request.ts'

export type ProblemNote = {
  item_problem_id: number
  note: string
}

export type NextBooking = {
  start_date: string
  start_time: string
  department_name: string | null
  count: number
  // How many whole pieces are left for this reservation, less than count means it cannot go ahead like this
  available: number
}

export type ItemWithProblems = {
  item_id: number
  name: string
  article_number: string | null
  is_active: boolean
  problems: ProblemNote[]
  // The first reservation that has yet to start and needs this item
  next_booking: NextBooking | null
}

// Every item that has reported problems, only for admins
export function fetchProblems(): Promise<ItemWithProblems[]> {
  return request('/api/problems')
}

// Removes a problem once it has been fixed, only for admins
export function resolveProblem(problemId: number): Promise<void> {
  return request(`/api/problems/${problemId}`, 'DELETE')
}

// A reservation that would have too few pieces once the broken one leaves the stock
export type WriteOffShortage = {
  reservation_id: number
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  department_name: string | null
  user_name: string
  count: number
  available: number
}

// The reservations that have to be changed first before the piece can leave the stock, only for admins
export function checkWriteOff(problemId: number): Promise<WriteOffShortage[]> {
  return request(`/api/problems/${problemId}/write-off`)
}

// Removes a broken piece from the stock together with its problem, only for admins
export function writeOffProblem(problemId: number): Promise<void> {
  return request(`/api/problems/${problemId}/write-off`, 'POST')
}
