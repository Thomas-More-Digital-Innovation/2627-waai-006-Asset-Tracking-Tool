import { Download } from 'lucide-react'
import { useState } from 'react'
import Button from '../../components/ui/Button.tsx'
import {
  activateItem,
  activateUser,
  createCategory,
  createDepartment,
  createItem,
  createUser,
  deleteCategory,
  deleteDepartment,
  deleteItem,
  deleteUser,
  fetchCategories,
  fetchCategoryOptions,
  fetchDepartments,
  fetchItems,
  fetchUsers,
  updateCategory,
  updateDepartment,
  updateItem,
  updateUser,
} from './api.ts'
import DataManager, { type DataField, type DataValues } from './DataManager.tsx'

const manageOptions = [
  { value: 'item', label: 'Materiaal' },
  { value: 'category', label: 'Categorieën' },
  { value: 'department', label: 'Afdelingen' },
  { value: 'user', label: 'Gebruikers' },
]

const categoryFields: DataField[] = [{ name: 'name', label: 'Naam' }]

const itemFields: DataField[] = [
  { name: 'photo', label: 'Foto', type: 'image' },
  { name: 'article_number', label: 'Artikelnummer', optional: true },
  { name: 'name', label: 'Naam' },
  { name: 'category_id', label: 'Categorie', type: 'select', loadOptions: fetchCategoryOptions },
  { name: 'count', label: 'Aantal', type: 'number' },
  { name: 'detail', label: 'Omschrijving', optional: true, hideInTable: true },
]

// An item is named by its name and, when it has one, its article number
function describeItem(values: DataValues) {
  return values.article_number ? `${values.name} - ${values.article_number}` : String(values.name)
}

const departmentFields: DataField[] = [
  { name: 'name', label: 'Naam' },
  { name: 'mail', label: 'E-mailadres', type: 'email' },
]

const userFields: DataField[] = [
  { name: 'firstname', label: 'Voornaam' },
  { name: 'lastname', label: 'Achternaam' },
  { name: 'email', label: 'E-mailadres', type: 'email' },
  { name: 'is_admin', label: 'Beheerder', type: 'checkbox' },
  { name: 'password', label: 'Wachtwoord', type: 'password', minLength: 8, hideInTable: true, optionalOnEdit: true },
]

// The tab from the address, or the first tab when there is none
function initialTab() {
  const tab = new URLSearchParams(window.location.search).get('tab')
  return manageOptions.find((option) => option.value === tab)?.value ?? manageOptions[0].value
}

function ManagePage() {
  const [selected, setSelected] = useState(initialTab)

  // Keeps the chosen tab in the address, so a reload opens the same tab
  function selectTab(tab: string) {
    setSelected(tab)
    window.history.replaceState(null, '', `?tab=${tab}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Beheren</h1>
      </div>

      {/* Tabs, the chosen one is underlined */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b border-gray-200" role="tablist" aria-label="Wat wil je beheren?">
          {manageOptions.map((option) => {
            const isSelected = selected === option.value
            return (
              <button
                key={option.value}
                className={`-mb-px cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  isSelected
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
                }`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => selectTab(option.value)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {selected === 'item' && (
        <DataManager
          title="Materiaal"
          fields={itemFields}
          load={fetchItems}
          create={createItem}
          update={updateItem}
          remove={deleteItem}
          restore={activateItem}
          describe={describeItem}
          actions={
            <Button variant="secondary" onClick={() => (window.location.href = '/api/items/export')}>
              <Download className="size-4" aria-hidden="true" />
              Exporteren
            </Button>
          }
        />
      )}

      {selected === 'category' && (
        <DataManager
          title="Categorieën"
          fields={categoryFields}
          load={fetchCategories}
          create={createCategory}
          update={updateCategory}
          remove={deleteCategory}
        />
      )}

      {selected === 'department' && (
        <DataManager
          title="Afdelingen"
          fields={departmentFields}
          load={fetchDepartments}
          create={createDepartment}
          update={updateDepartment}
          remove={deleteDepartment}
        />
      )}

      {selected === 'user' && (
        <DataManager
          title="Gebruikers"
          fields={userFields}
          load={fetchUsers}
          create={createUser}
          update={updateUser}
          remove={deleteUser}
          restore={activateUser}
        />
      )}
    </div>
  )
}

export default ManagePage
