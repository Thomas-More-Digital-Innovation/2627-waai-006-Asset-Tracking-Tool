import { Package } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

type TileProps = {
  title: string
  subtitle?: string
  description?: string | null
  // Shown across the top of the tile
  imageUrl?: string
  // Keeps the image area with a placeholder icon when there is no image, so tiles in a row line up
  showImage?: boolean
  // Together these add a button at the bottom of the tile that opens the address
  actionLabel?: string
  href?: string
  // Extra content at the bottom of the tile, such as buttons
  children?: ReactNode
}

function Tile({ title, subtitle, description, imageUrl, showImage, actionLabel, href, children }: TileProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow">
      {imageUrl ? (
        <img className="aspect-video w-full object-cover" src={imageUrl} alt="" />
      ) : (
        showImage && (
          <div className="flex aspect-video w-full items-center justify-center bg-gray-100 text-gray-400">
            <Package className="size-10" aria-hidden="true" />
          </div>
        )
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-semibold break-words text-gray-900">{title}</p>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
          {description?.trim() && (
            <p className="mt-2 text-sm break-words whitespace-pre-line text-gray-700">{description}</p>
          )}
        </div>

        {actionLabel && href && (
          <Link
            className="flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-center text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            to={href}
          >
            {actionLabel}
          </Link>
        )}

        {children}
      </div>
    </div>
  )
}

export default Tile
