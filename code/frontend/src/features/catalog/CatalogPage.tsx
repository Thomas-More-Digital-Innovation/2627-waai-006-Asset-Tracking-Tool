import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import FormMessage from '../../components/ui/FormMessage.tsx'
import SearchBar from '../../components/ui/SearchBar.tsx'
import Tile from '../../components/ui/Tile.tsx'
import { fetchCategories, type Category } from '../reserve/api.ts'
import { fetchCatalogItems, type CatalogItem } from './api.ts'

const gridClasses = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'

// Shows all categories and items, the same as the reserve page but without a period or cart
function CatalogPage() {
  const [params] = useSearchParams()
  const categoryId = Number(params.get('category'))
  const [data, setData] = useState<{ categories: Category[]; items: CatalogItem[] } | null>(null)
  const [hasError, setHasError] = useState(false)
  // The search belongs to one category, so opening another category starts with an empty search
  const [searchState, setSearchState] = useState({ categoryId, text: '' })
  const search = searchState.categoryId === categoryId ? searchState.text : ''

  useEffect(() => {
    Promise.all([fetchCategories(), fetchCatalogItems()])
      .then(([categories, items]) => setData({ categories, items }))
      .catch(() => setHasError(true))
  }, [])

  if (hasError || !data) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Catalogus</h1>
        {hasError && <FormMessage message={{ text: 'De gegevens konden niet geladen worden.', isError: true }} />}
      </div>
    )
  }

  const { categories, items } = data
  const category = categories.find((candidate) => candidate.category_id === categoryId)
  const searchText = search.trim().toLowerCase()
  const itemsIn = (id: number) => items.filter((item) => item.category_id === id)
  // An item matches when its name, article number or description contains the search text
  const matches = (item: CatalogItem) =>
    [item.name, item.article_number, item.detail].some((text) => text?.toLowerCase().includes(searchText))

  // Inside a category only its items are shown; outside one, categories are shown and,
  // while searching, matching items from every category as well
  const shownCategories = category
    ? []
    : categories.filter((candidate) => candidate.name.toLowerCase().includes(searchText))
  const shownItems = category ? itemsIn(category.category_id).filter(matches) : searchText ? items.filter(matches) : []

  let emptyText = ''
  if (category && itemsIn(category.category_id).length === 0) {
    emptyText = 'Deze categorie bevat geen materiaal.'
  } else if (categories.length === 0) {
    emptyText = 'Er is nog geen materiaal toegevoegd.'
  } else if (shownCategories.length === 0 && shownItems.length === 0) {
    emptyText = 'Geen resultaten gevonden.'
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Catalogus</h1>
      <section className="flex flex-col gap-4">
        {category && (
          <>
            <Link
              className="flex items-center gap-2 self-start text-sm font-medium text-primary hover:underline"
              to="/catalog"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Terug naar categorieën
            </Link>
            <h2 className="text-lg font-semibold">{category.name}</h2>
          </>
        )}

        {/* Searching makes no sense when there is nothing to search in */}
        {(category ? itemsIn(category.category_id).length > 0 : categories.length > 0) && (
          <div className="w-full sm:max-w-sm">
            <SearchBar
              placeholder={category ? `Zoeken in ${category.name}…` : 'Zoek materiaal of categorie…'}
              value={search}
              onChange={(event) => setSearchState({ categoryId, text: event.target.value })}
            />
          </div>
        )}

        {emptyText && <p className="text-gray-600">{emptyText}</p>}

        {shownCategories.length > 0 && (
          <>
            <h2 className="text-lg font-semibold">Categorieën</h2>
            <ul className={gridClasses}>
              {shownCategories.map((candidate) => (
                <li key={candidate.category_id}>
                  <Tile
                    title={candidate.name}
                    subtitle={`${itemsIn(candidate.category_id).length} items`}
                    actionLabel="Bekijk categorie"
                    href={`/catalog?category=${candidate.category_id}`}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {shownItems.length > 0 && (
          <>
            {!category && <h2 className="text-lg font-semibold">Materiaal</h2>}
            <ul className={gridClasses}>
              {shownItems.map((item) => (
                <li key={item.item_id}>
                  <Tile
                    title={item.name}
                    subtitle={`${item.count} in totaal`}
                    description={item.detail}
                    imageUrl={item.photo ? `/api/items/photos/${item.photo}` : undefined}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

export default CatalogPage
