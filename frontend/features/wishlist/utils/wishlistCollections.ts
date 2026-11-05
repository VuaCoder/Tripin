export interface WishlistCollection {
  id: string;
  name: string;
  tourIds: string[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'tripri_wishlist_collections_';

export function getWishlistCollections(userId = 'default'): WishlistCollection[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) {
      const initial: WishlistCollection[] = [
        {
          id: 'default',
          name: 'Danh sách yêu thích',
          tourIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : [
          {
            id: 'default',
            name: 'Danh sách yêu thích',
            tourIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
  } catch {
    return [];
  }
}

export function saveWishlistCollections(collections: WishlistCollection[], userId = 'default'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(collections));
    window.dispatchEvent(new CustomEvent('wishlist-collections-updated'));
  } catch {
    // Ignore quota errors
  }
}

export function getLatestWishlistCollection(userId = 'default'): WishlistCollection {
  const current = getWishlistCollections(userId);
  if (current.length === 0) {
    return createWishlistCollection('Danh sách yêu thích', undefined, userId);
  }
  if (current.length === 1) return current[0];

  // Prefer custom created collections over default empty list
  const custom = current.filter((c) => c.id !== 'default');
  const pool = custom.length > 0 ? custom : current;

  const sorted = [...pool].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return pool.indexOf(b) - pool.indexOf(a);
  });
  return sorted[0];
}

export function createWishlistCollection(name: string, tourId?: string, userId = 'default'): WishlistCollection {
  const current = getWishlistCollections(userId);
  const now = new Date().toISOString();
  const newCol: WishlistCollection = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    tourIds: tourId ? [tourId] : [],
    createdAt: now,
    updatedAt: now,
  };
  saveWishlistCollections([...current, newCol], userId);
  return newCol;
}

export function deleteWishlistCollection(collectionId: string, userId = 'default'): void {
  const current = getWishlistCollections(userId);
  const filtered = current.filter((c) => c.id !== collectionId);
  saveWishlistCollections(filtered, userId);
}

export function toggleTourInCollection(collectionId: string, tourId: string, userId = 'default'): boolean {
  const current = getWishlistCollections(userId);
  let isNowSaved = false;
  const updated = current.map((col) => {
    if (col.id === collectionId) {
      const exists = col.tourIds.includes(tourId);
      isNowSaved = !exists;
      return {
        ...col,
        tourIds: exists ? col.tourIds.filter((id) => id !== tourId) : [...col.tourIds, tourId],
        updatedAt: new Date().toISOString(),
      };
    }
    return col;
  });
  saveWishlistCollections(updated, userId);
  return isNowSaved;
}

export function addTourToCollection(collectionId: string, tourId: string, userId = 'default'): WishlistCollection | null {
  const current = getWishlistCollections(userId);
  let targetCol: WishlistCollection | null = null;
  const updated = current.map((col) => {
    if (col.id === collectionId) {
      const exists = col.tourIds.includes(tourId);
      const newCol = {
        ...col,
        tourIds: exists ? col.tourIds : [...col.tourIds, tourId],
        updatedAt: new Date().toISOString(),
      };
      targetCol = newCol;
      return newCol;
    }
    return col;
  });
  saveWishlistCollections(updated, userId);
  return targetCol;
}

export function addTourToLatestCollection(tourId: string, userId = 'default'): WishlistCollection {
  const latest = getLatestWishlistCollection(userId);
  const updated = addTourToCollection(latest.id, tourId, userId);
  return updated || latest;
}

export function removeTourFromCollection(collectionId: string, tourId: string, userId = 'default'): void {
  const current = getWishlistCollections(userId);
  const updated = current.map((col) => {
    if (col.id === collectionId) {
      return {
        ...col,
        tourIds: col.tourIds.filter((id) => id !== tourId),
        updatedAt: new Date().toISOString(),
      };
    }
    return col;
  });
  saveWishlistCollections(updated, userId);
}

export function getTourCollectionNames(tourId: string, userId = 'default'): string[] {
  const current = getWishlistCollections(userId);
  return current.filter((col) => col.tourIds.includes(tourId)).map((col) => col.name);
}

export function removeTourFromAllCollections(tourId: string, userId = 'default'): void {
  const current = getWishlistCollections(userId);
  const updated = current.map((col) => ({
    ...col,
    tourIds: col.tourIds.filter((id) => id !== tourId),
  }));
  saveWishlistCollections(updated, userId);
}
