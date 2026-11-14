# Sửa độ tin cậy và độ trễ đăng nhập

Trạng thái: đã triển khai sửa header/middleware và refresh lifecycle; đã thêm timing, còn cần waterfall đăng nhập thật để kết luận bottleneck. Phạm vi: đăng nhập dùng chung, agency và staff; không thay identity provider, không sửa calendar, không đổi dữ liệu tài khoản.

## Kết quả triển khai

- Dùng chung allowlist POST method/path chính xác trong constants. Frontend bỏ Authorization cũ, backend bỏ xác thực Bearer riêng ở allowlist; protected auth endpoints vẫn giữ nguyên bảo vệ.
- Refresh single-flight giữ nguyên; thêm phiên bản checked phân biệt từ chối xác thực với network/5xx. Giữ wrapper tương thích cho chat/socket và consumer cũ. Protected query không xóa phiên khi refresh gặp lỗi tạm thời.
- Bootstrap xóa phiên khi refresh bị từ chối, không treo guest ở trạng thái idle khi mạng lỗi, giữ guard không ghi đè login mới; xử lý logout qua storage giữa các tab.
- Dev Server-Timing trên login cá nhân/agency và refresh: credential_lookup, password_verify, session, refresh_token_write, session_recheck, last_login_write, memberships (tùy luồng). Không ghi credentials/PII và không bật timing header ở production.
- HTTP kiểm tra trực tiếp trên BE đang chạy: POST login kèm Bearer không hợp lệ + body rỗng nay trả VALIDATION_ERROR thay TOKEN_INVALID. Không dùng mật khẩu thật hoặc thay đổi tài khoản.
- Kiểm tra: 50 frontend auth/agency-auth tests, 38 backend middleware/auth-service tests; FE/BE typecheck. Không chạy migration hoặc thay đổi DB chung.
- Chưa đo được median/p95 đăng nhập thật, cold/warm, hoặc thời gian render moderator sau login; không coi các tối ưu query/index là đã hoàn tất. Chưa thay schema/index vì chưa có bằng chứng cần thiết.

### Cách thu số đo tiếp theo

Mở DevTools → Network, bật Preserve log, đăng nhập moderator. Xem Timing/response header Server-Timing của POST /auth/login và chuỗi request sau đó. So sánh lần đầu với lần sau; nếu API nhanh nhưng trang chậm, kiểm tra riêng bundle/dev compilation và query màn hình moderator. Không gửi token/cookie/password khi chia sẻ số đo hoặc ảnh Network.

## 1. Bằng chứng và giới hạn kết luận

- `frontend/store/api/baseApi.ts` gắn Bearer token vào mọi request, kể cả `/auth/login`. Danh sách auth exempt chỉ bỏ bước retry refresh, không bỏ Authorization.
- `backend/src/app.ts` chạy `authenticate` trước router. Token sai/hết hạn chặn request trước controller login.
- Đã tái hiện cùng POST `/auth/login` với body rỗng: không Authorization trả 400 VALIDATION_ERROR; thêm Bearer không hợp lệ trả 401 TOKEN_INVALID. Chưa kiểm tra mật khẩu thật của moderator.
- `AuthBootstrap.tsx` khôi phục token trong storage trước khi refresh. Khi refresh thất bại và đã có identity, code không xóa identity/token đó. Đây là đường dẫn giữ token lỗi, không phải bằng chứng toàn bộ độ chậm đều đến từ nó.
- Refresh client có timeout 5 giây. Protected request có thể phải chờ request đầu + refresh + retry. Chưa có waterfall thực tế của phiên người dùng.
- `AuthService.createSession` chờ tạo refresh token, đọc lại user để kiểm tra thay đổi phiên, cập nhật lastLoginAt, rồi đọc agency memberships. Truy vấn nối tiếp có thể tăng độ trễ, nhưng chưa đo nên chưa gọi là bottleneck.

## 2. Sửa đúng ranh giới API public và protected

### Frontend

- Tạo bộ phân loại endpoint theo pathname và HTTP method chính xác; không dùng includes có thể khớp nhầm đường dẫn.
- Các endpoint xác thực không cần access token (login cá nhân/agency, Google, đăng ký, OTP, quên/đặt lại mật khẩu, refresh, logout theo hợp đồng hiện tại) không mang Authorization cũ. Giữ credentials include để refresh/logout dùng cookie.
- Không áp dụng blanket rule cho toàn bộ `/auth/*`: security, change-password, two-factor và endpoint agency application cần actor vẫn giữ xác thực.
- Public auth không refresh/retry khi sai mật khẩu; protected request vẫn refresh tối đa một lần, single-flight.

### Backend

- Dùng allowlist method/path public tương ứng để không giải mã Bearer cũ trước những endpoint xác thực này; actor là guest, rate limit và validation vẫn chạy.
- Không bỏ middleware toàn cục cho cả auth router; không bỏ kiểm tra JWT ở API protected. Public endpoint chỉ được allowlist sau khi xác nhận controller không dựa vào actor để cấp quyền.
- API protected tiếp tục kiểm tra chữ ký, issuer, expiry, tokenVersion, trạng thái account và quyền hiện hành; không nới JWT secret/TTL hay bỏ kiểm tra DB để chữa chậm.

## 3. Vòng đời phiên và giao diện

- Phân biệt refresh bị từ chối xác thực với lỗi mạng/timeout/5xx; hiện refreshSession trả null cho tất cả nên chưa đủ thông tin.
- Khi refresh bị từ chối xác thực: xóa phiên/storage và cache gắn với identity cũ, chuyển về trạng thái guest rõ ràng.
- Khi mạng/timeout/5xx: kết thúc trạng thái chờ có giới hạn, hiển thị thông báo có thể thử lại; không xóa phiên vĩnh viễn chỉ vì lỗi tạm thời, không coi token hết hạn là phiên đã xác thực.
- Request refresh/bootstrap bắt đầu trước login/logout/chuyển tài khoản không được ghi đè phiên mới; giữ guard identity/token, bổ sung session generation nếu cần.
- Đồng bộ cả sự kiện xóa storage khi logout ở tab khác. Không tự refresh vòng lặp hoặc redirect vòng lặp giữa login và trang staff.
- Nút đăng nhập không bị khóa chờ background bootstrap; ngăn submit kép. Lỗi token nội bộ không hiện như lỗi mật khẩu; dùng thông báo tiếng Việt phù hợp.

## 4. Đo và tối ưu tốc độ theo bằng chứng

1. Ghi waterfall: mở trang login → bootstrap refresh → POST login → nhận phiên → route moderator → dữ liệu đầu tiên. Tách cold start và warm request, môi trường dev và production build.
2. Thêm timing có request ID cho auth: lookup credentials, password verify, tạo phiên, kiểm tra lại user, lastLoginAt, memberships; tổng HTTP. Không log password, token/cookie, body hay SQL parameters chứa PII.
3. Đo nhiều lượt, báo median/p95 và số request/refresh thực tế. Không đưa mục tiêu mili giây tùy ý trước khi có baseline.
4. Loại request lặp do bootstrap/guard/memberships cùng khởi chạy. Chỉ song song hóa công việc độc lập sau khi rà soát transaction và race đăng xuất/thu hồi phiên; giữ kiểm tra bảo mật trước cấp phiên.
5. Nếu SQL thực sự chậm: kiểm tra query plan/index và connection pooling bằng kiểm tra read-only. Phân biệt thời gian mở kết nối/cold compute với thời gian chạy query. Không giảm độ mạnh hash mật khẩu.

## 5. Database

- Sửa token/header và vòng đời phiên không cần migration, reset password, xóa refresh token hàng loạt hay thay dữ liệu DB chung.
- Chưa có bằng chứng thiếu index hoặc schema gây chậm; không thêm index trước khi đo và kiểm tra index hiện có.
- Nếu đo xác nhận cần index: ghi rõ query, EXPLAIN, index đề xuất, tác động lock/storage và rollback; kiểm thử migration trên môi trường tách biệt trước. Áp dụng DB chung là bước riêng có xác nhận phạm vi, không chạy reset/db push để chữa lỗi login.

## 6. Kiểm thử và tiêu chí hoàn tất

- Login cá nhân/agency với token hết hạn/sai chữ ký/secret cũ vẫn tới validation credentials, không TOKEN_INVALID vì header cũ; test qua frontend và HTTP middleware thực.
- Sai mật khẩu không refresh; protected token lỗi vẫn 401, không được bỏ qua bởi allowlist gần giống URL hoặc sai HTTP method.
- API security/change-password/two-factor/application không bị mở quyền ngoài ý muốn.
- Protected request đồng thời chỉ một refresh; thử lại tối đa một lần. Refresh invalid, timeout, offline và 5xx có hành vi khác nhau, không treo spinner.
- Login trong lúc bootstrap đang chạy, chuyển account, logout và đồng bộ tab không phục hồi identity/token cũ; cache không lộ dữ liệu user trước.
- Kiểm tra moderator, super admin, traveler và agency; Google/OTP/remember-me/logout không hồi quy, không đổi policy role/status/tokenVersion.
- So sánh waterfall trước/sau: không thêm refresh vào POST login, không điều hướng vòng lặp, hiển thị đúng tài khoản và tải được màn hình moderator. Báo riêng độ trễ cold/warm và phần chưa đo được.
- Chạy unit/integration liên quan, typecheck; kiểm tra trình duyệt thực khi có phiên thử nghiệm được phép. Không dùng tài khoản thật để đo nhiều lần hoặc thay đổi DB chung ngầm.

## 7. Thứ tự triển khai

1. Ghi baseline độ trễ và thêm regression test cho token cũ.
2. Sửa phân loại public auth/header và middleware, giữ protected security boundary.
3. Sửa bootstrap/refresh lifecycle, race và thông báo lỗi.
4. Đo lại; tối ưu request/query chỉ khi số đo chứng minh cần.
5. Chốt kết quả kiểm thử, số đo và quyết định migration (mặc định: không cần).
