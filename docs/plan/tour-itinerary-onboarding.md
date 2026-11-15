# Lịch trình trong onboarding, vận hành lịch ở calendar

Trạng thái: đã triển khai ngày 15/11/2026. Tiếp nối `tour-content-review-before-scheduling.md`. Theo lựa chọn popup được người dùng cho phép, giữ onboarding 4 bước hiện tại và đặt nút “Soạn lịch trình” trong Thông tin chung thay vì thêm bước thứ 5.

## 1. Phạm vi đã rõ

- `itinerary`: chương trình ngày 1, ngày 2, nơi tham quan/hoạt động — nội dung Agency nhập và moderator xem khi duyệt tour.
- `departures`: ngày khởi hành thực tế, giá từng đợt, số chỗ, mở/đóng nhận khách — vận hành tại calendar hiện có.
- Đưa việc nhập/sửa itinerary vào cùng form thông tin tour. Bỏ khối Khởi hành & Giá vé và editor vận hành trùng chức năng khỏi trang **chi tiết quản lý tour Agency**, không phải trang traveler.
- Giữ lịch trình chỉ đọc ở chi tiết Agency và traveler; moderator thấy cùng dữ liệu đã lưu. Không xóa dữ liệu departures hoặc itinerary cũ.
- Không sửa code, API contract, quyền hay logic của calendar. Không thay booking, thanh toán, tồn chỗ hoặc giá snapshot. Giữ basePrice trong thông tin tour như giai đoạn 1.

## 2. Luồng đề xuất

Thông tin chung (tóm tắt + popup Lịch trình) → Hình ảnh → Giá & Dịch vụ → Chính sách → Lưu bản nháp / Lưu & gửi duyệt.

- Giữ thế giới giao diện hiện có theo impeccable/taste: popup hai vùng chọn ngày và soạn nội dung, chỉ render một mục đang chỉnh. Trên mobile danh sách ngày xếp hai cột, footer Áp dụng/Hủy luôn nằm trong tầm nhìn. Không duy trì editor lịch trình thứ hai tại workspace.
- Nhập ngay khi tạo tour; sau khi lưu vẫn sửa tại cùng editor. Nội dung lịch trình đi cùng payload nội dung trước khi gọi gửi duyệt.
- Bản nháp có thể chưa nhập/nhập thiếu ngày; những mục đã nhập phải hợp lệ. Không tự điền nội dung giả để đủ ngày.
- **Đã chốt và triển khai:** gửi duyệt cần lịch trình phủ đủ ngày 1 đến durationDays, không trùng hoặc bỏ trống ngày. Có thể gộp một khoảng ngày nếu chung chương trình. Đây là kiểm tra nội dung, không liên quan lịch khởi hành.

### Thiết kế bước Lịch trình

- Hiển thị thời lượng đã chọn và tiến độ “Đã có nội dung X/Y ngày”. Khoảng ngày gộp tính theo số ngày được phủ, không phải số dòng.
- Mỗi mục có: Ngày / Đến ngày (gộp tùy chọn), Tiêu đề, Nội dung. Danh sách hoạt động là tùy chọn, không bắt nhập thêm nếu phần mô tả đã đủ.
- Chỉ mở mục đang chỉnh, mục còn lại hiển thị ngày và tiêu đề. Mục mới tự mở; lỗi phải mở đúng mục và focus đúng trường.
- Thêm ngày tiếp theo hoặc gộp khoảng ngày; nút Xóa ở đầu mục. Không tạo sẵn hàng trăm form khi tour dài tới 365 ngày.
- Lưu bản nháp không bị chặn chỉ vì chưa phủ đủ ngày. Lưu & gửi duyệt đưa về bước Lịch trình nếu thiếu nội dung theo rule được chốt.
- Mobile xếp một cột, stepper không tràn; tab/focus/lỗi và cảnh báo rời trang dùng chung cơ chế hiện tại.
- Giảm durationDays không âm thầm xóa ngày đã nhập: chỉ rõ mục vượt thời lượng, cho chỉnh/gỡ trước khi lưu. Cho phép giảm thời lượng và sửa lịch trình hợp lệ trong cùng lần lưu.

## 3. Kết quả rà code và thay đổi kỹ thuật

### Frontend editor

- `AgencyTourEditorPage.tsx`: giữ 4 bước, thêm tóm tắt/popup ở Thông tin chung; lỗi itinerary dẫn về bước 1 và focus nút mở. Link sửa lịch trình mở đúng popup sau khi nạp xong dữ liệu.
- `types/tour.types.ts`: TourDetail có itinerary nhưng TourContentInput chưa có; bổ sung itinerary vào dữ liệu nhập.
- `utils/tourContent.ts`, serializeForm, isDirty, initialSnapshot: đưa itinerary vào mapping/so sánh, clone mảng và activities để không sửa nhầm dữ liệu query cache hoặc mất thay đổi lúc thoát.
- Tách component nhập itinerary dùng trong editor; tận dụng trường và validation từ workspace, không duy trì hai editor cùng chức năng.
- Giữ nguyên xử lý lưu thành công/gửi duyệt lỗi và chống tạo trùng của giai đoạn 1.
- Mapper dùng chung với chat/custom offer: kiểm tra mọi consumer trước khi thêm itinerary vào payload. Không vô tình thay nội dung private/custom tour ngoài luồng offer revision được phép.

### Backend lưu cùng nội dung

- `tours.validation.ts`: POST tạo tour strict hiện từ chối itinerary; PATCH đã nhận itinerary. Tái dùng schema ngày/khoảng ngày cho tạo, sửa và endpoint itinerary cũ.
- `tours.types.ts`: thêm itinerary vào content input. Repository đã hỗ trợ lưu JSON itinerary khi create/update; không cần thêm cột.
- Validate ngày, khoảng, tiêu đề, giới hạn độ dài và không chồng lấn tại server. So với durationDays hiệu lực, không chỉ check tại frontend.
- Tạo nội dung và itinerary trong cùng transaction tạo tour hiện có, không tạo tour rồi gọi API itinerary thứ hai. Bulk import dùng create schema: rà việc thiếu itinerary để không phá nhập bản nháp cũ.
- Khi PATCH cả durationDays và itinerary: validate **trạng thái sau cập nhật**. Code hiện check itinerary cũ trước khi xét itinerary mới, có thể từ chối sai trường hợp giảm số ngày và sửa nội dung cùng lần.
- Nếu chốt rule hoàn chỉnh: kiểm tra đủ ngày trong submitForReview, có mã lỗi/nội dung Việt rõ ràng và điều hướng đúng bước ở FE. Không thêm điều kiện departure, giá từng đợt hoặc capacity.
- Kiểm tra bảo vệ trùng draft 5 giây tại createTour: nếu trả về draft có sẵn, không được báo đã lưu trong khi itinerary mới bị bỏ. Phân biệt payload nội dung hoặc xử lý cập nhật draft đã biết một cách rõ ràng; không tự overwrite tour khác chỉ vì trùng tên/điểm đến.

### Trang chi tiết quản lý Agency

- Bỏ toàn bộ khối Khởi hành & Giá vé, nút mở editor availability và form chỉnh giá/chỗ tại trang này.
- Bỏ editor itinerary tại workspace. Giữ khối lịch trình chỉ đọc; “Sửa lịch trình” dẫn đến editor, chọn đúng bước Lịch trình, có kiểm tra quyền và khóa trạng thái.
- Có thể giữ một liên kết nhỏ tới `/agency/calendar` cho người có quyền vận hành, không render lại danh sách departures/giá vé trong trang chi tiết.
- Dọn state, hooks mutation availability/itinerary, validation, beforeunload, preview, CTA chuyển qua lại giữa hai editor không còn dùng; chỉ bỏ import phụ thuộc thực sự hết dùng, không xóa component/API dùng ở nơi khác.
- Rà link cũ `?edit=availability`/`?edit=itinerary`: chuyển sang calendar hoặc editor phù hợp từ workspace, không sửa route/calendar để phục vụ link cũ.

### Moderator, traveler, quyền và tour cũ

- Moderator hiện đã render itinerary khi có dữ liệu. Rà thứ tự ngày/khoảng, mô tả và hoạt động để moderator thấy đầy đủ nội dung, không chỉ tiêu đề. Traveler và Agency đọc cùng dữ liệu, sắp đúng thứ tự.
- Tour đang chờ duyệt khóa nội dung như hiện tại; không cho chỉnh itinerary qua URL hoặc API để thay nội dung dưới phiên duyệt.
- Owner/Manager và Staff được phân quyền theo policy hiện hữu. Rà riêng `tour:configure-itinerary` và `tour:update-own`; việc gộp form không được làm Staff mất quyền đang có hoặc mở rộng quyền sửa giá/chính sách.
- Tour cũ thiếu itinerary mở editor với trạng thái rỗng; chưa thêm mục thì không tự lưu đè itinerary hoặc các trường khác. Draft/import cũ vẫn lưu được.
- Nếu chốt yêu cầu đủ ngày tại submit: áp dụng cho lần gửi/gửi lại sau rollout. Tour đã APPROVED/PENDING_REVIEW không bị tự đổi trạng thái hoặc tự từ chối vì rule mới. Moderator có thể thấy cảnh báo thiếu dữ liệu ở tour đang chờ từ trước.
- Hiện sửa APPROVED giữ APPROVED. Tác vụ này không tự đổi thành cơ chế duyệt lại/version nội dung; muốn moderator kiểm soát mọi lần sửa sau duyệt phải tách quyết định nghiệp vụ riêng.

## 4. Thứ tự triển khai

1. Chốt mức bắt buộc itinerary khi gửi duyệt; giữ nháp linh hoạt và scheduling độc lập.
2. Đồng bộ DTO/schema/validation server và lưu itinerary cùng content; kiểm tra import, anti-duplicate và PATCH giảm duration.
3. Tách component itinerary, đưa vào onboarding tạo/sửa, mapping bước và unsaved state. Kiểm tra payload lưu trước gửi duyệt.
4. Thay workspace bằng view chỉ đọc; bỏ UI availability và xử lý link cũ tại workspace, không đổi calendar.
5. Kiểm tra moderator/traveler và policy từng vai trò, sau đó chạy test và kiểm tra trực quan desktop/mobile.

## 5. Tiêu chí nghiệm thu

- Tạo tour có lịch trình → lưu một lần → reload còn nguyên → gửi duyệt → moderator thấy đủ mô tả/hoạt động/ngày gộp → traveler hiển thị đúng sau duyệt.
- Chưa có bất kỳ departure nào vẫn gửi duyệt được khi nội dung hợp lệ.
- Thiếu ngày/ngoài thời lượng/trùng ngày/tiêu đề sai: nhắc đúng mục; bản nháp thiếu ngày khác với dữ liệu ngày không hợp lệ.
- Thêm, sửa, xóa, gộp ngày; tăng/giảm duration; hủy/thoát; lưu lỗi; gửi duyệt lỗi rồi retry không mất hoặc tạo trùng dữ liệu.
- Tour một ngày, tour nhiều ngày và 365 ngày không tạo form quá lớn; kiểm tra bàn phím, desktop/mobile.
- Trang chi tiết Agency không còn khối, nút hoặc editor Khởi hành & Giá vé; vẫn có lịch trình và dịch vụ bổ sung đã lưu.
- Quyền Staff/Manager/Owner, PENDING_REVIEW lock, tour cũ/import và private/custom tour không bị mở quyền hoặc phá luồng hiện tại.
- Calendar tiếp tục xếp lịch/chỉnh giá nguyên trạng; booking thường vẫn cần departure hợp lệ và còn chỗ.
- Không migration hoặc ghi DB chung cho thay đổi UI/JSON hiện có; không xóa dữ liệu chuyến đã tạo.

## 6. Ghi nhận triển khai

- `TourItineraryField` giữ bản nháp riêng, Áp dụng/Hủy, khóa cuộn trang nền, giữ focus trong popup, khôi phục focus, cảnh báo đóng trình duyệt khi chưa áp dụng; sự kiện bàn phím/submit không lọt vào form bên ngoài.
- Lịch trình được gửi cùng POST/PATCH nội dung. Chỉ editor Agency opt-in mapping itinerary; mapper mặc định của chat/custom offer không tự thêm trường này vào luồng thương lượng.
- Kiểm tra chung FE/BE cho bản nháp hợp lệ và lịch trình hoàn chỉnh khi gửi duyệt. Giảm thời lượng cùng sửa chương trình được kiểm tra theo dữ liệu sau cập nhật. Bảo vệ draft gần nhất so sánh cả nội dung lịch trình, không trả nhầm chương trình khác.
- Workspace chỉ đọc nội dung/lịch trình/dịch vụ, không còn editor availability hoặc itinerary. Link cũ được chuyển tới calendar/editor hiện hữu.
- Moderator hiển thị tiêu đề, mô tả và hoạt động theo thứ tự ngày. Tour cũ đang chờ duyệt/đã duyệt không bị tự thay trạng thái.
- Đã xem ảnh render của component trên desktop 1440×900 và mobile 390×844; ảnh là fixture từ DOM component và CSS ứng dụng, không phải phiên thao tác đăng nhập end-to-end. Artifact tại `.test-artifacts/tour-itinerary/` (ignored).
- Không thay code calendar, schema, migration hoặc dữ liệu DB chung. Các thay đổi calendar có sẵn trong working tree được giữ nguyên.
- Xác minh: 820 unit test backend qua; 198 test frontend liên quan qua (tour/editor/workspace/moderator/custom tour); 18 integration test tour và HTTP error contract qua trên PostgreSQL tạm. Typecheck FE/BE và diff whitespace qua. Security source-scan được sửa nhận đúng `.max(20)` hiện có bằng cách ghép dòng khai báo schema dịch vụ, không đổi giới hạn hay hành vi.
- Taste gate trên fixture popup: `GATE: FAIL 8` (vòng 2/3). Đã sửa các lỗi thực sự về cắt chữ mobile, độ tương phản và kiểu nút. Còn 7 finding thuộc quy tắc trang giới thiệu (h1, hero, moment, section-height, container-edges, wrap), không áp dụng việc thêm hero/moment vào popup ứng dụng; 1 finding focus-hidden do file HTML fixture không chạy React focus trap/auto-focus. Kiểm tra hành vi focus/Tab/Escape thực hiện bằng component test, không coi gate này là PASS hoặc bằng chứng end-to-end.
