# BoatPreloader và audit hiệu năng điều hướng (2026-10-17)

## Phạm vi, nguyên nhân theo mức ảnh hưởng

1. **Next dev cold compile/render:** các route `/settings/history`, `/settings/profile`, `/settings/profile/security` là shell/client page; source không gọi backend khi dựng RSC. TTFB HTTP lần đầu trong dev cao hơn rõ so với warm, còn cùng route ở production thấp hơn nhiều. Đây là nguyên nhân có bằng chứng cho phần lớn độ trễ RSC khi phát triển, không phải kết luận về tốc độ điều hướng/hydration trong browser.
2. **Public tours API dao động:** `/api/v1/tours?page=1&limit=12` dùng `searchPublic`: `findMany` và `count` song song, sau đó `getSummaries` agency theo batch. Đo có spike 0,93 và 1,51 giây, nhưng chưa có trace SQL/DB/connection nên chưa thể quy kết hoặc sửa query an toàn. Không thấy N+1 trong đường dẫn danh sách này.
3. **Client fetch trên trang Traveler:** history gọi bookings và reviews; profile/security gọi query tương ứng sau mount. RSC nhanh không đồng nghĩa dữ liệu client sẵn sàng. Reviews 100 bản ghi được tải để xác định booking nào đã đánh giá; thay đổi logic này cần kiểm chứng chức năng với hơn 100 reviews nên chưa thực hiện.
4. **Login/destinations:** login cần tài khoản thử nghiệm và phân tách server/DB trace; không gửi request đăng nhập giả hoặc thay đổi auth. Destinations lấy các tour approved rồi nhóm theo destination trong ứng dụng; một loạt HTTP hiện tại nhanh nhưng chưa đủ chứng minh ổn định lúc lạnh. Không thêm cache dữ liệu nhạy cảm hay realtime.

## Chính sách Boat hiện tại

- Click link nội bộ và Back/Forward của Guest/Traveler **không trì hoãn** việc gửi request. Chỉ bật Boat sau 180 ms nếu route chưa commit; điều hướng nhanh không thấy overlay. Không tự bật trên Agency, link ngoài, tab mới, download hay cùng route/query-only.
- Khi URL mới commit, tự động thoát ngay, không giữ minimum 380 ms. Fade-out GSAP còn tối đa 300 ms nhưng overlay không chặn tương tác trong lúc thoát. URL commit không đồng nghĩa client API đã xong; skeleton/error của từng trang vẫn chịu trách nhiệm tiếp tục hiển thị trạng thái đó.
- Luồng bật Boat tường minh vẫn có minimum 380 ms. Timeout 4,5 giây giải phóng overlay khi điều hướng bị hủy/lỗi. Giữ reduced-motion, tween cleanup, và bảo vệ callback của transition cũ khi người dùng điều hướng nhanh.

## Số đo HTTP tại localhost

Phép đo bằng `curl.exe`, cổng 3000 = Next dev, cổng 3002 = `next start` từ `.next-verify`, cổng 3001 = backend dev. Mỗi route HTML: lần gọi đầu và hai lần tiếp theo, TTFB gần bằng total. Cùng máy, không có network throttling hoặc browser hydration. Các mẫu chỉ là snapshot, không phải benchmark đủ độ tin cậy hay bằng chứng tăng tốc sau sửa Boat (Boat chỉ chạy client).

| Route | Next dev lần đầu | Next dev warm | Production lần đầu | Production warm |
| --- | ---: | ---: | ---: | ---: |
| `/` | 730 ms | 54–63 ms | 239 ms | 8–9 ms |
| `/home` | 850 ms | 70–78 ms | 27 ms | 9–11 ms |
| `/settings/history` | 1.239 s | 67–71 ms | 30 ms | 8–10 ms |
| `/settings/profile` | 709 ms | 80–87 ms | 17 ms | 6–7 ms |
| `/settings/profile/security` | 697 ms | 84–92 ms | 17 ms | 5–6 ms |

RSC với header `RSC: 1`, warm, `_rsc=probe` (không có router-state browser): dev history 47–63 ms, profile 35–72 ms, security 40–81 ms; production tương ứng 4–5, 4–5, 4–5 ms. Các con số RSC này không thay thế navigation timing thật của Next App Router.

Backend HTTP `tours?page=1&limit=12`: 10 lần liên tiếp **1507, 250, 263, 269, 262, 932, 273, 260, 283, 260 ms**. `tours/destinations`: 10 lần **65–69 ms** trong loạt đo này; lần kiểm tra trước khoảng 63–66 ms. Không có phép đo login vì thiếu tài khoản thử nghiệm an toàn. Không có số đo trước/sau cùng điều kiện cho tour API, và không chỉnh backend trong đợt này.

## Kiểm chứng và giới hạn

- Frontend TypeScript (`npx tsc --noEmit`), 205 unit tests, production build `TRIPRI_VERIFY_BUILD=1` đều qua. Test Boat bao phủ route nhanh/chậm, Back/Forward, query-only, timeout, Agency, reduced-motion và luồng tường minh.
- Backend unit 501/501 qua và `npm run build` qua. Backend `npm run typecheck` còn lỗi ở `cloudinary/index.ts`, `auth/agency-approval.controller.ts`, `auth/agency-approval.service.ts` và hai dòng `bookings.service.test.ts`; các file này không được sửa trong đợt này, và các lỗi đã tồn tại từ lần kiểm tra trước.
- HTTP smoke test đã gọi Landing, Home, Login, Tours, Traveler, Agency và các trang settings. Không kiểm tra được thao tác login, quyền Traveler/Agency, hydration, Network panel, click-to-content hoặc mạng 3G thật: công cụ browser trong môi trường bị lỗi cấu hình Codex ngoài workspace. Fake timer mô phỏng route chậm, không phải đo 3G.
- Không thay đổi auth, API contract, logic nghiệp vụ, Create Tour, Phase 3 hoặc cache tenant-sensitive. Phase 1/2A/2B được giữ nguyên. Không tạo commit.

## UAT và bước chẩn đoán tiếp theo

Kiểm thử trình duyệt ở Normal/Slow 3G: Landing → Home → Tours/Login; Login ↔ Register; Traveler history/profile/security; Back/Forward; mạng lỗi/hủy điều hướng; Agency sidebar và đăng xuất. Ghi riêng `RSC`, API, hydration, click-to-content và overlay duration. Nếu tours API vẫn spike, đo server span theo `findMany`, `count`, `getSummaries`, pool wait và SQL `EXPLAIN (ANALYZE, BUFFERS)` trên môi trường phù hợp trước khi sửa backend. Nếu login ~943 ms lặp lại, profile auth handler/DB và network trước; không bỏ refresh 401 của Guest chỉ để giảm một request.
