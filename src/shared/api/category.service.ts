import { httpClient } from "./httpClient";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CategoryItem {
  id: number;
  name: string;
  iconUrl: string | null;
  roomCount: number;
}

export interface UpsertCategoryRequest {
  name: string;
  iconUrl?: string | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const categoryService = {
  /** GET /categories — danh sách tất cả danh mục (public) */
  getAll: () => httpClient.get<CategoryItem[]>("/categories"),

  /** GET /categories/{id} — chi tiết danh mục (public) */
  getById: (id: number) => httpClient.get<CategoryItem>(`/categories/${id}`),

  /** POST /categories — tạo danh mục mới (JWT ADMIN) */
  create: (data: UpsertCategoryRequest) => httpClient.post<CategoryItem>("/categories", data),

  /** PUT /categories/{id} — cập nhật danh mục (JWT ADMIN) */
  update: (id: number, data: UpsertCategoryRequest) =>
    httpClient.put<CategoryItem>(`/categories/${id}`, data),

  /** DELETE /categories/{id} — xóa danh mục (JWT ADMIN) */
  remove: (id: number) => httpClient.delete<void>(`/categories/${id}`),
};
