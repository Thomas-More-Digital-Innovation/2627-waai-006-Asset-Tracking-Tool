export type User = {
  user_id: number
  firstname: string
  lastname: string
  email: string
  is_admin: boolean
}

export type AuthMethod = 'email' | 'sso'

export async function fetchAuthMethod(): Promise<AuthMethod> {
  const response = await fetch('/api/auth/method')
  if (!response.ok) {
    throw new Error('Inlogmethode ophalen mislukt')
  }
  return (await response.json()).method
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    throw new Error('Inloggen mislukt')
  }
  return response.json()
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}

export async function fetchCurrentUser(): Promise<User | null> {
  const response = await fetch('/api/auth/me')
  return response.ok ? response.json() : null
}

export async function updateProfile(firstname: string, lastname: string): Promise<User> {
  const response = await fetch('/api/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstname, lastname }),
  })
  if (!response.ok) {
    throw new Error('Opslaan mislukt')
  }
  return response.json()
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetch('/api/auth/me/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
  if (!response.ok) {
    throw new Error('Wachtwoord wijzigen mislukt')
  }
}
