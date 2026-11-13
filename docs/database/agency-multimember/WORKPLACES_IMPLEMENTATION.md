# Workplace onboarding — implementation checkpoint

Ngày: 2026-11-13. Phạm vi: MVP trong worktree, chưa rollout shared/production.

## Hành vi đã triển khai

- Một account giữ danh tính cá nhân, có thể STAFF tại A và OWNER tại B. Đăng ký mới vẫn dùng global role TRAVELER tương thích; membership mới quyết định quyền agency.
- Đăng ký → OTP → `/workplaces`. Trang này liệt kê doanh nghiệp, role, trạng thái và yêu cầu tham gia. Có `/workplaces/new` và `/workplaces/join`; chưa có membership vẫn dùng được.
- Tạo agency có idempotency UUID, tạo `AgencyProfile.userId=null`, role mặc định và OWNER nguyên tử. Retry không tạo thêm doanh nghiệp; replay sau khi mất ownership bị từ chối.
- OWNER hoàn thiện/lưu/gửi lại hồ sơ tại `/agency/application/workplace`; settings/profile chuyển đến đây. Chưa VERIFIED vẫn sửa hồ sơ/quản lý team được; API vận hành tiếp tục yêu cầu VERIFIED.
- Moderation xét đúng AgencyProfile.id, kiểm tra quyền moderator trong transaction; public profile và số lượng hồ sơ chờ duyệt không còn lệ thuộc userId legacy.
- OWNER tạo mã crypto 12 ký tự, hiệu lực 15 phút. Database chỉ giữ SHA-256, trả plaintext khi tạo. Rotate/revoke vô hiệu mã cũ; các request đã gửi không bị hủy theo expiry mã. Frontend không hiển thị plaintext cũ khi metadata cho thấy mã đã được thay.
- Nhập mã chỉ tạo PENDING request. OWNER chọn role cùng agency, không phải OWNER và không vượt quyền được phép cấp, rồi xác nhận duyệt/từ chối. Người gửi xem/hủy request; có phân trang.
- Kiểm tra tài khoản ACTIVE/email verified, membership live, quyền live và tenant trong giao dịch. SUSPENDED không gia nhập lại để né đình chỉ. REMOVED được nhận lại bằng lời mời/yêu cầu mới, dùng lại membership ID và role mới, xóa quyền/scope cũ; lời mời/yêu cầu trước lần gỡ bị vô hiệu hóa. Agency row lock tuần tự hóa duyệt, sửa membership và email acceptance.
- Giữ email invitation cho email chưa có account: đăng ký/OTP rồi accept. Nếu email acceptance chạy sau code approval thì giữ role đang có; hủy pending request trùng khi accept email.
- Audit không chứa mã/token; notification tới OWNER đang hoạt động và người gửi đúng phạm vi. Có rate limit IP/account cho create/join/code generation.
- Login/OTP/Google chung nhận legacy owner; API auth agency cũ còn nguyên để chuyển tiếp. Alias frontend agency login/register chuyển về cổng account chung, giữ safe next.
- Workplace chọn landing theo capability thực tế của membership, không mặc định đưa STAFF vào dashboard không có quyền. Tái sử dụng tenant header, permissionVersion và cơ chế cache isolation hiện có.

## Các file chính

| Phần | Vị trí |
| --- | --- |
| API onboarding | `backend/src/modules/agencies/workplaces.routes.ts`, `workplaces.service.ts` |
| Hồ sơ độc lập/moderation | `backend/src/modules/agencies/agency-profile.repository.ts`, `modules/moderation/moderation.service.ts` |
| UI chọn/tạo/join | `frontend/features/agency/WorkplacesPage.tsx` |
| UI hồ sơ/team | `WorkplaceApplicationPage.tsx`, `AgencyJoinPanel.tsx` trong cùng thư mục |
| API frontend | `frontend/features/agency/workplacesApi.ts` |
| Schema/migration | `prisma/schema.prisma`, `prisma/migrations/20261113000200_agency_workplaces/migration.sql` |

API chi tiết được regenerate trong `docs/api/ENDPOINTS.md`; use-case mapping cập nhật tại `docs/backend/USE_CASE_MAP.md`.

## Kiểm chứng

- Backend unit: 777/777 qua, 60 files.
- Backend integration local: workplace 16 tests; audit workflow 1; moderation 4 đều qua. Các suite auth basic, auth flows và flexible permissions cũng đã qua khi chạy nhóm regression.
- Migration rehearsal: fresh migration history dùng bởi integration; upgrade trên fixture pre-workplace, đối chiếu fingerprints/OWNER/indexes và rollback DDL trong transaction đã qua. Đây không phải clone hoặc kiểm chứng target shared.
- Backend TypeScript và Prisma schema validation đã qua; Prisma Client đã regenerate; production bundle `tsup` qua.
- Frontend full suite: 739/740 qua; một test tour editor cũ timeout 5 giây khi chạy toàn bộ. Chạy lại nhóm auth/workplace/team/layout/tour-editor với timeout 15 giây: 38/38 qua. Sau khi thêm regression mã bị rotate ở session khác, suite workplace 6/6 qua. Không tuyên bố full suite xanh chỉ từ lần chạy riêng.
- Frontend TypeScript và production build Next.js (`TRIPRI_VERIFY_BUILD=1`, tách output khỏi dev) qua. Đã thêm Suspense cho entry đăng ký guide dùng chung continuation để prerender hoạt động.
- Browser QA chưa thực hiện được: browser runtime không khởi tạo do global `C:/Users/khoal/.codex/config.toml` có `agents` sai kiểu. Không sửa cấu hình ngoài repo và không coi component tests là browser evidence.

Không có shared migration/deploy nào được thực hiện.

## Phần còn lại / điều kiện release

1. Apply migration flexible permissions `20261113000100` trước `20261113000200_agency_workplaces`, sau khi preflight history/drift trên đúng target. Không dùng `migrate reset` trên shared. Generate client và deploy backend/client tương ứng cùng phiên bản.
2. Hồ sơ mới hỗ trợ liên kết giấy phép; chưa chuyển pipeline upload giấy phép trực tiếp cũ sang tenant mới.
3. Promotions, premium, complaints và review disputes vẫn có legacy integration gate. Không quảng bá là agency độc lập dùng được toàn bộ chức năng; các mục legacy tương ứng được ẩn khi không phù hợp và backend vẫn fail-closed.
4. Kiểm kê mobile/consumer cũ trước khi ngừng API agency auth; đợt này không xóa global AGENCY hoặc API cũ.
5. Sửa cấu hình browser qua một tác vụ được cho phép riêng rồi QA với backend thật/DB cô lập: desktop/mobile, keyboard, refresh/back, nhiều tab, invitation/OTP/Google/2FA, pending/approved/rejected và thay đổi quyền giữa chừng.
6. Rehearse clone/branch target, kiểm tra checkpoint/recovery, giám sát conflicts/rate limits và email delivery trước mở rộng rollout. Mã ngắn hạn chỉ hiển thị khi tạo, mất mã thì tạo lại; không có API đọc lại plaintext.

Không sửa `.env`, không thay đổi database shared, không commit/push. Các thay đổi flexible permissions có sẵn của người dùng được giữ lại.
