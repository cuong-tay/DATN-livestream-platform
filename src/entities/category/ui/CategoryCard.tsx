// ─── CategoryCard ─────────────────────────────────────────────────────────────
// Entity UI: displays a Category from the API.
// No business logic – purely presentational.

import { Link } from "react-router-dom";
import type { CategoryItem } from "@/shared/api/category.service";

interface CategoryCardProps {
  category: CategoryItem;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link to={`/browse/${category.id}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg mb-2">
        {category.iconUrl ? (
          <img
            src={category.iconUrl}
            alt={category.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <span className="text-3xl font-bold text-white/40">
              {category.name[0]?.toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2">
          <h3 className="font-semibold mb-1">{category.name}</h3>
          <p className="text-xs text-gray-300">
            {category.roomCount} live channels
          </p>
        </div>
      </div>
    </Link>
  );
}
