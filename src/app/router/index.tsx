import { createBrowserRouter } from "react-router-dom";
import { HomePage } from "@/pages/home/HomePage";
import { StreamPage } from "@/pages/stream/StreamPage";
import { VodPage } from "@/pages/vod/VodPage";
import { BrowsePage } from "@/pages/browse/BrowsePage";
import { ChannelPage } from "@/pages/channel/ChannelPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { LeaderboardPage } from "@/pages/leaderboard/LeaderboardPage";
import { AdminPage } from "@/pages/admin/AdminPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { Layout } from "@/widgets/layout";
import { ProtectedRoute } from "@/features/auth";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: "stream/:streamId", Component: StreamPage },
      { path: "vod/:sessionId", Component: VodPage },
      { path: "browse/:category?", Component: BrowsePage },
      { path: "channel/:streamer", Component: ChannelPage },
      { path: "leaderboard", Component: LeaderboardPage },
      
      // Protected routes for creators
      {
        element: <ProtectedRoute />,
        children: [
          { path: "dashboard", Component: DashboardPage },
          { path: "livestream/new", Component: DashboardPage }, // Cả 2 đều dẫn đến trang cấu hình stream
          { path: "settings", Component: SettingsPage },
        ],
      },
      {
        element: <ProtectedRoute requiredRole="ADMIN" />,
        children: [{ path: "admin", Component: AdminPage }],
      },
    ],
  },
]);
