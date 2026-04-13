import { Link } from "react-router-dom";
import { TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { StreamCard } from "@/entities/stream";
import { CategoryCard } from "@/entities/category";
import { useLiveRooms } from "@/entities/stream";
import { useCategories } from "@/entities/category";

export function HomePage() {
  const { rooms, isLoading: roomsLoading, error: roomsError, hasMore, loadMore } = useLiveRooms();
  const { categories, isLoading: catsLoading } = useCategories();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Categories */}
      <section className="border-b border-border bg-card text-card-foreground transition-colors duration-300">
        <div className="max-w-[1920px] mx-auto px-4 py-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Browse Categories
          </h2>

          {catsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Live channels */}
      <section className="max-w-[1920px] mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6">
          Live Channels We Think You'll Like
        </h2>

        {roomsError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-6">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{roomsError}</span>
          </div>
        )}

        {roomsLoading && rooms.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
        ) : rooms.length === 0 && !roomsLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium mb-2">Chưa có stream nào đang live</p>
            <p className="text-sm">Hãy quay lại sau nhé!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rooms.map((room) => (
                <StreamCard key={room.roomId} room={room} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={roomsLoading}
                  className="px-6 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
                >
                  {roomsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Show More
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
