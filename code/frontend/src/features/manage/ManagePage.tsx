import { useState } from 'react'
import Dropdown from '../../components/ui/Dropdown.tsx'
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
import DataManager, { type DataField } from './DataManager.tsx'

const manageOptions = [
  { value: 'item', label: 'Materiaal' },
  { value: 'category', label: 'Categorieën' },
  { value: 'department', label: 'Afdelingen' },
  { value: 'user', label: 'Gebruikers' },
]

const categoryFields: DataField[] = [{ name: 'name', label: 'Naam' }]

const itemFields: DataField[] = [
  { name: 'photo', label: 'Foto', type: 'image' },
  { name: 'name', label: 'Naam' },
  { name: 'category_id', label: 'Categorie', type: 'select', loadOptions: fetchCategoryOptions },
  { name: 'count', label: 'Aantal', type: 'number' },
  { name: 'detail', label: 'Omschrijving', optional: true, hideInTable: true },
]

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

function ManagePage() {
  const [selected, setSelected] = useState('')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Beheren</h1>
      </div>

      <div className="w-full sm:max-w-xs">
        <Dropdown
          label="Wat wil je beheren?"
          options={manageOptions}
          placeholder="Maak een keuze"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        />
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
