export type User = {
  user_id: number
  firstname: string
  lastname: string
  email: string
  is_admin: boolean
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
