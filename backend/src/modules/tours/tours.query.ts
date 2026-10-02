/** Narrows a validated list query to the `{ page, limit }` the services expect. */
export function pageQueryOf(query: { page: number; limit: number }): { page: number; limit: number } {
  return { page: query.page, limit: query.limit };
}
