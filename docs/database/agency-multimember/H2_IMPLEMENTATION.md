# H2 — Agency Multi-member Foundation

> Historical H2 report. For the current six-migration candidate, H2.7 fixes,
> isolated test results and DEFERRED history status, read
> [H27_HARDENING_RESULTS.md](H27_HARDENING_RESULTS.md). Shared deployment is not approved.

Ngày kiểm thử: 2026-11-12. Branch: `feature/agency-accounting`.

## Kết luận

Backend foundation đã triển khai và vượt qua kiểm thử cô lập. Sẵn sàng review
trên branch phát triển; **chưa đủ điều kiện merge như một release cutover hoặc
deploy lên Neon shared/production**. Cần tích hợp frontend, xử lý các boundary
nghiệp vụ còn legacy và phê duyệt migration reconciliation/cutover bên dưới.

Không sửa migration cũ, `.env`, dữ liệu Neon, ledger cũ hoặc orphan. Không có
payout thực. PostgreSQL test đã dừng; toàn bộ artifact và data directory được giữ.
Các thư mục `tripin-pr61-resolve/` của người dùng không bị chỉnh sửa.

## Database schema và migration mới

Source of truth cho H2 là `prisma/schema.prisma` và ba migration mới, không phải
các file candidate tham khảo trong migration-lab:

1. `20261112000000_agency_calendar_index`: bổ sung idempotent index
   TourDeparture(tourId,date) đã tồn tại trong snapshot nhưng thiếu trong local.
2. `20261112000100_agency_multimember_foundation`: transaction DDL; thêm
   AgencyProfile.id, backfill id=userId, NOT NULL, unique index tạm; giữ unique
   legacy userId; chuyển primary key sang id; default UUID cho doanh nghiệp mới;
   cho phép legacy userId nullable và dùng FK RESTRICT. Tạo enum/table/member
   PK/unique/index/FK; backfill OWNER; tạo invitation và ownership FK.
3. `20261112000200_agency_legacy_onboarding`: transaction DDL; BEFORE INSERT
   giữ id=userId cho luồng đăng ký legacy; AFTER INSERT tạo OWNER trong cùng
   transaction. Doanh nghiệp độc lập bỏ userId và có UUID riêng; provisioning
   doanh nghiệp độc lập phải tạo OWNER tường minh trong cùng transaction.

`AgencyMember`: UUID PK, agencyId→AgencyProfile.id, userId→User.id, role
OWNER/MANAGER/STAFF/ACCOUNTANT, status ACTIVE/SUSPENDED/REMOVED; unique
(agencyId,userId); index (userId,status,agencyId), (agencyId,status,role).

`AgencyInvitation`: UUID PK, agencyId→AgencyProfile.id, email chuẩn hóa, role
không OWNER, trạng thái PENDING/ACCEPTED/REVOKED/EXPIRED, tokenHash unique,
invitedByUserId/acceptedByUserId→User.id, các mốc thời gian; partial unique
(agencyId,email) khi PENDING; CHECK email/role/expiry/accepted fields.

Mười ownership FK dùng AgencyProfile.id: Tour, Booking, ETicket, Review, Report,
ComplaintTicket, ComplaintFeedback, Earning, GuidePayoutLedger,
PremiumContribution. Không thêm các identity/review-booking FK đang vướng orphan.
Không thêm composite constraint Booking.agencyId=Tour.agencyId vì tám mismatch
lịch sử chưa được phân xử. Các bản ghi đó giữ nguyên byte-equivalent row hashes.

Backfill 6 OWNER lấy AgencyProfile legacy join User có role AGENCY. Lab clone
xác nhận 6 ACTIVE OWNER và toàn bộ business rows không đổi ngoài cột id được
thêm. Không cần đổi UUID ở các bảng nghiệp vụ hiện tại.

## Authentication / AgencyContext / RBAC

User là danh tính cá nhân; AgencyProfile là doanh nghiệp. Invitation không đổi
User.role, password hoặc JWT subject. Traveler có thể đồng thời là Accountant,
Staff hoặc Owner của nhiều Agency. Global AGENCY không còn tự cấp tour/finance.

`/auth/agency/login`, agency Google và LOGIN_2FA kiểm tra ACTIVE membership thay
vì bắt buộc global AGENCY. REGISTER OTP vẫn giữ compatibility onboarding cũ.
Login/Google/OTP/refresh trả thêm danh sách `agencies`; JWT vẫn là danh tính User.
Refresh và mỗi request đọc quyền membership hiện tại, không đóng băng quyền trong
JWT. Ban/tokenVersion/staffStatus tiếp tục được kiểm tra từ DB.

API contract và permission matrix đầy đủ:
`backend/src/modules/agencies/README.md`.

Context server-side:

```ts
{ agencyId, actorUserId, memberId, memberRole, permissions }
```

Client gửi Bearer token và `X-Agency-Id: <AgencyProfile.id>`. Một membership ACTIVE
có thể auto-select; nhiều membership bắt buộc chọn. Header không hợp lệ: 400;
Agency lạ hoặc membership không ACTIVE: 403. Không dùng req.user.id làm tenant;
không nhận actor/permissions từ body/header. Finance summary query chỉ theo
AgencyContext.agencyId, chạy được với doanh nghiệp không có legacy User.

Team writes khóa row AgencyProfile rồi đọc lại actor membership; kiểm tra OWNER
cuối cùng trong cùng transaction. Invitation token ngẫu nhiên, hash trong DB,
gửi qua encrypted transactional outbox, email-bound, single-use, 24h expiry.
Acceptance kiểm tra lại người mời còn quyền; không dùng invitation để khôi phục
membership suspended/removed. Role/status change và invitation create/accept
ghi audit với actorUserId riêng, metadata chứa agencyId.

Đã đóng bypass qua public Tour detail suy ra quyền từ UUID legacy; quản trị draft
phải đi `/agency/tours/:id`. Shared complaint conversation không còn suy ra
Agency từ matching User ID; chỉ nhận agencyId do context server xác nhận. Hồ sơ
Agency legacy và onboarding token phải có ACTIVE OWNER để chỉnh sửa/truy cập.

## Test results

| Nhóm | Kết quả | Evidence local |
|---|---|---|
| Migration lab H2 | 53/53 PASS | `.test-artifacts/migration-lab-jx2QzA/report.json` |
| API / auth / RBAC smoke | 41/41 PASS | cùng thư mục, `h2-smoke.log` |
| Backend unit suite | 758/758 PASS, 57 files | `.test-artifacts/h2-unit.json` |
| TypeScript | PASS | `tsc --noEmit -p backend/tsconfig.json` |
| Whitespace/diff check | PASS | `git diff --check` |

Migration lab: fresh deploy toàn bộ history; clone deploy forward; baseline thử
trên DB rỗng rồi apply forward; Prisma validate/status và schema diff rỗng; FK,
unique, CHECK, valid/ready indexes; negative orphan/duplicate/business FK tests;
6 OWNER thật backfill; fingerprint toàn bộ historical business rows và ledger cũ
không đổi; rollback DDL của cả ba migration khôi phục catalog, data, ledger.

Smoke: sáu tài khoản legacy **mô phỏng**, biết mật khẩu, login thành công; Traveler
nhận Accountant không đổi role/password; invitation sai email/single-use/revoked/
expired; cùng Agency thấy cùng Tour; hai Agency không lẫn dữ liệu; cross-tenant
Tour ID bị từ chối; STAFF không Finance; ACCOUNTANT không quản trị Tour/team;
suspended/removed không dùng được token cũ; suspension không khóa Traveler cá
nhân; refresh/2FA giữ đúng membership; Google cá nhân và agency; doanh nghiệp
độc lập dùng Finance; malformed header/mass assignment; bảo vệ OWNER cuối cùng
và hai OWNER đồng thời tự demote chỉ một request thành công.

Không tuyên bố đã đăng nhập bằng mật khẩu của sáu User thật: không có credentials
để kiểm thử việc này. Google identity verifier và mail transport được mock trong
bộ smoke; chưa test OAuth/Brevo end-to-end. Không chạy integration harness cũ
vì có reset/cleanup DB; smoke dùng app thật/Prisma thật và fixture được giữ lại.

Hai lần lab đầu trong H2 phát hiện lỗi harness (copy candidate trùng thư mục
baseline) và fixture expiry vi phạm CHECK createdAt<expiresAt. Đã sửa harness/
fixture, không nới constraint hoặc sửa migration cũ. Run xác nhận cuối PASS.

## Migration status và baseline/reconciliation

Chỉ database test đã áp dụng ba migration H2. Neon shared vẫn nguyên trạng.
Prisma migrate status thành công trên DB test **không chứng minh đã giải quyết
checksum drift lịch sử**. Hai artifact thiếu và hai checksum khác vẫn là vấn đề
quản trị history đã ghi nhận ở báo cáo Migration Lab trước.

Baseline catalog đã tái tạo schema và apply H2 thành công trên DB test rỗng.
Baseline chưa được đưa vào production migration chain, chưa resolve hoặc sửa
ledger hiện hữu. Không được chạy baseline schema SQL lên DB shared đã có schema.

Đề xuất: giữ forward-only chain cho phát triển. Khi artifact gốc không khôi phục
được, duyệt một baseline có version/manifest, archive history + checksum/ledger
evidence cũ; rehearsal trên clone mới; xác nhận seed/reference data ngoài schema;
chọn thủ tục adopt baseline có chủ sở hữu/approval riêng. Mọi thay đổi ledger
chỉ là một cutover task được duyệt riêng, không phải hành động đã thực hiện H2.

## Những phần Kiều và Khoa tiếp tục tích hợp

Phân công sau là đề xuất để team chốt, không phải giả định ownership hiện có.

- Kiều / frontend: portal dựa trên ACTIVE memberships thay vì global role;
  selector Agency; gửi X-Agency-Id; xóa query cache theo tenant khi đổi Agency;
  permission-based navigation; invitation acceptance/login/OTP/Google/refresh;
  xử lý 403 khi bị đình chỉ và không dùng dữ liệu agency cache cũ.
- Khoa / backend nghiệp vụ: promotions, premium, complaints/disputes đang
  fail-closed cho member mới và doanh nghiệp độc lập; chỉ legacy OWNER có ACTIVE
  membership dùng được. Chuyển tenant filters, business actors và notification
  recipients trước khi bỏ requireLegacyOwnerIntegration.
- Notification/chat: hiện nhiều workflow còn coi agencyId là User recipient;
  doanh nghiệp độc lập có thể không nhận notification. Chọn recipients từ ACTIVE
  members có quyền phù hợp, không phát cho suspended members. Chat cá nhân chưa
  trở thành inbox dùng chung cho doanh nghiệp. Không certify các luồng này H2.
- Public Agency profile `/agencies/:id` và màn hình moderation Agency cũ còn
  dựa vào User/legacy profile. Doanh nghiệp độc lập chưa có đầy đủ public/profile
  administration lifecycle; chuyển sang AgencyProfile.id trong task tích hợp
  trước khi cho phép onboarding doanh nghiệp độc lập trên môi trường dùng chung.
- Finance tiếp theo: AgencyTransaction/AgencyPayout/AgencyPayoutItem dùng
  AgencyProfile.id; actorUserId/createdByUserId/approvedByUserId chỉ là danh tính
  thao tác và audit, không là chủ sở hữu sổ. H2 chỉ có Booking summary chưa đối
  soát, không transaction ledger, bank reconciliation, payout hoặc tiền thật.
- Chốt UX và API provisioning doanh nghiệp độc lập/ownership transfer; trigger
  chỉ đảm bảo onboarding legacy. Platform ban quản trị cấp User không phải team
  membership mutation; chính sách bàn giao OWNER khi ban doanh nghiệp cần chốt.

## Chuẩn bị cutover và rollback

1. Review permission matrix và các module đang fail-closed; tích hợp frontend.
   Không chạy backend mới với `.env` shared cũ để thử chức năng H2.
2. Chốt source-of-truth/history reconciliation/baseline với approval. Không sửa
   lại migration cũ cho khớp checksum và không tự resolve ledger.
3. Tạo clone mới gần thời điểm cutover, giới hạn truy cập dữ liệu nhạy cảm; kiểm
   tra lại 6 OWNER thực tế, orphan, tám mismatch, FK/index và snapshot fingerprints.
4. Rehearse deploy application + migration trên clone đó bằng direct test URL;
   test provider thật trong sandbox, frontend selector/cache và all tenant modules.
5. Chuẩn bị backup/restore point và tenant-aware rollback release. Dừng write
   liên quan team/agency trong cửa sổ cutover; xác nhận exact endpoint trước khi
   cấp quyền chạy migration. Chỉ operator đã được duyệt thực hiện shared deploy.
6. Apply migration theo thứ tự trên; verify owner count, legacy mapping, FK/index,
   ledger append-only, login/refresh và tenant boundaries rồi mới mở writes.

Rollback đã kiểm thử là transaction rollback **trước COMMIT**; chưa chứng nhận
down migration sau khi có thành viên/doanh nghiệp mới. Sau cutover ưu tiên sửa
forward hoặc quay lại tenant-aware release, giữ schema mở rộng và toàn bộ data.
Không drop member/invitation/id hoặc quay về application cũ sau khi có independent
Agency. Restore backup chỉ theo runbook được duyệt và có kế hoạch bảo toàn writes.

## Danh sách file thay đổi / bổ sung

Database:

- `prisma/schema.prisma`
- `prisma/migrations/20261112000000_agency_calendar_index/migration.sql`
- `prisma/migrations/20261112000100_agency_multimember_foundation/migration.sql`
- `prisma/migrations/20261112000200_agency_legacy_onboarding/migration.sql`

Foundation / middleware / wiring:

- `backend/src/modules/agencies/agency.policy.ts`
- `backend/src/modules/agencies/agency.service.ts`
- `backend/src/modules/agencies/agency.routes.ts`
- `backend/src/modules/agencies/README.md`
- `backend/src/middlewares/agency-context.ts`
- `backend/src/middlewares/authorize.ts`
- `backend/src/types/express.d.ts`
- `backend/src/app.ts`
- `backend/src/routes/index.ts`
- `backend/src/routes/registry.ts`
- `backend/src/routes/introspect.ts`
- `packages/constants/src/permissions.ts`

Authentication / tenant consumers:

- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.types.ts`
- `backend/src/modules/auth/auth.mapper.ts`
- `backend/src/modules/auth/agency-approval.service.ts`
- `backend/src/modules/audit/audit.types.ts`
- `backend/src/modules/users/users.repository.ts`
- `backend/src/modules/users/users.service.ts`
- `backend/src/modules/tours/tours.controller.ts`
- `backend/src/modules/tours/agency-calendar.routes.ts`
- `backend/src/modules/tours/tours-discovery.service.ts`
- `backend/src/modules/bookings/bookings.controller.ts`
- `backend/src/modules/dashboards/dashboards.controller.ts`
- `backend/src/modules/complaints/complaints.controller.ts`
- `backend/src/modules/complaints/complaints.service.ts`

Tests / lab / documentation:

- `backend/src/modules/auth/__tests__/auth.service.test.ts`
- `backend/src/modules/users/__tests__/users.service.test.ts`
- `backend/src/modules/tours/__tests__/tours-discovery.service.test.ts`
- `backend/src/modules/bookings/__tests__/bookings.export.test.ts`
- `backend/src/modules/dashboards/__tests__/dashboards.routes.test.ts`
- `backend/src/modules/complaints/__tests__/complaints.service.test.ts`
- `backend/src/routes/__tests__/routes.audit.test.ts`
- `backend/src/scripts/__tests__/prisma-enums-in-sync.test.ts`
- `backend/migration-lab/run.cjs`
- `backend/migration-lab/h2-smoke.mts`
- `backend/migration-lab/README.md`
- `docs/api/ENDPOINTS.md`
- `docs/backend/USE_CASE_MAP.md`
- `docs/database/agency-multimember/H2_IMPLEMENTATION.md`

Các artifact tham khảo từ vòng lab trước vẫn giữ trong workspace:
`backend/migration-lab/agency-foundation.sql`, `reconciliation.sql`,
`target-models.prisma`, `docs/database/agency-multimember/MIGRATION_LAB_RESULTS.md`.
Prisma Client đã generate local từ schema mới (generated output không commit).
