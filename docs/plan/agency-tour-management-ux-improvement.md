# Kế hoạch cải thiện flow tạo và quản lý tour

> Cập nhật theo code hiện tại ngày 13/11/2026. Phần **11. Đối chiếu với code hiện tại** dưới đây là nguồn tham chiếu khi các mô tả khái quát phía trên khác với hành vi đang được triển khai.

## 1. Mục tiêu

Người dùng mở một tour từ danh sách để xem được toàn bộ thông tin trước khi quyết định sửa. Khi cần chỉnh sửa, họ nhận biết rõ phần nào có thể sửa, đi đến đúng phần đó và luôn biết vì sao một thao tác không thể hoàn thành. Flow tạo tour và flow quản lý tour dùng cùng cách trình bày, trạng thái và phản hồi.

Kế hoạch này tập trung vào web dành cho đại lý. Giữ hệ thống màu và thành phần giao diện hiện có; thay đổi cấu trúc tương tác và cách phân cấp thông tin.

## 2. Vấn đề hiện tại

- Chọn một tour từ danh sách mở workspace có biểu mẫu lịch trình và khởi hành. Người dùng kỳ vọng xem chi tiết toàn bộ tour nhưng lại gặp giao diện mang dáng dấp chỉnh sửa.
- Lịch trình có ô nhập và nút **Thêm ngày** nhưng chúng có thể bị khóa do trạng thái tour. Lý do không đủ rõ ngay tại nơi người dùng thao tác.
- Nút **Chỉnh sửa nội dung** mở phần sửa thông tin chung, trong khi người dùng có thể hiểu rằng nó bao gồm cả lịch trình.
- Phần **Khởi hành & Giá vé** lặp nhiều card. Viền bao quanh card, viền trường nhập và các đường phân cách tạo cảm giác dày, khó quét nhanh.
- Lỗi kiểm tra dữ liệu và lỗi từ máy chủ chưa có một quy tắc phản hồi thống nhất giữa tạo tour, sửa nội dung, lịch trình và khởi hành. Một số lỗi chỉ nằm trên trang; người dùng có thể không thấy vì đang ở vị trí khác.

## 3. Cấu trúc flow đích

```text
Danh sách tour
  └─ Chọn tour → Chi tiết tour (chế độ xem)
       ├─ Sửa nội dung tour → Biểu mẫu thông tin chung, ảnh, giá và dịch vụ, chính sách
       ├─ Sửa lịch trình → Biểu mẫu các ngày trong lịch trình
       └─ Quản lý khởi hành & giá vé → Danh sách card ngày khởi hành

Tạo tour
  └─ Nhập thông tin tour → Thiết lập lịch trình → Thiết lập khởi hành & giá vé
       └─ Xem lại toàn bộ tour trước khi gửi duyệt
```

Các bước sau khi tạo có thể tiếp tục dùng cùng workspace hoặc thành phần biểu mẫu hiện có. Điều quan trọng là chế độ **xem** và chế độ **sửa** phải khác nhau rõ ràng; không hiển thị ô nhập bất hoạt như nội dung chi tiết.

## 4. Phạm vi thiết kế và hành vi

### 4.1. Danh sách và trang chi tiết tour

- Nhấn vào card hoặc tên tour trong danh sách mở **Chi tiết tour** ở chế độ xem. Hành động sửa bằng biểu tượng bút vẫn đi trực tiếp đến phần sửa nội dung tương ứng.
- Trang chi tiết hiển thị ít nhất: tên, điểm đến, thời lượng, ảnh, mô tả, giá cơ bản, dịch vụ/chính sách, lịch trình từng ngày, các ngày khởi hành với giá và sức chứa, trạng thái tour.
- Dữ liệu thiếu được hiển thị bằng trạng thái trống cụ thể như “Chưa có lịch trình” hoặc “Chưa có ngày khởi hành”, kèm thao tác bổ sung khi người dùng có quyền.
- Có nút quay về danh sách; sau khi lưu ở màn sửa, quay lại chi tiết và thấy dữ liệu mới.
- Đổi nhãn **Chỉnh sửa nội dung** thành **Sửa nội dung tour**. Đặt **Sửa lịch trình** ở phần lịch trình và **Quản lý khởi hành & giá vé** ở phần khởi hành. Các nút này dẫn đến đúng phần, không bắt người dùng tự tìm qua stepper.
- Trên màn nhỏ, các phần chi tiết xếp theo thứ tự đọc tự nhiên; các thao tác sửa nằm gần tiêu đề phần và không che nội dung.

### 4.2. Chế độ sửa lịch trình

- Khi được phép sửa, tiêu đề ngày, mô tả và các thao tác thêm/xóa ngày hoạt động trong một biểu mẫu rõ ràng, có nút lưu riêng.
- Giữ quy tắc ngày hoặc khoảng ngày không vượt quá `durationDays`, không trùng nhau. Nếu toàn bộ thời lượng đã được phủ, nút **Thêm ngày** bất hoạt và có lý do ngắn ngay cạnh hoặc trong trợ giúp của nút: “Đã đủ số ngày của tour”.
- Nếu tour đang chờ duyệt hoặc đã lưu trữ, phần chi tiết vẫn đọc được; hành động sửa bị khóa với lý do theo trạng thái. Không trình bày các ô nhập bị khóa như một biểu mẫu có thể thao tác.
- Nếu người dùng thiếu quyền, ẩn thao tác không được phép hoặc hiển thị trạng thái không khả dụng có lý do rõ ràng, nhất quán với quy tắc phân quyền hiện có.
- Nút lưu chỉ hoạt động khi có thay đổi hợp lệ. Trước khi rời màn có dữ liệu chưa lưu, cảnh báo để người dùng quyết định ở lại hoặc bỏ thay đổi.

### 4.3. Card khởi hành & giá vé

- Mỗi ngày khởi hành là một card nền trắng, nổi nhẹ trên nền trang bằng bóng đổ mềm. Tăng khoảng cách giữa các card để mắt nhận biết từng ngày là một đơn vị riêng.
- Giảm viền quanh card và các đường phân cách bên trong. Dùng khoảng trắng, căn hàng và độ đậm chữ để nhóm **ngày khởi hành**, **số lượng khách**, **giá riêng**, **trạng thái nhận khách**, **đã bán** và **gỡ ngày**. Chỉ giữ viền cần thiết cho ô nhập và trạng thái focus.
- Giữ nội dung card ngắn và dễ quét; không thêm đoạn giải thích dài phía trên danh sách. Trên màn hẹp, các trường xuống hàng hợp lý, không nén chữ hay để hành động nguy hiểm sát công tắc mở bán.
- Card có khách đã đặt hiển thị cảnh báo ngắn ngay trong card. Các trường bị khóa do đã bán vé thể hiện rõ bằng trạng thái và lý do; các thao tác còn hợp lệ vẫn hoạt động.
- Card chưa lưu, đang lưu, lưu thành công và lỗi có phản hồi nhất quán. Không xóa dữ liệu người dùng đã nhập khi lưu thất bại.
- Áp dụng cùng ngôn ngữ thị giác card, trường nhập, khoảng cách, nút và trạng thái cho bước thiết lập khởi hành trong flow tạo tour và cho phần quản lý sau khi tour được tạo.

### 4.4. Đồng bộ flow tạo tour

- Các biểu mẫu trong flow tạo dùng cùng nhãn, kiểu card, trạng thái khóa, quy tắc kiểm tra và toast với flow sửa. Không để cùng một lỗi có hai cách diễn đạt khác nhau.
- Bước thông tin cơ bản vẫn giữ cấu trúc nhập hiện có; sau khi lưu thành công, dẫn người dùng tiếp tục thiết lập lịch trình và khởi hành với dấu hiệu tiến độ rõ ràng.
- Trong quá trình tạo, các bước chưa hoàn thành nêu phần cần bổ sung tại chính bước đó. Khi bấm **Lưu**, **Tiếp tục** hoặc **Gửi duyệt**, lỗi phải đưa người dùng đến đúng bước/trường cần sửa.
- Có bước xem lại hoặc lối vào trang chi tiết để người dùng đọc toàn bộ tour trước khi gửi duyệt. Bản xem lại dùng nội dung trình bày, không dùng các ô nhập bất hoạt.
- Sau khi tạo thành công, điều hướng và thông báo phải nói rõ tour đang là bản nháp hay đã được gửi duyệt.

## 5. Quy tắc thông báo và xử lý lỗi

### 5.1. Cấu trúc phản hồi

- **Lỗi tại trường:** đánh dấu trường, viết nguyên nhân ngắn ngay dưới trường; chuyển đến đúng bước và cuộn/focus tới trường đầu tiên có lỗi.
- **Toast lỗi:** xuất hiện khi thao tác lưu, thêm, xóa, chuyển bước hoặc gửi duyệt thất bại. Nội dung gồm thao tác không hoàn thành, nguyên nhân cụ thể và cách sửa nếu có. Ví dụ: “Chưa lưu lịch trình: Ngày 3 vượt quá thời lượng tour. Hãy chỉnh lại số ngày.”
- **Lỗi toàn cục:** lỗi mạng, quyền hoặc máy chủ có toast kèm hành động thử lại phù hợp. Không thay lỗi có nguyên nhân cụ thể bằng câu chung “Có lỗi xảy ra”.
- **Toast thành công:** xác nhận ngắn thao tác đã hoàn thành. Không hiển thị nhiều toast trùng cho cùng một lần lưu.
- Toast không thay thế lỗi tại trường; cả hai phối hợp để người dùng nhận ra lỗi và tìm đúng nơi sửa. Thông báo quan trọng cũng phải truy cập được bằng trình đọc màn hình.

### 5.2. Các trường hợp bắt buộc

| Tình huống | Phản hồi mong đợi |
|---|---|
| Thiếu trường bắt buộc hoặc sai định dạng khi tạo/sửa tour | Toast nêu chưa lưu được, chuyển đến bước liên quan, lỗi xuất hiện cạnh trường. |
| Ngày lịch trình vượt thời lượng hoặc trùng khoảng ngày | Toast nêu ngày/khoảng ngày xung đột; đánh dấu mục cần sửa. |
| Chưa có ngày khởi hành mở bán khi gửi duyệt | Toast nêu điều kiện chưa đạt, chuyển đến phần khởi hành. |
| Ngày khởi hành mới không hợp lệ hoặc giá ngoài giới hạn | Toast nêu nguyên nhân; giữ nguyên dữ liệu đã nhập trên card. |
| Ngày đã có khách đặt nên không thể đổi hoặc gỡ | Chặn thao tác, nêu lý do ngay trên card và bằng toast nếu người dùng vẫn kích hoạt thao tác. |
| Tour đang chờ duyệt, lưu trữ hoặc người dùng thiếu quyền | Hành động khóa/ẩn nhất quán; nếu người dùng truy cập trực tiếp, thông báo rõ lý do. |
| Mất mạng hoặc máy chủ từ chối lưu | Toast nêu không lưu được và cho thử lại; giữ toàn bộ dữ liệu chưa lưu. |
| Rời màn khi có thay đổi chưa lưu | Hộp xác nhận nêu thay đổi sẽ bị mất; cho ở lại hoặc rời đi. |

Thông điệp lỗi từ API cần được ánh xạ sang tiếng Việt dễ hiểu theo mã lỗi; tránh hiển thị mã nội bộ hoặc thông báo kỹ thuật cho người dùng. Nếu API chưa cung cấp nguyên nhân đủ cụ thể, bổ sung mã lỗi/chi tiết có cấu trúc ở backend rồi ánh xạ ở frontend.

## 6. Ràng buộc nghiệp vụ cần giữ

- Không vượt thời lượng tour hoặc tạo các khoảng lịch trình chồng nhau.
- Tôn trọng trạng thái tour: bản nháp, chờ duyệt, đã duyệt, cần chỉnh sửa, tạm ẩn, lưu trữ; quyền sửa từng phần theo chính sách hiện hành.
- Không cho đổi ngày hoặc gỡ ngày khởi hành đã có khách đặt; cho phép các thao tác bán hàng còn hợp lệ theo quy tắc hiện hành.
- Giá, sức chứa và nhóm khách tuân thủ kiểm tra hiện có ở frontend và backend. Frontend hỗ trợ phát hiện sớm, backend vẫn là nguồn quyết định cuối cùng.
- Không thay đổi dữ liệu đã lưu chỉ vì người dùng mở trang chi tiết hoặc chuyển giữa các phần.

### 6.1. Role được phép thực hiện từng tác vụ

Ma trận dưới đây bám theo `AGENCY_ROLE_PERMISSIONS`, các guard trong route tour và giới hạn trường sửa của nhân viên hiện tại. Quyền luôn được kiểm tra ở backend; frontend dùng cùng ma trận để hiện đúng thao tác và thông báo khi không có quyền.

| Tác vụ | Chủ đại lý (Owner) | Quản lý (Manager) | Nhân viên (Staff) | Kế toán (Accountant) |
|---|:---:|:---:|:---:|:---:|
| Xem danh sách và chi tiết tour của đại lý | ✓ | ✓ | ✓ | — |
| Tạo tour mới | ✓ | ✓ | — | — |
| Sửa thông tin chung, giá, dịch vụ và chính sách | ✓ | ✓ | — | — |
| Sửa **nội dung** tour hiện có: tên, mô tả, ảnh, điểm nổi bật, dịch vụ bao gồm/không bao gồm | ✓ | ✓ | ✓ | — |
| Sửa lịch trình tour hiện có | ✓ | ✓ | ✓ | — |
| Thêm/sửa/gỡ ngày khởi hành, giá theo ngày, sức chứa và trạng thái nhận khách | ✓ | ✓ | — | — |
| Gửi tour để kiểm duyệt | ✓ | ✓ | — | — |
| Lưu trữ hoặc khôi phục tour | ✓ | ✓ | — | — |

Lưu ý triển khai: quyền sửa của Staff chỉ áp dụng cho tour **đã tồn tại**, không mở quyền tạo tour. Trường `itinerary` có thể nằm trong bản cập nhật nội dung, nhưng thao tác sửa lịch trình riêng dùng quyền `tour:configure-itinerary`; cả hai đều cho Staff theo chính sách hiện tại. Việc hiển thị nút **Sửa nội dung tour** cho Staff phải dẫn đến đúng các trường họ được phép sửa; các trường còn lại nên hiển thị ở chế độ đọc hoặc không nằm trong biểu mẫu của họ.

Trạng thái tour tiếp tục giới hạn quyền: chờ duyệt và lưu trữ có thể khóa chỉnh sửa dù role có quyền nền. Ngày khởi hành đã có khách đặt có giới hạn riêng, áp dụng cho cả Owner và Manager. Toast cần phân biệt rõ **thiếu quyền theo role**, **bị khóa theo trạng thái tour** và **bị khóa vì đã có khách đặt**.

## 7. Phạm vi code dự kiến

- `frontend/features/tours/components/AgencyTourListPage.tsx`: điều hướng và nhãn thao tác ở hai kiểu hiển thị danh sách.
- `frontend/features/tours/components/AgencyTourWorkspacePage.tsx`: cấu trúc trang xem/sửa lịch trình và khởi hành, trạng thái khóa, card khởi hành, toast và quản lý dữ liệu chưa lưu.
- `frontend/features/tours/components/AgencyTourEditorPage.tsx`: đồng bộ flow tạo/sửa nội dung, kiểm tra dữ liệu, thông báo và điều hướng đến bước cần sửa.
- `frontend/features/tours/components/AgencyTourStepper.tsx` và `AgencyTourLivePreview.tsx`: điều chỉnh nếu cần để thể hiện tiến độ và bản xem lại một cách nhất quán.
- `frontend/features/tours/components/tourEditorValidation.ts`, `frontend/features/tours/api/toursApi.ts`, `frontend/features/agency/agencyNotice.ts`: dùng chung ánh xạ lỗi và cơ chế thông báo khi phù hợp.
- `backend/src/modules/tours/`: chỉ thay đổi nếu mã lỗi hiện có không đủ để frontend giải thích chính xác lý do thất bại.

## 8. Thứ tự triển khai

1. **Chốt luồng xem và sửa:** kiểm tra quyền và trạng thái tour, dựng chế độ chi tiết đầy đủ, sửa đường dẫn từ danh sách và đặt các thao tác sửa đúng phần.
2. **Sửa lịch trình:** tách chế độ xem khỏi biểu mẫu sửa; hoàn thiện thêm/xóa/lưu, kiểm tra thời lượng, trạng thái khóa và dữ liệu chưa lưu.
3. **Tinh chỉnh card khởi hành:** nền, bóng đổ, khoảng cách, giảm viền; hoàn thiện layout trên desktop và mobile, trạng thái đã bán và thao tác nguy hiểm.
4. **Đồng bộ tạo tour:** áp dụng cùng thành phần và quy tắc trình bày, tiến độ, bản xem lại và điều hướng.
5. **Chuẩn hóa lỗi và toast:** lập bảng mã lỗi, nội dung tiếng Việt, vị trí focus và hành vi thử lại; bổ sung thông tin backend nếu thiếu.
6. **Kiểm tra toàn flow:** tạo mới, xem chi tiết, sửa từng phần, gửi duyệt, trạng thái khóa, quyền hạn và lỗi từ API.

## 9. Tiêu chí nghiệm thu

- Từ danh sách, chọn một tour sẽ mở màn chi tiết đọc được toàn bộ thông tin mà không phải vào chế độ sửa.
- Người dùng tìm được đường sửa nội dung, lịch trình và khởi hành ngay tại phần tương ứng; mỗi đường dẫn đến đúng biểu mẫu.
- Lịch trình chỉ có ô nhập và nút thêm/xóa trong chế độ được phép sửa. Khi bị khóa, lý do hiển thị rõ.
- Các ngày khởi hành là các card nổi, tách biệt bằng khoảng trắng; không có nhiều lớp viền gây rối. Giá, sức chứa và trạng thái bán vẫn đọc được nhanh trên desktop và mobile.
- Flow tạo tour và quản lý tour dùng cùng quy tắc giao diện, kiểm tra dữ liệu và thông báo.
- Mỗi thao tác thất bại nêu được lý do cụ thể nếu hệ thống có dữ liệu về lý do đó, đưa người dùng đến đúng nơi sửa và giữ dữ liệu chưa lưu.
- Nút lưu phản ánh thay đổi thực tế; lưu thành công hiện dữ liệu mới ở trang chi tiết, không phát nhiều thông báo trùng.
- Các trạng thái bản nháp, chờ duyệt, đã duyệt, lưu trữ, thiếu quyền, có khách đặt, mất mạng và lỗi máy chủ được kiểm tra cả trên giao diện lẫn luồng API liên quan.

## 10. Kiểm chứng

- Kiểm tra thủ công và tự động các đường đi chính: tạo → thiết lập lịch trình → thêm khởi hành → xem lại → gửi duyệt; danh sách → chi tiết → sửa → lưu → quay lại chi tiết.
- Kiểm tra lỗi nhập liệu, lỗi API, khóa theo trạng thái/quyền và dữ liệu chưa lưu; xác nhận toast, lỗi tại trường và vị trí focus đúng.
- So sánh giao diện card khởi hành ở desktop và mobile, gồm card thường, card đã có khách đặt, card đang lưu và card lỗi.
- Chạy các bài kiểm tra frontend/backend liên quan sau khi triển khai; không coi riêng ảnh chụp màn hình là đủ để xác nhận hành vi.

## 11. Đối chiếu với code hiện tại để triển khai đồng bộ

### 11.1. Route, dữ liệu và thứ tự tạo tour thực tế

| Route hiện có | Thành phần | Vai trò trong flow sau khi cải thiện |
|---|---|---|
| `/agency/tours` | `AgencyTourListPage` | Danh sách; card/tên dẫn đến chi tiết; nút sửa dẫn đến editor. |
| `/agency/tours/new` | `AgencyTourEditorPage` (`create`) | Form **4 bước**: Thông tin chung → Hình ảnh tour → Giá & Dịch vụ → Chính sách. Tạo thành công gọi `router.replace('/agency/tours/{id}')`. |
| `/agency/tours/[id]` | `AgencyTourWorkspacePage` | Hiện là workspace **2 bước**: Lịch trình → Khởi hành & Giá vé. Chuyển thành trang chi tiết đọc được đầy đủ, có lối vào hai biểu mẫu này. |
| `/agency/tours/[id]/edit` | `AgencyTourEditorPage` (`edit`) | Sửa nội dung tour. Tham số `from` đang dùng để quay về trang đã mở editor. |

- Không giả định form tạo tour đã có card ngày khởi hành. Card hiện nằm trong `AgencyTourWorkspacePage`, sau khi tour được tạo. Đồng bộ flow tạo bằng cách dẫn người dùng từ form 4 bước đến phần thiết lập lịch trình/khởi hành của tour mới, dùng **chính cùng thành phần card và quy tắc thông báo**, tránh làm thêm một bản card độc lập trong editor.
- `AgencyTourEditorPage` đã có kiểm tra trường, chuyển đến bước và focus trường lỗi, cảnh báo khi rời form chưa lưu, modal xác nhận lưu/tạo, và `AgencyTourLivePreview`. Giữ và mở rộng các cơ chế này; không tạo thêm modal hoặc bản preview trùng chức năng. Bản preview hiện tại chỉ là bản xem trước trong editor, chưa thay được trang chi tiết đầy đủ.
- `AgencyTourWorkspacePage` đã có `days`/`departures` local state, cờ dirty, snapshot dữ liệu, polling và cập nhật RTK Query cache sau khi lưu. Khi tách chế độ xem/sửa, giữ nguyên nguyên tắc không ghi đè bản nháp đang sửa bằng kết quả polling. Bổ sung cảnh báo rời workspace khi lịch trình hoặc khởi hành còn thay đổi chưa lưu, tương tự editor.
- Dùng các mutation hiện có: `POST /agency/tours`, `PATCH /agency/tours/:id`, `PUT /agency/tours/:id/itinerary`, `PUT /agency/tours/:id/availability`, `POST /agency/tours/:id/submit`. Chỉ thêm route/API nếu một yêu cầu không thể đáp ứng bằng những endpoint này.

### 11.2. Quyền và trạng thái theo code hiện tại

- `OWNER` và `MANAGER` có đủ quyền tạo, sửa nội dung/lịch trình, quản lý khởi hành, gửi duyệt, lưu trữ/khôi phục. `STAFF` có `tour:update-own` và `tour:configure-itinerary`; chỉ sửa tour đã tồn tại, và `PATCH` chỉ nhận `title`, `description`, `images`, `highlights`, `itinerary`, `inclusions`, `exclusions`. `ACCOUNTANT` không có quyền truy cập module tour.
- Route xem tour dùng `tour:update-own`, còn route sửa lịch trình dùng `tour:configure-itinerary`. Vì vậy UI phải kiểm tra **quyền sửa lịch trình riêng**, dù hiện tại ma trận role cùng cấp quyền đó cho Owner, Manager và Staff. Không dùng duy nhất `canView` để quyết định quyền sửa.
- Form tạo tour hiện chưa được ràng buộc rõ bằng `tour:create` tại nút **Tạo tour** trong `AgencyTourListPage`; khi triển khai phải ẩn/khóa nút này cho Staff để khớp route backend. Kiểm tra cả truy cập trực tiếp `/agency/tours/new`.
- `PENDING_REVIEW` và `ARCHIVED` khóa sửa nội dung/lịch trình. **`APPROVED` không bị khóa**: `applyContentChange` hiện giữ trạng thái `APPROVED` sau khi sửa nội dung hoặc lịch trình, không tự đưa tour về chờ duyệt. UI/toast và tiêu chí kiểm thử phải phản ánh đúng quy tắc này.
- Thay đổi khởi hành được phép khi `PENDING_REVIEW` nếu có quyền `tour:set-availability`; `ARCHIVED` không cho sửa. Không dùng chung cờ `locked` của nội dung/lịch trình để khóa khởi hành.
- `guardTourManagement` chặn Staff gửi duyệt và khôi phục; `tour:delete-own` giới hạn lưu trữ cho Owner/Manager. Tour private thuộc yêu cầu đặt tour nhóm được quản lý ở flow riêng và có thể bị backend từ chối bằng `TOUR_PRIVATE_MANAGED_BY_CUSTOM_TOUR`.
- Có khách đã đặt: backend chặn đổi/gỡ ngày, chặn hạ sức chứa thấp hơn số đã bán, nhưng vẫn cho cập nhật các trường còn hợp lệ như mở/đóng nhận khách. Chỉ khóa đúng trường/hành động bị cấm.

### 11.3. Các điểm lệch cần xử lý trong lần triển khai

1. `AgencyTourWorkspacePage` hiện hiển thị trực tiếp input lịch trình và khởi hành sau khi mở tour; thay vùng chi tiết mặc định bằng nội dung đọc, rồi mở biểu mẫu khi người dùng chọn thao tác sửa. Giữ URL `/agency/tours/[id]` để các liên kết hiện có từ danh sách, booking và dashboard không gãy.
2. `AgencyTourWorkspacePage` dùng `canView = tour:update-own` và `canManageAvailability = tour:set-availability`, nhưng chưa kiểm tra `tour:configure-itinerary` riêng cho nút sửa lịch trình. Thêm kiểm tra này khi tách chế độ.
3. `AgencyTourListPage` hiển thị nút **Tạo tour** ở cả header và empty state; đồng bộ cả hai với quyền `tour:create`. Hai kiểu list và grid đều cần cùng đường dẫn/nhãn sửa.
4. `AgencyTourEditorPage` có lỗi tại trường và `pageError`, còn workspace có `errorText` và `agencyNotice`; `getTourApiMessage` mới dịch một số lỗi. Chọn một quy tắc hiển thị toast cho các thao tác thất bại, tái dùng lỗi tại trường và chuyển bước đã có. Bổ sung ánh xạ cho `TOUR_LOCKED`, `ITINERARY_EXCEEDS_DURATION`, `DEPARTURE_HAS_BOOKINGS`, `CAPACITY_BELOW_BOOKED`, `TOUR_HAS_BOOKINGS`, `CONCURRENT_UPDATE` và quyền Staff nếu response có mã tương ứng. Không hiện raw English từ API.
5. Workspace hiện có `itineraryDirty` và `availabilityDirty` để bảo vệ bản nhập khỏi polling, nhưng nút lưu chưa dựa vào so sánh snapshot và chưa có cảnh báo rời trang. Dùng trạng thái dirty thực tế cho nút lưu và cảnh báo điều hướng; reset snapshot sau khi lưu thành công.
6. Card khởi hành hiện là `fieldset` viền slate trên nền slate, đặt trong một section cũng có viền. Giảm lớp viền ở cả card lẫn section; dùng nền trang và bóng card để tạo độ nổi theo ảnh tham chiếu. Giữ viền focus và viền trường nhập, trạng thái cảnh báo có khách đặt, dropdown nhóm khách và công tắc mở bán.
7. `AgencyTourEditorPage` đã có modal xác nhận tạo/sửa và preview. Tránh thêm một bước xem lại làm đứt flow hiện có; trước tiên nâng cấp trang `/agency/tours/[id]` thành trang chi tiết đầy đủ để sau khi tạo người dùng xem lại, thiết lập lịch trình/khởi hành và gửi duyệt. Nếu cần xem lại trước **lần lưu đầu tiên**, dùng preview hiện có và nêu rõ rằng lịch trình/khởi hành chỉ thiết lập sau khi tạo tour.

### 11.4. Thứ tự bàn giao kỹ thuật

1. Chuẩn hóa quyền UI và ánh xạ lỗi dùng chung; xác nhận các mã lỗi thực tế từ API và trạng thái `APPROVED`.
2. Tách trang `/agency/tours/[id]` thành chế độ xem chi tiết và các vùng sửa có chủ đích; bảo toàn state, polling và RTK Query cache hiện tại.
3. Tinh chỉnh một thành phần card khởi hành dùng trong giai đoạn thiết lập sau tạo và giai đoạn quản lý; đồng bộ responsive, trạng thái đã bán và cảnh báo rời trang.
4. Cập nhật editor 4 bước để nối flow tạo sang trang chi tiết/thiết lập, dùng cùng toast, lỗi tại trường và nhãn hành động.
5. Cập nhật test hiện có ở `frontend/features/agency/__tests__/agency-tour-editor.test.tsx` và `frontend/features/agency/__tests__/agency-screens.test.tsx`; bổ sung kiểm thử riêng cho danh sách tour đại lý nếu chưa có. Kiểm tra role và trạng thái ở backend tour khi có thay đổi API/quy tắc.

Điều kiện đồng bộ khi bàn giao: một thay đổi nghiệp vụ ở quyền, trạng thái hoặc điều kiện lưu phải được phản ánh đồng thời ở backend, ánh xạ lỗi frontend, trạng thái thao tác trên UI và bài kiểm thử tương ứng.
