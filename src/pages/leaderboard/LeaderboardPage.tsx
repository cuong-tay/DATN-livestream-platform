import { useState, useEffect } from "react";
import { Trophy, Medal, Star, TrendingUp, Flame } from "lucide-react";

interface LeaderboardUser {
  id: number;
  username: string;
  avatarUrl: string | null;
  followers: number;
  rank: number;
  trend: "up" | "down" | "same";
}

const MOCK_LEADERBOARD: LeaderboardUser[] = [
  { id: 1, username: "MixiGaming", avatarUrl: null, followers: 1250000, rank: 1, trend: "up" },
  { id: 2, username: "PewPew", avatarUrl: null, followers: 980000, rank: 2, trend: "same" },
  { id: 3, username: "Xemesis", avatarUrl: null, followers: 850000, rank: 3, trend: "up" },
  { id: 4, username: "ViruSs", avatarUrl: null, followers: 720000, rank: 4, trend: "down" },
  { id: 5, username: "MisThy", avatarUrl: null, followers: 650000, rank: 5, trend: "up" },
  { id: 6, username: "Linh Ngoc Dam", avatarUrl: null, followers: 540000, rank: 6, trend: "same" },
  { id: 7, username: "ThayGiaoBa", avatarUrl: null, followers: 420000, rank: 7, trend: "up" },
];

export function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Giả lập gọi API lấy bảng xếp hạng
    const timer = setTimeout(() => {
      setData(MOCK_LEADERBOARD);
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-primary">
        <Flame className="w-16 h-16 animate-pulse text-orange-500 mb-4" />
        <h2 className="text-xl font-bold animate-pulse text-foreground">Đang tải Bảng Xếp Hạng...</h2>
      </div>
    );
  }

  const topThree = data.slice(0, 3);
  const others = data.slice(3);

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-orange-500/10 rounded-full mb-4">
            <Trophy className="w-12 h-12 text-orange-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-rose-500">
            Bảng Xếp Hạng Streamer
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Vinh danh những nhà sáng tạo nội dung hàng đầu có lượng người hâm mộ đông đảo nhất trên nền tảng.
          </p>
        </div>

        {/* Top 3 Podium */}
        <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 pt-8 pb-12">
          {/* Rank 2 */}
          <div className="flex flex-col items-center order-2 md:order-1 relative">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-500 border-4 border-slate-300 shadow-lg shadow-slate-500/20 z-10 relative">
                {topThree[1].username[0]}
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-20">
                #2
              </div>
            </div>
            <h3 className="font-bold text-lg text-foreground mt-2">{topThree[1].username}</h3>
            <p className="text-sm font-medium text-muted-foreground">{topThree[1].followers.toLocaleString()} người theo dõi</p>
            <div className="w-32 h-32 bg-gradient-to-b from-slate-200/20 to-transparent mt-4 rounded-t-lg hidden md:block" />
          </div>

          {/* Rank 1 */}
          <div className="flex flex-col items-center order-1 md:order-2 relative -mt-8 md:mt-0 z-10">
            <div className="absolute -top-10 text-yellow-400">
              <Trophy className="w-12 h-12 animate-bounce" />
            </div>
            <div className="relative mb-4">
              <div className="w-32 h-32 rounded-full bg-yellow-100 flex items-center justify-center text-5xl font-bold text-yellow-600 border-4 border-yellow-400 shadow-xl shadow-yellow-500/30">
                {topThree[0].username[0]}
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-yellow-950 text-sm font-black px-4 py-1.5 rounded-full shadow-lg z-20">
                #1 Vô Địch
              </div>
            </div>
            <h3 className="font-extrabold text-2xl text-foreground mt-2">{topThree[0].username}</h3>
            <p className="text-base font-semibold text-yellow-600">{topThree[0].followers.toLocaleString()} người theo dõi</p>
            <div className="w-40 h-40 bg-gradient-to-b from-yellow-500/20 to-transparent mt-4 rounded-t-xl hidden md:block" />
          </div>

          {/* Rank 3 */}
          <div className="flex flex-col items-center order-3 md:order-3 relative">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center text-3xl font-bold text-amber-700 border-4 border-amber-600 shadow-lg shadow-amber-700/20 z-10 relative">
                {topThree[2].username[0]}
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-20">
                #3
              </div>
            </div>
            <h3 className="font-bold text-lg text-foreground mt-2">{topThree[2].username}</h3>
            <p className="text-sm font-medium text-muted-foreground">{topThree[2].followers.toLocaleString()} người theo dõi</p>
            <div className="w-32 h-24 bg-gradient-to-b from-amber-600/10 to-transparent mt-4 rounded-t-lg hidden md:block" />
          </div>
        </div>

        {/* The rest of the leaderboard */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-[60px_1fr_120px_60px] gap-4 p-4 bg-muted/50 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
            <div className="text-center">Thứ Hạng</div>
            <div>Streamer</div>
            <div className="text-right">Người theo dõi</div>
            <div className="text-center">Phong độ</div>
          </div>
          <div className="divide-y divide-border">
            {others.map((user) => (
              <div key={user.id} className="grid grid-cols-[60px_1fr_120px_60px] gap-4 p-4 items-center hover:bg-accent/30 transition-colors group">
                <div className="text-center font-bold text-muted-foreground group-hover:text-foreground">
                  {user.rank}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {user.username[0]}
                  </div>
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {user.username}
                  </span>
                </div>
                <div className="text-right font-medium text-foreground">
                  {user.followers.toLocaleString()}
                </div>
                <div className="flex justify-center">
                  {user.trend === "up" ? (
                     <TrendingUp className="w-5 h-5 text-green-500" />
                  ) : user.trend === "down" ? (
                     <TrendingUp className="w-5 h-5 text-red-500 rotate-180" />
                  ) : (
                     <div className="w-3 h-1 bg-gray-400 rounded-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
