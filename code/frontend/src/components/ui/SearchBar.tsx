import { Search } from 'lucide-react'
import type { ComponentProps } from 'react'

// Accepts everything a normal <input> does, except "type", which is always "search"
type SearchBarProps = Omit<ComponentProps<'input'>, 'type'>

function SearchBar({ placeholder = 'Zoeken…', className = '', ...props }: SearchBarProps) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-500"
        aria-hidden="true"
      />
      <input
        className={`min-h-10 w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-9 text-base text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none ${className}`}
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        {...props}
      />
    </div>
  )
}

export default SearchBar
