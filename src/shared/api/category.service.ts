import { httpClient } from "./httpClient";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CategoryItem {
  id: number;
  name: string;
  iconUrl: string | null;
  roomCount: number;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const categoryService = {
  /** GET /categories — danh sách tất cả danh mục (public) */
  getAll: () => httpClient.get<CategoryItem[]>("/categories"),

  /** GET /categories/{id} — chi tiết danh mục (public) */
  getById: (id: number) => httpClient.get<CategoryItem>(`/categories/${id}`),
};
