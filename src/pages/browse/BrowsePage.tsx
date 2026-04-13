import { useParams, Link } from "react-router-dom";
import { Grid3x3, LayoutList, SlidersHorizontal, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { StreamCard } from "@/entities/stream";
import { CategoryCard, useCategories } from "@/entities/category";
import { useLiveRooms } from "@/entities/stream";

export function BrowsePage() {
  const { category } = useParams();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { categories, isLoading: catsLoading } = useCategories();

  // category URL param is now a numeric ID (e.g. /browse/1)
  const categoryId = category ? Number(category) : undefined;
  const selectedCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : null;

  const { rooms, isLoading, error, hasMore, loadMore } = useLiveRooms(categoryId);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Category hero banner */}
      {selectedCategory && (
        <div className="relative h-60 overflow-hidden border-b border-border">
          {selectedCategory.iconUrl ? (
            <img
              src={selectedCategory.iconUrl}
              alt={selectedCategory.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="max-w-[1920px] mx-auto">
              <h1 className="text-4xl font-bold mb-2">
                {selectedCategory.name}
              </h1>
              <p className="text-muted-foreground">
                {selectedCategory.roomCount} live channels
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All-categories grid */}
      {!category && (
        <div className="border-b border-border bg-card transition-colors duration-300 text-card-foreground">
          <div className="max-w-[1920px] mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold mb-4">Browse</h1>

            {catsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-lg bg-secondary animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {categories.map((cat) => (
                  <CategoryCard key={cat.id} category={cat} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="border-b border-border bg-card transition-colors duration-300 sticky top-14 z-40">
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded transition text-sm text-foreground">
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>
              {category && (
                <Link
                  to="/browse"
                  className="px-4 py-2 hover:bg-accent rounded transition text-sm text-muted-foreground hover:text-foreground"
                >
                  Clear category
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded transition ${
                  viewMode === "grid" ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded transition ${
                  viewMode === "list" ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                }`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stream results */}
      <div className="max-w-[1920px] mx-auto px-4 py-8">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-sm text-muted-foreground mb-4">
          {rooms.length} live channels
        </p>

        {isLoading && rooms.length === 0 ? (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                : "space-y-4"
            }
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-video rounded-lg bg-secondary animate-pulse mb-2" />
                <div className="flex gap-2">
                  <div className="w-10 h-10 rounded-full bg-secondary animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-secondary rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-secondary rounded animate-pulse w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 && !isLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium mb-2">
              {selectedCategory
                ? `Không có stream nào đang live trong ${selectedCategory.name}`
                : "Chưa có stream nào đang live"}
            </p>
            <p className="text-sm">Hãy quay lại sau nhé!</p>
          </div>
        ) : (
          <>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "space-y-4"
              }
            >
              {rooms.map((room) => (
                <StreamCard key={room.roomId} room={room} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Show More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
