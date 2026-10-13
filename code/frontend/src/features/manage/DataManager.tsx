import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import Button from '../../components/ui/Button.tsx'
import FormMessage from '../../components/ui/FormMessage.tsx'
import Input from '../../components/ui/Input.tsx'
import Modal from '../../components/ui/Modal.tsx'
import SearchBar from '../../components/ui/SearchBar.tsx'

export type DataValues = Record<string, string>

export type DataRow = {
  id: number
  values: DataValues
}

export type DataField = {
  name: string
  label: string
  type?: string
}

type DataManagerProps = {
  title: string
  fields: DataField[]
  load: () => Promise<DataRow[]>
  create: (values: DataValues) => Promise<void>
  update: (id: number, values: DataValues) => Promise<void>
  remove: (id: number) => Promise<void>
}

const iconButtonClasses =
  'flex size-10 cursor-pointer items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100'

function DataManager({ title, fields, load, create, update, remove }: DataManagerProps) {
  const [rows, setRows] = useState<DataRow[]>([])
  // "new" means the add form is open, a row means that row is being edited
  const [editing, setEditing] = useState<DataRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<DataRow | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // Loads the rows once, when the component first appears
  useEffect(() => {
    load()
      .then(setRows)
      .catch(() => setError('De gegevens konden niet geladen worden.'))
  }, [load])

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
      setError(caught instanceof Error ? caught.message : 'Er ging iets mis.')
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Prevents the browser from reloading the page when the form is submitted
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values: DataValues = {}
    for (const field of fields) {
      values[field.name] = String(form.get(field.name)).trim()
    }

    const row = editing
    save(() => (row === 'new' || row === null ? create(values) : update(row.id, values)))
  }

  const isModalOpen = editing !== null || deleting !== null

  // Keeps the rows where at least one field contains the search text
  const searchText = search.trim().toLowerCase()
  const visibleRows = rows.filter((row) =>
    fields.some((field) => row.values[field.name].toLowerCase().includes(searchText)),
  )

  return (
    <section className="rounded-xl bg-white shadow">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden="true" />
          Toevoegen
        </Button>
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
          {rows.length === 0 ? 'Nog geen gegevens.' : 'Geen resultaten gevonden'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-gray-200 text-sm text-gray-600">
              <tr>
                {fields.map((field) => (
                  <th className="px-4 py-3 font-medium sm:px-6" key={field.name}>
                    {field.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium sm:px-6">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  {fields.map((field) => (
                    <td className="px-4 py-2 sm:px-6" key={field.name}>
                      {row.values[field.name]}
                    </td>
                  ))}
                  <td className="px-2 py-2 sm:px-4">
                    <div className="flex justify-end gap-1">
                      <button
                        className={iconButtonClasses}
                        type="button"
                        aria-label="Wijzigen"
                        onClick={() => setEditing(row)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        className={`${iconButtonClasses} hover:text-red-700`}
                        type="button"
                        aria-label="Verwijderen"
                        onClick={() => setDeleting(row)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
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
            {fields.map((field) => (
              <Input
                key={field.name}
                label={field.label}
                name={field.name}
                type={field.type ?? 'text'}
                defaultValue={editing === 'new' ? '' : editing.values[field.name]}
                maxLength={255}
                required
              />
            ))}

            {error && <FormMessage message={{ text: error, isError: true }} />}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeModals}>
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
            <p>
              Weet je zeker dat je <strong>{deleting.values[fields[0].name]}</strong> wilt verwijderen?
            </p>

            {error && <FormMessage message={{ text: error, isError: true }} />}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeModals}>
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
