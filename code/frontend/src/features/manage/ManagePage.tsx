import { useState } from 'react'
import Dropdown from '../../components/ui/Dropdown.tsx'
import { createCategory, deleteCategory, fetchCategories, updateCategory } from './api.ts'
import DataManager from './DataManager.tsx'

const manageOptions = [{ value: 'category', label: 'Categorieën' }]

const categoryFields = [{ name: 'name', label: 'Naam' }]

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
    </div>
  )
}

export default ManagePage
