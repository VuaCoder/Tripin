# Kế hoạch dịch vụ bổ sung khi đặt tour

Ngày nghiên cứu: 14/11/2026. Trạng thái: đã triển khai code web MVP; migration schema dịch vụ đã áp dụng lên DB chung. Migration sửa quyền tour đoàn chờ phê duyệt riêng.

## Tiến độ triển khai web MVP — 14/11/2026

Đã bổ sung code cho Agency tạo/sửa dịch vụ trong editor tour; các mẫu đưa đón, ăn sáng, thiết bị và gói ảnh, kèm loại tự nhập. Checkout web chọn từng hành khách bằng ID ổn định, dùng chung hoặc riêng điểm đón; quote backend và tạo booking tính phí dịch vụ, kiểm tra lại điều kiện/giá dưới khóa, lưu snapshot. Trang tour, booking detail của Traveler/Agency, PDF danh sách hành khách, vé điện tử và email có thông tin dịch vụ.

Quyết định kỹ thuật MVP:

- Rút gọn popup Agency: chỉ nhập tên, giá/người, hạn đặt trước, mô tả và cấu hình đón nếu dùng mẫu đưa đón. Không hiển thị loại dịch vụ, cách tính, đơn vị, giới hạn mỗi booking, nhóm tuổi hay công tắc mở bán. Khi áp dụng, mặc định PER_PERSON, đơn vị người, mọi nhóm tuổi, active=true và maxQuantity=100 (trần kỹ thuật hiện có, không phải tồn kho). Các dịch vụ cũ được chuẩn hóa theo các mặc định này khi Agency bấm áp dụng; Hủy không thay đổi dữ liệu. Nút Xóa nằm ở đầu từng dịch vụ; xóa khỏi tour không sửa snapshot booking đã tạo.

- Form tour chỉ hiển thị tóm tắt và nút “Quản lý dịch vụ”. Cấu hình chi tiết nằm trong popup riêng, có cuộn nội dung và footer cố định. Chỉnh sửa trên bản nháp: “Áp dụng dịch vụ” kiểm tra dữ liệu rồi cập nhật form tour; “Hủy”, nút đóng hoặc Escape bỏ các thay đổi chưa áp dụng. Áp dụng không tự lưu tour lên server; vẫn dùng thao tác lưu tour hiện có.

- `Tour.optionalServices` và `Booking.serviceSnapshot` là JSONB được validate nghiêm ngặt, thay cho bốn bảng đề xuất dưới đây. Snapshot gồm giá, điều kiện, người sử dụng và điểm đón; cập nhật dịch vụ dùng endpoint tạo/sửa tour hiện có, giữ nguyên ranh giới quyền STAFF. Không có migration phá roster cũ.
- Giữ `Booking.subtotal` là tiền tour trước giảm để không đổi nghĩa contract hiện có; thêm `servicesSubtotal`. `totalAmount = max(0, subtotal - discountAmount) + servicesSubtotal`. Hoa hồng theo tổng thực thu; refund theo chính sách booking hiện có.
- Giới hạn số lượng là mỗi booking, chưa có tồn kho dịch vụ theo departure. Không dùng tính năng này làm cam kết giữ thiết bị/xe có tồn kho giới hạn. Giá đưa đón theo người, không theo xe/km.
- Điểm đón có sẵn được kiểm tra theo danh sách phía server. Địa chỉ tự nhập có vùng phục vụ/hướng dẫn hiển thị cho khách, chưa có geocoding để tự xác minh địa chỉ nằm trong vùng; Agency cần kiểm tra vận hành. Không quảng bá là xác thực vùng tự động.
- Custom tour giữ dịch vụ trong offer thương lượng, không cho cộng thêm dịch vụ từ source tour. Selector dịch vụ mới chỉ có ở checkout booking thường. Mobile chưa có UI chọn dịch vụ, API cũ có thể tiếp tục tạo booking không dịch vụ; các trường DTO bổ sung là additive.
- Không thêm/hủy dịch vụ riêng sau khi thanh toán; không đổi giá lịch sử khi Agency sửa tour.

Migration dịch vụ: `prisma/migrations/20261114000100_tour_optional_services/migration.sql` đã áp dụng lên DB chung theo yêu cầu người dùng, qua kết nối trực tiếp, trong transaction cùng bản ghi lịch sử/checksum. Prisma schema engine gặp P1001 trong môi trường này nên dùng script giới hạn phạm vi `backend/src/scripts/apply-tour-services-migrations.ts` với driver `pg` của ứng dụng. Metadata trước thay đổi được lưu cục bộ dưới `.test-artifacts/db-migrations/` (không chứa payload khách hàng hoặc credentials). Không reset hay xóa dữ liệu.

Migration sửa quyền role mặc định cho tour đoàn: `prisma/migrations/20261114000200_agency_custom_tour_role_defaults/migration.sql` chưa áp dụng trên DB chung: cơ chế duyệt an toàn yêu cầu phê duyệt riêng vì bổ sung `custom-tour:view` và `custom-tour:respond` cho template OWNER/MANAGER/STAFF chưa tùy chỉnh. Role tùy chỉnh và override thành viên được giữ nguyên theo thiết kế. Script mặc định chỉ chạy migration schema; cờ `--include-role-repair` chỉ dùng sau khi được phê duyệt riêng.

Các migration cũ thiếu lịch sử và lệch checksum vẫn giữ nguyên, chưa reconcile; không dùng `migrate deploy`/`db push` mù trên DB chung. Regenerate Prisma trước khi khởi động code mới.

Kiểm thử được chạy theo yêu cầu tiếp theo của người dùng, trên PostgreSQL tạm cục bộ, không dùng DB chung. Đã bổ sung kiểm tra booking 5 người/3 người đưa đón, từ chối điểm đón ngoài dịch vụ, conflict báo giá/idempotency và migration bảo toàn quyền tùy chỉnh. Kết quả cuối ghi trong bàn giao.

Các mục còn lại trong tài liệu là thiết kế/định hướng, không phải tuyên bố đã triển khai toàn bộ giai đoạn sau (tồn kho, custom offer services, mobile selection, giá theo vùng/km, sửa dịch vụ đã thanh toán).

## 1. Kết luận đề xuất

Agency cấu hình dịch vụ bán thêm trên từng tour. Traveler chọn dịch vụ và người sử dụng khi đặt tour. Một booking có thể có những hành khách sử dụng dịch vụ khác nhau; không buộc cả đoàn mua cùng một dịch vụ.

Ví dụ booking 5 người: A, B, C mua đưa đón; D, E tự đến điểm tập trung. Phí đưa đón chỉ tính cho A, B, C. Agency nhận được danh sách người cần đón cùng địa chỉ, thay vì một ghi chú chung không biết dành cho ai.

Phân biệt hai trường:

- `meetingPoint`: điểm tập trung mặc định, Agency quy định trên tour; hiển thị cho người tự di chuyển.
- Địa chỉ đón: dữ liệu thực hiện dịch vụ đưa đón đã được chọn; chỉ thu thập cho người sử dụng dịch vụ đó.

Không suy ra nhu cầu thị trường từ thống kê 30 booking/0 địa chỉ đón trước đây: trường dữ liệu hành khách mới chưa có người dùng, mẫu này không chứng minh khách không cần đưa đón.

## 2. Nghiên cứu tham khảo

- [Rezdy: thiết lập Extra](https://support.rezdy.com/hc/en-us/articles/19867826235420-How-To-Set-Up-an-Extra): có cách tính theo đơn, theo số người/số lượng và số lượng khách tự chọn. Đây là cơ sở phân biệt đơn vị tính thay vì mặc định nhân mọi dịch vụ với toàn bộ đoàn.
- [Rezgo: custom forms](https://support.rezgo.com/kb/how-to-add-custom-forms-to-inventory/): phân biệt thông tin mỗi khách và thông tin mỗi booking, có lựa chọn bổ sung làm thay đổi giá.
- [Rezdy: thiết lập điểm đón](https://support.rezdy.com/hc/en-us/articles/19867826805788-How-To-Create-Pickups): hỗ trợ danh sách điểm đón, phụ phí và cho phép yêu cầu địa điểm khác khi nhà cung cấp bật lựa chọn đó.

Các quy tắc dưới đây là đề xuất riêng cho Tripin, không phải khẳng định các sản phẩm trên có cùng nghiệp vụ hoàn tiền, phân quyền hoặc cấu trúc dữ liệu.

## 3. Hiện trạng code cần kế thừa

- `Tour.meetingPoint` đã tồn tại trong Prisma, validation, mapper và thông tin vé điện tử.
- `inclusions`/`exclusions` hiện là mô tả nội dung bao gồm/không bao gồm; chưa phải danh mục dịch vụ có giá và số lượng.
- Checkout hiện có `pickupPoint` tự do trên từng hành khách. Trường này được đưa vào `passengerSnapshot` và xuất danh sách khách, nhưng chưa gắn với dịch vụ mua thêm.
- `bookings.service.ts` tính giá tour, giảm giá, hoa hồng và tổng tiền phía server. Cần mở rộng điểm này, không cộng tiền chỉ ở UI.
- PayOS nhận số tiền từ booking đã lưu; phải hoàn tất báo giá và tạo booking trước khi tạo checkout.
- Booking thường dùng JSON passenger snapshot; custom tour dùng danh sách `BookingPassenger` và offer có revision. Không tạo thêm cơ chế hành khách thứ ba.
- Schema, migration và DB đã có dấu hiệu lệch nhau trong các lỗi gần đây. Cần kiểm tra drift trước migration tính năng; không coi các sửa SQL thủ công trước đây là một lịch sử migration hoàn chỉnh.

## 4. Danh mục và cấu hình của Agency

Trong tạo/sửa tour, thêm mục “Dịch vụ bổ sung” sau phần giá/bao gồm. Có mẫu điển hình nhưng tên, mô tả và giá do Agency nhập.

| Mẫu | Cách tính MVP | Thông tin bổ sung |
| --- | --- | --- |
| Đưa đón tận nơi | Theo người được chọn | Khu vực phục vụ, địa chỉ đón, hướng dẫn đón |
| Đón tại điểm có sẵn | Theo người được chọn | Danh sách điểm và hướng dẫn của Agency |
| Ăn sáng bổ sung | Theo người được chọn | Ghi rõ 1 bữa/ngày cụ thể hoặc gói cả chuyến |
| Thuê thiết bị | Theo số lượng | Đơn vị: bộ/chiếc; người nhận nếu cần |
| Gói ảnh riêng | Một lần mỗi booking | Mô tả phạm vi gói |
| Dịch vụ tự nhập | Chọn một trong ba cách tính trên | Tên, mô tả, đơn vị; không tự tạo form/script tùy ý |

Các trường tối thiểu: tên (2–120 ký tự), mô tả, loại (`PICKUP`, `MEAL`, `EQUIPMENT`, `OTHER`), cách tính (`PER_PERSON`, `PER_BOOKING`, `PER_UNIT`), giá VND nguyên không âm, đơn vị, nhóm tuổi áp dụng, hạn đặt trước, trạng thái bán. Mẫu chỉ là gợi ý, không tự bật sẵn và không tự thêm phí.

MVP giá cố định trong một tour, không có bảng giá động theo km hoặc từng ngày. Ăn sáng nhiều ngày được định nghĩa rõ thành gói, ví dụ “3 bữa sáng/người”; không ngầm nhân thêm số ngày. Giá 0 được ghi “Miễn phí” và vẫn chọn người nếu cần chuẩn bị phục vụ.

Một tiện ích đã bao gồm giá tour không được tạo thành khoản thu thêm mặc định. Agency cần sửa nội dung bao gồm hoặc làm rõ đó là gói nâng cấp trước khi mở bán.

Đưa đón có một chiều hoặc khứ hồi, phạm vi phục vụ và thời gian/hướng dẫn rõ ràng. Chọn một chế độ: điểm đón có sẵn, hoặc địa chỉ tự nhập trong vùng được hỗ trợ. MVP địa chỉ tự nhập là dịch vụ giá cố định theo vùng đã công bố, Agency cam kết phục vụ; địa chỉ ngoài vùng bị từ chối và hướng dẫn liên hệ, không thu tiền rồi mới thương lượng phí. Báo giá theo địa chỉ/chờ xác nhận là giai đoạn sau.

Không đưa thuê xe nguyên chuyến vào `PER_BOOKING` để xử lý ngầm: số ghế và giới hạn địa chỉ cần thiết kế riêng. MVP đưa đón bán theo người để tránh tính sai khi 3/5 khách sử dụng.

## 5. Luồng Traveler và nhóm 5 người/3 người dùng

Giữ thiết kế, component và nhịp bố cục checkout hiện tại; đây là màn hình thao tác, ưu tiên tên rõ, đơn vị tính rõ và sửa được dữ liệu.

1. Trang tour hiển thị điểm tập trung, dịch vụ bao gồm và dịch vụ mua thêm có nhãn giá riêng.
2. Khách chọn ngày/số người và nhập danh sách hành khách. Mỗi hành khách có ID ổn định ngay trong draft, không dùng index hay tên làm định danh.
3. Trong bước thông tin, mục “Dịch vụ bổ sung” cho chọn dịch vụ. Dịch vụ theo người mở danh sách tên để tick; có “Chọn tất cả”, mặc định không chọn. Có thể hiện “Hành khách 1” trước khi nhập đủ tên.
4. Chọn đưa đón cho A/B/C mới hiện phần địa chỉ dành cho ba người này. Có “Cùng điểm đón” để nhập một lần rồi gán cho nhiều người; có thể tách A/B một địa chỉ, C địa chỉ khác.
5. D/E hiển thị “Tự đến điểm tập trung: …”; không có ô nhập địa chỉ đón. Khi bỏ chọn, xóa dữ liệu địa chỉ khỏi payload và tổng tiền. Không cho submit địa chỉ qua API nếu không có dịch vụ phù hợp.
6. Tóm tắt trước thanh toán có từng khoản, người sử dụng, đơn vị và địa chỉ. Có nút sửa quay lại đúng bước, giữ nguyên draft.
7. Backend báo giá lại. Khi giá/cấu hình thay đổi, hiển thị khác biệt và yêu cầu xác nhận; không tự chuyển PayOS với số tiền mới.

Ví dụ giá minh họa, không phải giá thương mại:

| Khoản | Sử dụng | Thành tiền |
| --- | --- | --- |
| Tour 1.000.000đ/người | A, B, C, D, E | 5.000.000đ |
| Đưa đón 100.000đ/người | A, B, C | 300.000đ |
| Gói ăn sáng 60.000đ/người | B, D | 120.000đ |
| Tổng trước giảm giá | | 5.420.000đ |

Việc mua theo nhóm không yêu cầu tách thành 3 booking. Người đại diện trả một lần cho toàn booking, với phân bổ dịch vụ theo người. Nếu muốn mỗi người tự trả, đó là tính năng chia thanh toán riêng.

Khi giảm số khách, những người bị xóa sẽ mất phân bổ dịch vụ; UI phải báo và cập nhật giá. ID của người còn lại giữ nguyên. Khi đổi ngày, kiểm tra lại toàn bộ dịch vụ và không giữ địa chỉ/phân bổ của khách đã bị xóa.

Validation tên, năm sinh, lựa chọn người và địa chỉ đón chạy ngay trong bước nhập, hiển thị tại field; server kiểm tra tương tự. Không chờ đến nút thanh toán mới thông báo lỗi.

## 6. Mô hình dữ liệu đề xuất

- `TourService`: tenant/tour, ID ổn định, loại, tên, mô tả, cách tính, unitPrice BigInt, giới hạn số lượng, nhóm tuổi, cutoff, pickup config, active, version, sortOrder. Cấu hình có schema được kiểm tra, không lưu dữ liệu tùy ý chưa validate.
- `BookingService`: booking/service, snapshot tên/đơn vị/giá/quy tắc/version, quantity, lineTotal. Giữ service ID để tra cứu, giữ snapshot để lịch sử không thay đổi khi Agency sửa tour. Không xóa cascade lịch sử khi ngừng bán.
- `BookingServiceParticipant`: booking service, passenger ID ổn định. Unique theo service/người; quantity theo người bằng số phân bổ, không tin quantity gửi lên.
- `BookingPickupGroup`: booking service, địa chỉ hoặc ID điểm đón, snapshot hướng dẫn; phân bổ các participant vào nhóm đón. Mỗi người dùng một dịch vụ đưa đón chỉ thuộc một nhóm đón.
- Booking thêm `tourSubtotal`, `servicesSubtotal` và snapshot điểm tập trung. Quy định lại rõ `subtotal` tổng trước giảm, `discountAmount`, `totalAmount`.

Trước khi chốt DDL cần thống nhất định danh hành khách: booking thường thêm `passengerId` vào JSON snapshot; booking custom dùng `BookingPassenger.id`. Nếu dùng FK cứng chung thì phải chuẩn hóa roster của cả hai luồng về bảng trước; không khai báo FK trỏ vào JSON. MVP có thể dùng participant key trong phân bổ, validate membership ở server trong cùng transaction, sau đó chuẩn hóa ở một migration riêng được kiểm thử.

## 7. API, giá, thanh toán và tính nhất quán

- Agency CRUD dịch vụ qua `/agency/tours/:tourId/services`, yêu cầu quyền giá tương ứng OWNER/role được cấp; không cho STAFF quyền nội dung tự đổi phí. Kiểm tra tenant ở mọi truy vấn.
- Tour detail trả dịch vụ đang bán và version cấu hình. Không trả địa chỉ riêng của khách qua API công khai.
- Đề xuất `POST /bookings/quote`: departure, guest counts/participant keys, service IDs, người sử dụng/số lượng, pickup groups và mã giảm giá. Trả breakdown, version hoặc quote token có thời hạn. Endpoint phải kiểm tra quyền/giới hạn request phù hợp.
- `POST /bookings` nhận selections và quote version; server đọc lại dữ liệu, kiểm tra người thuộc booking, dịch vụ thuộc đúng tour/agency/ngày, hạn đặt, số lượng, vùng đón và giá. Không nhận đơn giá/tổng tiền do client quyết định.
- Idempotency key gắn với fingerprint nội dung booking: retry cùng key/cùng payload trả cùng kết quả; cùng key/khác selections trả conflict. Tránh tạo booking cũ nhưng hiển thị tổng tiền mới.
- Tạo booking, snapshot dịch vụ, phân bổ và giữ chỗ tour trong cùng transaction. Nếu có sức chứa dịch vụ, reserve và release đồng bộ khi hết hạn/hủy; cần khóa/atomic update, không chỉ kiểm tra ở UI.
- MVP đề xuất giảm giá chỉ trên tiền tour; phụ phí cộng sau giảm. Hoa hồng áp dụng trên tổng thực thu theo tỷ lệ hiện có, ghi snapshot. Đây là lựa chọn kinh doanh cần duyệt, không phải hành vi hiện có đã xác nhận. Audit mọi nơi dùng `subtotal`, premium voucher, thống kê và refund để không đổi nghĩa âm thầm.
- PayOS dùng `totalAmount` đã lưu; webhook và earnings giữ tính idempotent. Không thay đổi dịch vụ trên booking đã trả tiền trong MVP. Muốn thêm/bớt sau trả tiền cần đơn điều chỉnh và thu/hoàn bổ sung ở giai đoạn sau.
- Đề xuất MVP dịch vụ theo cùng chính sách hủy booking và snapshot riêng nội dung áp dụng. Chính sách hoàn phí khác nhau từng dịch vụ để giai đoạn sau; không tự diễn giải điều khoản pháp lý.

## 8. Booking đoàn thương lượng và vận hành

“Booking 5 người” thường và “Yêu cầu booking đoàn” thương lượng là hai luồng hiện có. Cả hai cần dùng cùng kiểu phân bổ dịch vụ.

Với custom tour, offer phải snapshot dịch vụ, giá, phạm vi, lựa chọn và phiên bản. Dịch vụ nằm trong gói đã thỏa thuận không bị tính thêm lần nữa. Đổi offer phải tăng revision, đánh dấu quote/draft cũ không còn hiệu lực và cho khách đọc lại trước chấp nhận. Không copy dịch vụ đang bán mới nhất từ source tour vào offer đã được chấp nhận.

MVP triển khai booking thường trước; custom tour chỉ mở mua thêm khi cơ chế offer revision đã tích hợp, trước đó phải ghi rõ dịch vụ thuộc gói thương lượng và không render selector mua thêm chưa hỗ trợ.

Agency booking detail/PDF cần danh sách theo dịch vụ và theo điểm đón: ai, bao nhiêu người, số liên hệ đại diện và hướng dẫn. Chỉ booking xác nhận mới vào danh sách phục vụ chính thức; booking pending phân biệt rõ. Guide/driver chỉ đọc dữ liệu đúng chuyến và quyền được cấp. Không đưa địa chỉ riêng vào danh sách review, tour public hoặc log.

## 9. Phạm vi MVP và mở rộng

MVP: mẫu đưa đón, ăn sáng, thuê thiết bị và gói chung; service tự nhập với trường cấu hình chuẩn; giá cố định; optional; chọn từng người; địa chỉ có điều kiện; quote server; snapshots; breakdown thanh toán; PDF vận hành; ngừng bán không phá lịch sử. Với dịch vụ có giới hạn vật lý, Agency chỉ được mở bán khi có hạn mức departure được reserve atomically; có thể hoãn loại dịch vụ này thay vì bán quá sức chứa.

Giai đoạn sau: thuê xe theo xe/chuyến, giá theo vùng/km, giá riêng trẻ em, chọn từng ngày/bữa, tồn kho thiết bị dùng chung nhiều tour, chờ Agency xác nhận địa chỉ ngoài vùng, bổ sung/hủy riêng dịch vụ sau thanh toán, chia thanh toán.

## 10. Thứ tự triển khai và tiêu chí nghiệm thu

1. Audit schema/migration và các luồng giá hiện có; chốt pricing/commission/refund; chạy migration đầy đủ trên DB branch riêng được xác minh bằng endpoint, không chỉ biến tên branch.
2. Shared DTO/constants và dữ liệu dịch vụ, version/snapshot/participant keys. Thử migration với booking cũ không có dịch vụ.
3. Agency CRUD, quyền sửa và ngừng bán. Tour public trình bày rõ bao gồm/mua thêm/meeting point.
4. Quote + create booking transaction, promotions, inventory, payment breakdown và DTO tương thích client.
5. Checkout chọn người, pickup conditional, validation tại bước, sửa dữ liệu/giữ draft; mobile cập nhật hoặc API version/feature gate trước khi bật rộng.
6. Agency/PDF/email/vé, rồi tích hợp custom offer revision. Kiểm thử staging trước rollout.

Các ca bắt buộc:

- 5 người/3 đưa đón: đúng 3 người, đúng 3 phần phí; hai người còn lại không có địa chỉ đón.
- Bỏ chọn đưa đón hoặc tour không bán đưa đón: UI ẩn input; API từ chối dữ liệu đón dư.
- Một địa chỉ chung hoặc nhiều nhóm đón, dịch vụ miễn phí, nhiều dịch vụ khác người sử dụng.
- Giả giá, service ID của agency khác, passenger key không tồn tại, key trùng, quantity sai, trẻ không thuộc nhóm được dùng.
- Đổi ngày/giá/tắt dịch vụ trong lúc checkout; cần đọc lại và xác nhận đúng giá.
- Hai người tranh suất dịch vụ cuối cùng; pending hết hạn/hủy chỉ trả tồn một lần.
- Retry submit/webhook không thu hai lần; lỗi dịch vụ không giữ chỗ tour mồ côi.
- Paid booking không đổi khi Agency sửa tên/giá; tiền tour/giảm giá/phụ phí/hoa hồng/refund khớp nhau.
- Custom offer cũ không mua nhầm dịch vụ phiên bản mới; mobile cũ vẫn đọc booking cũ không phụ phí.

## 11. Quyết định cần chốt trước xây dựng

Khuyến nghị dùng các mặc định trong kế hoạch để ước lượng và thiết kế: đưa đón theo người, địa chỉ trong vùng phục vụ giá cố định; dịch vụ optional không chọn sẵn; giảm giá trên tiền tour; hoa hồng trên tổng thực thu; không sửa dịch vụ sau thanh toán; custom-tour rollout sau booking thường. Các lựa chọn này cần xác nhận khi chốt scope triển khai, không cản trở việc nghiên cứu/kế hoạch hiện tại.
