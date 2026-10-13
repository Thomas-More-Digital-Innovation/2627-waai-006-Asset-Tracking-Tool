import { useId, type ComponentProps } from 'react'

type InputProps = ComponentProps<'input'> & {
  label: string
}

function Input({ label, id, className = '', ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700" htmlFor={inputId}>
        {label}
      </label>
      <input
        className={`min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 ${className}`}
        id={inputId}
        {...props}
      />
    </div>
  )
}

export default Input
