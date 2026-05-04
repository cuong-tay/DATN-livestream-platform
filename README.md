# 📺 Hệ Thống Livestream Platform (Đồ Án Tốt Nghiệp)

Đây là dự án nền tảng phát video trực tiếp (Livestreaming Platform) được thiết kế theo kiến trúc **Feature-Sliced Design (FSD)** kết hợp cùng hệ sinh thái công nghệ mới nhất. Nền tảng được xây dựng với mục tiêu mang lại trải nghiệm xem stream mượt mà, thân thiện, và đầy đủ tính năng tương tác mạng xã hội cho người dùng.

## 🚀 Các Tính Năng Nổi Bật (Features)

Hệ thống được chia thành 4 giai đoạn phát triển chính (Phases), bao phủ đầy đủ luồng nghiệp vụ của một nền tảng chuyên nghiệp:

### 🌟 Phase 1 & 2: Cốt lõi & Trải nghiệm xem
- **Home & Browse:** Khám phá Streamer theo các danh mục Game/Music/Tech với giao diện trực quan.
- **HLS Video Player:** Tích hợp trình phát video mượt mà, độ trễ thấp thông qua chuẩn HLS stream (kết nối trực tiếp từ Nginx RTMP).
- **Phòng Chat Real-time:** Tương tác thời gian thực thông qua WebSockets/STOMP.
- **Hệ thống theo dõi (Follow):** Subscriber flow & hiển thị theo dõi (Follow/Unfollow).
- **Profile & Channel:** Xem trang cá nhân hiển thị luồng trực tiếp hoặc lịch sử VOD (Video On Demand) khi stream kết thúc.

### 🎥 Phase 3: Creator Studio (Dành cho Streamer)
- **Bảng điểu khiển (Dashboard):** Giao diện Dark-mode dành riêng cho Streamer quản lý thông số (Youtube-Studio style).
- **Quản lý Livestream:** Tạo mới, kết thúc luồng thủ công (Force End) & Cập nhật tiêu đề/danh mục trực tiếp.
- **Lịch sử VODs:** Quản lý tự động các video stream ngoại tuyến đã được máy chủ thu hình và đăng tải (CloudFlare R2 / S3).

### 🔥 Phase 4: Tính Năng Nâng Cao (Advanced)
- **Donate System (Ủng hộ):** Tích hợp Modal ủng hộ Streamer cực kỳ bắt mắt.
- **Chuông Thông Báo (Notification Bell):** Hệ thống thông báo đẩy (Polling/WS) về các sự kiện có người theo dõi mới hoặc thông báo chung.
- **Trang Bảng Xếp Hạng (Leaderboard):** Vinh danh các Streamer có lượt theo dõi cao nhất với giao diện Bục Vô Địch 3D-styled chuyên nghiệp.
- **Report & Moderation:** 
  - Người xem có quyền Report vi phạm trên stream.
  - Streamer có quyền Cấm chat (Ban User) thông qua Dropdown UI ở phòng Chat.
- **Admin Control Panel:** Trang quản trị phân quyền (Role Guard JWT) quản trị người dùng, khóa mõm, và giám sát băng thông luồng live.

## 🛠 Công Nghệ Sử Dụng (Tech Stack)

### 🎨 Frontend
- **Framework:** React 18 (Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Radix UI (Headless Component) + Shadcn UI
- **Architecture:** Feature-Sliced Design (FSD)
- **Routing:** React Router v6
- **Real-time:** SockJS + STOMP (WebSocket)
- **Player:** HLS.js
- **API Fetching:** Axios (kèm Interceptors xử lý JWT Bearer token tự động)

### ⚙️ Backend (Tương Thích)
- Java Spring Boot (REST API + WebSocket)
- Nginx Web Server (RTMP Module) giúp ingest luồng từ OBS.
- CloudFlare R2 / AWS S3 (Lưu trữ VOD)

## 📦 Hướng Dẫn Chạy Cục Bộ (Local Deployment)

Đảm bảo bạn đã cài đặt [Node.js](https://nodejs.org/en) (phiên bản 18+).

```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi động môi trường phát triển Vite (Mặc định ở http://localhost:5173)
npm run dev

# 3. Build chạy cho Môi trường Sản xuất (Production)
npm run build
```

**Lưu ý khi chạy cùng Backend:** File cấu hình `vite.config.ts` đã được tích hợp sẵn hệ thống Proxy tự động (`dns.setDefaultResultOrder('ipv4first')` và `localhost:8080`) để giải quyết vấn đề CORS, đụng độ IPv6 kết nối tới máy chủ Spring Boot. Bạn chỉ cần chạy Backend cổng 8080 là Frontend sẽ tự hiểu.

Frontend hiện gọi backend trực tiếp, không dùng Vite proxy. Mặc định app sẽ gọi REST tới `http://localhost:8080/api/v1` và WebSocket tới `ws://localhost:8080/api/v1/ws`.

Nếu backend chạy cổng hoặc domain khác, cấu hình biến môi trường theo [.env.example](c:/Users/ASUS/DATN-livestream-platform/.env.example):

```bash
VITE_API_BASE_URL=http://localhost:8080/api/v1
# hoặc origin thuần, app sẽ tự thêm /api/v1
# VITE_API_BASE_URL=http://localhost:8080

# không bắt buộc nếu WS cùng host với REST
VITE_WS_URL=ws://localhost:8080/api/v1/ws
```

Vì frontend và backend giờ là cross-origin trong local dev, backend cần bật CORS cho `http://localhost:5173`.

## 🌐 Deploy Lên Vercel

Dự án này đã được tinh chỉnh cấu hình sẵn để vượt rào lỗi khi lên Vercel. Chú ý các điều sau để Github tự Push lên Vercel chạy ngon lành:

1. Đã có file `vercel.json` phục vụ Rewrite URL cho React Router.
2. Tại màn hình Dashboard cài đặt môi trường của Vercel (Environment Variables), bắt buộc phải khởi tạo tham số:
   - Tên biến: `VITE_API_BASE_URL`
   - Giá trị: `https://[dia-chi-backend-cua-ban]/api/v1`

---
*Phát triển bởi Cuong-Tay | Đồ Án Tốt Nghiệp 2026*
