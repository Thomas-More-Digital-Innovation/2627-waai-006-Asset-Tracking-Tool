import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import Button from '../ui/Button.tsx'
import Logo from '../ui/Logo.tsx'
import { defaultLinks, type NavLink } from './navLinks.ts'

type NavbarProps = {
  links?: NavLink[]
  onLogout?: () => void
}

function Navbar({ links = defaultLinks, onLogout }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const currentPath = window.location.pathname

  return (
    <header className="sticky top-0 z-10 bg-primary text-white shadow-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="hidden items-center gap-4 sm:flex">
          <nav aria-label="Hoofdnavigatie">
            <ul className="flex items-center gap-1">
              {links.map((link) => {
                const isActive = currentPath === link.href
                return (
                  <li key={link.href}>
                    <a
                      className={`relative block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10 ${
                        isActive
                          ? 'text-white after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-secondary'
                          : 'text-white/80 hover:text-white'
                      }`}
                      href={link.href}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {link.label}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
          <Button variant="secondary" onClick={onLogout}>
            <LogOut className="size-4" aria-hidden="true" />
            Uitloggen
          </Button>
        </div>

        <button
          className="-mr-2 flex size-11 items-center justify-center rounded-md transition-colors hover:bg-white/10 sm:hidden"
          type="button"
          aria-label={isOpen ? 'Menu sluiten' : 'Menu openen'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
        </button>
      </div>

      {isOpen && (
        <nav className="border-t border-white/15 sm:hidden" aria-label="Hoofdnavigatie">
          <ul className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3">
            {links.map((link) => {
              const isActive = currentPath === link.href
              return (
                <li key={link.href}>
                  <a
                    className={`block rounded-md border-l-4 px-3 py-2.5 font-medium transition-colors hover:bg-white/10 ${
                      isActive ? 'border-secondary bg-white/10 text-white' : 'border-transparent text-white/80'
                    }`}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {link.label}
                  </a>
                </li>
              )
            })}
          </ul>
          <div className="mx-auto w-full max-w-6xl px-4 pb-4">
            <Button className="w-full" variant="secondary" onClick={onLogout}>
              <LogOut className="size-4" aria-hidden="true" />
              Uitloggen
            </Button>
          </div>
        </nav>
      )}
    </header>
  )
}

export default Navbar
