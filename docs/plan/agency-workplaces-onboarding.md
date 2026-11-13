# Account chung và nơi làm việc Agency

Ngày lập: 2026-11-13. Trạng thái: đã triển khai MVP trong worktree; chưa deploy database shared/production.

## Bản cập nhật luồng auth và thiết kế UI

### Điều hướng thống nhất — 2026-11-14

Đăng nhập hoặc đăng ký/xác minh email thành công mặc định vào `/workplaces`,
không qua màn Bắt đầu. Trang này có Tạo doanh nghiệp và popup Nhập mã mời;
gửi mã xong mở tab Yêu cầu đã gửi để chờ duyệt, đóng/Hủy vẫn ở danh sách hiện tại.
Onboarding tạo doanh nghiệp quay lại đây. `/workplaces/start` chỉ redirect về
`/workplaces`; `/workplaces/join` redirect về `/workplaces?join=1` để mở popup.
Continuation hợp lệ cho lời mời/đích truy cập riêng vẫn được giữ qua OTP/2FA/Google.
Mục này thay thế thiết kế hai lựa chọn ban đầu trong các tài liệu cũ.

### owner và co_owner

Mỗi doanh nghiệp có một owner: người tạo trong `AgencyCreationKey`, hoặc
`AgencyProfile.userId` với dữ liệu legacy. Người được cấp thêm vai trò OWNER là
co_owner, dùng cùng bộ quyền nhưng không quản lý vai trò/trạng thái các chủ khác.
Chỉ owner được thêm, hạ vai trò, đình chỉ hoặc gỡ co_owner; không ai chỉnh
vai trò/trạng thái của owner qua quản lý thành viên. Khi hạ co_owner, xóa
quyền tùy chỉnh cũ và áp dụng bộ quyền vai trò mới. Không thêm migration hay
luồng chuyển chủ trong phạm vi này.

Bản cập nhật đã triển khai trong worktree: [Email thông báo và Lời mời của tôi](agency-email-invitation-inbox.md). Email mời mới không có link web; người nhận chấp nhận trong trang chọn nơi làm việc sau khi xác minh đúng email. Chưa deploy hoặc thay đổi database shared.

Xem [Làm lại đăng nhập, đăng ký và onboarding Agency](agency-auth-onboarding-redesign.md). Luồng hiện tại: tạo account → xác minh → chọn nơi làm việc; tạo doanh nghiệp qua onboarding ba bước hoặc nhập mã trong popup, nhận lời mời email tại đây. Code đã được triển khai và kiểm thử; bằng chứng triển khai ban đầu được giữ trong bản cập nhật.

Khi khác nhau về màn hình và điều hướng auth, ưu tiên bản cập nhật. Các ràng buộc dữ liệu, tenant, quyền, migration và tính nhất quán trong tài liệu nền này vẫn áp dụng. Đặc biệt, account chưa có membership phải đăng nhập được; kiểm tra membership trong agency auth legacy hiện là điểm cần sửa/tách khỏi luồng web mới, không phải yêu cầu sản phẩm.

## Cập nhật triển khai — 2026-11-13

Đã có account chung → `/workplaces` → tạo agency độc lập hoặc gửi mã tham gia → OWNER chọn role và duyệt. Luồng lời mời email được giữ lại. Đã chuyển hồ sơ OWNER, moderation và public profile sang agencyId; giữ API auth agency cũ cho client tương thích.

Đây chưa phải hoàn tất rollout P0–P5: upload giấy phép trực tiếp theo tenant, các module legacy promotions/premium/complaints/review-disputes, kiểm kê client mobile và browser QA/backend thật còn phải hoàn thiện. Hồ sơ MVP nhận liên kết giấy phép. Migration mới chỉ được chạy trên PostgreSQL local cô lập; chưa preflight hay thay đổi target shared.

Chi tiết phạm vi, kiểm thử và điều kiện phát hành: [WORKPLACES_IMPLEMENTATION.md](../database/agency-multimember/WORKPLACES_IMPLEMENTATION.md). Checklist bên dưới giữ vai trò acceptance toàn bộ kế hoạch; không đồng nghĩa mọi hạng mục release đã hoàn tất.

## 1. Mục tiêu và phạm vi

Một account có thể là STAFF ở agency A và OWNER ở agency B. Đăng ký tạo danh tính cá nhân; tạo agency và tham gia agency là các thao tác sau đăng nhập. Hỗ trợ hai cách tham gia: nhập mã ngắn hạn rồi chờ OWNER phân role/duyệt, hoặc nhận lời mời email có role do người mời chọn.

Trong kế hoạch này, “outlet” được hiểu là một workspace độc lập, tương ứng một `AgencyProfile.id`, có thành viên, dữ liệu và trạng thái xác minh riêng. Quan hệ công ty mẹ–chi nhánh, dùng chung giấy phép hoặc sổ tài chính giữa nhiều outlet chưa nằm trong phạm vi. Nếu outlet mang nghĩa chi nhánh của một pháp nhân, cần thiết kế quan hệ đó trước migration.

Giữ Express, Prisma, JWT/refresh, Google OAuth, OTP, 2FA và RTK Query hiện có. Quyền nền tảng MODERATOR/SUPER_ADMIN và lifecycle hướng dẫn viên giữ phạm vi riêng. Chưa xóa enum global `AGENCY` hoặc đổi hàng loạt role user cũ trong đợt đầu.

## 2. Review đề xuất trước và hiện trạng code

| Nội dung | Kết quả review |
| --- | --- |
| Một user có nhiều vai trò ở nhiều agency | Đã có nền tảng: `AgencyMember`, unique `(agencyId,userId)`, `listForUser`, selector, tenant header và cache epoch. |
| Staff phải có global role AGENCY | Không cần. `loginAgency()` hiện kiểm tra membership; nhận invitation giữ nguyên global role. |
| Manager mặc định mời được Staff | Câu trả lời cũ sai với flexible permissions hiện tại. MANAGER mặc định không có Team administration; phải được cấp quyền thích hợp. |
| Dùng `User.staffStatus = INVITED` cho agency staff | Không áp dụng. `staffStatus`, `StaffInvitation`, `/auth/staff/activate` đang quản lý nhân sự nền tảng, đặc biệt MODERATOR; dễ chặn toàn bộ đăng nhập nếu tái sử dụng. |
| Phải tạo user ngay khi gửi invitation email | Không bắt buộc. `AgencyService.invite()` đã nhận email chưa tồn tại; có thể đăng ký/verify rồi accept. User mới tự chọn mật khẩu qua đăng ký chung. |
| Chỉ redirect `/agency/login` là hợp nhất auth | Chưa đủ: generic login/OTP/Google vẫn có nhánh role AGENCY, agency OTP REGISTER có response/lifecycle khác; mobile và client cũ cần compatibility. |
| Chỉ thêm POST tạo agency | Chưa đủ: settings, application/approval, moderation và public profile còn dùng `User.role`, `AgencyProfile.userId` hoặc giả định agencyId=userId. |
| Migration OWNER cũ | Foundation đã có backfill. Phải kiểm tra target thực tế, không tạo lại OWNER hoặc đổi ID lịch sử theo suy đoán. |

Nguồn chính: `backend/src/modules/agencies/{agency.policy,agency.service,agency-access.service}.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/users/{staff.routes,users.service,users.repository}.ts`, `backend/src/modules/auth/agency-approval.service.ts`, `frontend/app/agency/layout.tsx`, `prisma/schema.prisma`.

Tài liệu H2/H2.8 là bằng chứng lịch sử, không xác nhận trạng thái database hiện tại. Báo cáo trước ghi Shared chưa triển khai và history drift chưa giải quyết; phải preflight lại trước rollout.

## 3. Quy tắc sản phẩm đề xuất

1. Account đăng ký mới theo flow này dùng role cá nhân mặc định TRAVELER để tương thích hiện tại. OWNER/STAFF nằm trên membership; tạo agency không đổi global role. Không mở tự đăng ký quyền platform.
2. User phải ACTIVE và đã xác minh email trước khi tạo agency, gửi request hoặc nhận invitation. Google dùng verifier hiện có; 2FA không bị bỏ qua do đổi flow.
3. Sau OTP đăng ký trong ngữ cảnh agency, chuyển đến `/workplaces`. Login chung ưu tiên `next` nội bộ hợp lệ; không ép người đang đặt tour vào workplace. Hướng dẫn viên và platform giữ landing hiện hành nếu không có ngữ cảnh agency.
4. Trang workplace luôn có danh sách agency, trạng thái hồ sơ, role của chính mình và hai hành động Tạo agency / Tham gia. Người chưa có membership vẫn truy cập được trang này.
5. Tạo agency đồng thời tạo OWNER và các role mặc định trong cùng transaction. Agency mới để `userId=null`, ID độc lập. Lưu draft UNVERIFIED, submit hồ sơ chuyển PENDING theo validation hiện có.
6. OWNER được sửa/gửi hồ sơ, xem trạng thái và quản lý team theo policy khi agency chưa VERIFIED. Những thao tác kinh doanh vẫn yêu cầu VERIFIED. Layout không được khóa luôn đường sửa/resubmit hồ sơ.
7. MVP chỉ ACTIVE OWNER được sinh/thu hồi mã và duyệt/từ chối join request. Xem hàng chờ cần `agency:team-view`; thao tác duyệt phải kiểm tra lại OWNER và quyền team/permissions trong transaction. Chưa mở delegation duyệt request.
8. Mã ngẫu nhiên riêng cho từng lần cấp của agency, sống 15 phút theo giờ server. Đề xuất 12 ký tự base32 không gây nhầm, sinh bằng crypto; không dùng ID doanh nghiệp làm mã. Một agency tối đa một mã chưa revoke; cấp lại revoke mã cũ. Mã có thể dùng cho nhiều người trong thời gian hiệu lực.
9. Mã chỉ cho phép tạo PENDING request. OWNER duyệt và chọn một role template thuộc cùng agency, không phải OWNER, với quyền không vượt quyền người duyệt. Overrides/scope tiếp tục quản lý bằng API hiện có sau khi gia nhập.
10. Mã hết hạn/rotate/revoke không tự hủy request đã nộp hợp lệ. Request chờ đến khi duyệt, từ chối hoặc người gửi hủy; không cần EXPIRED ở MVP. Server vẫn kiểm tra expiry mã ngay khi submit, kể cả chưa có cleanup job.
11. Mỗi `(agencyId,userId)` chỉ có một request PENDING. Member ACTIVE không gửi lại; SUSPENDED phải kích hoạt qua quản lý thành viên. REMOVED được nhận lời mời mới hoặc gửi yêu cầu bằng mã rồi chờ duyệt; dùng lại membership ID, áp dụng role mới, xóa overrides/scope cũ. Gỡ/đình chỉ vô hiệu hóa lời mời và yêu cầu đang chờ trước đó; co_owner đã gỡ chỉ được owner nhận lại.
12. Invitation email là consent riêng: role được người mời chọn trước, người nhận xác minh đúng email và accept thì tạo membership, không cần OWNER duyệt lần hai. Invitation hiện có vẫn 24 giờ; mã 15 phút là cơ chế khác.
13. Email chưa có account: gửi invitation trước, người nhận đăng ký chung, OTP rồi quay về accept. Không tự tạo user pending hoặc thay mật khẩu user đã tồn tại. Owner không nhận thông tin email có account hay chưa ngoài lỗi membership cần thiết.

## 4. Dữ liệu và nhất quán

Tái sử dụng `AgencyProfile`, `AgencyRole`, `AgencyMember`, `AgencyInvitation`, overrides, scopes, `permissionVersion`, audit và mail outbox.

Thêm bằng migration forward-only:

| Model | Trường/chỉ mục cần thiết |
| --- | --- |
| `AgencyJoinCode` | id, agencyId, codeHash unique, createdByUserId, createdAt, expiresAt, revokedAt; index theo agency/time. Partial unique agencyId WHERE revokedAt IS NULL; mã hết hạn được đánh dấu revoke khi cấp mới. CHECK expiresAt>createdAt. |
| `AgencyJoinRequest` | id, agencyId, userId, joinCodeId, status PENDING/APPROVED/REJECTED/CANCELLED, createdAt, reviewedAt, reviewedByUserId, assignedRoleId nullable, cancelledAt. Partial unique `(agencyId,userId)` WHERE status=PENDING; indexes cho hàng chờ agency và danh sách user. |

`joinCodeId` phải có composite FK cùng `agencyId`; `assignedRoleId` có composite FK tới AgencyRole cùng agency. Người gửi/người duyệt tham chiếu User. CHECK đảm bảo review metadata phù hợp trạng thái; không cascade xóa agency/business history. Giữ lịch sử code để request còn tham chiếu được.

Chỉ lưu hash mã; trả plaintext một lần khi OWNER tạo, UI giữ trong bộ nhớ và hỗ trợ copy/countdown. Reload hiển thị expiry/metadata và hành động tạo mã mới. Không log mã hoặc invitation token.

Luồng cấp/revoke mã, gửi request, approve/reject/cancel và accept email dùng cùng khóa `AgencyProfile FOR UPDATE` như các team writers. Recheck user/membership/quyền/trạng thái dưới lock. Approve tạo membership + cập nhật request + bump permissionVersion + audit trong cùng transaction; chỉ phát thông báo sau commit qua cơ chế hiện có.

Nếu email accept và approve request diễn ra đồng thời: chỉ tạo một membership; đường đến sau đóng request trùng hoặc trả trạng thái đã gia nhập, không đổi role/overrides của membership vừa tạo. Retry cùng kết quả trả thành công idempotent; request đã bị từ chối/hủy trả conflict. Ràng buộc unique là lớp bảo vệ cuối.

Giới hạn thử mã theo IP và user, giới hạn submit theo user/agency, thông báo chung cho mã sai/hết hạn/revoke. Không có endpoint public tra agency bằng mã; thành công chỉ trả companyName/request status tối thiểu, không trả danh sách member.

## 5. API dự kiến

Base `/api/v1`; URL dưới đây là đề xuất chưa được serve. Các API tạo/join không yêu cầu một membership hoặc active agency có sẵn. Riêng team APIs dùng `X-Agency-Id` và resolver hiện có.

| Method/path | Quyền và hành vi |
| --- | --- |
| `POST /auth/register`, `/auth/login`, `/auth/verify-otp`, `/auth/google` | Dùng chung identity/session; giữ JWT subject và response `agencies`. |
| `POST /agencies` | User ACTIVE/email verified; tạo agency + OWNER; hỗ trợ idempotency cho double-click/retry. Không thay public GET `/agencies/:id`. |
| `GET /agency/application` | OWNER theo AgencyContext; đọc hồ sơ của outlet đang chọn. |
| `PUT /agency/application` | OWNER; lưu draft/resubmit theo trạng thái; kiểm tra thay đổi pháp lý và re-verification hiện có. |
| `POST /agency/application/submit` | OWNER; kiểm tra hồ sơ đủ rồi UNVERIFIED/eligible state → PENDING. |
| `POST /agency/join-codes` | OWNER; rotate và trả mã mới + expiresAt. |
| `GET /agency/join-codes/current` | OWNER; metadata, không plaintext. |
| `POST /agency/join-codes/:id/revoke` | OWNER; revoke mã thuộc agency hiện tại. |
| `POST /agency-join-requests` | User verified; body `{code}`; tạo/reuse PENDING request. |
| `GET /users/me/agency-join-requests` | User; xem request của chính mình, có pagination. |
| `POST /agency-join-requests/:id/cancel` | Chính người gửi; chỉ cancel PENDING. |
| `GET /agency/join-requests` | Team view; filter trạng thái/pagination; dữ liệu tối thiểu phục vụ duyệt. |
| `POST /agency/join-requests/:id/approve` | OWNER; body `{roleId}`; role cùng agency, non-OWNER, transaction. |
| `POST /agency/join-requests/:id/reject` | OWNER; chỉ PENDING. |
| Invitation email hiện có | Giữ contract; bổ sung continuation qua register/OTP/login và xử lý request trùng. |

Đưa routes qua validation/controller/service/repository theo kiến trúc repo. Tái sử dụng module agencies; không mở auth framework/module trùng. Đăng ký guard metadata, error contracts, audit actions và notification types/fanout chính xác. Role phải chọn từ server catalog.

Client cần phân loại route tenant rõ ràng. `/agencies` và `/agency-join-requests` không được bị chặn bởi `baseApi` do chưa chọn agency; `/agency/...` vẫn scoped. Không nhận agencyId/role/actor từ body thay cho server context.

## 6. UX và điều hướng

Mode Operate, tái sử dụng giao diện auth/team và design tokens hiện có. Impeccable được dùng để chốt trình tự, trạng thái và quyền truy cập; chưa chọn thiết kế hình ảnh mới.

- `/workplaces`: danh sách workspace ghi tên/role/trạng thái xác minh, nút mở, tạo mới/tham gia và request đang chờ. Có loading, retry, empty và membership vừa bị thu hồi. Không redirect vòng khi danh sách rỗng.
- `/workplaces/new`: form hồ sơ theo thông tin nghiệp vụ hiện hành; lưu draft và submit rõ ràng. Chủ account có thể tạo thêm workspace từ đây dù đã thuộc agency khác.
- Popup Nhập mã mời tại `/workplaces`: gửi yêu cầu rồi mở tab chờ duyệt; không hiện role selector cho người xin tham gia. `/workplaces/join` chỉ là URL chuyển tiếp tương thích.
- `/agency/team`: thêm khu vực Mã tham gia và Yêu cầu tham gia; OWNER xem người gửi, chọn role, xác nhận duyệt hoặc từ chối. Staff không thấy hành động quản trị.
- Invitation accept: nếu chưa login, có cả Đăng nhập và Tạo account; giữ đường quay lại an toàn qua OTP/2FA/Google. Dùng continuation chung, tránh localStorage chứa invitation token và loại query token sau accept.
- Khi approve: user nhận thông báo, membership refetch/poll/focus và có thể mở workspace. Không cần logout/login để cập nhật quyền; dữ liệu API/cache cũ bị xóa theo agencyEpoch hiện có.
- Không auto-select workspace vừa tạo/join làm đổi nơi làm việc ở tab khác; navigation chủ động chọn workspace trên tab đang thao tác. Giữ bảo vệ response muộn/account switch.
- Cung cấp mục Nơi làm việc sau login cho cả account mới và account đã có. Trang doanh nghiệp chưa xác minh vẫn cho OWNER cập nhật hồ sơ; thành viên khác thấy trạng thái tối thiểu.

## 7. Giai đoạn và task triển khai

### P0 — Chốt baseline, sửa contract và test nền

- [ ] Xác nhận outlet trong phạm vi là workspace độc lập; ghi định nghĩa vào README.
- [ ] Ghi baseline git/test ở worktree hiện tại; bảo toàn các thay đổi flexible permissions chưa commit của người dùng.
- [ ] Regenerate ENDPOINTS, bổ sung USE_CASE_MAP và sửa query validation `/agency/work/tours`; tái kiểm tra thay vì giả định lỗi cũ còn nguyên.
- [ ] Kiểm tra integration PostgreSQL Windows và chọn harness cô lập hoạt động; không chạy reset test trên URL shared từ `.env`.
- [ ] Kiểm kê consumer web/mobile của agency auth và ứng dụng/profile/moderation theo userId.

Exit: danh sách endpoint/consumer và kết quả baseline rõ ràng; môi trường integration dùng DB riêng đã xác minh.

### P1 — Hợp nhất identity và continuation

- [ ] Generic login/OTP/Google chấp nhận owner legacy; membership không là điều kiện để đăng nhập account chung.
- [ ] Registration tạo account/OTP, không bắt buộc tạo business profile. Giữ entry guide riêng tương thích.
- [ ] Chuẩn hóa safe next/continuation qua register, OTP, login, Google, 2FA và invitation.
- [ ] Giữ agency auth APIs cũ bằng adapter tương thích trong giai đoạn chuyển tiếp. Đánh dấu deprecated; chưa redirect HTTP API hoặc đổi response agency OTP REGISTER cho client cũ.
- [ ] Cập nhật `homeForRole`, guards và docs AI_RULES khi mapping được chuyển sang workplace theo ngữ cảnh.

Exit: account chưa thuộc agency login được; legacy owner login/OTP/Google/refresh hoạt động; invitation mới không mất token/next qua đăng ký.

### P2 — Agency độc lập và lifecycle hồ sơ (dependency bắt buộc)

- [ ] API tạo agency idempotent, userId=null, tạo OWNER + seed roles trong transaction; rollback không để agency thiếu OWNER.
- [ ] Hồ sơ/settings/upload giấy phép/submit/resubmit lấy tenant từ context; thay reference email/User để truy cập workspace.
- [ ] Moderation queue/approve/reject, dashboard đếm agency và public agency profile truy vấn AgencyProfile.id; audit ghi actor riêng, notification tới member đúng quyền.
- [ ] Kiểm tra các trigger onboarding mặc định hiện có với agency độc lập và nested legacy registration.
- [ ] Chuyển promotions/premium/complaints/review-disputes khỏi legacy-owner gate khi tenant/actor/recipient đã tích hợp. Trước khi mở đầy đủ agency mới, module chưa chuyển phải ẩn/giải thích rõ và tiếp tục từ chối ở server.

Exit: một user tạo hai agency, mỗi agency có OWNER và hồ sơ riêng; moderator duyệt đúng agency độc lập; sửa A không đổi B. MVP vận hành giới hạn phải nêu rõ module hỗ trợ; release đầy đủ cần hoàn thành các module legacy còn lại.

### P3 — Mã tham gia và OWNER duyệt

- [ ] Migration join codes/requests, FK/check/partial unique/index và enum.
- [ ] Cấp/rotate/revoke mã; hết hạn server-side; throttle IP/user và kiểm tra trạng thái người cấp khi submit.
- [ ] Submit/list/cancel request; chặn membership inactive quay lại qua request.
- [ ] Approve/reject với live OWNER check, role tenant check, transaction/idempotency và xử lý cuộc đua invitation.
- [ ] Audit và notification chủ agency/người gửi; dữ liệu không lẫn tenant hoặc phát cho user bị ban/member bị suspend.

Exit: mã 15 phút chỉ tạo request; chỉ duyệt thành công mới cấp membership đúng role, không có đường tự nâng thành OWNER.

### P4 — Workplace và Team frontend

- [ ] `/workplaces`, create/join/status screens và danh sách agency; dùng hooks/session/selector hiện có.
- [ ] Guard cho account không membership; tách quyền hồ sơ trước xác minh khỏi quyền vận hành.
- [ ] Team code panel, request queue, role picker và xác nhận duyệt/từ chối.
- [ ] Invitation email cũ hoạt động từ account đã có hoặc chưa có; lỗi email sai, expired/revoked, đang đăng nhập account khác rõ ràng.
- [ ] Điều hướng sau verify/login theo ngữ cảnh; alias frontend agency login chuyển dần sang login chung khi backend/client compatibility đã sẵn sàng.
- [ ] QA desktop/mobile, bàn phím, loading/error/empty, back/refresh và nhiều tab.

Exit: chạy hết luồng người dùng bằng browser với backend thật và database test; lưu evidence, không chỉ dựa trên mock component.

### P5 — Migration rehearsal và rollout

- [ ] Schema validate, backend/frontend typecheck, unit, integration và frontend production build theo quy tắc repo; route audits/docs đồng bộ.
- [ ] Fresh-history deploy và upgrade DB có dữ liệu; đối chiếu ID, OWNER, business fingerprints, role mappings, unique/FK/check.
- [ ] Preflight lại history/target database hiện tại; nếu drift thì xử lý bằng kế hoạch reconciliation riêng trước shared deploy.
- [ ] Rehearse trên clone/branch cô lập bằng migration code/Prisma và direct connection; tạo/kiểm tra checkpoint, rollback về bản app còn hiểu tenant mới.
- [ ] Bật tính năng theo capability: chỉ mở “Tạo agency” khi lifecycle độc lập đủ dùng; giám sát lỗi auth, join/approve conflicts và email delivery.
- [ ] Chỉ ngừng agency auth APIs cũ sau khi web/mobile đã chuyển và quan sát không còn client dùng contract cũ.

Thứ tự phụ thuộc: P0 → P1 → P2 → P3 → P4 → P5. Có thể xây API/UI từng vertical slice, nhưng không mở UI trước backend/guard/lifecycle tương ứng.

## 8. Acceptance tests quan trọng

1. U là STAFF ở A, tạo B thành OWNER; quyền trong A không đổi; mọi query/mutation A/B tách dữ liệu.
2. Đăng ký → OTP → workplace; chưa có membership vẫn tạo/join được. Flow đặt tour, guide và platform không bị redirect ngoài ngữ cảnh.
3. Agency mới không liên kết legacy userId; OWNER lưu/submit/resubmit và moderator duyệt đúng hồ sơ; chỉ VERIFIED mới vận hành.
4. Mã trước/sát/sau expiry, rotate, revoke, tạo đồng thời và dùng code agency khác; không log code và throttle hoạt động.
5. Mã hợp lệ nộp request trước expiry vẫn duyệt sau expiry; không được truy cập API business trong lúc chờ.
6. Hai OWNER duyệt đồng thời, approve đối đầu reject/cancel, approve đối đầu email accept: không có hai membership hoặc role bị ghi đè.
7. Role khác tenant/OWNER/platform permission bị từ chối. Người duyệt vừa mất OWNER/quyền hoặc bị ban trước commit không duyệt được.
8. User bị khóa hoặc member SUSPENDED không được phục hồi qua mã/email. Member REMOVED chỉ được nhận lại bằng lời mời mới hoặc duyệt yêu cầu mới; không giữ quyền/scope cũ, không tạo membership trùng, vẫn giữ lịch sử audit.
9. Invitation đã gửi tới email chưa có user: register/OTP/accept thành công; email sai, invitation expired/revoked/single-use bị chặn; người mời mất quyền thì không accept được.
10. Refresh/Google/2FA/rememberMe và legacy agency auth còn đúng contract. Account switch, workspace switch, response muộn, permissionVersion không lộ cache khác tenant.
11. AgencyProfile/roles/OWNER creation rollback nguyên tử; create retry cùng idempotency key không sinh agency thứ hai; lỗi validation không tạo rác.
12. Notification request chỉ đến OWNER hợp lệ; kết quả duyệt chỉ đến người gửi; mã/token không xuất hiện trong audit/log/analytics.

## 9. Quyết định mặc định và phần cần xác nhận khi chốt thiết kế

Mặc định đã triển khai trong MVP: outlet là workspace độc lập; mã 15 phút, nhiều người dùng, một mã hiện hành; chỉ OWNER duyệt; request không tự hết hạn sau khi mã hết hạn; lời mời email accept trực tiếp; account mới dùng TRAVELER tương thích schema hiện có. Giới hạn release được ghi trong báo cáo triển khai ở đầu tài liệu.

Ưu tiên phát triển: hoàn thành P0/P1, sau đó P2 trước khi dựng trang tạo agency. Không cần tự tạo user từ email mời hoặc xóa global role AGENCY để đạt mục tiêu đa workplace.
