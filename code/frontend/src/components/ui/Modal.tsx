import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
}

function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Opens the dialog as a modal, so the rest of the page cannot be used while it is open
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/50"
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop
        if (event.target === dialogRef.current) {
          onClose()
        }
      }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          className="-mr-2 flex size-10 cursor-pointer items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          type="button"
          aria-label="Sluiten"
          onClick={onClose}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  )
}

export default Modal
