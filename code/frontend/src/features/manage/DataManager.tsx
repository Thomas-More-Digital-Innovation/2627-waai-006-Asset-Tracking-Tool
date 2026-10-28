import { Image as ImageIcon, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import Button from '../../components/ui/Button.tsx'
import Dropdown, { type DropdownOption } from '../../components/ui/Dropdown.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import ImageInput from '../../components/ui/ImageInput.tsx'
import Input from '../../components/ui/Input.tsx'
import Modal from '../../components/ui/Modal.tsx'
import SearchBar from '../../components/ui/SearchBar.tsx'
import Toggle from '../../components/ui/Toggle.tsx'
import { PartialSaveError } from './PartialSaveError.ts'

// An image field holds the address of the stored image, or the chosen file when saving
export type DataValues = Record<string, string | boolean | File>

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export type DataRow = {
  id: number
  values: DataValues
  // Only set for data that can be made inactive instead of being removed
  isActive?: boolean
  // A locked row has no action buttons, for example the user's own account
  isLocked?: boolean
}

export type DataField = {
  name: string
  label: string
  // "checkbox" shows a toggle and stores true or false, "select" shows a dropdown,
  // "image" shows a file picker, the other types are text inputs
  type?: 'text' | 'email' | 'password' | 'number' | 'checkbox' | 'select' | 'image'
  minLength?: number
  // Loads the choices of a "select" field
  loadOptions?: () => Promise<DropdownOption[]>
  // The field may stay empty
  optional?: boolean
  // Leaves the field out of the table, for example for a password
  hideInTable?: boolean
  // The field is required when adding, but may stay empty when editing
  optionalOnEdit?: boolean
}

type DataManagerProps = {
  title: string
  fields: DataField[]
  load: () => Promise<DataRow[]>
  create: (values: DataValues) => Promise<void>
  update: (id: number, values: DataValues) => Promise<void>
  remove: (id: number) => Promise<void>
  // When given, inactive rows are shown with a button to make them active again
  restore?: (id: number) => Promise<void>
  // The name of a row in the delete question, by default the first text field
  describe?: (values: DataValues) => string
  // Extra buttons next to "Toevoegen", for example an export
  actions?: ReactNode
}

// Turns a stored value into the text shown in the table
function displayValue(value: DataValues[string] | undefined, options?: DropdownOption[]): string {
  if (typeof value === 'boolean') {
    return value ? 'Ja' : 'Nee'
  }
  if (value instanceof File) {
    return ''
  }
  // A select field stores the value of the chosen option, the table shows its label
  return options?.find((option) => option.value === value)?.label ?? value ?? ''
}

const iconButtonClasses =
  'flex size-10 cursor-pointer items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100'

function DataManager({ title, fields, load, create, update, remove, restore, describe, actions }: DataManagerProps) {
  const [rows, setRows] = useState<DataRow[]>([])
  // "new" means the add form is open, a row means that row is being edited
  const [editing, setEditing] = useState<DataRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<DataRow | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  // The choices of every select field, by field name
  const [options, setOptions] = useState<Record<string, DropdownOption[]>>({})

  // Loads the rows once, when the component first appears
  useEffect(() => {
    load()
      .then(setRows)
      .catch(() => setError('De gegevens konden niet geladen worden.'))
  }, [load])

  // Loads the choices of the select fields once
  useEffect(() => {
    for (const field of fields) {
      field
        .loadOptions?.()
        .then((loaded) => setOptions((current) => ({ ...current, [field.name]: loaded })))
        .catch(() => setError('De keuzes konden niet geladen worden.'))
    }
  }, [fields])

  function closeModals() {
    setEditing(null)
    setDeleting(null)
    setError('')
  }

  // Runs an add, edit or delete, then reloads the list and closes the modal
  async function save(action: () => Promise<void>) {
    try {
      await action()
      setRows(await load())
      closeModals()
    } catch (caught) {
      if (caught instanceof PartialSaveError) {
        // The row was saved, so the form closes and only the warning stays visible
        setRows(await load())
        closeModals()
      }
      setError(caught instanceof Error ? caught.message : 'Er ging iets mis.')
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Prevents the browser from reloading the page when the form is submitted
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values: DataValues = {}
    for (const field of fields) {
      const value = form.get(field.name)
      if (field.type === 'checkbox') {
        values[field.name] = value !== null
      } else if (field.type === 'image') {
        // A chosen file is uploaded, an empty text removes the image, nothing leaves it as it is
        if (value instanceof File && value.size > MAX_IMAGE_BYTES) {
          setError('De afbeelding is te groot (maximaal 10 MB).')
          return
        }
        if (value instanceof File && value.size > 0) {
          values[field.name] = value
        } else if (form.get(`${field.name}_removed`) !== null) {
          values[field.name] = ''
        }
      } else {
        values[field.name] = field.type === 'password' ? String(value) : String(value).trim()
      }
    }

    const row = editing
    save(() => (row === 'new' || row === null ? create(values) : update(row.id, values)))
  }

  const isModalOpen = editing !== null || deleting !== null

  // Keeps the rows where at least one field contains the search text
  const searchText = search.trim().toLowerCase()
  const tableFields = fields.filter((field) => !field.hideInTable)
  const searchFields = tableFields.filter((field) => field.type !== 'image')

  function describeRow(row: DataRow) {
    return describe ? describe(row.values) : displayValue(row.values[searchFields[0].name])
  }
  const visibleRows = rows.filter((row) =>
    searchFields.some((field) =>
      displayValue(row.values[field.name], options[field.name]).toLowerCase().includes(searchText),
    ),
  )

  return (
    <section className="rounded-xl bg-white shadow">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-2">
          {actions}
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden="true" />
            Toevoegen
          </Button>
        </div>
      </div>

      {!isModalOpen && error && (
        <div className="px-6 pt-4">
          <FormMessage message={{ text: error, isError: true }} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="border-b border-gray-200 px-6 py-4 sm:max-w-sm sm:border-b-0 sm:pb-0">
          <SearchBar value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      )}

      {visibleRows.length === 0 ? (
        <p className="px-6 py-8 text-center text-gray-600">
          {rows.length === 0 ? 'Nog geen gegevens' : 'Geen resultaten gevonden'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-gray-200 text-sm text-gray-600">
              <tr>
                {tableFields.map((field) => (
                  <th className="px-4 py-3 font-medium sm:px-6" key={field.name}>
                    {field.label}
                  </th>
                ))}
                {restore && <th className="px-4 py-3 font-medium sm:px-6">Status</th>}
                <th className="px-4 py-3 text-right font-medium sm:px-6">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visibleRows.map((row) => (
                <tr className={`h-14 ${row.isActive === false ? 'text-gray-400' : ''}`} key={row.id}>
                  {tableFields.map((field) => (
                    <td className="px-4 py-2 sm:px-6" key={field.name}>
                      {field.type !== 'image' ? (
                        displayValue(row.values[field.name], options[field.name])
                      ) : row.values[field.name] ? (
                        <img
                          className="size-10 rounded-md border border-gray-200 object-cover"
                          src={String(row.values[field.name])}
                          alt=""
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-400">
                          <ImageIcon className="size-4" aria-hidden="true" />
                        </div>
                      )}
                    </td>
                  ))}
                  {restore && (
                    <td className="px-4 py-2 sm:px-6">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          row.isActive === false ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {row.isActive === false ? 'Inactief' : 'Actief'}
                      </span>
                    </td>
                  )}
                  <td className="px-2 py-2 sm:px-4">
                    {!row.isLocked && (
                      <div className="flex justify-end gap-1">
                        <button
                          className={iconButtonClasses}
                          type="button"
                          aria-label="Wijzigen"
                          onClick={() => setEditing(row)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        {restore && row.isActive === false ? (
                          <button
                            className={`${iconButtonClasses} hover:text-green-700`}
                            type="button"
                            aria-label="Actief maken"
                            onClick={() => save(() => restore(row.id))}
                          >
                            <RotateCcw className="size-4" aria-hidden="true" />
                          </button>
                        ) : (
                          <button
                            className={`${iconButtonClasses} hover:text-red-700`}
                            type="button"
                            aria-label="Verwijderen"
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <Modal title={editing === 'new' ? 'Toevoegen' : 'Wijzigen'} onClose={closeModals}>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {fields.map((field) => {
              const value = editing === 'new' ? undefined : editing.values[field.name]
              const isOptional = field.optional || (field.optionalOnEdit && editing !== 'new')

              if (field.type === 'checkbox') {
                return <Toggle key={field.name} label={field.label} name={field.name} defaultChecked={value === true} />
              }
              if (field.type === 'image') {
                return (
                  <ImageInput
                    key={field.name}
                    label={field.label}
                    name={field.name}
                    currentUrl={typeof value === 'string' ? value : ''}
                  />
                )
              }
              if (field.type === 'select') {
                return (
                  <Dropdown
                    key={field.name}
                    label={field.label}
                    name={field.name}
                    options={options[field.name] ?? []}
                    placeholder="Maak een keuze"
                    defaultValue={typeof value === 'string' ? value : ''}
                    required={!isOptional}
                  />
                )
              }
              return (
                <Input
                  key={field.name}
                  label={field.label}
                  name={field.name}
                  type={field.type ?? 'text'}
                  defaultValue={typeof value === 'string' ? value : ''}
                  placeholder={field.optionalOnEdit && isOptional ? 'Leeg laten om niet te wijzigen' : undefined}
                  min={field.type === 'number' ? 0 : undefined}
                  minLength={field.minLength}
                  maxLength={255}
                  required={!isOptional}
                />
              )
            })}

            {error && <FormMessage message={{ text: error, isError: true }} />}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="neutral" onClick={closeModals}>
                Annuleren
              </Button>
              <Button type="submit">Opslaan</Button>
            </div>
          </form>
        </Modal>
      )}

      {deleting !== null && (
        <Modal title="Verwijderen" onClose={closeModals}>
          <div className="flex flex-col gap-5">
            <p className="break-words">
              Weet je zeker dat je <strong>{describeRow(deleting)}</strong> wilt verwijderen?
            </p>

            {error && <FormMessage message={{ text: error, isError: true }} />}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="neutral" onClick={closeModals}>
                Annuleren
              </Button>
              <Button variant="danger" onClick={() => save(() => remove(deleting.id))}>
                Verwijderen
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default DataManager
