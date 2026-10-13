import { Minus, Plus } from 'lucide-react'

type QuantityStepperProps = {
  value: number
  max: number
  onChange: (value: number) => void
}

const buttonClasses =
  'flex size-10 cursor-pointer items-center justify-center text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent'

function QuantityStepper({ value, max, onChange }: QuantityStepperProps) {
  return (
    <div className="inline-flex items-center self-start overflow-hidden rounded-md border border-gray-300 bg-white">
      <button className={buttonClasses} type="button" aria-label="Eén minder" onClick={() => onChange(value - 1)}>
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-10 px-2 text-center font-semibold" aria-live="polite">
        {value}
      </span>
      <button
        className={buttonClasses}
        type="button"
        aria-label="Eén meer"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export default QuantityStepper
