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

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json()
}

export function fetchDaysOfWeek(): Promise<DayOfWeek[]> {
  return request('/api/days-of-week')
}

export function fetchSettings(): Promise<ApplicationSettings> {
  return request('/api/settings')
}

export function updateSettings(settings: ApplicationSettings): Promise<ApplicationSettings> {
  return request('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
}
