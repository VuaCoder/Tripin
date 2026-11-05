# TÀI LIỆU TOÀN DIỆN VỀ LUỒNG DANH SÁCH YÊU THÍCH (WISHLIST FLOW)
> **Hệ thống:** TripRi Travel Platform  
> **Phạm vi:** Mobile App (Flutter / BLoC Cubit) $\longleftrightarrow$ Backend (Express / TypeScript / Prisma) $\longleftrightarrow$ CSDL (PostgreSQL)

---

## 🧭 1. TỔNG QUAN VỀ TÍNH NĂNG WISHLIST

Tính năng Wishlist (Danh sách yêu thích) trong hệ sinh thái TripRi cho phép người dùng:
1. **Lưu lại các tour du lịch yêu thích** chỉ với 1 chạm vào biểu tượng trái tim.
2. **Phân loại tour theo Bộ sưu tập (Collections)** tùy chỉnh (ví dụ: *"Tour Đà Nẵng"*, *"Du lịch hè 2026"*, *"Đi cùng gia đình"*...).
3. **Cơ chế lưu trữ hỗn hợp (Hybrid Sync)**: Lưu đồng bộ lên máy chủ (Cloud Backend) đồng thời lưu trữ nhanh ở cục bộ thiết bị (`SharedPreferences`) theo từng tài khoản (`userId`).
4. **Theo dõi lịch sử "Đã xem gần đây" (Recently Viewed)** cùng cơ chế **Audit Log vĩnh viễn** để bảo tồn dữ liệu hiển thị ảnh bìa collage.
5. **Đảm bảo bảo mật & toàn vẹn**: Phân quyền nghiêm ngặt theo JWT Token, chỉ cho phép lưu các tour hợp lệ (`APPROVED`), và xử lý graceful degradation khi tour bị gỡ khỏi hệ thống (`available: false`).

---

## 🗺️ 2. SƠ ĐỒ KIẾN TRÚC TOÀN HỆ THỐNG (FULL-STACK ARCHITECTURE)

```
┌────────────────────────────────────────────────────────────────────────┐
│                              FLUTTER MOBILE                            │
│                                                                        │
│  [UI Layer]                                                            │
│   • TourCard / TourDetailScreen (Nút Tim)                              │
│   • WishlistScreen / WishlistCollectionDetailScreen                    │
│   • Bottom Sheets: CreateWishlistSheet, SaveToWishlistSheet            │
│   • Banners: SavedToWishlistBanner, LoginRequiredDialog                │
│                                    ▲                                   │
│                                    │ emit(WishlistState)               │
│                                    ▼                                   │
│  [State Management - Cubit]                                            │
│   • WishlistCubit: handleHeartTap(), loadWishlist(), createCollection()│
│   • WishlistState: isFavorite(), collections, recentlyViewed, auditLog │
│                  ▲                                  ▲                  │
│                  │                                  │                  │
│  [Local Storage] │                                  │ [Network]        │
│   • WishlistStorage (SharedPreferences)             │  • WishlistRepo  │
│     - collections_uid_{userId}                      │    (ApiClient)   │
│     - recently_viewed_uid_{userId}                  │                  │
│     - audit_log_uid_{userId}                        │                  │
└──────────────────┼──────────────────────────────────┼──────────────────┘
                   │                                  │
                   │ (Lưu offline cục bộ)             │ REST API (Bearer JWT)
                   │                                  │
┌──────────────────┼──────────────────────────────────┼──────────────────┐
│                  │               BACKEND            ▼                  │
│                  │   [Routes]                                          │
│                  │    • POST   /api/v1/wishlist/:tourId                │
│                  │    • DELETE /api/v1/wishlist/:tourId                │
│                  │    • GET    /api/v1/wishlist?page=1&limit=50        │
│                  │                                                     │
│                  │   [Controller] wishlists.controller.ts              │
│                  │    • Trích xuất userId = req.user.id (Bảo mật)      │
│                  │                                                     │
│                  │   [Service] wishlists.service.ts                    │
│                  │    • Kiểm tra tour APPROVED (toursService)          │
│                  │    • Giới hạn MAX 200 items (WISHLIST_FULL)         │
│                  │    • Idempotent upsert & join thông tin thẻ tour    │
│                  │                                                     │
│                  │   [Repository] wishlists.repository.ts              │
│                  │    • Prisma Client thao tác CSDL                    │
└──────────────────┼──────────────────────────────────┼──────────────────┘
                   │                                  │
                   ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        POSTGRESQL DATABASE                             │
│   Bảng: "WishlistItem"                                                 │
│   • userId (FK -> User)                                                │
│   • tourId (FK -> Tour)                                                │
│   • createdAt (DateTime)                                               │
│   • Ràng buộc: UNIQUE(userId, tourId) | INDEX(userId, createdAt DESC)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 3. CHI TIẾT CÁC LUỒNG HOẠT ĐỘNG (DETAILED FLOWS)

### 📌 Luồng 1: Người dùng chạm vào Trái tim trên Tour Card (`handleHeartTap`)

Đây là hành động trung tâm nhất của tính năng yêu thích.

```
                  [Người dùng bấm Tim]
                           │
                           ▼
               [Kiểm tra đăng nhập?]
              /                     \
       (Chưa đăng nhập)          (Đã đăng nhập)
            /                         \
[Hiện LoginRequiredDialog]       [Tour này ĐÃ LƯU chưa?]
                                 /                     \
                          (Đã lưu - Tim đỏ)      (Chưa lưu - Tim trắng)
                                /                         \
     1. Xóa khỏi Collection                     [Đã có Collection nào chưa?]
     2. Cập nhật state (Optimistic)            /                            \
     3. Lưu vào SharedPreferences        (Chưa có)                        (Đã có)
     4. Gọi DELETE /api/v1/wishlist/:id      /                                \
     5. Hiện Banner "Đã xóa khỏi..."  [Mở CreateSheet]              [Mở SaveToWishlistSheet]
                                             │                                │
                                      Tạo bộ sưu tập mới            Chọn bộ sưu tập muốn lưu
                                             │                                │
                                             └────────────────┬───────────────┘
                                                              ▼
                                                1. Thêm tour vào Collection
                                                2. Cập nhật state (savedTourIds)
                                                3. Lưu vào SharedPreferences
                                                4. Gọi POST /api/v1/wishlist/:tourId
                                                5. Hiện Banner "Saved to [Tên]"
```

#### Code xử lý tại `WishlistCubit` (`mobile/lib/features/wishlist/bloc/wishlist_cubit.dart`):
```dart
Future<void> handleHeartTap({
  required BuildContext context,
  required TourModel tour,
}) async {
  // Bước 1: Kiểm tra quyền đăng nhập
  final isAuth = await _repository.isAuthenticated();
  if (!isAuth) {
    if (context.mounted) await LoginRequiredDialog.show(context);
    return;
  }

  final isCurrentlySaved = state.isFavorite(tour.id);

  // TRƯỜNG HỢP A: Bỏ thích (Unfavorite)
  if (isCurrentlySaved) {
    final containingCols = state.collections.where((c) => c.containsTour(tour.id)).toList();
    final collectionName = containingCols.isNotEmpty ? containingCols.first.name : 'Danh sách yêu thích';

    // Xóa tour khỏi các collection cục bộ
    final updatedCollections = state.collections.map((c) {
      if (c.containsTour(tour.id)) {
        return c.copyWith(
          tours: c.tours.where((t) => t.id != tour.id).toList(),
          updatedAt: DateTime.now(),
        );
      }
      return c;
    }).toList();

    emit(state.copyWith(
      collections: updatedCollections,
      savedTourIds: _extractSavedTourIds(updatedCollections),
    ));

    final userId = await _getUserId();
    await _storage.saveCollections(updatedCollections, userId: userId);
    _repository.removeFromWishlist(tour.id).catchError((_) {}); // Gọi Backend ngầm

    if (context.mounted) {
      SavedToWishlistBanner.show(
        context,
        collectionName: collectionName,
        customMessage: 'Xoá khỏi $collectionName',
        tour: tour,
        onChangeTap: null,
      );
    }
    return;
  }

  // TRƯỜNG HỢP B: Lưu yêu thích (Favorite)
  if (state.collections.isEmpty) {
    // Chưa có collection nào -> Mở sheet tạo mới
    final name = await CreateWishlistSheet.show(context);
    if (name != null && name.trim().isNotEmpty && context.mounted) {
      await createCollection(name.trim(), initialTour: tour);
      _showSavedBanner(context, name.trim(), tour);
    }
  } else {
    // Đã có collection -> Mở sheet chọn danh sách muốn lưu
    final chosenCollections = await SaveToWishlistSheet.show(
      context,
      tour: tour,
      collections: state.collections,
    );
    if (chosenCollections != null && context.mounted) {
      await updateTourCollections(tour: tour, targetCollectionIds: chosenCollections);
      // ... Hiện popup thông báo đã lưu
    }
  }
}
```

---

### 📌 Luồng 2: Tải và đồng bộ Wishlist (`loadWishlist`)

Khi người dùng mở ứng dụng hoặc vào màn hình Wishlist, quá trình đồng bộ diễn ra để đảm bảo dữ liệu luôn mới nhất nhưng vẫn hiển thị tức thì (không để màn hình trắng chờ mạng):

1. **Đọc dữ liệu cục bộ trước (Local First)**:
   - Đọc danh sách collections từ `WishlistStorage.loadCollections(userId)`.
   - Đọc danh sách đã xem từ `WishlistStorage.loadRecentlyViewed(userId)`.
   - Cập nhật state hiển thị ngay lập tức.
2. **Nếu đã đăng nhập (Authenticated)**:
   - Gửi yêu cầu `GET /api/v1/wishlist` lên server.
   - Nhận về danh sách `items: List<WishlistItemModel>`.
   - **Cơ chế Re-sync**: Nếu tài khoản đăng nhập trên máy mới (chưa có collection cục bộ) nhưng trên server đã có sẵn các tour yêu thích $\rightarrow$ hệ thống tự tạo một collection mặc định mang tên **"Đã lưu"** và gom tất cả các tour từ backend vào đó.

---

### 📌 Luồng 3: Ghi nhận lịch sử xem tour & Audit Log vĩnh viễn (`recordRecentlyViewed`)

Khi người dùng nhấn vào xem chi tiết một tour bất kỳ (`TourDetailScreen`):
1. Màn hình gọi `context.read<WishlistCubit>().recordRecentlyViewed(tour)`.
2. Hàm sẽ:
   - Đưa tour lên đầu danh sách `recentlyViewed`.
   - Đồng thời ghi vào `auditLog` (bảo tồn vĩnh viễn).
   - Giới hạn danh sách xem gần nhất là 40 tour.
3. **Cơ chế Audit Log**: Kể cả khi người dùng bấm nút *"Xóa tất cả lịch sử"* trên giao diện, hàm `effectiveRecentlyViewed` trong `WishlistState` sẽ tự động lấy dữ liệu từ `auditLog` để màn hình luôn có ảnh đẹp mắt làm hình nền/collage mà không bao giờ bị vỡ bố cục.

---

## 🛡️ 4. XỬ LÝ PHÍA BACKEND & CÁC NGUYÊN TẮC BẢO MẬT

Backend của Wishlist được đặt tại [`backend/src/modules/wishlists`](file:///d:/fifa/chuyen-nganh-8/WDP302/travel-platform/backend/src/modules/wishlists).

### 1. API Endpoints
| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/wishlist` | `wishlist:manage` (Traveler) | Lấy danh sách tour đã lưu phân trang (`page`, `limit`). Kèm đầy đủ thông tin card tour (giá, ảnh, rating). |
| `POST` | `/api/v1/wishlist/:tourId` | `wishlist:manage` (Traveler) | Thêm tour vào wishlist. Trả về `201` nếu mới thêm, `200` nếu đã có từ trước (Idempotent). |
| `DELETE` | `/api/v1/wishlist/:tourId` | `wishlist:manage` (Traveler) | Xóa tour khỏi wishlist. Luôn trả về `204 No Content` bất kể tour có tồn tại hay không. |

### 2. Các quy tắc nghiệp vụ cốt lõi (Business Rules)
1. **Tuyệt đối ẩn danh định danh người dùng (Zero-trust ownership)**:
   - Không bao giờ nhận `userId` từ URL params hay Request body.
   - `userId` luôn được lấy trực tiếp từ JWT payload đã xác thực (`req.user.id`). Người dùng A không bao giờ có thể đọc hoặc sửa wishlist của người dùng B.
2. **Chỉ cho phép thêm tour đã duyệt (`APPROVED`)**:
   - Khi gọi `POST /wishlist/:tourId`, service gọi `toursService.getTourFacts(tourId)`.
   - Nếu tour không tồn tại hoặc chưa được kiểm duyệt (`DRAFT`, `PENDING_REVIEW`, `SUSPENDED`), server trả về lỗi `404 Not Found`.
3. **Giới hạn số lượng (Hard Limit)**:
   - Mỗi người dùng chỉ được lưu tối đa 200 tour (`WISHLIST_LIMITS.MAX_ITEMS = 200`).
   - Nếu vượt quá, server trả về mã lỗi `409 Conflict` với mã lỗi `WISHLIST_FULL`.
4. **An toàn trước Double-click (Idempotency)**:
   - Người dùng bấm 2 lần liên tục nút lưu: Nhờ câu lệnh `createMany({ data: [...], skipDuplicates: true })` trong Prisma và chỉ mục duy nhất `(userId, tourId)`, không bao giờ bị lỗi trùng lặp dữ liệu hay lỗi SQL 500.
5. **Xử lý Graceful khi Tour bị tạm khóa hoặc gỡ bỏ**:
   - Nếu một tour khách đã lưu sau này bị gỡ xuống, khi gọi `GET /wishlist`, tour đó vẫn xuất hiện trong danh sách nhưng có cờ `available: false` (không đính kèm card tour).
   - Điều này giúp khách hàng biết tour đã hết hạn/tạm ngưng và vẫn có thể bấm nút Xóa tour đó ra khỏi danh sách của mình.

#### Trích đoạn mã nguồn Service (`backend/src/modules/wishlists/wishlists.service.ts`):
```typescript
async add(userId: string, tourId: string): Promise<{ created: boolean }> {
  // 1. Kiểm tra tour có hợp lệ và công khai không
  const tour = await this.tours.getTourFacts(tourId);
  if (!tour || tour.status !== TOUR_STATUS.APPROVED) {
    throw AppError.notFound('Tour not found');
  }

  // 2. Kiểm tra giới hạn 200 tour
  if (!(await this.items.exists(userId, tourId)) && 
      (await this.items.count(userId)) >= WISHLIST_LIMITS.MAX_ITEMS) {
    throw AppError.conflict(
      `Your wishlist is full (${WISHLIST_LIMITS.MAX_ITEMS} tours)`, 
      'WISHLIST_FULL'
    );
  }

  // 3. Lưu idempotent
  return { created: await this.items.addIfAbsent(userId, tourId) };
}
```

---

## 📊 5. BẢNG TỔNG KẾT VAI TRÒ CÁC TẬP TIN

| Tệp tin | Vị trí | Trách nhiệm chính |
| :--- | :--- | :--- |
| `wishlist_cubit.dart` | `mobile/.../bloc` | Điều phối toàn bộ trạng thái, gọi Repository, quản lý Collection và xử lý sự kiện bấm tim. |
| `wishlist_state.dart` | `mobile/.../bloc` | Chứa dữ liệu: `savedTourIds`, `collections`, `recentlyViewed`, `auditLog`, hàm `isFavorite()`. |
| `wishlist_repository.dart` | `mobile/.../bloc` | Gọi các API RESTful tới backend thông qua `ApiClient`. |
| `wishlist_storage.dart` | `mobile/.../storage` | Lưu trữ dữ liệu JSON vào `SharedPreferences` phân vùng theo `userId`. |
| `wishlists.routes.ts` | `backend/.../wishlists` | Định nghĩa 3 router chính, gắn middleware xác thực JWT. |
| `wishlists.controller.ts` | `backend/.../wishlists` | Nhận request HTTP, lấy `userId`, gọi service và trả response. |
| `wishlists.service.ts` | `backend/.../wishlists` | Kiểm tra trạng thái tour, chặn quá 200 tour, map dữ liệu public card. |
| `wishlists.repository.ts` | `backend/.../wishlists` | Ghi trực tiếp xuống bảng PostgreSQL qua Prisma Client (`skipDuplicates: true`). |

