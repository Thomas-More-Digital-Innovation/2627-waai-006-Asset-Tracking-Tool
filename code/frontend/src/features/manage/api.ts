import { request } from '../../lib/request.ts'
import type { DataRow, DataValues } from './DataManager.tsx'
import { PartialSaveError } from './PartialSaveError.ts'

type Category = {
  category_id: number
  name: string
}

type User = {
  user_id: number
  firstname: string
  lastname: string
  email: string
  is_admin: boolean
  is_active: boolean
}

type Item = {
  item_id: number
  article_number: string | null
  name: string
  photo: string | null
  detail: string | null
  count: number
  category_id: number
  is_active: boolean
}

type Department = {
  department_id: number
  name: string
  mail: string
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

export async function fetchDepartments(): Promise<DataRow[]> {
  const departments = await request<Department[]>('/api/departments')
  return departments.map((department) => ({
    id: department.department_id,
    values: { name: department.name, mail: department.mail },
  }))
}

export async function createDepartment(values: DataValues): Promise<void> {
  await request('/api/departments', 'POST', values)
}

export async function updateDepartment(id: number, values: DataValues): Promise<void> {
  await request(`/api/departments/${id}`, 'PUT', values)
}

export async function deleteDepartment(id: number): Promise<void> {
  await request(`/api/departments/${id}`, 'DELETE')
}

export async function fetchUsers(): Promise<DataRow[]> {
  const [users, currentUser] = await Promise.all([
    request<User[]>('/api/users'),
    request<User>('/api/auth/me'),
  ])
  return users.map((user) => ({
    id: user.user_id,
    values: { firstname: user.firstname, lastname: user.lastname, email: user.email, is_admin: user.is_admin },
    isActive: user.is_active,
    // Admins cannot edit or remove their own account from this list
    isLocked: user.user_id === currentUser.user_id,
  }))
}

export async function createUser(values: DataValues): Promise<void> {
  await request('/api/users', 'POST', values)
}

export async function updateUser(id: number, values: DataValues): Promise<void> {
  // An empty password means the current password stays the same
  await request(`/api/users/${id}`, 'PUT', { ...values, password: values.password || null })
}

export async function deleteUser(id: number): Promise<void> {
  await request(`/api/users/${id}`, 'DELETE')
}

export async function activateUser(id: number): Promise<void> {
  await request(`/api/users/${id}/activate`, 'POST')
}

export async function fetchItems(): Promise<DataRow[]> {
  const items = await request<Item[]>('/api/items')
  return items.map((item) => ({
    id: item.item_id,
    values: {
      photo: item.photo ? `/api/items/photos/${item.photo}` : '',
      article_number: item.article_number ?? '',
      name: item.name,
      category_id: String(item.category_id),
      count: String(item.count),
      detail: item.detail ?? '',
    },
    isActive: item.is_active,
  }))
}

// The form works with text, the backend expects numbers for the count and the category
function toItemBody(values: DataValues) {
  return {
    article_number: values.article_number || null,
    name: values.name,
    detail: values.detail,
    count: Number(values.count),
    category_id: Number(values.category_id),
  }
}

// The photo is sent separately from the other fields, because it is a file
async function savePhoto(id: number, photo: DataValues[string] | undefined): Promise<void> {
  try {
    if (photo instanceof File) {
      const body = new FormData()
      body.append('file', photo)
      const response = await fetch(`/api/items/${id}/photo`, { method: 'PUT', body })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(typeof error?.detail === 'string' ? error.detail : 'De upload is mislukt.')
      }
    } else if (photo === '') {
      await request(`/api/items/${id}/photo`, 'DELETE')
    }
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : 'De upload is mislukt.'
    throw new PartialSaveError(`Het item is opgeslagen, maar de foto niet: ${reason}`)
  }
}

export async function createItem(values: DataValues): Promise<void> {
  const item = await request<Item>('/api/items', 'POST', toItemBody(values))
  await savePhoto(item.item_id, values.photo)
}

export async function updateItem(id: number, values: DataValues): Promise<void> {
  await request(`/api/items/${id}`, 'PUT', toItemBody(values))
  await savePhoto(id, values.photo)
}

export async function deleteItem(id: number): Promise<void> {
  await request(`/api/items/${id}`, 'DELETE')
}

export async function activateItem(id: number): Promise<void> {
  await request(`/api/items/${id}/activate`, 'POST')
}

export async function fetchCategoryOptions() {
  const categories = await request<Category[]>('/api/categories')
  return categories.map((category) => ({ value: String(category.category_id), label: category.name }))
}
