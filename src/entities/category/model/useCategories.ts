import { useState, useEffect } from "react";
import { categoryService, type CategoryItem } from "@/shared/api/category.service";

interface UseCategoriesReturn {
  categories: CategoryItem[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches all categories from the API. Since categories are relatively
 * static, no pagination is needed.
 */
export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    categoryService
      .getAll()
      .then((res) => {
        if (!cancelled) setCategories(res.data);
      })
      .catch(() => {
        if (!cancelled) setError("Không thể tải danh mục");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, isLoading, error };
}
