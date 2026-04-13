# 📡 API Documentation — Streaming Platform

> **Base URL**: `http://localhost:8080/api/v1`
> **Định dạng**: `application/json`
> **Auth**: `Authorization: Bearer <accessToken>`

---

## ⚙️ Biến môi trường (Postman)

| Variable | Value |
|----------|-------|
| `BASE_URL` | `http://localhost:8080/api/v1` |
| `TOKEN` | _(copy từ response login/register)_ |
| `ADMIN_TOKEN` | _(copy từ response login tài khoản ADMIN)_ |

---

## 🔑 Phân quyền

| Ký hiệu | Ý nghĩa |
|---------|---------|
| 🌐 PUBLIC | Không cần token |
| 🔑 JWT | Cần `Authorization: Bearer <token>` |
| 🛡️ ADMIN | Cần token với role ADMIN |
| 📡 WEBHOOK | Gọi nội bộ từ Nginx RTMP |

---

## 1. 🔐 Authentication — `/auth`

### 1.1 Đăng ký 🌐
```
POST /api/v1/auth/register
```
**Body:**
```json
{
  "username": "streamer01",
  "email": "streamer01@gmail.com",
  "password": "Password@123"
}
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"streamer01\",\"email\":\"streamer01@gmail.com\",\"password\":\"Password@123\"}"
```
**Response `201`:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "userId": 1,
    "username": "streamer01",
    "email": "streamer01@gmail.com",
    "role": "USER"
  }
}
```
> ⚠️ Copy `accessToken` → dùng cho tất cả request 🔑

| Lỗi | Nguyên nhân |
|-----|-------------|
| `400` | Email/username đã tồn tại hoặc thiếu field |

---

### 1.2 Đăng nhập 🌐
```
POST /api/v1/auth/login
```
**Body:**
```json
{
  "email": "streamer01@gmail.com",
  "password": "Password@123"
}
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"streamer01@gmail.com\",\"password\":\"Password@123\"}"
```
**Response `200`:** _(tương tự 1.1)_

| Lỗi | Nguyên nhân |
|-----|-------------|
| `401` | Sai email hoặc password |
| `401` | Tài khoản bị BANNED |
| `409` | Tài khoản đăng ký bằng Google, dùng endpoint `/auth/google` |

---

### 1.3 Đăng nhập Google 🌐
```
POST /api/v1/auth/google
```
**Body:**
```json
{
  "idToken": "<Google ID Token từ Google Sign-In>"
}
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"<google_id_token>\"}"
```
**Response `200`:** _(tương tự 1.1)_

| Lỗi | Nguyên nhân |
|-----|-------------|
| `400` | ID Token không hợp lệ / hết hạn |
| `409` | Email đã đăng ký bằng password |
| `409` | Google OAuth tạm thời không khả dụng |

---

## 2. 🏠 Room — `/rooms`

> **Flow**: Tạo phòng → Lấy `streamKey` → Cấu hình OBS (`rtmp://localhost:1935/live/<streamKey>`) → OBS push → Webhook `on-publish` tự kích hoạt LIVE

### 2.1 Danh sách phòng đang LIVE 🌐
```
GET /api/v1/rooms/live
GET /api/v1/rooms/live?categoryId=1&page=0&size=12
```
**curl:**
```bash
curl http://localhost:8080/api/v1/rooms/live
curl "http://localhost:8080/api/v1/rooms/live?categoryId=1&page=0&size=12"
```
**Response `200`:**
```json
{
  "content": [
    {
      "roomId": 1,
      "title": "Test Stream",
      "streamerUsername": "streamer01",
      "streamerId": 1,
      "streamerAvatarUrl": null,
      "categoryName": "Gaming",
      "hlsUrl": "http://localhost:8000/hls/sk_abc123.m3u8",
      "status": "LIVE"
    }
  ],
  "totalElements": 1,
  "totalPages": 1,
  "size": 12,
  "number": 0
}
```

---

### 2.2 Chi tiết một phòng 🌐
```
GET /api/v1/rooms/{roomId}
```
**curl:**
```bash
curl http://localhost:8080/api/v1/rooms/1
```

---

### 2.3 Tạo phòng live mới 🔑
```
POST /api/v1/rooms
Authorization: Bearer <token>
```
**Body:**
```json
{
  "title": "Stream tối nay — PUBG rank",
  "categoryId": 1
}
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/rooms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Stream toi nay\",\"categoryId\":1}"
```
**Response `201`:**
```json
{
  "roomId": 1,
  "title": "Stream tối nay — PUBG rank",
  "streamerName": "streamer01",
  "categoryName": "Gaming",
  "streamKey": "sk_a1b2c3d4e5f6",
  "status": "PENDING"
}
```
> 💡 Cấu hình OBS: Server = `rtmp://localhost:1935/live` | Stream Key = `sk_a1b2c3d4e5f6`

| Lỗi | Nguyên nhân |
|-----|-------------|
| `409` | Đã có phòng đang active (PENDING/LIVE) |

---

### 2.4 Cập nhật phòng của tôi 🔑
```
PUT /api/v1/rooms/me
Authorization: Bearer <token>
```
**Body:**
```json
{
  "title": "Đổi tên stream",
  "categoryId": 2
}
```
**curl:**
```bash
curl -X PUT http://localhost:8080/api/v1/rooms/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Doi ten stream\",\"categoryId\":2}"
```

---

### 2.5 Kết thúc stream 🔑
```
PATCH /api/v1/rooms/{roomId}/end
Authorization: Bearer <token>
```
**curl:**
```bash
curl -X PATCH http://localhost:8080/api/v1/rooms/1/end \
  -H "Authorization: Bearer <token>"
```
**Response `204`** _(no body)_

---

### 2.6 Tất cả phòng của tôi 🔑
```
GET /api/v1/rooms/me/all?page=0&size=10
Authorization: Bearer <token>
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/rooms/me/all" \
  -H "Authorization: Bearer <token>"
```

---

### 2.7 Lịch sử session của tôi 🔑
```
GET /api/v1/rooms/me/sessions?page=0&size=10
Authorization: Bearer <token>
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/rooms/me/sessions" \
  -H "Authorization: Bearer <token>"
```

---

### 2.8 Lịch sử session của phòng 🌐
```
GET /api/v1/rooms/{roomId}/sessions?page=0&size=10
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/rooms/1/sessions"
```
**Response `200`:**
```json
{
  "content": [
    {
      "id": 1,
      "roomId": 1,
      "title": "Stream tối nay",
      "startedAt": "2026-04-13T20:00:00",
      "endedAt": "2026-04-13T23:00:00",
      "durationMinutes": 180,
      "maxCcv": 500,
      "vodUrl": "https://pub-xxx.r2.dev/vod/live_sk_abc.../playlist.m3u8"
    }
  ]
}
```
> `vodUrl` có giá trị sau khi stream kết thúc và upload R2 hoàn tất (~30s async)

---

### 2.9 Ban phòng 🛡️
```
PATCH /api/v1/rooms/{roomId}/ban
Authorization: Bearer <admin-token>
```
**curl:**
```bash
curl -X PATCH http://localhost:8080/api/v1/rooms/1/ban \
  -H "Authorization: Bearer <admin-token>"
```
**Response `204`**

---

### 2.10 Unban phòng 🛡️
```
PATCH /api/v1/rooms/{roomId}/unban
Authorization: Bearer <admin-token>
```
**curl:**
```bash
curl -X PATCH http://localhost:8080/api/v1/rooms/1/unban \
  -H "Authorization: Bearer <admin-token>"
```
**Response `204`**

---

### 2.11 Webhook — OBS bắt đầu push stream 📡
```
POST /api/v1/rooms/on-publish
Content-Type: application/x-www-form-urlencoded
Body: name=<streamKey>
```
**curl (test thủ công, thay thế OBS):**
```bash
curl -X POST http://localhost:8080/api/v1/rooms/on-publish \
  -d "name=sk_a1b2c3d4e5f6"
```
| Response | Ý nghĩa |
|----------|---------|
| `200 OK` | streamKey hợp lệ → phòng chuyển sang **LIVE** |
| `403` | streamKey không tồn tại hoặc phòng bị BAN |

---

### 2.12 Webhook — OBS ngắt kết nối 📡
```
POST /api/v1/rooms/on-publish-done
Content-Type: application/x-www-form-urlencoded
Body: name=<streamKey>
```
**curl (test thủ công):**
```bash
curl -X POST http://localhost:8080/api/v1/rooms/on-publish-done \
  -d "name=sk_a1b2c3d4e5f6"
```
> ⚡ **Grace Period**: KHÔNG đóng session ngay! Phòng chuyển sang `RECONNECTING` và chờ **3 phút**.
> - Nếu OBS reconnect trong 3 phút → session tiếp tục, không tạo VOD mới
> - Nếu hết 3 phút → đóng session + upload VOD + chuyển `ENDED`
> - Viewer vẫn thấy phòng `LIVE` trong suốt grace period

---

### 2.13 Webhook — Nginx ghi xong recording 📡
```
POST /api/v1/rooms/on-record-done
Content-Type: application/x-www-form-urlencoded
Body: name=<streamKey>
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/rooms/on-record-done \
  -d "name=sk_a1b2c3d4e5f6"
```

---

## 3. 🗂️ Category — `/categories`

### 3.1 Danh sách tất cả danh mục 🌐
```
GET /api/v1/categories
```
**curl:**
```bash
curl http://localhost:8080/api/v1/categories
```
**Response `200`:**
```json
[
  { "id": 1, "name": "Gaming",        "iconUrl": null, "roomCount": 0 },
  { "id": 2, "name": "Just Chatting", "iconUrl": null, "roomCount": 0 },
  { "id": 3, "name": "Music",         "iconUrl": null, "roomCount": 0 }
]
```

---

### 3.2 Chi tiết danh mục 🌐
```
GET /api/v1/categories/{id}
```
**curl:**
```bash
curl http://localhost:8080/api/v1/categories/1
```

---

### 3.3 Tạo danh mục 🛡️
```
POST /api/v1/categories
Authorization: Bearer <admin-token>
```
**Body:**
```json
{ "name": "IRL", "iconUrl": "https://cdn.example.com/icons/irl.png" }
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/categories \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"IRL\",\"iconUrl\":\"https://cdn.example.com/icons/irl.png\"}"
```
**Response `201`:**
```json
{ "id": 4, "name": "IRL", "iconUrl": "https://cdn.example.com/icons/irl.png", "roomCount": 0 }
```

---

### 3.4 Cập nhật danh mục 🛡️
```
PUT /api/v1/categories/{id}
Authorization: Bearer <admin-token>
```
**curl:**
```bash
curl -X PUT http://localhost:8080/api/v1/categories/4 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"IRL & Outdoors\",\"iconUrl\":\"https://cdn.example.com/icons/irl-v2.png\"}"
```

---

### 3.5 Xóa danh mục 🛡️
```
DELETE /api/v1/categories/{id}
Authorization: Bearer <admin-token>
```
**curl:**
```bash
curl -X DELETE http://localhost:8080/api/v1/categories/4 \
  -H "Authorization: Bearer <admin-token>"
```
| Lỗi | Nguyên nhân |
|-----|-------------|
| `409` | Còn phòng đang dùng danh mục này |

---

## 4. 👥 Follow — `/users`

### 4.1 Follow streamer 🔑
```
POST /api/v1/users/{streamerId}/follow
Authorization: Bearer <token>
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/users/2/follow \
  -H "Authorization: Bearer <token>"
```
**Response `201`** | Lỗi `409` nếu đã follow rồi

---

### 4.2 Unfollow streamer 🔑
```
DELETE /api/v1/users/{streamerId}/follow
Authorization: Bearer <token>
```
**curl:**
```bash
curl -X DELETE http://localhost:8080/api/v1/users/2/follow \
  -H "Authorization: Bearer <token>"
```
**Response `204`**

---

### 4.3 Kiểm tra trạng thái follow 🔑
```
GET /api/v1/users/{streamerId}/follow-status
Authorization: Bearer <token>
```
**curl:**
```bash
curl http://localhost:8080/api/v1/users/2/follow-status \
  -H "Authorization: Bearer <token>"
```
**Response `200`:**
```json
{ "following": true }
```

---

### 4.4 Số lượng follower 🌐
```
GET /api/v1/users/{userId}/follower-count
```
**curl:**
```bash
curl http://localhost:8080/api/v1/users/2/follower-count
```
**Response `200`:**
```json
{ "userId": 2, "followerCount": 42 }
```

---

### 4.5 Danh sách followers 🌐
```
GET /api/v1/users/{userId}/followers?page=0&size=20
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/users/2/followers"
```

---

### 4.6 Danh sách đang following 🌐
```
GET /api/v1/users/{userId}/following?page=0&size=20
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/users/1/following"
```

---

## 5. 💬 Chat — WebSocket + REST

### 5.1 Kết nối WebSocket (STOMP) 🔑
```
WS endpoint : ws://localhost:8080/api/v1/ws   (SockJS fallback)
Subscribe   : /topic/room/{roomId}
Publish to  : /app/chat.sendMessage
```
**Payload gửi:**
```json
{ "roomId": 1, "senderName": "viewer123", "content": "GG wp!" }
```
**Message broadcast nhận về:**
```json
{ "roomId": 1, "senderName": "viewer123", "content": "GG wp!", "timestamp": "2026-04-13T20:15:30" }
```
> ❌ User bị ban chat trong phòng → server reject, tin nhắn không gửi được

---

### 5.2 Lịch sử chat (50 tin gần nhất) 🌐
```
GET /api/v1/rooms/{roomId}/chats
```
**curl:**
```bash
curl http://localhost:8080/api/v1/rooms/1/chats
```

---

## 6. 🔨 Chat Ban — `/rooms/{roomId}/bans`

### 6.1 Ban / Timeout user 🔑
```
POST /api/v1/rooms/{roomId}/bans
Authorization: Bearer <streamer-token>
```
**Body:**
```json
{
  "userId": 5,
  "durationMinutes": 30,
  "reason": "Spam"
}
```
> `durationMinutes: null` = ban vĩnh viễn

**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/rooms/1/bans \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":5,\"durationMinutes\":30,\"reason\":\"Spam\"}"
```
**Response `201`:**
```json
{
  "id": 1, "roomId": 1, "userId": 5, "username": "spammer",
  "durationMinutes": 30, "reason": "Spam",
  "bannedAt": "2026-04-13T20:30:00", "expiresAt": "2026-04-13T21:00:00"
}
```

---

### 6.2 Unban user 🔑
```
DELETE /api/v1/rooms/{roomId}/bans/{userId}
Authorization: Bearer <streamer-token>
```
**curl:**
```bash
curl -X DELETE http://localhost:8080/api/v1/rooms/1/bans/5 \
  -H "Authorization: Bearer <token>"
```

---

### 6.3 Danh sách ban vĩnh viễn 🔑
```
GET /api/v1/rooms/{roomId}/bans
Authorization: Bearer <streamer-token>
```
**curl:**
```bash
curl http://localhost:8080/api/v1/rooms/1/bans \
  -H "Authorization: Bearer <token>"
```

---

## 7. 💰 Donation — `/donations`

### 7.1 Donate cho streamer 🔑
```
POST /api/v1/donations
Authorization: Bearer <token>
```
**Body:**
```json
{
  "streamerId": 2,
  "amount": 50000,
  "message": "Ủng hộ streamer!"
}
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/donations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{\"streamerId\":2,\"amount\":50000,\"message\":\"Ung ho streamer!\"}"
```
**Response `201`:**
```json
{
  "id": 1, "donorUsername": "viewer01", "streamerUsername": "streamer01",
  "amount": 50000, "message": "Ủng hộ streamer!",
  "donatedAt": "2026-04-13T21:00:00"
}
```
| Lỗi | Nguyên nhân |
|-----|-------------|
| `400` | Streamer không đang LIVE |

---

### 7.2 Donation tôi đã gửi 🔑
```
GET /api/v1/donations/sent?page=0&size=20
Authorization: Bearer <token>
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/donations/sent" \
  -H "Authorization: Bearer <token>"
```

---

### 7.3 Donation tôi đã nhận 🔑
```
GET /api/v1/donations/received?page=0&size=20
Authorization: Bearer <token>
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/donations/received" \
  -H "Authorization: Bearer <token>"
```

---

### 7.4 Donation public của streamer 🌐
```
GET /api/v1/donations/streamer/{streamerId}?page=0&size=20
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/donations/streamer/2"
```

---

## 8. 🔔 Notification — `/notifications`

### 8.1 Danh sách thông báo 🔑
```
GET /api/v1/notifications?page=0&size=20
Authorization: Bearer <token>
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/notifications" \
  -H "Authorization: Bearer <token>"
```
**Response `200`:**
```json
{
  "content": [
    { "id": 1, "type": "NEW_FOLLOWER",      "message": "viewer01 đã follow bạn",          "isRead": false, "createdAt": "2026-04-13T20:00:00" },
    { "id": 2, "type": "DONATION_RECEIVED", "message": "viewer01 đã donate 50,000đ cho bạn!", "isRead": false, "createdAt": "2026-04-13T21:00:00" }
  ],
  "totalElements": 2,
  "totalPages": 1
}
```

---

### 8.2 Số thông báo chưa đọc 🔑
```
GET /api/v1/notifications/unread-count
Authorization: Bearer <token>
```
**curl:**
```bash
curl http://localhost:8080/api/v1/notifications/unread-count \
  -H "Authorization: Bearer <token>"
```
**Response `200`:**
```json
{ "unreadCount": 2 }
```

---

### 8.3 Đánh dấu 1 thông báo đã đọc 🔑
```
PUT /api/v1/notifications/{notificationId}/read
Authorization: Bearer <token>
```
**curl:**
```bash
curl -X PUT http://localhost:8080/api/v1/notifications/1/read \
  -H "Authorization: Bearer <token>"
```

---

### 8.4 Đánh dấu tất cả đã đọc 🔑
```
PUT /api/v1/notifications/read-all
Authorization: Bearer <token>
```
**curl:**
```bash
curl -X PUT http://localhost:8080/api/v1/notifications/read-all \
  -H "Authorization: Bearer <token>"
```
**Response `204`**

---

## 9. 🚨 Report — `/reports`

### 9.1 Nộp report 🔑
```
POST /api/v1/reports
Authorization: Bearer <token>
```
**Body:**
```json
{
  "reportedUserId": 2,
  "roomId": 1,
  "reason": "Nội dung bạo lực"
}
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/reports \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{\"reportedUserId\":2,\"roomId\":1,\"reason\":\"Noi dung bao luc\"}"
```
**Response `201`:**
```json
{
  "id": 1, "reporterUsername": "viewer01", "reportedUsername": "streamer01",
  "roomId": 1, "reason": "Nội dung bạo lực",
  "status": "PENDING", "createdAt": "2026-04-13T20:45:00", "resolvedAt": null, "adminNote": null
}
```

---

### 9.2 Report của tôi 🔑
```
GET /api/v1/reports/me?page=0&size=20
Authorization: Bearer <token>
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/reports/me" \
  -H "Authorization: Bearer <token>"
```

---

### 9.3 Tất cả report 🛡️
```
GET /api/v1/reports?status=PENDING&page=0&size=20
Authorization: Bearer <admin-token>
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/reports?status=PENDING" \
  -H "Authorization: Bearer <admin-token>"
```
> `status`: `PENDING` | `RESOLVED` | `DISMISSED` (để trống = lấy tất cả)

---

### 9.4 Xét duyệt report 🛡️
```
PUT /api/v1/reports/{reportId}/resolve
Authorization: Bearer <admin-token>
```
**Body:**
```json
{
  "action": "BAN_STREAMER",
  "adminNote": "Vi phạm nghiêm trọng"
}
```
**curl:**
```bash
curl -X PUT http://localhost:8080/api/v1/reports/1/resolve \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"BAN_STREAMER\",\"adminNote\":\"Vi pham nghiem trong\"}"
```
> `action = BAN_STREAMER` → **Domino Effect**: ban user + blacklist JWT + dừng stream nếu đang LIVE
> `action = WARN` → chỉ đánh dấu đã xử lý

---

### 9.5 Bác bỏ report 🛡️
```
PUT /api/v1/reports/{reportId}/dismiss
Authorization: Bearer <admin-token>
```
**curl:**
```bash
curl -X PUT http://localhost:8080/api/v1/reports/1/dismiss \
  -H "Authorization: Bearer <admin-token>"
```

---

## 10. 👤 Admin — `/admin/users`

### 10.1 Ban user 🛡️
```
POST /api/v1/admin/users/{userId}/ban
Authorization: Bearer <admin-token>
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/admin/users/2/ban \
  -H "Authorization: Bearer <admin-token>"
```
**Response `204`**
> Domino Effect: `status = BANNED` + blacklist JWT (đăng xuất ngay) + dừng LIVE nếu đang stream + broadcast `STREAM_TERMINATED`

---

### 10.2 Unban user 🛡️
```
POST /api/v1/admin/users/{userId}/unban
Authorization: Bearer <admin-token>
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/admin/users/2/unban \
  -H "Authorization: Bearer <admin-token>"
```
**Response `204`**
> `status = ACTIVE` + xóa blacklist + phòng → `PENDING`

---

## 11. 📊 Statistics — `/statistics`

### 11.1 Creator Studio Dashboard 🔑
```
GET /api/v1/statistics/me
Authorization: Bearer <token>
```
**curl:**
```bash
curl http://localhost:8080/api/v1/statistics/me \
  -H "Authorization: Bearer <token>"
```
**Response `200`:**
```json
{
  "totalFollowers": 42,
  "totalDonationsReceived": 500000,
  "totalStreams": 5,
  "totalWatchMinutes": 12000,
  "allTimePeakCcv": 300,
  "chart30Days": [
    { "date": "2026-04-13", "viewers": 120, "donations": 50000 }
  ],
  "recentSessions": []
}
```

---

### 11.2 Lịch sử sessions kèm số liệu 🔑
```
GET /api/v1/statistics/me/sessions?page=0&size=10
Authorization: Bearer <token>
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/statistics/me/sessions" \
  -H "Authorization: Bearer <token>"
```
**Response `200`:**
```json
{
  "content": [
    {
      "sessionId": 1, "title": "Stream tối nay",
      "startedAt": "2026-04-13T20:00:00", "endedAt": "2026-04-13T23:00:00",
      "durationMinutes": 180, "peakCcv": 300,
      "totalWatchMinutes": 5000, "totalDonations": 150000
    }
  ]
}
```

---

### 11.3 Leaderboard — Top Peak CCV 🌐
```
GET /api/v1/statistics/leaderboard/top-ccv?from=2026-04-01&to=2026-04-13&size=10
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/statistics/leaderboard/top-ccv?from=2026-04-01&to=2026-04-13&size=10"
```
**Response `200`:**
```json
{
  "content": [
    { "rank": 1, "streamerId": 1, "streamerUsername": "streamer01", "value": 500 },
    { "rank": 2, "streamerId": 2, "streamerUsername": "streamer02", "value": 300 }
  ]
}
```

---

### 11.4 Leaderboard — Top Donations 🌐
```
GET /api/v1/statistics/leaderboard/top-donations?from=2026-04-01&to=2026-04-13&size=10
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/statistics/leaderboard/top-donations?from=2026-04-01&to=2026-04-13&size=10"
```

---

### 11.5 Leaderboard — Top Watch Time 🌐
```
GET /api/v1/statistics/leaderboard/top-watchtime?from=2026-04-01&to=2026-04-13&size=10
```
**curl:**
```bash
curl "http://localhost:8080/api/v1/statistics/leaderboard/top-watchtime?from=2026-04-01&to=2026-04-13&size=10"
```

---

## 12. 🕐 View History — `/view-history`

### 12.1 Heartbeat xem stream 🌐
```
POST /api/v1/view-history/heartbeat/{roomId}
Authorization: Bearer <token>   (không bắt buộc)
```
**curl:**
```bash
curl -X POST http://localhost:8080/api/v1/view-history/heartbeat/1 \
  -H "Authorization: Bearer <token>"
```
**Response `200`** _(no body)_
> 💡 Frontend gọi mỗi **60 giây** khi đang xem stream (setInterval 60000ms). Dừng khi user tạm dừng hoặc rời tab.

---

## 🧪 Kịch bản test end-to-end

### Flow 1: Đăng ký → Tạo phòng → Fake LIVE → Kết thúc

```
# B1: Đăng ký tài khoản streamer
POST /api/v1/auth/register
{"username":"streamer01","email":"streamer01@gmail.com","password":"Password@123"}
→ Lưu accessToken

# B2: Tạo danh mục (cần token ADMIN, hoặc seed sẵn trong DB)
POST /api/v1/categories
{"name":"Gaming","iconUrl":null}

# B3: Tạo phòng
POST /api/v1/rooms   [Bearer streamer token]
{"title":"Test Stream","categoryId":1}
→ Lưu streamKey (vd: sk_abc123)

# B4: Fake OBS kết nối (giả lập webhook Nginx)
POST /api/v1/rooms/on-publish
name=sk_abc123
→ Phòng chuyển sang LIVE

# B5: Verify phòng đang LIVE
GET /api/v1/rooms/live

# B6: Fake OBS ngắt kết nối
POST /api/v1/rooms/on-publish-done
name=sk_abc123
→ Phòng chuyển sang ENDED, VOD upload async
```

---

### Flow 2: Viewer Follow + Donate + Notification

```
# B1: Đăng ký viewer
POST /api/v1/auth/register
{"username":"viewer01","email":"viewer01@gmail.com","password":"Password@123"}
→ Lưu viewer_token

# B2: Follow streamer (userId=1)
POST /api/v1/users/1/follow   [Bearer viewer_token]

# B3: Kiểm tra follow
GET /api/v1/users/1/follow-status   [Bearer viewer_token]
→ {"following": true}

# B4: Streamer đang LIVE → Viewer donate
POST /api/v1/donations   [Bearer viewer_token]
{"streamerId":1,"amount":50000,"message":"Ung ho!"}

# B5: Streamer check notification
GET /api/v1/notifications   [Bearer streamer_token]
→ Thấy DONATION_RECEIVED + NEW_FOLLOWER
```

---

### Flow 3: Admin Ban + Report

```
# B1: Viewer gửi report
POST /api/v1/reports   [Bearer viewer_token]
{"reportedUserId":1,"roomId":1,"reason":"Vi pham"}

# B2: Admin xem report
GET /api/v1/reports?status=PENDING   [Bearer admin_token]

# B3: Admin ban streamer (Domino Effect)
PUT /api/v1/reports/1/resolve   [Bearer admin_token]
{"action":"BAN_STREAMER","adminNote":"Xu ly vi pham"}
→ User bị ban + JWT blacklist + stream dừng

# B4: Admin unban
POST /api/v1/admin/users/1/unban   [Bearer admin_token]
```

---

## 🗑️ Reset database để test lại từ đầu

```bash
# Chạy lệnh này khi muốn xóa sạch data test (giữ nguyên users & categories)
docker exec streaming-mysql mysql -u root -proot livestream_db -e "
  SET FOREIGN_KEY_CHECKS=0;
  TRUNCATE TABLE view_history;
  TRUNCATE TABLE chat_messages;
  TRUNCATE TABLE donations;
  TRUNCATE TABLE daily_statistics;
  TRUNCATE TABLE reports;
  TRUNCATE TABLE room_bans;
  TRUNCATE TABLE stream_sessions;
  TRUNCATE TABLE rooms;
  SET FOREIGN_KEY_CHECKS=1;
"

# Xóa toàn bộ kể cả users (fresh start)
docker exec streaming-mysql mysql -u root -proot livestream_db -e "
  SET FOREIGN_KEY_CHECKS=0;
  TRUNCATE TABLE view_history;
  TRUNCATE TABLE chat_messages;
  TRUNCATE TABLE donations;
  TRUNCATE TABLE daily_statistics;
  TRUNCATE TABLE reports;
  TRUNCATE TABLE room_bans;
  TRUNCATE TABLE stream_sessions;
  TRUNCATE TABLE rooms;
  TRUNCATE TABLE notifications;
  TRUNCATE TABLE follows;
  TRUNCATE TABLE user_sessions;
  TRUNCATE TABLE wallets;
  TRUNCATE TABLE users;
  SET FOREIGN_KEY_CHECKS=1;
"
```

---

## 📝 Cấu trúc lỗi chuẩn

```json
{
  "timestamp": "2026-04-13T20:00:00",
  "status": 400,
  "message": "Email đã được sử dụng: streamer01@gmail.com"
}
```

---

## 📦 Enum Values

### Room Status
| Status | Mô tả |
|--------|-------|
| `PENDING` | Tạo xong, chờ OBS kết nối |
| `LIVE` | Đang phát sóng |
| `RECONNECTING` | OBS ngắt tạm, đang chờ reconnect (grace period 3 phút). Viewer thấy = LIVE |
| `ENDED` | Đã kết thúc |
| `BANNED` | Bị Admin cấm |

### VOD Status
| Status | Mô tả |
|--------|-------|
| `PENDING` | Chưa upload |
| `UPLOADING` | Đang upload lên R2 |
| `DONE` | Upload xong, `vodUrl` có giá trị |
| `FAILED` | Upload thất bại |

### Notification Type
| Type | Trigger |
|------|---------|
| `NEW_FOLLOWER` | Có người follow |
| `DONATION_RECEIVED` | Nhận donation |
| `STREAM_LIVE` | Streamer được follow bắt đầu live |
| `STREAM_TERMINATED` | Stream bị dừng do vi phạm |
| `REPORT_RESOLVED` | Report đã được xử lý |

### User Role
| Role | Mô tả |
|------|-------|
| `USER` | Người dùng thường |
| `ADMIN` | Quản trị viên |

### Auth Provider
| Provider | Mô tả |
|----------|-------|
| `LOCAL` | Đăng ký bằng email + password |
| `GOOGLE` | Đăng ký qua Google OAuth2 |
