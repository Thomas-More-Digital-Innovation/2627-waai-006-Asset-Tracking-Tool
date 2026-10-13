import { Image as ImageIcon } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'

type ImageInputProps = {
  label: string
  name: string
  // The address of the image that is stored now, if there is one
  currentUrl?: string
}

function ImageInput({ label, name, currentUrl = '' }: ImageInputProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(currentUrl)
  const [isRemoved, setIsRemoved] = useState(false)

  function showPreview(url: string) {
    // Frees the memory of the previous preview before showing a new one
    if (preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview)
    }
    setPreview(url)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      showPreview(URL.createObjectURL(file))
      setIsRemoved(false)
    }
  }

  function handleRemove() {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
    showPreview('')
    setIsRemoved(currentUrl !== '')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-4">
        {preview ? (
          <img className="size-20 shrink-0 rounded-md border border-gray-200 object-cover" src={preview} alt="" />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-400">
            <ImageIcon className="size-6" aria-hidden="true" />
          </div>
        )}
        <div className="flex min-w-0 flex-col items-start gap-2">
          <input
            className="w-full text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-900 hover:file:bg-gray-200"
            id={id}
            ref={inputRef}
            name={name}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleChange}
          />
          {preview && (
            <button className="cursor-pointer text-sm text-red-700 hover:underline" type="button" onClick={handleRemove}>
              Foto verwijderen
            </button>
          )}
        </div>
      </div>
      {/* Tells the form that the stored image must be removed */}
      {isRemoved && <input name={`${name}_removed`} type="hidden" value="true" />}
    </div>
  )
}

export default ImageInput
