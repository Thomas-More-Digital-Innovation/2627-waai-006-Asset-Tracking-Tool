import type { Period } from './api.ts'

// Reads the chosen period from the address, for example /reserve?start_date=2026-10-20&...
export function readPeriod(params: URLSearchParams): Period | null {
  const period = {
    start_date: params.get('start_date') ?? '',
    start_time: params.get('start_time') ?? '',
    end_date: params.get('end_date') ?? '',
    end_time: params.get('end_time') ?? '',
  }
  return Object.values(period).every(Boolean) ? period : null
}

// Shows 2026-10-20 and 09:00 as "20/10/2026 09:00"
export function formatMoment(date: string, time: string) {
  return `${date.split('-').reverse().join('/')} ${time}`
}
