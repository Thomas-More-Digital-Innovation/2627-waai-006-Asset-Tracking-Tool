export type NavLink = {
  label: string
  href: string
}

export const defaultLinks: NavLink[] = [
  { label: 'Reserveer', href: '/reserve' },
  { label: 'Reserveringen', href: '/reservations' },
  { label: 'Instellingen', href: '/settings' },
]

export const adminLinks: NavLink[] = [
  { label: 'Reserveer', href: '/reserve' },
  { label: 'Reserveringen', href: '/reservations' },
  { label: 'Beheren', href: '/manage' },
  { label: 'Instellingen', href: '/settings' },
]
