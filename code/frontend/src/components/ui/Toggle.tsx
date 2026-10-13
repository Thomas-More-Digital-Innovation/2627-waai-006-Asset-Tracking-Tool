import type { ComponentProps } from 'react'

type ToggleProps = Omit<ComponentProps<'input'>, 'type'> & {
  label: string
}

function Toggle({ label, ...props }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input className="peer sr-only" type="checkbox" {...props} />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-secondary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  )
}

export default Toggle
