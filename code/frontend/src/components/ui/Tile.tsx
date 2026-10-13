import type { ReactNode } from 'react'

type TileProps = {
  title: string
  subtitle?: string
  // Shown across the top of the tile
  imageUrl?: string
  // Together these add a button at the bottom of the tile that opens the address
  actionLabel?: string
  href?: string
  // Extra content at the bottom of the tile, such as buttons
  children?: ReactNode
}

function Tile({ title, subtitle, imageUrl, actionLabel, href, children }: TileProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow">
      {imageUrl && <img className="aspect-video w-full object-cover" src={imageUrl} alt="" />}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-semibold break-words text-gray-900">{title}</p>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        </div>

        {actionLabel && href && (
          <a
            className="flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-center text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={href}
          >
            {actionLabel}
          </a>
        )}

        {children}
      </div>
    </div>
  )
}

export default Tile
