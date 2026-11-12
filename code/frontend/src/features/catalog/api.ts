import { request } from '../../lib/request.ts'

export type CatalogItem = {
  item_id: number
  article_number: string | null
  name: string
  photo: string | null
  detail: string | null
  count: number
  category_id: number
}

export function fetchCatalogItems(): Promise<CatalogItem[]> {
  return request('/api/items/catalog')
}
