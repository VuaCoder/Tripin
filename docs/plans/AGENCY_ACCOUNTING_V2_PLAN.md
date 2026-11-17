# Kế hoạch kế toán vận hành V2: tự động quyết toán và rút tiền Agency

Ngày: 17/11/2026, Asia/Ho_Chi_Minh. Trạng thái: đã triển khai. Cập nhật mới nhất: bỏ chỉnh chính sách; áp dụng cố định 7 ngày giữ tiền, rút tối thiểu 100.000đ, tối đa 500 triệu/lần và 1 tỷ/ngày. Nội dung kế hoạch cấu hình bên dưới là thiết kế cũ, đã được thay bằng quy tắc cố định.

## Tiến độ triển khai 17/11/2026

Đã bổ sung migration ví/quyết toán, phân loại LIVE/TEST/UNKNOWN, job tự động, chính sách có phiên bản, số dư có thể rút, yêu cầu rút và quy trình Admin ghi nhận chuyển khoản ngoài hệ thống. Dashboard Admin có biểu đồ, công việc cần xử lý, danh sách Agency có avatar/tìm kiếm/phân trang, trang chi tiết và xuất Excel/PDF. Hoàn tiền kế toán tiếp tục chưa phát triển.

Migration `20261117000400_agency_wallet_settlement` đã áp dụng lên database cấu hình; không tự bật chính sách và không chuyển dữ liệu mô phỏng thành số dư thật. Chưa thực hiện chuyển khoản ngân hàng thật. Hướng dẫn vận hành và giới hạn hiện tại: [Agency accounting README](../../backend/src/modules/agency-finance/README.md).

Phần xem trước cấu hình hiện đếm hồ sơ ảnh hưởng; chưa mô phỏng đầy đủ số tiền. So sánh biểu đồ với kỳ trước, kế toán thuế và tích hợp chuyển tiền ngân hàng tự động chưa có trong bản này.

## 1. Mục tiêu và phạm vi

- Sàn thu tiền khách. Khi chuyến đi hoàn tất và đáp ứng chính sách, hệ thống tự chuyển phần Agency được hưởng sang số dư có thể rút.
- Agency yêu cầu rút; Admin kiểm tra và chuyển khoản ngoài hệ thống, sau đó ghi nhận bằng chứng chuyển thành công.
- Admin có dashboard tài chính toàn sàn, danh sách Agency, chi tiết số dư, danh sách rút tiền, đối soát và cấu hình.
- Hoàn tiền kế toán vẫn chưa phát triển. Không mở lại tab, nhập hoàn hay duyệt hoàn. Các nghĩa vụ tài chính cũ chưa giải quyết tiếp tục chặn phần tiền liên quan.
- Không triển khai lệnh chuyển khoản tự động hoặc mặc định coi số liệu test là giao dịch ngân hàng thật.

## 2. Hiện trạng đã kiểm tra

| Đã có | Cần phát triển hoặc thay đổi |
| --- | --- |
| Payment/booking, snapshot giá/hoa hồng, outbox khoản thu, journal kép với số nguyên BigInt | Chuỗi sự kiện thật từ thu tiền đến số dư có thể rút; phân loại nguồn LIVE/TEST |
| Đối soát độc lập thông tin PayOS, lưu quan sát và lịch sử chạy | Lịch chạy tự động cho khoản thu cần kiểm tra, hàng đợi lỗi, giải thích sai lệch và cảnh báo vận hành |
| Báo cáo hoàn tất theo đợt, booking hoàn tất, điều kiện eligibility truy vấn trực tiếp | Ghi nhận quyết toán riêng, có trạng thái/số tiền/chính sách được chốt; tự giải phóng tiền đúng một lần |
| AgencyPayout đang gộp lập kỳ, duyệt và chuyển khoản | Tách quyết toán nội bộ khỏi yêu cầu rút/chuyển tiền; giữ tương thích lịch sử payout cũ |
| Chính sách chỉ có holdDays, form lịch sử và kiểm tra phiên bản | Chính sách có phiên bản bất biến, thời điểm hiệu lực, xem trước ảnh hưởng, công tắc tự động và giới hạn rút |
| Trang Admin chọn Agency và xem tài chính từng Agency | Dashboard toàn sàn, tìm kiếm/phân trang phía server, thẻ Agency có nhận diện và số liệu |
| Audit và xuất Excel/PDF theo Agency | Dashboard, xuất báo cáo và sổ số dư dùng cùng một định nghĩa chỉ số; thông báo và bảng sức khỏe job |

Nguồn: `backend/src/modules/agency-finance/finance.service.ts`, `finance.routes.ts`, `finance.export.ts`; `frontend/features/agency-finance`; `prisma/schema.prisma`.

Hiện giao diện gọi API thật, không hardcode tất cả số liệu. Các giao dịch TEST-FINANCE được seed vào database vẫn là mô phỏng; chưa chứng minh luồng thanh toán, quyết toán và chuyển tiền thật hoạt động trọn vẹn.

## 3. Chốt thuật ngữ và số dư

**Quyết toán:** xác định khoản Agency đã đủ điều kiện hưởng và ghi tăng số dư có thể rút. Không làm tiền trong tài khoản ngân hàng của sàn giảm.

**Rút tiền:** Agency yêu cầu chuyển một phần số dư có thể rút về ngân hàng. Chỉ giảm tiền sàn đang giữ khi có bằng chứng đã chuyển thành công.

| Chỉ số Agency | Bản chất |
| --- | --- |
| Chờ quyết toán | Nghĩa vụ trả Agency chưa được giải phóng: chưa hoàn tất/chưa đến hạn/chưa đủ điều kiện |
| Có thể rút | Số dư đã quyết toán, chưa bị giữ và chưa dành cho yêu cầu rút |
| Đang rút | Tiền đã được dành riêng cho yêu cầu rút đang chờ hoặc đang chuyển |
| Tạm giữ | Tiền bị giữ bởi tranh chấp hoặc ngoại lệ được ghi rõ |
| Đã chuyển ngân hàng trong kỳ | Dòng tiền thực chi đã được xác nhận, không phải số dư hiện tại |
| Đã quyết toán trong kỳ | Luồng tiền được giải phóng trong kỳ, đã trừ các bút toán đảo; không cộng thêm lần nữa vào số dư |

Ví dụ: khách trả 10 triệu, phí sàn 1 triệu. Agency có 9 triệu chờ quyết toán. Đủ điều kiện: 9 triệu chuyển sang có thể rút. Yêu cầu rút 4 triệu: còn 5 triệu có thể rút, 4 triệu đang rút. Chuyển thành công: còn 5 triệu có thể rút, 0 đang rút, đã chuyển ngân hàng 4 triệu. Không trừ 4 triệu vào có thể rút lần thứ hai.

Tổng số dư nghĩa vụ hiện còn của sàn với Agency = chờ quyết toán + có thể rút + đang rút + tạm giữ, có điều chỉnh nợ được ghi sổ riêng. Các nhóm loại trừ nhau; số lũy kế không được cộng vào số dư.

## 4. Luồng tự động quyết toán

1. Webhook hoặc kiểm tra PayOS hợp lệ xác nhận khoản thu. Outbox ghi nhận khoản thu đúng một lần, giữ nguyên snapshot booking.
2. Đối soát khớp booking, mã cổng, tiền thực thu và bằng chứng. Không dùng mỗi trạng thái Payment.PAID làm đủ điều kiện.
3. Agency gửi báo cáo hoàn tất. Hệ thống liên kết các booking của đúng đợt, tạo hồ sơ chờ quyết toán và chốt phiên bản chính sách.
4. Ngày đủ điều kiện theo thời gian = max(thời điểm kết thúc dự kiến, thời điểm gửi báo cáo hoàn tất đầu tiên) + số ngày giữ tiền. Báo cáo bổ sung không tự khởi động lại thời gian giữ hoặc ghi thêm tiền.
5. Khi tới hạn, worker kiểm tra lại các điều kiện động trong một giao dịch: khoản thu, đối soát, tình trạng Agency, tranh chấp, nghĩa vụ chưa xử lý, số dư đã ghi và việc đã quyết toán trước đó.
6. Đủ điều kiện: ghi bút toán chuyển tiền chờ sang có thể rút; ghi hồ sơ quyết toán và audit; phát thông báo qua outbox. Không có thao tác Admin duyệt từng tour thông thường.
7. Chưa đủ: giữ nguyên tiền, lưu tất cả mã lý do, lần kiểm tra gần nhất và thời điểm kiểm tra lại. Khi điều kiện thay đổi, tự đưa vào hàng đợi đánh giá lại.

Điểm phân biệt: tài khoản ngân hàng chưa xác minh chặn **rút tiền**, không nhất thiết chặn việc Agency được ghi nhận số dư đã quyết toán. Agency chưa xác minh hoặc bị đình chỉ tài chính chặn giải phóng tiền theo chính sách. Hai trạng thái phải hiện riêng.

Worker có lịch quét bù cho sự kiện bị bỏ lỡ; chạy nhiều node, retry hay restart đều không được giải phóng cùng khoản hai lần. Quyết toán theo từng booking; tour/đợt dùng để nhóm hiển thị. Một booking bị giữ không mặc nhiên giữ toàn bộ khách còn lại của tour.

## 5. Luồng rút tiền và trách nhiệm Admin

1. OWNER hoặc thành viên được cấp quyền rút xem số dư và tài khoản ngân hàng đã xác minh.
2. Nhập số tiền, xem lại ngân hàng nhận và xác nhận. Server kiểm tra hạn mức và giữ số tiền ngay trong cùng transaction tạo yêu cầu.
3. Admin xem yêu cầu, các khoản quyết toán nguồn, thông tin Agency và ngân hàng. Người kiểm tra duyệt hoặc từ chối với lý do.
4. Sau duyệt, người có quyền chi nhận xử lý và chuyển khoản bên ngoài. Tại điểm này, Agency không được hủy và tiền không tự được trả lại vào số dư khi có timeout.
5. Admin nhập mã ngân hàng, thời điểm chuyển thực tế, số tiền và chứng từ riêng tư. Server kiểm tra số tiền khớp, mã không trùng, chứng từ đúng Agency rồi xác nhận đã chuyển.
6. Ghi giảm tiền đang rút và tiền sàn; gửi thông báo; Agency xem/tải chứng từ đã được phép công khai cho chính Agency đó.

| Trạng thái yêu cầu | Xử lý số dư |
| --- | --- |
| Chờ duyệt / Đã duyệt | Tiền vẫn dành riêng cho yêu cầu |
| Đang chuyển / Chưa rõ kết quả | Tiền tiếp tục bị giữ; cần kiểm tra, không tự giải phóng |
| Đã chuyển | Ghi chi đúng một lần |
| Từ chối / Agency hủy khi còn chờ duyệt | Giải phóng phần dự trữ về có thể rút, nếu không có lý do tạm giữ mới |
| Chuyển thất bại đã được xác minh | Giải phóng hoặc chuyển sang tạm giữ theo kết quả kiểm tra; giữ nguyên lịch sử thất bại |

Giữ nguyên phân tách người lập/người duyệt hiện có, không tự hạ còn một người. Yêu cầu do Agency lập được Admin duyệt; tài khoản nội bộ lập thay Agency vẫn cần Admin khác duyệt. Quyền yêu cầu rút phải hẹp hơn quyền xem kế toán; ACCOUNTANT không tự có quyền rút mặc định.

## 6. Dashboard kế toán Admin

Trang đầu `/super-admin/finance` là dashboard, không mở bằng một khối điều kiện dài.

**Chỉ số trong kỳ:** tổng tiền khách thực thu đã xác minh, hoa hồng tạm tính, hoa hồng đã ghi nhận theo quy tắc quyết toán, tiền mới giải phóng cho Agency và tiền đã chuyển ngân hàng.

**Số dư tại cuối kỳ:** tổng chờ quyết toán, tổng có thể rút, tổng đang rút, tổng tạm giữ. Tách nhóm này với số phát sinh trong kỳ để không đọc nhầm.

**Biểu đồ:**

- Tiền khách thực thu và tiền chuyển Agency theo ngày/tuần/tháng.
- Hoa hồng tạm tính và đã ghi nhận theo kỳ.
- Cơ cấu số dư Agency: chờ, có thể rút, đang rút, tạm giữ; cộng ra đúng tổng nghĩa vụ hiện còn.
- Giá trị tạm giữ theo tuổi: dưới 7, 7–14, 15–30, trên 30 ngày; nhấn để mở booking và lý do.
- Agency có số dư lớn, giá trị rút lớn hoặc số yêu cầu cần xử lý; tiêu chí phải ghi rõ.

**Khối công việc:** yêu cầu rút chờ duyệt, đang chuyển quá thời hạn xử lý, đối soát lệch, tài khoản ngân hàng chờ xác minh, job thất bại. Nhấn một mục mở danh sách đã lọc tương ứng.

Mọi biểu đồ có tooltip và bảng số liệu thay thế, bộ lọc thời gian dùng giờ Việt Nam, so sánh kỳ trước cùng độ dài, hiển thị thời điểm cập nhật. Không có dữ liệu thì hiện trạng thái trống, lỗi tải thì không thay bằng số 0. Không gọi số dư sổ nội bộ là số dư ngân hàng nếu chưa có nguồn sao kê xác minh.

## 7. Danh sách và trang chi tiết Agency

Danh sách chuyển sang thẻ hai cột như Tổng kết tour Moderator, một cột trên mobile. Tái sử dụng/tách dùng chung `CompletionAgencyIdentity`, không sao chép thêm một hệ avatar khác.

Thẻ gồm avatar hoặc chữ viết tắt, tên, xác minh, địa chỉ nếu có; phía dưới là có thể rút, chờ quyết toán, số yêu cầu rút đang xử lý và lần chuyển gần nhất. CTA `Xem kế toán` mở trang chi tiết riêng, không xổ accordion.

Tìm kiếm/phân trang/sắp xếp phía server; có tổng số Agency phù hợp. Bộ lọc: có số dư, có yêu cầu rút, đang bị giữ, ngân hàng chưa xác minh. Hiển thị được Agency chưa có giao dịch với số liệu đúng bằng 0. Không tải sẵn tối đa 1.000 Agency rồi lọc ở trình duyệt như hiện tại.

Trang chi tiết `/super-admin/finance/agencies/:agencyId` có nhận diện, ngân hàng che số và các tab: Tổng quan, Quyết toán, Yêu cầu rút, Giao dịch & đối soát, Lịch sử. Mỗi khoản truy ngược tới booking, đợt, báo cáo hoàn tất, khoản thu và bút toán. Admin không được sửa trực tiếp số dư.

## 8. Kế toán Agency

- Bốn số dư chính: chờ quyết toán, có thể rút, đang rút, tạm giữ; nút yêu cầu rút gắn với số dư có thể rút.
- Bên dưới là đã quyết toán trong kỳ, đã chuyển về ngân hàng trong kỳ, phí sàn và biểu đồ phát sinh thực.
- Tab Tổng quan, Giao dịch, Quyết toán, Rút tiền, Tài khoản nhận tiền; đối soát có thể giữ là tab riêng theo quyền hiện có.
- Mỗi booking cho biết phần được hưởng, dự kiến đủ điều kiện ngày nào, đang thiếu gì, đã giải phóng bao nhiêu. Mỗi yêu cầu rút có tiến trình, lý do từ chối/thất bại, lịch sử và chứng từ.
- Thành viên chỉ xem không thấy nút rút; OWNER có thể cấp quyền rút riêng. Thay đổi tài khoản ngân hàng làm mất xác minh và không tự thay tài khoản đã chốt trên yêu cầu đang chuyển.

## 9. Cấu hình quyết toán đầy đủ hơn

Chuyển cấu hình thành trang hoặc panel riêng với nhóm rõ ràng và màn xem trước tác động trước khi lưu:

| Nhóm | Cấu hình hoặc quy tắc |
| --- | --- |
| Tự động | Bật/tạm dừng giải phóng số dư; lịch quét; giờ Việt Nam; cảnh báo job quá hạn. Chạy theo sự kiện và quét bù, không dựa vào mở trang |
| Thời gian | Số ngày giữ sau mốc hoàn tất; thời điểm hiệu lực; phiên bản chính sách. 0 ngày nghĩa là giải phóng khi mọi điều kiện đạt, không bỏ kiểm tra |
| Điều kiện cố định | Thu tiền thật và đối soát khớp, báo cáo hoàn tất, không trùng quyết toán, số dư hợp lệ. Không có nút tắt các kiểm tra tính đúng tiền |
| Kiểm soát ngoại lệ | Lý do tạm giữ, quyền giữ/giải phóng thủ công và yêu cầu ghi lý do; không được dùng giải phóng thủ công để coi khoản thu sai là khớp |
| Rút tiền | Số tiền tối thiểu/tối đa một lần, hạn mức mỗi ngày, ngân hàng đã xác minh, các quyền thao tác. Không tự đặt phí rút nếu chưa có chính sách được chấp thuận |
| Vận hành | Thời gian mục tiêu xử lý yêu cầu, ngưỡng cảnh báo, quy trình chưa rõ kết quả chuyển, thông báo |
| Quản trị | Người sửa, lý do sửa, trước/sau, ngày hiệu lực, kiểm tra phiên bản, xem trước số booking bị tác động |

Phí hoa hồng tiếp tục theo snapshot booking, không lấy tỷ lệ mới ghi đè. Chính sách thời gian được chốt khi tạo hồ sơ quyết toán; đổi chính sách chỉ áp dụng hồ sơ mới kể từ ngày hiệu lực. Hồ sơ lịch sử cần được duyệt kế hoạch chuyển đổi riêng, không âm thầm áp dụng lùi. Không cấu hình thì hiện bước thiết lập ban đầu và dừng tự động, không giả định đã áp dụng 7 ngày.

## 10. Dữ liệu, sổ ghi và API

Mở rộng bằng migration có kiểm thử, tận dụng sổ kép hiện có:

- `AgencySettlementPolicyVersion`: các tham số đã chốt, thời điểm hiệu lực, người sửa và lý do; phiên bản đã dùng không bị cập nhật tại chỗ.
- `AgencySettlement`: nguồn booking/payment/completion, snapshot số tiền và chính sách, ngày đủ điều kiện, số tiền giải phóng, trạng thái, lý do bị giữ. Ràng buộc nghiệp vụ bảo đảm phần gốc của một booking chỉ giải phóng một lần; sửa sau đó là điều chỉnh riêng.
- Các tài khoản sổ phụ cho Agency: pending, available, withdrawal-reserved, frozen. Không vừa ghi tổng `AGENCY_PAYABLE` cũ vừa cộng các sổ phụ thành hai lần; tổng nghĩa vụ được suy ra từ cùng tập bút toán.
- Sự kiện thu, giải phóng, giữ tiền, đặt yêu cầu rút, giải phóng dự trữ và chi thực tế có loại riêng. Bút toán quyết toán nội bộ không ghi giảm `PLATFORM_CASH`. Hoa hồng tạm tính/đã ghi nhận được phân loại nhất quán; báo cáo cũ cần chuyển đổi có đối chiếu.
- `AgencyWithdrawalRequest` và các allocation tới khoản quyết toán: số tiền, ngân hàng snapshot đã mã hóa, trạng thái, khóa chống gửi trùng, người yêu cầu/duyệt/chi, bằng chứng và mốc thời gian. Giữ `AgencyPayout` cũ làm lịch sử chi, không tự biến kỳ đã trả thành số dư có thể rút.
- `FinanceOutbox`/job và notification outbox: trạng thái retry, lần lỗi, khóa sự kiện duy nhất. Có trang kiểm tra và chạy lại job có kiểm soát.
- Snapshot/bảng tổng hợp để đọc dashboard nhanh; có thể rebuild từ ledger. Không có cột balance cho Admin tùy ý ghi đè.

API dự kiến:

- Admin: `GET /admin/finance/dashboard`, `/cashflow`, `/agencies` có phân trang, `/agencies/:id`, `/settlements`, `/withdrawals`, `/jobs`, `/policy/versions`; các thao tác duyệt/từ chối/nhận xử lý/xác nhận chuyển, giữ hoặc giải phóng khoản tiền với lý do.
- Agency: `GET /agency/finance/balances`, `/settlements`, `/withdrawals`; `POST /withdrawals`, hủy yêu cầu còn chờ; cập nhật ngân hàng theo quyền riêng.
- Export dùng cùng bộ lọc và định nghĩa chỉ số; đối chiếu được dashboard, ledger, settlement, withdrawal và lịch sử chi. Không phát hành lệnh chuyển ngân hàng tự động trong giai đoạn này.

## 11. Tính đúng tiền và xử lý lỗi

- Tiền VND BigInt, API chuỗi số nguyên; không dùng float. Các bút toán đã ghi bất biến và luôn cân bằng.
- Khóa theo Agency cùng ràng buộc unique và transaction cho giải phóng/rút/chi; kiểm tra quyền lại khi giữ khóa. Hai request đồng thời không thể rút vượt số dư.
- Retry webhook, job, submit hoặc phản hồi mạng bị mất không được ghi trùng. Trạng thái chưa rõ kết quả chuyển không được tự hoàn dự trữ.
- Tranh chấp sau giải phóng giữ đúng phần tiền nguồn chưa chi. Nếu đã chi thì ghi nhận ngoại lệ/nợ để xử lý riêng và bù trừ tương lai theo quy tắc đã được chốt; không tạo giả giao dịch hoàn tiền.
- Bổ sung báo cáo hoặc sửa số người không tự tính lại giá booking. Nếu có điều chỉnh tiền, phải là nghiệp vụ được kiểm tra và có bút toán riêng.
- Log/audit không in token hoặc số tài khoản đầy đủ; chứng từ tài chính riêng tư, kiểm tra quyền khi tải và audit người xem.
- Dashboard tổng hợp khoản thu chưa đối soát thành nhóm riêng, không tăng số dư có thể rút. Kiểm tra cân bằng toàn sàn và từng Agency, có cảnh báo chênh lệch giữa tổng hợp và ledger.

## 12. Dữ liệu thật, chuyển đổi và thử nghiệm

Trước khi triển khai, tái hiện chỉ báo `1 error` trong ảnh Admin, lấy lỗi runtime/network thực tế và sửa nguyên nhân; không giả định đây chỉ là lỗi giao diện hoặc lỗi cấu hình. Kiểm tra riêng tải dashboard, tải chính sách và phân quyền.

1. Phân loại dữ liệu cũ: khoản LIVE có bằng chứng, khoản chưa đủ bằng chứng và bộ TEST-FINANCE. Phân loại được audit; không chỉ dựa vào tên mô tả để quyết định tiền thật.
2. Dữ liệu mô phỏng phải tách môi trường hoặc có nguồn TEST lan truyền xuyên booking/payment/journal/settlement. Dashboard thật mặc định loại TEST. Với journal bất biến cũ, dùng metadata phân loại nguồn có audit thay vì sửa chứng từ đã ghi.
3. Backfill lịch sử không tạo tiền mới: số đã trả không ghi có lại, các nghĩa vụ chưa xử lý vẫn giữ; kiểm tra số dư đầu kỳ trước/sau migration theo từng Agency và toàn sàn.
4. Chạy worker ở chế độ xem trước, chỉ tính các khoản dự kiến giải phóng. Đối chiếu thủ công bảng kê trước khi bật ghi sổ tự động.
5. Kiểm thử trong môi trường biệt lập với adapter cổng có bằng chứng mô phỏng; sau đó kiểm tra tích hợp thật bằng giao dịch được cho phép. Không gọi mô phỏng là tiền LIVE và không tự thực hiện giao dịch thật để seed.
6. Bật theo giai đoạn: đọc dashboard thật → tính đủ điều kiện → tự giải phóng cho nhóm kiểm soát → yêu cầu rút → vận hành toàn bộ. Tạm dừng worker khi rollback, giữ nguyên lịch sử tiền.

Kịch bản nghiệm thu: hoàn tất đúng hạn; chưa hết thời gian giữ; đối soát lệch; report bổ sung; webhook/job chạy lặp; hai yêu cầu rút đồng thời; đổi ngân hàng sau yêu cầu; bị giữ trước/sau giải phóng; chuyển thành công, thất bại và chưa rõ kết quả; phân quyền và cách ly Agency; dữ liệu cũ đã payout; nguồn TEST không lọt vào LIVE; dashboard và Excel/PDF cộng khớp, không nhân đôi tiền.

## 13. Thứ tự triển khai và tiêu chí hoàn thành

| Giai đoạn | Sản phẩm bàn giao | Điều kiện qua |
| --- | --- | --- |
| 1. Định nghĩa và chuyển đổi | Bộ định nghĩa chỉ số, sổ phụ, trạng thái, chính sách phiên bản, migration và kế hoạch backfill | Ví dụ tiền khớp; lịch sử không bị nhân đôi; TEST/LIVE được phân loại |
| 2. Engine quyết toán | Event/outbox, eligibility có lý do, ngày dự kiến, worker giải phóng và audit | Hoàn tất đủ điều kiện tự tăng có thể rút đúng một lần; giữ được khoản lỗi |
| 3. Dashboard và danh sách | Dashboard Admin, thẻ Agency theo Moderator, trang chi tiết riêng, cấu hình đầy đủ | Dữ liệu API thật, phân trang, biểu đồ/bộ lọc/tooltip đúng; trạng thái trống và lỗi rõ |
| 4. Rút tiền | Số dư Agency, tạo yêu cầu, Admin kiểm tra/duyệt/ghi chuyển và chứng từ | Không rút vượt, không chi trùng; phân quyền, ngân hàng và trạng thái chưa rõ được bảo toàn |
| 5. Vận hành | Thông báo, xuất báo cáo, giám sát job, đối chiếu số dư và chạy thử có kiểm soát | Đi hết luồng thật; bộ kiểm thử giao dịch và phục hồi qua; vận hành có hướng dẫn |

Một bản hoàn thành phải đi được từ booking có khoản thu xác minh → Agency gửi báo cáo → tự giải phóng tiền → Agency yêu cầu rút → Admin xác nhận chuyển ngoài → số dư, dashboard, thông báo và báo cáo cùng khớp. Chỉ làm đẹp thẻ hoặc nạp thêm mock chưa đạt tiêu chí này.
