import type { DataRow, DataValues } from './DataManager.tsx'

type Category = {
  category_id: number
  name: string
}

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    // The backend sends a readable reason in "detail" for errors it expects
    const error = await response.json().catch(() => null)
    throw new Error(typeof error?.detail === 'string' ? error.detail : 'Er ging iets mis.')
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export async function fetchCategories(): Promise<DataRow[]> {
  const categories = await request<Category[]>('/api/categories')
  return categories.map((category) => ({ id: category.category_id, values: { name: category.name } }))
}

export async function createCategory(values: DataValues): Promise<void> {
  await request('/api/categories', 'POST', values)
}

export async function updateCategory(id: number, values: DataValues): Promise<void> {
  await request(`/api/categories/${id}`, 'PUT', values)
}

export async function deleteCategory(id: number): Promise<void> {
  await request(`/api/categories/${id}`, 'DELETE')
}
