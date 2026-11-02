import { ClipboardList } from 'lucide-react'
import { Link } from 'react-router'

function Logo() {
  return (
    <Link className="flex items-center gap-2.5 text-white" to="/">
      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary">
        <ClipboardList className="size-5" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold tracking-tight">WaaiTrack</span>
    </Link>
  )
}

export default Logo
