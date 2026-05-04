import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trophy, Flame, AlertCircle, Users, DollarSign, Clock } from "lucide-react";
import { statisticsService, type LeaderboardEntry } from "@/shared/api/statistics.service";

type TabKey = "ccv" | "donations" | "watchtime";

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  valueLabel: string;
  formatValue: (v: number) => string;
}

const TABS: TabConfig[] = [
  {
    key: "ccv",
    label: "Peak CCV",
    icon: <Users className="w-4 h-4" />,
    valueLabel: "người xem đỉnh",
    formatValue: (v) => v.toLocaleString("vi-VN"),
  },
  {
    key: "donations",
    label: "Top Donations",
    icon: <DollarSign className="w-4 h-4" />,
    valueLabel: "tổng donate",
    formatValue: (v) =>
      v >= 1_000_000
        ? `${(v / 1_000_000).toFixed(1)}M đ`
        : `${v.toLocaleString("vi-VN")} đ`,
  },
  {
    key: "watchtime",
    label: "Watch Time",
    icon: <Clock className="w-4 h-4" />,
    valueLabel: "phút xem",
    formatValue: (v) =>
      v >= 60 ? `${Math.round(v / 60).toLocaleString("vi-VN")} giờ` : `${v} phút`,
  },
];

// Build last-30-days date range
function getDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("ccv");
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async (tab: TabKey) => {
    setIsLoading(true);
    setError(null);
    const params = { ...getDateRange(), size: 10 };
    try {
      let res;
      if (tab === "ccv") res = await statisticsService.getLeaderboardTopCcv(params);
      else if (tab === "donations") res = await statisticsService.getLeaderboardTopDonations(params);
      else res = await statisticsService.getLeaderboardTopWatchtime(params);
      setData(res.data.content);
    } catch {
      setError("Không thể tải bảng xếp hạng");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(activeTab);
  }, [activeTab, fetchLeaderboard]);

  const activeTabConfig = TABS.find((t) => t.key === activeTab)!;

  const topThree = data.slice(0, 3);
  const others = data.slice(3);

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-orange-500/10 rounded-full mb-4">
            <Trophy className="w-12 h-12 text-orange-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-rose-500">
            Bảng Xếp Hạng Streamer
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Vinh danh những nhà sáng tạo nội dung hàng đầu trên nền tảng – cập nhật 30 ngày gần nhất.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all ${
                activeTab === tab.key
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-orange-400"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Flame className="w-12 h-12 animate-pulse text-orange-500 mb-3" />
            <p className="text-muted-foreground animate-pulse">Đang tải bảng xếp hạng...</p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="flex items-center justify-center gap-2 py-12 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && data.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Chưa có dữ liệu trong khoảng thời gian này.</p>
          </div>
        )}

        {/* Podium top 3 */}
        {!isLoading && !error && topThree.length >= 3 && (
          <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 pt-8 pb-4">
            {/* Rank 2 */}
            <div className="flex flex-col items-center order-2 md:order-1">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-600 border-4 border-slate-300 shadow-lg">
                  {topThree[1].streamerUsername[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
                  #2
                </div>
              </div>
              <h3 className="font-bold text-lg text-foreground mt-2">
                <Link to={`/channel/${topThree[1].streamerId}`} className="hover:text-primary transition-colors">{topThree[1].streamerUsername}</Link>
              </h3>
              <p className="text-sm text-muted-foreground">{activeTabConfig.formatValue(topThree[1].value)} {activeTabConfig.valueLabel}</p>
              <div className="w-32 h-24 bg-gradient-to-b from-slate-200/20 to-transparent mt-3 rounded-t-lg hidden md:block" />
            </div>

            {/* Rank 1 */}
            <div className="flex flex-col items-center order-1 md:order-2 relative -mt-8 md:mt-0 z-10">
              <div className="absolute -top-10 text-yellow-400">
                <Trophy className="w-12 h-12 animate-bounce" />
              </div>
              <div className="relative mb-4">
                <div className="w-32 h-32 rounded-full bg-yellow-100 flex items-center justify-center text-5xl font-bold text-yellow-600 border-4 border-yellow-400 shadow-xl shadow-yellow-500/30">
                  {topThree[0].streamerUsername[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-yellow-950 text-sm font-black px-4 py-1.5 rounded-full shadow-lg z-20">
                  #1 Vô Địch
                </div>
              </div>
              <h3 className="font-extrabold text-2xl text-foreground mt-2">
                <Link to={`/channel/${topThree[0].streamerId}`} className="hover:text-primary transition-colors">{topThree[0].streamerUsername}</Link>
              </h3>
              <p className="text-base font-semibold text-yellow-600">{activeTabConfig.formatValue(topThree[0].value)} {activeTabConfig.valueLabel}</p>
              <div className="w-40 h-32 bg-gradient-to-b from-yellow-500/20 to-transparent mt-3 rounded-t-xl hidden md:block" />
            </div>

            {/* Rank 3 */}
            <div className="flex flex-col items-center order-3 md:order-3">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center text-3xl font-bold text-amber-700 border-4 border-amber-600 shadow-lg">
                  {topThree[2].streamerUsername[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
                  #3
                </div>
              </div>
              <h3 className="font-bold text-lg text-foreground mt-2">
                <Link to={`/channel/${topThree[2].streamerId}`} className="hover:text-primary transition-colors">{topThree[2].streamerUsername}</Link>
              </h3>
              <p className="text-sm text-muted-foreground">{activeTabConfig.formatValue(topThree[2].value)} {activeTabConfig.valueLabel}</p>
              <div className="w-32 h-16 bg-gradient-to-b from-amber-600/10 to-transparent mt-3 rounded-t-lg hidden md:block" />
            </div>
          </div>
        )}

        {/* Full list rank 4+ */}
        {!isLoading && !error && others.length > 0 && (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-[60px_1fr_160px] gap-4 p-4 bg-muted/50 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
              <div className="text-center">Hạng</div>
              <div>Streamer</div>
              <div className="text-right">{activeTabConfig.label}</div>
            </div>
            <div className="divide-y divide-border">
              {others.map((entry) => (
                <div key={entry.streamerId} className="grid grid-cols-[60px_1fr_160px] gap-4 p-4 items-center hover:bg-accent/30 transition-colors group">
                  <div className="text-center font-bold text-muted-foreground group-hover:text-foreground">
                    {entry.rank}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {entry.streamerUsername[0].toUpperCase()}
                    </div>
                    <Link to={`/channel/${entry.streamerId}`} className="font-semibold text-foreground group-hover:text-primary transition-colors hover:underline">
                      {entry.streamerUsername}
                    </Link>
                  </div>
                  <div className="text-right font-medium text-foreground">
                    {activeTabConfig.formatValue(entry.value)}
                    <span className="text-xs text-muted-foreground ml-1">{activeTabConfig.valueLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show top 3 in list format if fewer than 3 entries in podium section */}
        {!isLoading && !error && data.length > 0 && topThree.length < 3 && (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-[60px_1fr_160px] gap-4 p-4 bg-muted/50 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
              <div className="text-center">Hạng</div>
              <div>Streamer</div>
              <div className="text-right">{activeTabConfig.label}</div>
            </div>
            <div className="divide-y divide-border">
              {data.map((entry) => (
                <div key={entry.streamerId} className="grid grid-cols-[60px_1fr_160px] gap-4 p-4 items-center hover:bg-accent/30 transition-colors group">
                  <div className="text-center font-bold text-muted-foreground group-hover:text-foreground flex justify-center">
                    {entry.rank === 1 ? <Trophy className="w-5 h-5 text-yellow-500" /> : entry.rank}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {entry.streamerUsername[0].toUpperCase()}
                    </div>
                    <Link to={`/channel/${entry.streamerId}`} className="font-semibold text-foreground group-hover:text-primary transition-colors hover:underline">
                      {entry.streamerUsername}
                    </Link>
                  </div>
                  <div className="text-right font-medium text-foreground">
                    {activeTabConfig.formatValue(entry.value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
