import { useState } from 'react'
import Dropdown from '../../components/ui/Dropdown.tsx'
import {
  activateUser,
  createCategory,
  createDepartment,
  createUser,
  deleteCategory,
  deleteDepartment,
  deleteUser,
  fetchCategories,
  fetchDepartments,
  fetchUsers,
  updateCategory,
  updateDepartment,
  updateUser,
} from './api.ts'
import DataManager, { type DataField } from './DataManager.tsx'

const manageOptions = [
  { value: 'category', label: 'Categorieën' },
  { value: 'department', label: 'Afdelingen' },
  { value: 'user', label: 'Gebruikers' },
]

const categoryFields: DataField[] = [{ name: 'name', label: 'Naam' }]

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
