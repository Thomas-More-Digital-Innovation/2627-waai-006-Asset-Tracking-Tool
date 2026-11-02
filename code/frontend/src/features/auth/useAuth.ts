import { create } from 'zustand'
import { fetchAuthMethod, fetchCurrentUser, logout as logoutRequest, type AuthMethod, type User } from './api.ts'

type AuthStore = {
  // null while nobody is logged in
  user: User | null
  authMethod: AuthMethod
  // True until it is known whether someone is logged in
  isLoading: boolean
  setUser: (user: User | null) => void
  load: () => Promise<void>
  logout: () => Promise<void>
}

// The login state of the app, every component can read it with useAuth instead of through props
export const useAuth = create<AuthStore>((set) => ({
  user: null,
  authMethod: 'email',
  isLoading: true,
  setUser: (user) => set({ user }),
  load: async () => {
    const [user, authMethod] = await Promise.all([
      fetchCurrentUser().catch(() => null),
      fetchAuthMethod().catch((): AuthMethod => 'email'),
    ])
    set({ user, authMethod, isLoading: false })
  },
  logout: async () => {
    await logoutRequest()
    set({ user: null })
  },
}))

// The logged in user, for components that are only shown after logging in
export function useUser(): User {
  const user = useAuth((state) => state.user)
  if (!user) {
    throw new Error('useUser can only be used after logging in')
  }
  return user
}
