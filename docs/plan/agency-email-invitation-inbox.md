# Lời mời doanh nghiệp qua email và hộp lời mời cá nhân

Ngày lập: 2026-11-13. Trạng thái: đã được chấp thuận và triển khai trong worktree; chưa deploy database shared/production.

## Cập nhật triển khai

- Đã thêm inbox cá nhân phân trang và accept bằng ID, không yêu cầu chọn tenant. Endpoint token cũ dùng chung phần kiểm tra/transaction để giữ tương thích.
- Email mới dùng thông báo tiếng Việt, tên doanh nghiệp, vai trò và hạn dùng thực tế; không còn link/token. Outbox và OTP/Brevo giữ nguyên. Không sửa hoặc gửi lại mail cũ đã enqueue.
- Trang workplaces có tab **Lời mời của tôi**, tổng số, danh sách gọn, phân trang, empty/loading/error, keyboard và layout mobile xếp dọc. Accept cập nhật membership/inbox/yêu cầu mã mời nhưng không tự điều hướng vào tenant.
- Chống bấm lặp, phản hồi muộn sau logout/account switch và tách lỗi refresh khỏi accept đã commit. Không thay đổi global role; suspended không tự khôi phục. Removed chỉ nhận lại qua lời mời/yêu cầu mới được người quản lý cho phép, không tái sử dụng quyền/scope cũ.
- Typecheck backend/frontend đạt. Suite workplaces PostgreSQL cô lập đạt 22/22 trên code cuối; test giao diện workplaces + Agency login đạt 21/21 (trong đó workplaces 15/15); test template mail, route audit và docs-in-sync đạt 15/15.
- Backend unit toàn bộ sau generate docs: **61 files, 784/784 tests đạt**. Suite flexible integration rộng: 18/19 đạt, còn test owner tự sửa trả 403 thay vì expectation cũ 409, ngoài phần invitation; không sửa chính sách owner để chiều test.
- Frontend toàn bộ: **115/117 files đạt, 752/755 tests đạt**. Ba lỗi đã có từ lượt auth trước: hai expectation cũ trong `agency-team.test.tsx` (tên lặp trong sr-only, nút phân quyền đã đổi thành popup chỉnh sửa), một timeout 5 giây trong test max counts của tour editor. Không thay UI member/tour để sửa các test ngoài phạm vi.
- Production build trên code cuối đạt, prerender 88/88 routes; dùng `.next-preview` để không đụng output dev `.next`. `git diff --check` đạt, `.env` không thay đổi.
- Kiểm tra trình duyệt trực tiếp bị chặn do cấu hình công cụ tại `C:/Users/khoal/.codex/config.toml` (agents không đúng kiểu); không sửa cấu hình người dùng và chưa xác nhận visual QA trong browser.
- Chưa chạy migration, tạo dữ liệu hay gửi email thật để test trên môi trường shared. Không có migration mới trong phạm vi email inbox; các migration foundation/flexible/workplaces vẫn là điều kiện môi trường như mục 9.

## 1. Phạm vi chốt theo yêu cầu

Owner chọn email và vai trò trong màn quản lý thành viên. Hệ thống lưu lời mời và gửi email thông báo, không đính kèm URL, token, nút truy cập web hoặc địa chỉ localhost. Người nhận tự đăng nhập Tripri Partner bằng đúng email đã được xác minh, vào trang chọn nơi làm việc và chấp nhận trong tab **Lời mời của tôi**.

Lời mời email đã được người quản lý chọn vai trò: chấp nhận là tạo membership, không yêu cầu owner duyệt lần nữa. Luồng nhập mã mời vẫn là gửi yêu cầu và chờ owner chọn vai trò, duyệt như hiện tại. Không tự thêm thành viên chỉ vì đã gửi email.

Giữ TTL lời mời email **24 giờ** theo code hiện có; không nhầm với mã tham gia 15 phút. Cho phép mời trước khi người nhận tạo tài khoản; sau đăng ký và xác minh đúng email, lời mời còn hiệu lực sẽ xuất hiện.

Không thay đổi OTP, nhà cung cấp mail thật, đăng nhập, onboarding doanh nghiệp hoặc bảng màu Agency. Chưa thêm chức năng từ chối, gửi lại lời mời, realtime/socket hay lịch sử lời mời cá nhân trong MVP.

## 2. Đối chiếu code hiện tại

| Phần | Hiện trạng | Hướng thay đổi |
| --- | --- | --- |
| `AgencyService.invite()` | Chuẩn hóa email, chọn role, chống mời trùng, tạo lời mời 24 giờ, enqueue mail cùng transaction | Giữ nghiệp vụ; thay email tiếng Anh kèm URL bằng thông báo tiếng Việt không link |
| `AgencyService.accept()` | Tìm bằng token hash; kiểm tra tài khoản, email xác minh, thời hạn, quyền người mời; khóa agency và tạo membership trong transaction | Tách phần kiểm tra/chấp nhận dùng chung, thêm đầu vào invitation ID cho người nhận đã đăng nhập |
| `/agency/invitations` | Owner/người có quyền xem lời mời đã gửi trong tenant đang chọn | Giữ, không dùng làm inbox cá nhân |
| `/agency-invitations/accept` | Nhận token, cần đăng nhập nhưng không cần chọn agency | Giữ tương thích client/link cũ; không còn phát link trong email mới |
| `WorkplacesPage` | Có tab Doanh nghiệp và Yêu cầu đã gửi khi có dữ liệu | Thêm tab Lời mời của tôi, luôn hiển thị kể cả chưa có membership |
| `MailOutbox` | Lưu mail bền vững, mã hóa nội dung, dedup và retry | Tái sử dụng; không gửi trực tiếp trước khi transaction commit |
| `AgencyInvitation` | Có email, roleId, trạng thái, expiresAt, tokenHash và index email/status | Tái sử dụng; dự kiến chưa cần migration cho MVP |

## 3. Giao diện và nội dung

Visitor mode: Operate. Giữ nền sáng, teal, kiểu dòng gọn và khung trang chọn nơi làm việc hiện tại; không dựng thêm dashboard hoặc khối lời mời bên dưới danh sách doanh nghiệp.

Thứ tự tab: **Doanh nghiệp · Lời mời của tôi (N) · Yêu cầu đã gửi**. Tab yêu cầu giữ điều kiện hiển thị hiện tại. N là tổng lời mời PENDING chưa hết hạn, không phải số dòng trang hiện tại; không giả số 0 khi tải thất bại. Badge chỉ hiển thị sau khi tải thành công.

Danh sách lời mời dạng dòng:

| Doanh nghiệp | Vai trò được mời | Hết hạn | Thao tác |
| --- | --- | --- | --- |
| Tên doanh nghiệp thực tế | Tên vai trò thực tế | Ngày, giờ theo locale | Chấp nhận lời mời |

- Có mô tả ngắn: “Lời mời được gửi đến [email tài khoản]. Chấp nhận để tham gia doanh nghiệp với vai trò được chỉ định.”
- Không hiển thị quyền chi tiết thành list dài, không yêu cầu nhập lại token, không cần popup xác nhận cho thao tác chấp nhận đã có đủ thông tin.
- Khi chấp nhận: khóa nút dòng đang xử lý, hiển thị “Đang tham gia…”, chống bấm lặp. Khi thành công: cập nhật danh sách lời mời, membership và yêu cầu đã gửi; báo “Bạn đã tham gia [doanh nghiệp].” rồi chuyển sang tab Doanh nghiệp. Người dùng chủ động bấm “Mở doanh nghiệp”; không tự đổi workspace đang chọn.
- Nếu refresh membership sau accept lỗi: báo rõ lời mời đã chấp nhận, cho tải lại doanh nghiệp; không coi accept thất bại hoặc gửi lại mutation.
- Lời mời hết hạn/thu hồi trong lúc màn hình đang mở: báo lỗi rõ và refresh danh sách; không tạo membership.
- Empty: “Bạn chưa có lời mời nào. Người quản lý có thể mời bạn bằng email [email].”
- Loading/error tách riêng khỏi danh sách doanh nghiệp; có nút Thử lại. Không chặn cả trang nếu inbox lỗi.
- Mobile: mỗi dòng xếp tên → vai trò/thời hạn → nút; không tràn ngang. Tabs hỗ trợ phím trái/phải, Home/End, focus và aria-controls cho cả ba tab.
- Sau đăng ký, link đến `/workplaces` phải giúp người dùng tìm được lời mời, không ép tạo doanh nghiệp hoặc nhập mã mới thấy inbox.

## 4. API đề xuất

Các đường dẫn dưới đây tương đối với `/api/v1`, không nhận email/userId từ client để quyết định người nhận và không yêu cầu `X-Agency-Id`.

| API | Hành vi |
| --- | --- |
| `GET /users/me/agency-invitations?page=1` | Đọc user từ session; chỉ trả lời mời đúng email đã xác minh, PENDING và chưa hết hạn; phân trang 20, sort createdAt/id ổn định, trả `{ items, page, pageSize, total }` |
| `POST /agency-invitations/:id/accept` | Body rỗng; tìm đúng lời mời thuộc email của actor, kiểm tra lại mọi điều kiện trong transaction; trả invitationId, agencyId, memberId |

DTO list tối thiểu: `id`, `agency: { id, companyName }`, `roleName`, `createdAt`, `expiresAt`. Không trả token/tokenHash, thông tin cá nhân người mời hoặc dữ liệu nội bộ doanh nghiệp.

Tách lookup token và lookup ID khỏi phần accept chung để hai đường vào không lệch kiểm tra bảo mật. Với ID không tồn tại hoặc thuộc email khác, dùng cùng một lỗi không tìm thấy; không tiết lộ email/agency của lời mời khác. Bổ sung validation UUID, pagination, rate limit mutation và mã lỗi ổn định cho UI.

## 5. Quy tắc toàn vẹn và bảo mật

- Đăng nhập chưa có membership vẫn gọi inbox/accept được. Backend bắt buộc user ACTIVE, staffStatus ACTIVE, emailVerifiedAt có giá trị; email chuẩn hóa theo quy tắc hiện tại.
- Giữ quyền `agency:team-invite` và giới hạn quyền được ủy quyền. Không âm thầm đổi chính sách thành owner-only; owner mặc định là người thao tác, nhân sự được cấp quyền vẫn tuân theo hệ thống hiện có.
- Không cho mời role OWNER qua flow này. Kiểm tra role thuộc đúng agency và kiểm tra lại quyền người mời tại thời điểm accept.
- Giữ khóa agency, trạng thái lời mời, chống xử lý đồng thời accept/revoke và unique agency/user. Bấm accept hai lần không tạo hai membership hoặc ghi audit hai lần; lần sau trả trạng thái đã xử lý để UI refresh.
- Thành viên đang ACTIVE không bị lời mời ghi đè role. SUSPENDED phải được kích hoạt trong quản lý thành viên. REMOVED được nhận lời mời mới hoặc gửi yêu cầu mới để chủ doanh nghiệp duyệt, dùng lại membership với role mới và không giữ quyền/scope cũ.
- Accept email hủy yêu cầu mã mời đang PENDING của chính user tại cùng agency như code hiện tại; không ảnh hưởng agency khác.
- Membership, trạng thái ACCEPTED, permission version, đóng yêu cầu trùng và audit phải commit/rollback cùng nhau.
- Dùng lại enum PENDING/ACCEPTED/REVOKED/EXPIRED. GET chỉ lọc thời hạn, không bắt buộc ghi EXPIRED khi đọc. Không xóa cột tokenHash: giữ tương thích schema/endpoint cũ, không đưa token vào email mới.

## 6. Nội dung email và phản hồi phía owner

Subject: **[Tripri Partner] Lời mời tham gia {tên doanh nghiệp}**.

Nội dung lấy từ dữ liệu thật, ví dụ cấu trúc:

> Bạn được mời tham gia {tên doanh nghiệp} với vai trò {tên vai trò}.
>
> Đăng nhập Tripri Partner bằng email nhận thư này, mở trang Chọn nơi làm việc → Lời mời của tôi và chấp nhận lời mời.
>
> Nếu chưa có tài khoản, hãy đăng ký và xác minh email này trước.
>
> Lời mời có hiệu lực đến {ngày giờ hết hạn, ghi rõ múi giờ}. Bạn chưa trở thành thành viên cho đến khi chấp nhận. Nếu không nhận ra lời mời, bạn có thể bỏ qua email này.

Không URL, không CTA link, không token trong text/HTML; không phụ thuộc CLIENT_URL. MVP dùng mail text hiện có để tránh mở rộng outbox chỉ cho mục đích trang trí.

Owner nhận phản hồi sau khi lưu thành công: **“Đã tạo lời mời. Hệ thống sẽ gửi email thông báo.”** Không khẳng định mail đã đến inbox vì API hiện mới enqueue; mail gửi lỗi vẫn retry và người nhận vẫn thấy lời mời trong hệ thống. Gửi trùng khi lời mời còn hiệu lực phải báo rõ, không tạo thêm mail/membership. Hết hạn thì owner có thể tạo lời mời mới theo cơ chế hiện tại.

Mail cũ đã nằm trong outbox không tự thay nội dung: không flush thủ công hoặc gửi lại hàng loạt trong quá trình triển khai. Trước bật worker/gửi mail thật, kiểm tra read-only các lời mời cũ còn chờ; nếu cần sửa/hủy các mail đã enqueue chứa localhost phải xin xác nhận phạm vi riêng.

## 7. Thứ tự triển khai

1. Backend: tách accept chung, bổ sung inbox và accept theo ID, giữ API token cũ; unit/integration test bảo mật và race.
2. Mail: template tiếng Việt không link; test nội dung, dedup, transaction/outbox và phản hồi owner.
3. Frontend: query/mutation cá nhân không tenant, tab inbox, số lượng, trạng thái; refresh cache membership/invitations/join requests đúng tài khoản, không ghi dữ liệu sau logout hoặc account switch.
4. Regression: owner tạo lời mời → người chưa có account đăng ký/OTP → thấy inbox → accept → hiện doanh nghiệp → mở bằng quyền được cấp. Kiểm tra cả người đã có account hoặc đã là owner ở agency khác.
5. Cập nhật README module, USE_CASE_MAP và tài liệu endpoint theo quy tắc repo; ghi kết quả kiểm thử vào kế hoạch này. Người dùng đã xác nhận triển khai; deploy/migration shared vẫn là phạm vi riêng.

## 8. Điều kiện nghiệm thu

- Email mới có đúng tên doanh nghiệp/vai trò/hạn dùng, không có web URL hay token; cấu hình Brevo/OTP giữ nguyên.
- Owner mời email chưa có user thành công; đúng tài khoản sau verify thấy lời mời, tài khoản khác không đọc/accept được.
- Zero-membership vẫn mở được inbox. Nhiều agency mời cùng email hiển thị độc lập, không đổi global role của account.
- Accept tạo đúng một membership/role trong đúng tenant; không cấp quyền trước khi chấp nhận hoặc vượt quyền người mời.
- Hết hạn, revoke, inviter mất quyền, role bị đổi quyền, user bị ban và concurrent accept/revoke đều không vượt kiểm tra.
- API list phân trang/count chính xác; lỗi inbox không phá danh sách doanh nghiệp. Test keyboard/tab ba mục và mobile 390px.
- Test cache theo account/agency epoch, cập nhật membership sau accept, lỗi refresh sau commit và đóng yêu cầu tham gia trùng.
- Backend/frontend typecheck và các test liên quan pass; browser QA dùng dữ liệu test cô lập. Không gửi mail thật khi chạy automated tests.

## 9. Điều kiện môi trường

Chưa deploy không ngăn luồng inbox hoạt động ở local. Tuy nhiên accept hiện có cập nhật bảng AgencyJoinRequest; cần kiểm tra migration/schema target trước test backend thật. Các lần kiểm tra trước ghi nhận migration workplaces chưa có trên DB cấu hình; phải xác minh lại khi triển khai, không mặc định đã được áp dụng và không tự migrate/reset shared DB.

Kế hoạch này không cho phép thay đổi database shared, xóa dữ liệu, gửi thư thật để thử hoặc nâng cấp framework ngoài phạm vi.
