import { ChevronDown } from 'lucide-react'
import { useId, type ComponentProps } from 'react'

export type DropdownOption = {
  value: string
  label: string
}

type DropdownProps = ComponentProps<'select'> & {
  label: string
  options: DropdownOption[]
  placeholder?: string
}

function Dropdown({ label, options, placeholder, id, className = '', ...props }: DropdownProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700" htmlFor={selectId}>
        {label}
        {props.required && (
          <span className="text-red-600" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <div className="relative">
        <select
          className={`min-h-10 w-full cursor-pointer appearance-none rounded-md border border-gray-300 bg-white py-2 pr-10 pl-3 text-base text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 ${className}`}
          id={selectId}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export default Dropdown
