import { ClipboardList } from 'lucide-react'

function Logo() {
  return (
    <a className="flex items-center gap-2.5 text-white" href="/">
      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary">
        <ClipboardList className="size-5" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold tracking-tight">WaaiTrack</span>
    </a>
  )
}

export default Logo
