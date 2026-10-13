// Sends a request to the backend and returns the answer, or throws an error with a readable reason
export async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    // The backend sends a readable reason in "detail" for errors it expects
    const error = await response.json().catch(() => null)
    throw new Error(typeof error?.detail === 'string' ? error.detail : 'Er ging iets mis.')
  }
  // An answer without content, such as after a delete, has nothing to read
  return response.status === 204 ? (undefined as T) : response.json()
}
