import { request } from '../../lib/request.ts'

export type DayOfWeek = {
  day_of_week_id: number
  name: string
}

export type ApplicationSettings = {
  is_summer_time: boolean
  summer_start_time: string | null
  summer_end_time: string | null
  summer_start_date_of_week: number | null
  summer_end_date_of_week: number | null
}

export function fetchDaysOfWeek(): Promise<DayOfWeek[]> {
  return request('/api/days-of-week')
}

export function fetchSettings(): Promise<ApplicationSettings> {
  return request('/api/settings')
}

export function updateSettings(settings: ApplicationSettings): Promise<ApplicationSettings> {
  return request('/api/settings', 'PUT', settings)
}
