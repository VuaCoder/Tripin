# Kế hoạch bổ sung kế toán Agency

Cập nhật phạm vi 17/11/2026: luồng hoàn tiền trong kế toán được hoãn theo yêu cầu người dùng; đã bỏ giao diện và khóa API thao tác. Giữ dữ liệu cũ và điều kiện chặn quyết toán các nghĩa vụ chưa xử lý. Cấu hình quyết toán do Super Admin quản lý, có kiểm tra phiên bản và lịch sử thay đổi; Agency chỉ xem điều kiện. Các đoạn mô tả hoàn tiền phía dưới là kế hoạch lịch sử, chưa phát hành.

Triển khai hiện tại và hướng dẫn vận hành: [Agency accounting](../../backend/src/modules/agency-finance/README.md). Các ghi chú “chưa triển khai” bên dưới mô tả thời điểm lập kế hoạch, không phải trạng thái sau khi phát triển.

Ngày nghiên cứu: 17/11/2026, Asia/Ho_Chi_Minh. Căn cứ code trong working tree của branch `feature/agency-accounting`, gồm các thay đổi chưa commit. Đây là kế hoạch; chưa triển khai model/API, chạy migration hay phát sinh giao dịch tiền.

## 1. Phạm vi đã chốt với người dùng

- Sàn thu tiền khách; sau tour mới quyết toán cho agency.
- Hoàn tiền thực hiện ngoài hệ thống. Agency nhập thông tin hoàn tiền và chứng từ; không tích hợp chuyển tiền hoàn tự động trong đợt này.
- Báo cáo hoàn tất tour của agency chỉ để xem/audit, không thêm bước moderator duyệt. Việc kiểm tra/duyệt quyết toán tài chính là quy trình riêng.
- Không đợi từng khách nhấn hoàn tất hoặc viết đánh giá mới quyết toán.
- Đề xuất đợt đầu ghi nhận chuyển khoản quyết toán bằng chứng từ bên ngoài; tích hợp chi hộ tự động là giai đoạn riêng nếu có yêu cầu sau này. Điểm này là đề xuất, chưa phải quyết định của người dùng.

## 2. Hiện trạng đã kiểm tra

| Nguồn | Điều đã có | Khoảng trống cần xử lý |
| --- | --- | --- |
| [Schema](../../prisma/schema.prisma), `Booking` | Giá, dịch vụ mua thêm, giảm giá, `commissionBps`, `commissionAmount`, `agencyAmount` được lưu tại lúc đặt | Chưa phải sổ tài chính; trạng thái booking không chứng minh tiền đã chuyển agency |
| [Payments service](../../backend/src/modules/payments/payments.service.ts) | PayOS, xác minh webhook, `Payment.PAID`, xử lý thanh toán muộn, retry fulfilment | Chưa có nhật ký đối soát riêng; webhook sai tiền chỉ ghi `failureReason`; polling chấp nhận `amountPaid >= amount` nhưng chưa phân loại phần trả thừa |
| [Provider contract](../../backend/src/modules/payments/providers/payment.provider.ts) | Lấy trạng thái và tổng tiền nhận | Chưa trả chi tiết giao dịch nhận tiền để đối soát theo từng mã ngân hàng; chưa có adapter chi tiền |
| [Agency summary](../../backend/src/modules/agencies/agency.routes.ts) | `/agency/finance/summary` cộng `agencyAmount` của booking đã trả, còn CONFIRMED/COMPLETED | Trả `reconciledBalance: false`; không được đổi tên số này thành tiền đã thực nhận |
| [Refund repository](../../backend/src/modules/payments/refund-ledger.repository.ts), [complaints](../../backend/src/modules/complaints/complaints.service.ts) | Yêu cầu hoàn tiền từ khiếu nại, trạng thái PENDING; booking có `refundRequired` | Chưa có chứng từ chuyển ngoài, phân biệt người chi, xác nhận hoặc chống hoàn trùng xuyên các yêu cầu |
| [Booking cancellation](../../backend/src/modules/bookings/bookings.service.ts) | Tính mức hoàn từ chính sách và đánh dấu booking | Cờ chờ hoàn không đồng nghĩa đã hoàn; thanh toán muộn cũng có thể tạo nghĩa vụ hoàn |
| [Schema tiền](../../prisma/schema.prisma), [money helpers](../../packages/constants/src/money.ts) | Booking/Payment dùng BigInt; mức booking cho phép tới 50 tỷ VND | `Booking.refundAmount` và `RefundLedger.amount` còn Int; không đủ miền giá trị tương ứng |
| [Commission](../../backend/src/modules/agency-commission/README.md) | Thay đổi tỷ lệ có version; booking giữ phí cũ | Không tính lại booking cũ bằng tỷ lệ mới; cần quy tắc đảo phí khi hoàn tiền |
| [Tour completion](../../backend/src/modules/tour-completion/completion.service.ts) | Báo cáo có phiên bản/audit; chốt booking theo đợt | Chưa phát hành quyền quyết toán; sửa số người hay bổ sung báo cáo không tự thay đổi tiền |
| [Guide earnings](../../backend/src/modules/earnings/README.md) | Thù lao guide và GuidePayoutLedger riêng | Không phải khoản sàn đã trả agency; endpoint chuyển guide cũ đang cách ly 410, không mở lại để dùng thay finance |
| [Agency permissions](../../backend/src/modules/agencies/agency.policy.ts) | AgencyContext, quyền tài chính, ACCOUNTANT, custom roles | ACCOUNTANT hiện chủ yếu có quyền xem; không gán quyền quản lý rộng chỉ để cho chạy đối soát |
| [H2 notes](../database/agency-multimember/H2_IMPLEMENTATION.md) | Đã xác định finance theo AgencyProfile.id | AgencyTransaction/AgencyPayout/AgencyPayoutItem chưa được triển khai |

`pdfkit` và font DejaVu đã có trong backend; `exceljs` chưa nằm trong dependencies. Không kiểm tra số dư hay dữ liệu khách hàng trên Production trong lần nghiên cứu này.

## 3. Nguyên tắc tính tiền

### 3.1. Phân biệt các con số

- **GMV thực thu trong kỳ:** khoản tiền khách trả hợp lệ cho booking, chưa trừ hoàn; tiền chuyển thừa/trùng được theo dõi riêng, không tăng GMV hai lần.
- **Phần agency được hưởng:** giá trị theo booking và các điều chỉnh đã được xác nhận, sau phí sàn; chưa phải tiền đã vào ngân hàng agency và không phải lợi nhuận sau mọi chi phí vận hành.
- **Tiền chờ quyết toán:** nghĩa vụ trả agency đang giữ, tính đến cuối kỳ; gồm phần chưa đủ điều kiện và phần đang bị giữ có lý do.
- **Có thể quyết toán:** phần đã đủ điều kiện, trừ giữ chỗ quyết toán đang xử lý và nghĩa vụ cần bù trừ.
- **Đã chuyển agency:** chỉ ghi khi có xác nhận/chứng từ chuyển thành công. Tạo kỳ hoặc bấm xử lý không làm tăng chỉ số này.
- **Phí sàn:** phân biệt tạm tính lúc thanh toán và ghi nhận khi tour hoàn tất theo chính sách, có đảo phí nếu phát sinh hoàn tiền.
- **Công nợ hoàn:** tiền đã được chấp thuận phải trả khách nhưng chưa có xác nhận hoàn xong.

Kỳ thống kê theo UTC+7, tuần từ thứ Hai; backend chuyển thành khoảng UTC `[from, toExclusive)`. Luồng phát sinh trong kỳ và số dư cuối kỳ là hai cách tính khác nhau: số dư cần số đầu kỳ và toàn bộ phát sinh tới mốc chốt, không chỉ SUM các dòng đang lọc.

Tiền dùng BigInt xuyên DB/service, JSON là chuỗi số nguyên. V1 chỉ VND. Giá, phí, tỷ lệ làm tròn lấy từ snapshot; không dùng số thực để cộng tiền. Không cộng các loại tiền khác nhau.

### 3.2. Voucher, phí và các khoản chưa đủ chính sách

- Code hiện cộng giảm giá rồi tính hoa hồng trên `totalAmount`, gồm dịch vụ mua thêm. V1 đọc đúng snapshot này, không âm thầm đổi cơ sở tính phí của booking cũ.
- Chốt riêng agency chịu voucher agency, ai chịu voucher sàn/Premium và có bù trợ giá agency hay không. Lưu phần tài trợ và phiên bản chính sách cho booking mới; dữ liệu cũ thiếu bằng chứng phải gắn cờ, không tự tạo tiền bù.
- Đề xuất hoàn toàn phần thì đảo toàn bộ phần phí liên quan; hoàn một phần phân bổ theo tỷ lệ gốc, làm tròn VND và giữ tổng phân bổ bằng số hoàn. Cần chốt trước khi ghi sổ chính thức.
- Không tự trừ thù lao guide một lần nữa từ `agencyAmount`. Nếu sàn chi hộ guide sau này phải có nghiệp vụ và bằng chứng riêng.
- Phí ngân hàng, phạt, trợ giá và bồi thường phải có nguồn/chính sách rõ. Không tự sinh khoản phạt khi agency chậm báo cáo.

### 3.3. Điều kiện được đưa vào kỳ quyết toán

Booking đã thực thu và đối soát; tour đã kết thúc và có báo cáo agency đã gửi; hết thời gian giữ tiền được cấu hình; không còn giữ do khiếu nại/hoàn tiền/chênh lệch; agency và tài khoản nhận tiền đủ điều kiện; khoản đó chưa thuộc kỳ đang giữ hoặc đã trả.

Đề xuất thời gian giữ sau hoàn tất và lịch quyết toán tuần/tháng là cấu hình có phiên bản, cần chốt với chủ sản phẩm. Không hardcode thời hạn vào worker. Booking COMPLETED cũ nhưng thiếu báo cáo/bằng chứng tiền không tự được giải ngân khi backfill.

## 4. Hoàn tiền thủ công, giao dịch bên ngoài

### 4.1. Luồng thao tác

1. Tạo nghĩa vụ hoàn từ hủy booking, khiếu nại hoặc thanh toán đến muộn. Yêu cầu có booking/payment hợp lệ và lý do, giới hạn theo tiền thực thu còn có thể hoàn.
2. Agency chọn yêu cầu, nhập số tiền đã chuyển ngoài, ngày chuyển, bên thực chi, mã ngân hàng/tham chiếu, người nhận được che thông tin và chứng từ.
3. Lưu bản ghi **Chờ xác nhận**. Phía tài chính sàn đối chiếu thủ công chứng từ, xác nhận hoặc trả lại với lý do. Đây là đề xuất kiểm soát trước khi đưa số tiền vào quyết toán.
4. Chỉ khoản được xác nhận mới tăng số đã hoàn. Cho phép nhiều lần hoàn một phần, tổng không vượt nghĩa vụ và tiền thực thu sau các lần hoàn đã xác nhận/đang giữ.
5. Ghi audit người nhập/người xác nhận/thời điểm; sửa sai bằng bản điều chỉnh, không xóa giao dịch đã xác nhận.

Không gọi API chuyển tiền, không đánh dấu hoàn thành vì mới nhập số tiền, không gắn nhãn “Khớp PayOS” cho chứng từ thủ công. Nếu không đủ bằng chứng, hiển thị đang chờ đối chiếu.

### 4.2. Ai trả quyết định cách bù trừ

Ví dụ minh họa, chưa có voucher/phí khác: khách trả 10 triệu, phí sàn 10%, phần agency 9 triệu; hoàn khách 2 triệu và đảo 200 nghìn phí.

| Bên thực chuyển hoàn | Tiền sàn chuyển lại agency | Giải thích |
| --- | --- | --- |
| Sàn chuyển 2 triệu bên ngoài | 7,2 triệu | Agency chịu 1,8 triệu, sàn đảo phí 0,2 triệu |
| Agency dùng tiền riêng chuyển 2 triệu | 9,2 triệu | 9 - 1,8 + 2 triệu bù lại agency đã chi hộ |

Trường hợp agency chi hộ, sàn không phát sinh dòng tiền chi hoàn; phải ghi khoản bù trả agency. Nếu chỉ trừ 2 triệu khỏi kỳ quyết toán sẽ khiến agency chịu hai lần. Bản ghi phải có `paidBy`, không suy luận người trả từ người đăng nhập.

Hoàn phát sinh sau một kỳ đã trả: giữ nguyên kỳ cũ, tạo điều chỉnh ở kỳ sau. Nếu agency cần trả lại tiền cho sàn, ghi công nợ agency riêng; không tạo kỳ quyết toán âm hoặc tự rút tiền ngân hàng agency.

## 5. Cấu trúc dữ liệu đề xuất

Hai model trong issue là điểm bắt đầu nhưng chưa đủ để giữ tiền, chống trả trùng và truy nguyên nguồn.

| Model/nhóm | Dữ liệu và trách nhiệm |
| --- | --- |
| `AgencyTransaction` | Chứng từ/nghiệp vụ: agencyId, booking/payment/refund/payout refs, loại, BigInt amount, currency, bookingCode snapshot, effectiveAt, postedAt, sourceType/sourceId/version, eventKey duy nhất, actor/audit. Thêm ADJUSTMENT/REVERSAL/PAYOUT/AGENCY_REIMBURSEMENT; không chỉ bốn loại gốc |
| `AgencyLedgerEntry` | Các vế ghi sổ theo tài khoản, amount không âm, debit/credit. Tổng Nợ = Có theo chứng từ và tiền tệ. Sổ đã ghi bất biến; đảo/điều chỉnh bằng chứng từ liên kết |
| `FinanceOutbox` | Sự kiện tài chính bền vững, eventKey/version, retry. Ghi cùng transaction với sự kiện nguồn; worker tạo ledger có unique key |
| `GatewayObservation` | Bằng chứng thu tiền: provider/channel, orderCode, paymentLinkId, reference, actual amount/currency/time, nguồn webhook/polling, checksum/hash. Bản không xác định booking giữ ở hàng chờ nội bộ, không phát cho agency khác |
| `ReconciliationRun/Item` | Phiên đối soát, phạm vi agency, expected/actual amount, MATCHED/DISCREPANCY/UNRECONCILED, mã nguyên nhân, bằng chứng, thời điểm và người chạy |
| `RefundCase`, `ManualRefundPayment` | Chuẩn hóa nghĩa vụ hoàn và các lần ghi nhận chi ngoài: payment/booking, số được duyệt, paidBy, người chi/nhận, số tiền, mã tham chiếu, proof IDs, trạng thái xác nhận. Có khóa chống lặp và kiểm tra tổng đã hoàn |
| `AgencyPayout`, `AgencyPayoutItem` | Kỳ quyết toán, khoảng thời gian, các khoản được chốt, phí/hoàn/bù chi hộ/điều chỉnh, netPayoutAmount, policy snapshot, tài khoản ngân hàng snapshot. Items giữ quyền chi trả từng phần tiền để không rơi vào hai kỳ đang chạy |
| `AgencyPayoutAttempt` | Lần chuyển/ghi nhận chuyển, nguồn manual/provider, khóa chống lặp, trạng thái kết quả, bankRef, chứng từ, completedAt. Giữ trạng thái UNKNOWN khi chưa biết kết quả, không coi timeout là thất bại chắc chắn |
| `AgencyBankAccount` | Thông tin nhận tiền được mã hóa, bản che số cho UI, người cập nhật/xác minh và phiên bản. Đổi tài khoản không sửa snapshot kỳ đã chốt |
| `FinanceExportJob/Document` | Người yêu cầu, agency, bộ lọc, mốc sổ, trạng thái, file private, checksum, hạn tải. Chứng từ quyết toán khác hóa đơn thuế |

Tất cả khóa sở hữu dùng `AgencyProfile.id`, không dùng User/OWNER làm agencyId. Actor là user/member riêng. FK/repository kiểm tra booking và kỳ cùng agency; không cascade-delete sổ tiền khi đổi chủ hoặc đóng doanh nghiệp.

Trạng thái xử lý giao dịch và kết quả đối soát là hai chiều độc lập. Không đổi số tiền chứng từ đã ghi chỉ để làm cho nó “khớp”. Tổng các loại giao dịch hiển thị không phải phép SUM tùy ý: phí sàn là phân bổ, không phải một lần tiền khách trả thêm.

### Ví dụ sổ kiểm soát phía sàn

- Nhận 10 triệu: Nợ tiền ngân hàng 10; Có phải trả agency đang giữ 9; Có phí sàn chờ ghi nhận 1.
- Hoàn được duyệt 2 triệu trước khi ghi nhận phí: Nợ phải trả agency 1,8; Nợ phí chờ ghi nhận 0,2; Có phải hoàn khách 2.
- Agency xác nhận đã chi hộ 2 triệu: Nợ phải hoàn khách 2; Có phải bù agency 2. Không ghi tiền ngân hàng sàn giảm.
- Chốt kỳ: chuyển số đủ điều kiện từ phải trả khả dụng sang khoản đang dành cho kỳ. Khi có chứng từ chuyển thành công mới giảm tiền ngân hàng và khoản phải trả đó.

Ví dụ chỉ kiểm tra bảo toàn tiền cho trường hợp đơn giản. Voucher, phí phát sinh, hoàn sau ghi nhận phí và công nợ sau quyết toán cần bảng quy tắc riêng trước triển khai.

## 6. Đối soát thu tiền

Đối chiếu ba nguồn: booking/giá kỳ vọng → Payment/orderCode của hệ thống → giao dịch thực nhận từ PayOS. `bookingCode`, `orderCode`, `paymentLinkId` và mã ngân hàng `reference` là các mã khác nhau, không gộp vào một `gatewayRef` mơ hồ.

- Lưu quan sát hợp lệ kể cả payment đã PAID; đừng bỏ mất reference đến muộn sau polling.
- Sai chữ ký không được dùng làm bằng chứng tiền. Sai số tiền/link/currency, trả thiếu/thừa, chuyển hai lần hoặc không rõ booking tạo ngoại lệ để xử lý; không tự sửa tổng booking, không cộng trùng GMV.
- Một booking có thể có nhiều lần thử thanh toán hoặc nhận tiền muộn. Chống lặp theo giao dịch nhận tiền thực tế, không đặt unique bookingId cho mọi PAYMENT.
- Không tự ghi thêm toàn bộ `amountPaid` mỗi lần polling. Dữ liệu tổng và danh sách giao dịch phải có quy tắc hợp nhất, mức đủ bằng chứng và khóa chống lặp.
- Chạy job nền có hạn mức/retry; nút agency chỉ xếp job cho payment thuộc agency đã xác thực. Không nhận orderCode tùy ý rồi trả dữ liệu merchant toàn sàn cho agency.
- Mất kết nối giữ UNRECONCILED/chờ kiểm tra. MATCHED chỉ khi bằng chứng đủ; không dùng trạng thái Payment.PAID như bằng chứng độc lập thứ ba.
- Refund thủ công có kết quả xác minh thủ công riêng; không giả vờ ngân hàng/PayOS đã tự xác thực.

## 7. Quyết toán

Luồng đề xuất: `DRAFT → PENDING_APPROVAL → APPROVED → PROCESSING → COMPLETED`; REJECTED/CANCELLED và FAILED/UNKNOWN có nhánh xử lý riêng.

Agency xem khoản đủ điều kiện, bảng kê, khoản giữ và lý do. Phía tài chính sàn lập/duyệt kỳ, chốt tài khoản nhận và số tiền; agency không có quyền tự đánh dấu sàn đã trả. Người lập và người phê duyệt tách nhau khi có nhân sự phù hợp; fallback dùng manual review và audit rõ, không tự duyệt im lặng.

Khóa tiền và payout items bằng DB transaction/row locks, kiểm tra điều kiện lần cuối trước chốt. Cùng booking chỉ được phân bổ tối đa quyền lợi còn lại; hai worker đồng thời không thể tạo hai khoản trả giống nhau. Không gọi mạng khi đang giữ DB lock lâu.

Đề xuất giai đoạn đầu: tải lên chứng từ chuyển ngoài và ghi nhận thủ công. Nếu sau này tích hợp PayOS chi hộ, dùng attempt/key bền vững; request được tiếp nhận/PROCESSING không phải chuyển xong; khi timeout phải hỏi lại theo mã cũ trước retry. Phí chuyển và nguồn tiền tài khoản chi cần xác minh riêng, không suy ra từ tổng Payment.

## 8. API và giao diện

### Agency

| API dự kiến | Nội dung |
| --- | --- |
| `GET /agency/finance/overview` | KPI, số dư đầu/cuối, khoản giữ, công nợ, số đang chờ xác nhận; có định nghĩa thời điểm cho từng số |
| `GET /agency/finance/cashflow` | Tiền vào/ra thực tế phía sàn cho agency; khoản agency chi hộ hiển thị riêng |
| `GET /agency/finance/transactions[/:id]` | Sổ giao dịch, drill-down booking/payment/chứng từ, phân trang server |
| `POST /agency/finance/reconcile` | Tạo job; GET kết quả theo runId, chỉ agency sở hữu |
| `GET /agency/finance/refunds` | Nghĩa vụ hoàn, số đã ghi nhận/xác nhận và phần còn lại |
| `POST /agency/finance/refunds/:id/manual-payments` | Ghi nhận tiền hoàn ngoài hệ thống; idempotency key, version và chứng từ |
| `GET /agency/finance/payouts[/:id]` | Kỳ quyết toán, breakdown, chứng từ và trạng thái |
| `GET/PUT /agency/finance/bank-account` | Thông tin nhận tiền; cập nhật có quyền riêng và version |
| `GET /agency/finance/reports/export.xlsx`, `export.pdf` | Xuất nhỏ đồng bộ; tập lớn tạo job và tải file có xác thực |

UI `/agency/finance`: bốn KPI chính (GMV, phần agency được hưởng, tiền chờ quyết toán, phí sàn), số đã nhận/có thể quyết toán/công nợ ở phần chi tiết. Tabs **Giao dịch**, **Đối soát**, **Hoàn tiền**, **Quyết toán**. Chọn tuần/tháng/quý/tùy chỉnh và dùng cùng bộ lọc cho bảng/xuất file. Biểu đồ doanh thu ghi nhận và phí không gắn nhãn dòng tiền thực; biểu đồ dòng tiền lấy đúng nhận/chi thực tế.

Tab hoàn tiền là form ghi nhận chuyển ngoài, không có nút gọi chuyển tiền. Tab quyết toán cho xem và tải bảng kê; số liệu/không có quyền/lỗi/chưa đối soát phân biệt rõ, không đổi lỗi thành 0 đồng.

### Phía sàn

Trang `/super-admin/finance` đề xuất: danh sách agency, số chờ quyết toán, ngoại lệ thu tiền, khoản hoàn cần xác minh và các kỳ quyết toán. API nội bộ có namespace/quyền riêng cho xác minh chứng từ, lập/duyệt kỳ và ghi nhận chuyển khoản; không mở những thao tác này bằng quyền xem báo cáo tour.

| Vai trò | Quyền đề xuất |
| --- | --- |
| OWNER | Xem/xuất, đối soát agency, quản lý tài khoản nhận tiền; cho phép ghi nhận hoàn theo quyền nghiệp vụ |
| ACCOUNTANT | Xem/xuất, chạy đối soát trong agency, nhập ghi nhận hoàn; không tự đổi ngân hàng hay duyệt tiền sàn |
| MANAGER/STAFF | Không tự được cấp tài chính; chỉ cấp qua custom role rõ ràng |
| MODERATOR | Báo cáo tour vẫn chỉ xem; không tự có quyền kế toán/duyệt quyết toán |
| SUPER_ADMIN hoặc nhân sự tài chính sàn được cấp riêng | Kiểm tra chứng từ, quản lý đối soát toàn sàn, lập/duyệt/ghi nhận quyết toán theo quyền tách biệt |

Thêm quyền hẹp cho export/reconcile/refund-record/bank-manage/payout-prepare/payout-approve; không dùng `agency:finance-manage` để vô tình mở quyền đổi hoa hồng. API, worker và download đều kiểm tra scope; cache/reset đúng AgencyContext và phiên bản quyền.

## 9. Xuất báo cáo

- Excel: các sheet Tổng hợp/Giao dịch/Hoàn tiền/Quyết toán/Định nghĩa; SUM cho cột số an toàn và tổng tính sẵn từ server. Tên/mã tham chiếu là text, không diễn giải dữ liệu người dùng thành công thức.
- Excel chỉ có độ chính xác số 15 chữ số: nếu số tiền hoặc tổng vượt miền chính xác, xuất dạng text và tổng chính xác từ BigInt, ghi rõ chế độ; không tạo SUM âm thầm bỏ qua text hoặc làm tròn tiền.
- PDF: tên agency/logo có sẵn, bộ lọc, ngày chốt, đơn vị tiền, bảng tổng hợp và nơi ký; font tiếng Việt, lặp tiêu đề khi sang trang. Không gọi PDF sinh ra là hóa đơn thuế.
- Cùng một bộ truy vấn, timezone và mốc sổ cho UI/Excel/PDF. Snapshot hoặc as-of-postedAt ổn định để các trang file không lệch khi dữ liệu mới đến.
- Chứng từ ngân hàng/file export là private, có quyền tải và audit; không tái sử dụng URL Cloudinary public của ảnh tour để lưu chứng từ tài chính. Logo remote cần đường tải có kiểm soát; không cho server fetch URL tùy ý.

## 10. Các đợt triển khai và điều kiện nghiệm thu

| Đợt | Công việc | Điều kiện xong |
| --- | --- | --- |
| 0. Chốt nghiệp vụ | Định nghĩa số tiền, voucher, phí hoàn, thời gian giữ/lịch quyết toán, người kiểm tra chứng từ | Có bảng tình huống và số tiền kỳ vọng, tách quyết định đã chốt/đề xuất |
| 1. Nền sổ | Migration additive, BigInt tiền hoàn, journal/entries, outbox, source refs, quyền tenant | Mỗi chứng từ cân; replay/race không sinh tiền; dữ liệu cũ vẫn đọc được |
| 2. Thu tiền và hoàn ngoài | Bằng chứng PayOS, runs đối soát, RefundCase, form/chứng từ hoàn thủ công, bù agency chi hộ | Test đủ/thừa/thiếu/trùng/muộn; xác nhận hoàn không trừ agency hai lần |
| 3. Đọc số và UI | Overview, cashflow, transactions, bộ lọc, tabs, chi tiết nguồn/audit | Tổng UI bằng truy vấn sổ; đúng scope, timezone và số dư đầu/cuối |
| 4. Quyết toán | Eligibility, holds, payout/items/attempts, ngân hàng snapshot, quy trình tài chính nội bộ | Không trả trùng; giữ đúng tiền chờ hoàn; thay ngân hàng không đổi kỳ đã chốt |
| 5. File và cutover | Excel/PDF, private download, dry-run lịch sử, so sánh old/new, vận hành shadow | File khớp UI/sổ; lịch sử thiếu bằng chứng được cách ly; rollout có thể tắt nghiệp vụ mới |

API thu/chi tự động không phải điều kiện hoàn thành phạm vi hoàn tiền thủ công. Không triển khai ERP tổng hợp, kế toán thuế, hóa đơn điện tử, đa tiền tệ hoặc chi hộ tự động trong đợt đầu.

## 11. Kiểm thử bắt buộc

1. Bảo toàn tiền: tổng Nợ=Có, phí+quyền agency+nghĩa vụ hoàn/khác khớp từng nguồn; thử giá trị lớn và làm tròn VND.
2. Webhook lặp/song song, polling trước webhook, unknown order, sai chữ ký, sai link/tiền, trả thiếu/thừa, hai payments một booking và tiền đến sau hủy.
3. Hoàn một phần nhiều lần, cùng nghĩa vụ đi từ hủy rồi khiếu nại, trùng chứng từ/idempotency, không vượt tiền thực thu, agency chi hộ và sàn chi; hoàn sau payout tạo điều chỉnh mới.
4. Hai worker lập kỳ cùng lúc; chạy lại job; payout đang xử lý/không rõ kết quả; không giải phóng tiền khi chưa xác định chuyển thất bại.
5. Chốt tour một lần, bổ sung báo cáo/đổi số khách không tự đổi tiền, không đợi review khách; khiếu nại mới giữ đúng khoản liên quan.
6. Hai agency/cùng actor nhiều agency, đổi chủ/đổi quyền/đình chỉ staff, UUID agency khác, file download sai tenant, moderator không có quyền tiền.
7. Đầu/cuối ngày-tuần-quý theo UTC+7; số dư đầu kỳ; tổng không chỉ từ trang hiện tại; export khớp mốc sổ, font tiếng Việt, BigInt/Excel 15 chữ số.
8. Backfill chạy hai lần không trùng, không tự ghi hoàn/đã trả từ cờ legacy; tiền test/subscription không lẫn GMV booking agency.

Chạy PostgreSQL tạm hoặc môi trường schema/fixture tách biệt và mock PayOS. Không tự sao chép dữ liệu Production, gửi lệnh tiền thật hoặc sửa các migration đã áp dụng.

## 12. Dữ liệu cũ và đưa vào sử dụng

- Dry-run phân loại Booking/Payment/RefundLedger/GuidePayoutLedger và báo cáo hoàn tất; chưa ghi ledger khi chỉ nghiên cứu.
- `refundRequired` chỉ chứng minh cần xử lý; PENDING RefundLedger không phải đã trả. GuidePayoutLedger không phải agency payout.
- PAID cũ thiếu giao dịch ngân hàng phải gắn mức bằng chứng lịch sử, không tự MATCHED. Không tạo số dư khả dụng/đã giải ngân từ một phép SUM booking.
- Tiền hoàn Int nâng lên BigInt theo expand/contract: kiểm tra/backfill/đổi reader-writer đồng bộ; không nhận số vượt giới hạn cũ khi worker cũ còn ghi cột Int.
- Chạy shadow số liệu, đối chiếu nguồn thực thu, xác nhận số dư đầu kỳ rồi mới bật chức năng chốt kỳ. Mọi bản backfill có source key và audit.
- Rollback bằng tắt tạo nghiệp vụ mới; không xóa các chứng từ đã ghi hoặc chứng từ chuyển tiền ngoài.

## 13. Điểm còn phải chốt trước khi triển khai tiền chính thức

| Đã chốt | Còn đề xuất/chưa đủ dữ liệu |
| --- | --- |
| Sàn thu tiền khách | Thời gian giữ sau hoàn tất và chu kỳ quyết toán |
| Hoàn tiền ngoài hệ thống, agency nhập thủ công | Nhân sự sàn xác nhận chứng từ hoàn và cơ chế duyệt kỳ |
| Báo cáo tour không duyệt, không bắt khách đánh giá | Phân bổ hoàn/đảo phí, tài trợ voucher và phí ngân hàng |
| Có xem sổ/đối soát/quyết toán và xuất file | Nguồn tiền thực tế/tài khoản merchant nhận tiền; tài khoản nhận agency được xác minh bằng cách nào |

## 14. Tài liệu ngoài đã đối chiếu

- [payOS API](https://payos.vn/docs/api/): thông tin thu tiền có amountPaid/giao dịch và reference; API chi hộ là nhóm riêng, có khóa idempotency; phản hồi tạo chi có thể còn PROCESSING. Adapter hiện tại của repo chưa cung cấp các khả năng chi này. Chỉ dùng làm cơ sở thiết kế, không gọi giao dịch thật.
- [payOS signature](https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/): chữ ký API chi hộ khác nhóm payment-requests. Không tái sử dụng mù quáng hàm ký thu tiền nếu tích hợp chi sau này.
- [ExcelJS README](https://github.com/exceljs/exceljs/blob/master/README.md): hỗ trợ XLSX, công thức và streaming; cần bổ sung dependency và kiểm tra workbook sinh ra.
- [Microsoft Excel limits](https://support.microsoft.com/en-us/excel/excel-specifications-and-limits?cq_net=g): số có độ chính xác 15 chữ số; tham chiếu/ngân hàng và tiền vượt miền phải giữ dạng text chính xác.
- [PDFKit fonts/text](https://pdfkit.org/docs/text.html): tái sử dụng PDFKit/font đã có để xuất tiếng Việt.

Task GitHub hiện liên quan: [#148](https://github.com/VuaCoder/Tripin/issues/148), đã Closed nhưng chỉ mô tả tổng quát. Khi triển khai nên chia các đợt trên thành work items có tiêu chí nghiệm thu; không coi trạng thái Closed của issue là bằng chứng đã có luồng kế toán hoàn chỉnh.
