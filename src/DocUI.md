# KẾ HOẠCH CHO AI AGENT: PHÁT TRIỂN UI/UX KIẾN TRÚC FSD + AD

## 1. KHÁI NIỆM CỐT LÕI
### 1.1. Feature-Sliced Design (FSD)
Một phương pháp kiến trúc tổ chức code theo domain nghiệp vụ (feature). Mỗi 'slice' là một module độc lập.
* **Điểm mạnh:** Đóng gói logic & khả năng mở rộng.
* **Hạn chế:** Đường cong học tập ban đầu dốc hơn.

### 1.2. Atomic Design (AD)
Một phương pháp tổ chức theo hệ thống phân cấp trực quan (Atoms -> Molecules -> Organisms...).
* **Điểm mạnh:** Nhất quán & tái sử dụng UI.
* **Hạn chế:** Không có hướng dẫn cho logic nghiệp vụ.

## 2. NHỮNG ĐIỀU NÊN LÀM
Khi thiết kế và viết code, Agent bắt buộc phải tuân thủ:
1. Giữ các component atomic dùng chung 'thuần túy' (không có business logic).
2. Đặt component dành riêng cho feature vào trong slice của feature đó.
3. Sử dụng tầng `entities` cho UI của domain (VD: UserAvatar).
4. Bắt đầu nhỏ và phát triển kiến trúc khi cần thiết.
5. Ghi lại tài liệu về design system và các quyết định component.

## 3. NHỮNG ĐIỀU CẦN TRÁNH
Tuyệt đối tránh các lỗi sau trong quá trình triển khai:
1. Đừng 'over-engineer' ngay từ đầu.
2. Đừng để thư mục `shared/` trở thành bãi rác.
3. Đừng tạo hệ thống phân cấp cứng nhắc; hãy linh hoạt.
4. Không tạo sự phụ thuộc giữa các feature khác nhau.
5. Đừng bỏ qua việc cập nhật hệ thống khi sản phẩm phát triển.


## 1. MỤC ĐÍCH
Tài liệu này định nghĩa các nguyên tắc kiến trúc Frontend chuẩn mực mà AI Agent phải tuân thủ tuyệt đối khi phân tích, thiết kế và sinh code (generate code). 
Kiến trúc được sử dụng là sự kết hợp (Hybrid) giữa **Feature-Sliced Design (FSD)** để quản lý quy mô nghiệp vụ và **Atomic Design (AD)** để xây dựng hệ thống UI nhất quán.

## 2. KHÁI NIỆM CỐT LÕI (CORE CONCEPTS)

### 2.1. Feature-Sliced Design (FSD)
Là phương pháp tổ chức thư mục và kiến trúc code chia theo **domain nghiệp vụ (features)** thay vì chia theo loại file (components, hooks, utils...).
* **Điểm mạnh:** Đóng gói logic (encapsulation), khả năng mở rộng cực tốt khi dự án lớn lên, dễ dàng gỡ bỏ hoặc thêm tính năng mà không ảnh hưởng hệ thống.
* **Nguyên tắc phụ thuộc một chiều (One-way dependency):** Các tầng (layers) bên trên chỉ được phép import từ các tầng bên dưới. **Tầng bên dưới KHÔNG BAO GIỜ được biết về sự tồn tại của tầng bên trên.**
* *Thứ tự các tầng (Từ trên xuống dưới):* `app` -> `pages` -> `widgets` -> `features` -> `entities` -> `shared`.

### 2.2. Atomic Design (AD)
Là phương pháp tư duy thiết kế hệ thống giao diện (UI) phân cấp từ nhỏ đến lớn.
* **Atoms:** Các thành phần UI cơ bản nhất, không thể chia nhỏ (Button, Input, Icon, Text).
* **Molecules:** Sự kết hợp của nhiều Atoms để tạo thành một khối UI đơn giản (SearchBar = Input + Button).
* **Organisms:** Khối UI phức tạp, có ý nghĩa độc lập, kết hợp từ Atoms và Molecules (Header, Sidebar, UserProfileCard).

### 2.3. Sự Kết Hợp (The Hybrid Approach)
Để tối ưu hóa, hệ thống sẽ ánh xạ AD vào bên trong các tầng của FSD như sau:
* **Atoms & Molecules (AD)** -> Sẽ được đặt tại tầng `shared/ui` của FSD. Đây là các "Dumb Components" hoàn toàn thuần túy, KHÔNG chứa business logic, KHÔNG gọi API.
* **Organisms (AD)** -> Sẽ tương đương với tầng `widgets` của FSD. Đây là nơi ghép nối các UI components, các `features` và `entities` lại với nhau để tạo thành một khối chức năng hoàn chỉnh (Ví dụ: `ChatBoard` trong một hệ thống Livestream).

---

## 3. CẤU TRÚC THƯ MỤC CHUẨN (STANDARD DIRECTORY STRUCTURE)
AI phải đặt file đúng vị trí theo cấu trúc sau:

```text
src/
├── app/          # Thiết lập global (Routing, Global Store, Global Styles, Providers)
├── pages/        # Nơi lắp ráp các Widgets thành một trang hoàn chỉnh (VD: LiveStreamPage)
├── widgets/      # Khối UI lớn, ghép từ nhiều feature/entity (VD: ChatWidget, VideoPlayerWidget)
├── features/     # Logic tương tác của người dùng (VD: SendMessage, DonateCoin, FilterProducts)
├── entities/     # Thực thể nghiệp vụ và UI gắn liền với nó (VD: User, Product, Message)
└── shared/       # Code dùng chung toàn cục
    ├── ui/       # (Atoms/Molecules) Design System cơ bản (Button, Input, Modal)
    ├── api/      # Cấu hình base API (Axios instance...)
    └── lib/      # Các hàm utils, helpers