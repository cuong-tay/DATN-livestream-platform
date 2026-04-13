import { useAuth } from "@/app/providers/AuthContext";
import { Navigate } from "react-router-dom";
import { ShieldAlert, Users, Video, Flag } from "lucide-react";

export function AdminPage() {
  const { user, isAuthenticated } = useAuth();

  // Role Guard
  if (!isAuthenticated || user?.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4 border-b border-border pb-6">
          <div className="w-16 h-16 bg-red-500/10 flex items-center justify-center rounded-xl">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Control Panel</h1>
            <p className="text-muted-foreground">Quản lý hệ thống nền tảng, người dùng và nội dung.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-4 mb-4">
              <Users className="w-8 h-8 text-blue-500" />
              <h3 className="text-xl font-semibold">User Management</h3>
            </div>
            <p className="text-muted-foreground text-sm">Khóa tài khoản, quản lý role và danh sách thành viên nền tảng.</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-4 mb-4">
               <Video className="w-8 h-8 text-green-500" />
              <h3 className="text-xl font-semibold">Live Monitoring</h3>
            </div>
            <p className="text-muted-foreground text-sm">Giám sát các luồng trực tiếp đang diễn ra, can thiệp khẩn cấp (Bandwidth, Stream Cut).</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-4 mb-4">
               <Flag className="w-8 h-8 text-orange-500" />
              <h3 className="text-xl font-semibold">Review Reports</h3>
            </div>
            <p className="text-muted-foreground text-sm">Xử lý báo cáo vi phạm nội dung từ cộng đồng. (Spam, Bạo lực, Hình ảnh đồi trụy)</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
             <h3 className="text-xl font-bold mb-4">Hoạt động gần đây</h3>
             <div className="text-center text-muted-foreground py-12 border-2 border-dashed border-border rounded-lg">
                <p>Khu vực này sẽ hiển thị logs phân tích của API System.</p>
             </div>
        </div>
      </div>
    </div>
  );
}
