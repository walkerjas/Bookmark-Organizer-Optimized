export type Bookmark = {
  id: number;
  url: string;
  title: string;
  description?: string | null;
  favicon?: string | null;
  previewImage?: string | null;
  collectionId?: number | null;
  pinned: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt?: string;
  tags?: Tag[];
};

export type Collection = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  parentId?: number | null;
  createdAt: string;
  bookmarkCount: number;
};

export type Tag = {
  id: number;
  name: string;
  color?: string | null;
};

export type BookmarkInput = {
  url: string;
  title: string;
  description?: string;
  favicon?: string;
  collectionId?: number | null;
  pinned?: boolean;
  tagIds?: number[];
};

function getBaseUrl(): string {
  return localStorage.getItem("markbase_api_url") || "http://racetrack:8082";
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const base = getBaseUrl().replace(/\/$/, "");
  if (!base) throw new Error("API URL not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function listBookmarks(params?: {
  search?: string;
  pinned?: boolean;
  collectionId?: number;
}): Promise<Bookmark[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.pinned !== undefined) qs.set("pinned", String(params.pinned));
  if (params?.collectionId !== undefined)
    qs.set("collectionId", String(params.collectionId));
  const q = qs.toString();
  return apiFetch<Bookmark[]>(`/api/bookmarks${q ? `?${q}` : ""}`);
}

export async function createBookmark(data: BookmarkInput): Promise<Bookmark> {
  return apiFetch<Bookmark>("/api/bookmarks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function togglePin(id: number): Promise<Bookmark> {
  return apiFetch<Bookmark>(`/api/bookmarks/${id}/pin`, { method: "PATCH" });
}

export async function updateBookmark(
  id: number,
  data: Partial<{ sortOrder: number; pinned: boolean; title: string; description: string }>,
): Promise<Bookmark> {
  return apiFetch<Bookmark>(`/api/bookmarks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function reorderBookmarks(ids: number[]): Promise<void> {
  return apiFetch<void>("/api/bookmarks/reorder", {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}

export async function deleteBookmark(id: number): Promise<void> {
  return apiFetch<void>(`/api/bookmarks/${id}`, { method: "DELETE" });
}

export async function listCollections(): Promise<Collection[]> {
  return apiFetch<Collection[]>("/api/collections");
}

export async function checkHealth(): Promise<boolean> {
  try {
    await apiFetch<{ status: string }>("/api/healthz");
    return true;
  } catch {
    return false;
  }
}
