"""Build the Agency functional document (.docx) with LibreOffice UNO.

Run with a headless soffice listening on port 2002:
  soffice --headless --accept='socket,host=127.0.0.1,port=2002;urp;StarOffice.ServiceManager' &
  python3 docs/agency/build_agency_doc.py
"""
import os
import uno
from com.sun.star.beans import PropertyValue

PARAGRAPH_BREAK = uno.getConstantByName("com.sun.star.text.ControlCharacter.PARAGRAPH_BREAK")
PAGE_BEFORE = uno.Enum("com.sun.star.style.BreakType", "PAGE_BEFORE")
BREAK_NONE = uno.Enum("com.sun.star.style.BreakType", "NONE")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOTS = ROOT + "/docs/testing/agency-roles/screenshots/"
OUT = ROOT + "/docs/agency/AGENCY-FUNCTIONS.docx"

local = uno.getComponentContext()
resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
ctx = resolver.resolve("uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext")
smgr = ctx.ServiceManager
desktop = smgr.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
doc = desktop.loadComponentFromURL("private:factory/swriter", "_blank", 0, ())
text = doc.Text
cursor = text.createTextCursor()
provider = smgr.createInstanceWithContext("com.sun.star.graphic.GraphicProvider", ctx)

# ---------- styles & page ----------
styles = doc.StyleFamilies.getByName("ParagraphStyles")
standard = styles.getByName("Standard")
standard.CharFontName = "Arial"
standard.CharHeight = 11
standard.ParaBottomMargin = 120
for name in ("Text body", "Heading", "Contents Heading"):
    styles.getByName(name).CharFontName = "Arial"

for name, size, color, bold, before, after in [
    ("Heading 1", 20, 0x0F4C5C, True, 0, 300),
    ("Heading 2", 14, 0x0F4C5C, True, 400, 200),
    ("Heading 3", 12, 0x333333, True, 300, 150),
]:
    s = styles.getByName(name)
    s.CharFontName = "Arial"
    s.CharHeight = size
    s.CharColor = color
    s.CharWeight = 150 if bold else 100
    s.ParaTopMargin = before
    s.ParaBottomMargin = after
    s.BreakType = PAGE_BEFORE if name == "Heading 1" else BREAK_NONE

styles.getByName("Title").CharFontName = "Arial"
styles.getByName("Title").CharHeight = 30
styles.getByName("Title").CharColor = 0x0F4C5C
styles.getByName("Title").CharWeight = 150
styles.getByName("Subtitle").CharFontName = "Arial"
styles.getByName("Subtitle").CharHeight = 14
styles.getByName("Subtitle").CharColor = 0x555555
styles.getByName("Caption").CharFontName = "Arial"
styles.getByName("Caption").CharHeight = 9
styles.getByName("Caption").CharColor = 0x666666
styles.getByName("Caption").CharPosture = 2
styles.getByName("Caption").ParaAdjust = 3

pages = doc.StyleFamilies.getByName("PageStyles")
page = pages.getByName("Standard")
page.Width = 21000
page.Height = 29700
page.LeftMargin = 2000
page.RightMargin = 2000
page.TopMargin = 1800
page.BottomMargin = 1800
page.HeaderIsOn = True
page.FooterIsOn = True
page.HeaderHeight = 800
page.FooterHeight = 800

header = page.HeaderText
hc = header.createTextCursor()
hc.CharFontName = "Arial"
hc.CharHeight = 8
hc.CharColor = 0x777777
header.insertString(hc, "Tripin Partner Portal  ·  Tài liệu chức năng Agency", False)

footer = page.FooterText
fc = footer.createTextCursor()
fc.CharFontName = "Arial"
fc.CharHeight = 8
fc.CharColor = 0x777777
fc.ParaAdjust = 3
footer.insertString(fc, "Trang ", False)
page_number = doc.createInstance("com.sun.star.text.TextField.PageNumber")
page_number.NumberingType = 4  # ARABIC
footer.insertTextContent(fc, page_number, False)
footer.insertString(fc, " / ", False)
page_count = doc.createInstance("com.sun.star.text.TextField.PageCount")
page_count.NumberingType = 4
footer.insertTextContent(fc, page_count, False)

doc.DocumentProperties.Title = "Tài liệu chức năng cổng đối tác Agency"
doc.DocumentProperties.Subject = "Tripin Partner Portal"
doc.DocumentProperties.Author = "Tripin"

# ---------- helpers ----------
def brk(kind=PARAGRAPH_BREAK):
    text.insertControlCharacter(cursor, kind, False)


def para(value, style="Text body", size=None, color=None, bold=False, italic=False, align=None):
    cursor.ParaStyleName = style
    cursor.ParaLeftMargin = 0
    cursor.ParaFirstLineIndent = 0
    if size:
        cursor.CharHeight = size
    if color:
        cursor.CharColor = color
    cursor.CharWeight = 150 if bold else 100
    cursor.CharPosture = 2 if italic else 0
    if align is not None:
        cursor.ParaAdjust = align
    text.insertString(cursor, value, False)
    brk()


def label(head, value):
    cursor.ParaStyleName = "Text body"
    cursor.ParaLeftMargin = 0
    cursor.ParaFirstLineIndent = 0
    cursor.CharWeight = 150
    cursor.CharColor = 0x0F4C5C
    text.insertString(cursor, head + " ", False)
    cursor.CharWeight = 100
    cursor.CharColor = 0x222222
    text.insertString(cursor, value, False)
    brk()


def bullets(items):
    for item in items:
        cursor.ParaStyleName = "Text body"
        cursor.ParaLeftMargin = 500
        cursor.ParaFirstLineIndent = -300
        cursor.CharWeight = 100
        cursor.CharColor = 0x222222
        text.insertString(cursor, "•  " + item, False)
        brk()


def table(rows, widths=None, header_row=True):
    t = doc.createInstance("com.sun.star.text.TextTable")
    t.initialize(len(rows), len(rows[0]))
    text.insertTextContent(cursor, t, False)
    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            cell = t.getCellByPosition(c, r)
            cell.String = str(value)
            tc = cell.getText().createTextCursor()
            tc.gotoEnd(True)
            tc.CharFontName = "Arial"
            tc.CharHeight = 9
            if header_row and r == 0:
                tc.CharWeight = 150
                cell.BackColor = 0xE8F1F2
    brk()


def image(name, caption):
    global figure
    figure += 1
    url = "file://" + SHOTS + name
    graphic = provider.queryGraphic((PropertyValue("URL", 0, url, 0),))
    obj = doc.createInstance("com.sun.star.text.GraphicObject")
    obj.Graphic = graphic
    ratio = graphic.Size.Height / graphic.Size.Width
    obj.Width = 16500
    obj.Height = int(16500 * ratio)
    obj.AnchorType = 1  # AS_CHARACTER
    text.insertTextContent(cursor, obj, False)
    brk()
    para("Hình %d. %s" % (figure, caption), "Caption")


def page_break():
    cursor.ParaStyleName = "Text body"
    cursor.BreakType = PAGE_BEFORE
    text.insertString(cursor, "", False)
    brk()


figure = 0

# ---------- cover ----------
para("TÀI LIỆU CHỨC NĂNG", "Title")
para("CỔNG ĐỐI TÁC AGENCY", "Title")
para("Tripin Partner Portal  ·  Đặc tả tính năng theo màn hình", "Subtitle")
para("")
table([
    ["Phiên bản", "1.0"],
    ["Ngày", "14/11/2026"],
    ["Phạm vi", "4 vai trò · 23 màn hình · 17 nhóm chức năng"],
    ["Nguồn", "docs/testing/agency-roles/FEATURES.md và REPORT.md"],
    ["Đối tượng", "BA · QA · Frontend · Backend"],
], widths=[3500, 13500], header_row=False)
para("Tài liệu mô tả hành vi hiện tại của cổng đối tác Agency. Ảnh chụp lấy từ lượt kiểm thử E2E "
     "213/213 checks pass ngày 14/11/2026; dữ liệu trong ảnh là dữ liệu fixture QA.", italic=True, color=0x666666)
page_break()

# ---------- TOC ----------
para("Mục lục", "Contents Heading", size=16, color=0x0F4C5C, bold=True)
toc = doc.createInstance("com.sun.star.text.ContentIndex")
toc.Title = ""
toc.CreateFromOutline = True
toc.Level = 2
text.insertTextContent(cursor, toc, False)
brk()

# ---------- 1 ----------
para("1. Tổng quan & vai trò", "Heading 1")
para("Cổng đối tác Agency là không gian làm việc đa tenant cho doanh nghiệp lữ hành. Mỗi tài khoản có thể "
     "thuộc nhiều doanh nghiệp; sau khi chọn doanh nghiệp, mọi request `/agency/*` được gắn header "
     "`X-Agency-Id` để backend giới hạn dữ liệu theo tenant. Vai trò thành viên (`AgencyMember.role`) "
     "độc lập với role toàn cục `AGENCY` của tài khoản.")
para("1.1 Vai trò & quyền", "Heading 2")
table([
    ["Vai trò", "Phạm vi chính", "Không có"],
    ["OWNER", "Toàn bộ quyền của MANAGER; quản lý đội ngũ, role, tài chính, import tour, xoá/lưu trữ tour, premium", "—"],
    ["MANAGER", "Tour (trừ xoá/import), lịch, booking, voucher, khiếu nại, đánh giá, dashboard", "Đội ngũ, tài chính, premium"],
    ["STAFF", "Tour được giao, nội dung tour, theo dõi booking, yêu cầu đoàn, hộp thư", "Tour CRUD, lịch, booking đầy đủ, voucher, khiếu nại, đội ngũ"],
    ["ACCOUNTANT", "Dashboard, danh sách/chi tiết booking, chiết khấu (chỉ xem)", "Tour, lịch, đội ngũ, voucher, khiếu nại, chat"],
], widths=[2500, 9000, 5500])
para("1.2 Bản đồ màn hình", "Heading 2")
table([
    ["Màn hình", "Đường dẫn", "Quyền chính", "Vai trò"],
    ["Đăng nhập đối tác", "/agency/login", "Công khai", "Tất cả"],
    ["Chọn nơi làm việc", "/workplaces", "Membership", "Tất cả"],
    ["Tổng quan", "/agency", "agency:dashboard", "OWNER, MANAGER, ACCOUNTANT"],
    ["Danh sách tour", "/agency/tours", "agency:tour-view", "OWNER, MANAGER, STAFF"],
    ["Tạo tour", "/agency/tours/new", "tour:create", "OWNER, MANAGER"],
    ["Import tour", "/agency/tours/import", "tour:import", "OWNER"],
    ["Chi tiết tour", "/agency/tours/:id", "agency:tour-view", "OWNER, MANAGER, STAFF (STAFF chỉ xem)"],
    ["Sửa tour", "/agency/tours/:id/edit", "tour:update-own", "OWNER, MANAGER"],
    ["Lịch khởi hành", "/agency/calendar", "tour:update-own / tour:set-availability", "OWNER, MANAGER"],
    ["Đơn đặt chỗ", "/agency/bookings", "agency:bookings-view", "OWNER, MANAGER, ACCOUNTANT"],
    ["Nội dung được giao", "/agency/work/tours", "agency:tour-view", "OWNER, MANAGER, STAFF"],
    ["Theo dõi booking", "/agency/work/bookings", "agency:booking-monitor", "OWNER, MANAGER, STAFF"],
    ["Đội ngũ", "/agency/team", "agency:team-view", "OWNER"],
    ["Yêu cầu tham gia", "/agency/team/requests", "OWNER (server)", "OWNER"],
    ["Khuyến mãi & voucher", "/agency/promotions", "promotion:agency-manage", "OWNER, MANAGER"],
    ["Khiếu nại", "/agency/complaints", "complaint:respond", "OWNER, MANAGER"],
    ["Đánh giá", "/agency/reviews", "review:dispute", "OWNER, MANAGER"],
    ["Premium", "/agency/premium", "premium:contribute", "OWNER"],
    ["Yêu cầu đoàn", "/agency/custom-tours", "custom-tour:view", "OWNER, MANAGER, STAFF"],
    ["Hộp thư & tin nhắn", "/agency/conversations", "chat:use", "OWNER, MANAGER, STAFF"],
    ["Chiết khấu hoa hồng", "/agency/settings/commission", "agency:context-view / agency:finance-manage", "Xem: OWNER, MANAGER, ACCOUNTANT; gửi: OWNER"],
    ["Thông báo", "/agency/notifications", "agency:context-view", "Tất cả"],
    ["Hồ sơ doanh nghiệp", "/agency/settings/profile", "Không gate (sửa: legacy owner)", "Tất cả (xem)"],
], widths=[3700, 4800, 5300, 3200])

# ---------- 2 ----------
para("2. Đăng nhập & chọn nơi làm việc", "Heading 1")
para("2.1 Đăng nhập cổng đối tác", "Heading 2")
label("Kích hoạt:", "Truy cập `/agency/login`, hoặc bị chuyển hướng khi mở trang `/agency/*` mà chưa có phiên.")
label("Mô tả:", "Xác thực bằng email và mật khẩu dành cho tài khoản đối tác. Tài khoản du khách bị từ chối và "
      "được hướng về cổng du khách; tài khoản đối tác chưa hoàn thiện hồ sơ được đưa sang luồng onboarding.")
label("Bố cục màn hình:", "Form đăng nhập hai cột: thương hiệu bên trái, form bên phải; có ghi nhớ đăng nhập, "
      "quên mật khẩu, đăng ký và đăng nhập Google nếu cấu hình.")
image("account-states/state-wrong-password.png", "Đăng nhập sai mật khẩu — thông báo lỗi tại chỗ.")
label("Chi tiết chức năng:", "")
bullets([
    "Bắt buộc email hợp lệ và mật khẩu; lỗi hiển thị ngay dưới form, không lộ tài khoản có tồn tại hay không.",
    "Sau khi đăng nhập: một doanh nghiệp → vào `/agency`; từ hai doanh nghiệp → `/workplaces` để chọn.",
    "Rate limit 20 lượt / 15 phút / IP cho các endpoint xác thực; vượt hạn mức trả lỗi 429 theo envelope chung.",
    "Phiên dùng access token ngắn hạn + refresh token; session được khôi phục khi tải lại trang.",
    "Tài khoản AGENCY không đăng nhập được cổng du khách (`AGENCY_PORTAL_REQUIRED`).",
])

para("2.2 Chọn nơi làm việc", "Heading 2")
label("Kích hoạt:", "Sau đăng nhập khi tài khoản có từ hai membership, hoặc mở trực tiếp `/workplaces`.")
label("Mô tả:", "Liệt kê các doanh nghiệp mà tài khoản là thành viên, kèm vai trò và trạng thái; cho phép mở "
      "doanh nghiệp, tham gia bằng mã mời và xem lời mời đang chờ.")
label("Bố cục màn hình:", "Danh sách dạng bảng, mỗi dòng có tên doanh nghiệp, vai trò, trạng thái và nút "
      "“Mở doanh nghiệp”; tab “Lời mời của tôi” nằm cạnh tab “Doanh nghiệp”.")
image("invitation/invitation-two-memberships.png", "Hai nơi làm việc của cùng một tài khoản.")
label("Chi tiết chức năng:", "")
bullets([
    "Chỉ hiển thị membership đang ACTIVE; membership SUSPENDED/REMOVED không mở được context.",
    "Chọn doanh nghiệp sẽ đặt `activeAgencyId`; header `X-Agency-Id` được gắn cho các request `/agency/*`.",
    "Nếu chỉ có một membership, hệ thống tự chọn và không bắt buộc qua màn hình này.",
    "Tham gia bằng mã mời: nhập mã, hệ thống kiểm tra hạn dùng, trạng thái và role mặc định.",
])

para("2.3 Nhận lời mời", "Heading 2")
label("Kích hoạt:", "Tab “Lời mời của tôi” tại `/workplaces` sau khi được OWNER mời bằng email.")
label("Mô tả:", "Hiển thị lời mời kèm doanh nghiệp và vai trò dự kiến; người dùng chấp nhận để trở thành "
      "thành viên hoặc từ chối để bỏ qua.")
label("Bố cục màn hình:", "Danh sách lời mời có nút “Chấp nhận lời mời”; sau khi nhận, doanh nghiệp xuất hiện "
      "trong tab “Doanh nghiệp”.")
image("invitation/invitation-accepted.png", "Lời mời đã được chấp nhận.")
label("Chi tiết chức năng:", "")
bullets([
    "Lời mời có thời hạn; hết hạn hoặc đã thu hồi thì không chấp nhận được.",
    "Chấp nhận tạo membership với role đã chọn; nếu email đã là thành viên thì báo lỗi thay vì tạo trùng.",
    "Sau khi chấp nhận, người dùng có thể mở doanh nghiệp ngay từ danh sách.",
])

# ---------- 3 ----------
para("3. Tổng quan doanh nghiệp", "Heading 1")
para("3.1 Bảng điều khiển", "Heading 2")
label("Kích hoạt:", "Màn hình mặc định sau khi chọn doanh nghiệp; menu “Tổng quan”.")
label("Mô tả:", "Tóm tắt hoạt động kinh doanh của agency trong kỳ đã chọn: khách hàng, đơn đặt chỗ, doanh thu, "
      "hoa hồng, thực nhận, top tour và các việc cần xử lý.")
label("Bố cục màn hình:", "Bốn KPI trên cùng, biểu đồ doanh thu theo kỳ, top tour bán chạy, thẻ đơn đặt chỗ và "
      "tour/phản hồi; sidebar thay đổi theo vai trò.")
image("role-matrix/matrix-owner-landing.png", "Bảng điều khiển góc nhìn OWNER.")
label("Chi tiết chức năng:", "")
bullets([
    "Kỳ báo cáo: 7 ngày, 30 ngày hoặc 6 tháng; số liệu tính theo ngày khởi hành và trạng thái booking.",
    "Doanh thu gộp, hoa hồng nền tảng và thực nhận là ba chỉ số tách biệt, không cộng dồn vào nhau.",
    "Top tour xếp theo doanh thu tích luỹ trong kỳ; tour không có booking vẫn có thể xuất hiện ở mục quản lý.",
    "OWNER/MANAGER thấy toàn bộ; ACCOUNTANT chỉ thấy số liệu tài chính; STAFF bị chuyển về “Nội dung được giao”.",
])

# ---------- 4 ----------
para("4. Quản lý tour", "Heading 1")
para("4.1 Danh sách tour", "Heading 2")
label("Kích hoạt:", "Menu “Quản lý tour” (`/agency/tours`).")
label("Mô tả:", "Danh sách tour của agency với bộ lọc trạng thái, tìm kiếm, phân trang và các thao tác theo quyền.")
label("Bố cục màn hình:", "Bảng tour gồm ảnh bìa, tên, trạng thái, giá, số ngày và menu thao tác; nút “Tạo tour” "
      "và “Import” hiển thị theo quyền.")
image("owner/owner-tour-archived.png", "Danh sách tour với badge trạng thái và thao tác.")
label("Chi tiết chức năng:", "")
bullets([
    "Trạng thái: DRAFT (nháp), PENDING_REVIEW (chờ duyệt), APPROVED (đã duyệt), ARCHIVED (lưu trữ).",
    "OWNER/MANAGER tạo, sửa, lưu trữ/khôi phục; STAFF chỉ xem danh sách và mở tour được giao.",
    "Tour PENDING_REVIEW và ARCHIVED bị khoá nội dung; chỉ trạng thái DRAFT/APPROVED mới sửa được.",
    "Tìm kiếm theo tên; lọc theo trạng thái; phân trang giữ bộ lọc khi quay lại.",
])

para("4.2 Tạo tour", "Heading 2")
label("Kích hoạt:", "Nút “Tạo tour” tại danh sách tour (`/agency/tours/new`).")
label("Mô tả:", "Tạo tour mới theo stepper bốn bước: nội dung → hình ảnh → dịch vụ bao gồm/không bao gồm → "
      "chính sách & giá; có thể lưu nháp hoặc gửi duyệt.")
label("Bố cục màn hình:", "Stepper bốn bước, cột phải là phần xem trước; sau khi lưu, hệ thống mở workspace "
      "của tour vừa tạo.")
image("owner/owner-tour-created.png", "Tour vừa tạo ở trạng thái nháp.")
label("Chi tiết chức năng:", "")
bullets([
    "Bước 1: tên, mô tả, danh mục, thời lượng, điểm khởi hành; bắt buộc tên và mô tả.",
    "Bước 2: ảnh bìa bằng URL hoặc tải file; kiểm tra định dạng và dung lượng.",
    "Bước 3: danh sách dịch vụ bao gồm/không bao gồm, highlight; thêm/xoá từng dòng.",
    "Bước 4: giá cơ bản, chính sách huỷ, lịch trình; lưu nháp hoặc gửi duyệt.",
    "Gửi duyệt chuyển trạng thái PENDING_REVIEW; thiếu lịch khởi hành bị chặn kèm hướng dẫn.",
])

para("4.3 Chi tiết & chỉnh sửa tour", "Heading 2")
label("Kích hoạt:", "Mở một tour từ danh sách (`/agency/tours/:id`) hoặc nút “Sửa nội dung tour” "
      "(`/agency/tours/:id/edit`).")
label("Mô tả:", "Workspace quản lý toàn bộ nội dung tour: thông tin, lịch trình, khởi hành & giá vé, phân công "
      "hướng dẫn viên và xuất danh sách khách.")
label("Bố cục màn hình:", "Cột trái là các khối thông tin tour, lịch trình, khởi hành & giá vé; cột phải là "
      "thanh thao tác theo quyền.")
image("manager/manager-final.png", "Workspace tour góc nhìn MANAGER.")
label("Chi tiết chức năng:", "")
bullets([
    "Lịch trình: thêm/sửa/xoá từng ngày, thứ tự ngày và nội dung hoạt động.",
    "Khởi hành & giá vé: thêm ngày, giá, sức chứa, trạng thái mở bán; kiểm tra chồng lấn và ngày quá khứ.",
    "Phân công hướng dẫn viên theo ngày khởi hành; chỉ hiện hướng dẫn viên đủ điều kiện.",
    "Xuất PDF danh sách khách theo departure hoặc toàn tour; PDF dùng font DejaVu để hiển thị tiếng Việt.",
    "STAFF mở được workspace nhưng chỉ sửa các trường được cấp; không thấy nút sửa toàn bộ.",
])

para("4.4 Lưu trữ & khôi phục", "Heading 2")
label("Kích hoạt:", "Menu thao tác trên dòng tour → “Lưu trữ tour” hoặc “Khôi phục tour”.")
label("Mô tả:", "Ẩn tour khỏi bề mặt công khai mà không xoá dữ liệu; có thể khôi phục về trạng thái trước đó.")
label("Chi tiết chức năng:", "")
bullets([
    "Chỉ OWNER có `tour:delete-own` được lưu trữ/khôi phục; MANAGER và STAFF không thấy thao tác.",
    "Tour ARCHIVED bị khoá nội dung, không nhận booking mới và không hiện trong tìm kiếm công khai.",
    "Khôi phục đưa tour về trạng thái APPROVED/DRAFT tương ứng trước khi lưu trữ.",
])

para("4.5 Import tour", "Heading 2")
label("Kích hoạt:", "Nút “Import” tại danh sách tour (`/agency/tours/import`), chỉ OWNER.")
label("Mô tả:", "Nhập nhiều tour từ tài liệu theo mẫu, xem trước và tạo hàng loạt.")
label("Chi tiết chức năng:", "")
bullets([
    "Hỗ trợ tệp theo mẫu; kiểm tra tiêu đề, giá, thời lượng và lịch khởi hành trước khi tạo.",
    "Hiển thị lỗi theo dòng; không tạo tour nào nếu tệp sai cấu trúc.",
    "Tour import vào trạng thái DRAFT để OWNER rà soát trước khi gửi duyệt.",
])

# ---------- 5 ----------
para("5. Lịch khởi hành", "Heading 1")
para("5.1 Lịch tháng", "Heading 2")
label("Kích hoạt:", "Menu “Lịch khởi hành” (`/agency/calendar`).")
label("Mô tả:", "Quản lý lịch khởi hành của tất cả tour theo tháng; thêm, sửa, xoá và theo dõi sức chứa.")
label("Bố cục màn hình:", "Lịch tháng bên phải, danh sách tour bên trái; mỗi ngày có badge tour và số chỗ; "
      "form thêm lịch ở panel phải.")
image("owner/owner-calendar-saved.png", "Lịch tháng sau khi thêm ngày khởi hành.")
label("Chi tiết chức năng:", "")
bullets([
    "Thêm lịch: chọn tour, ngày, giờ, giá, sức chứa, trạng thái mở bán; có thể lặp hàng tuần.",
    "Sửa/xoá từng ngày; ngày đã có booking không xoá được, chỉ đóng bán.",
    "Kiểm tra chồng lấn cùng tour, ngày quá khứ và sức chứa vượt giới hạn.",
    "Chỉ OWNER/MANAGER có quyền; STAFF và ACCOUNTANT không thấy menu.",
])

# ---------- 6 ----------
para("6. Đơn đặt chỗ", "Heading 1")
para("6.1 Danh sách & chi tiết booking", "Heading 2")
label("Kích hoạt:", "Menu “Đơn đặt chỗ” (`/agency/bookings`), mở một dòng để xem chi tiết.")
label("Mô tả:", "Theo dõi booking của agency: khách, số khách, thanh toán, hoa hồng, trạng thái và danh sách "
      "hành khách theo departure.")
label("Bố cục màn hình:", "Bảng booking có bộ lọc; trang chi tiết chia khối thông tin đặt chỗ, thanh toán, "
      "hành khách và lịch sử.")
image("owner/owner-booking-detail.png", "Chi tiết booking và danh sách hành khách.")
label("Chi tiết chức năng:", "")
bullets([
    "Lọc theo trạng thái, tour, khoảng ngày khởi hành; tìm theo mã booking hoặc tên khách.",
    "Cột chính: mã, khách, tour, ngày khởi hành, số khách, thanh toán, hoa hồng, trạng thái.",
    "Chi tiết: người liên hệ, hành khách (năm sinh/nhóm tuổi/điểm đón/ghi chú), trạng thái hoàn tiền.",
    "ACCOUNTANT xem được danh sách/chi tiết nhưng không xuất PDF; STAFF chỉ theo dõi ở màn hình việc được giao.",
])

para("6.2 Xuất PDF danh sách khách", "Heading 2")
label("Kích hoạt:", "Nút xuất PDF trong chi tiết booking hoặc workspace tour.")
label("Mô tả:", "Xuất danh sách khách theo departure hoặc toàn tour để bàn giao cho hướng dẫn viên.")
label("Chi tiết chức năng:", "")
bullets([
    "PDF hiển thị tiếng Việt bằng font DejaVu; tên tệp theo mã tour/ngày khởi hành.",
    "Chỉ OWNER/MANAGER có quyền xuất; ACCOUNTANT và STAFF không thấy nút.",
    "Dữ liệu lấy tại thời điểm xuất; hành khách thiếu thông tin hiển thị “—”, không chặn xuất.",
])

# ---------- 7 ----------
para("7. Nội dung được giao (STAFF)", "Heading 1")
para("7.1 Nội dung tour", "Heading 2")
label("Kích hoạt:", "Menu “Nội dung được giao” (`/agency/work/tours`) hoặc trang mặc định của STAFF.")
label("Mô tả:", "STAFF chỉ thấy các tour được phân công và chỉ sửa những trường nội dung được phép.")
label("Bố cục màn hình:", "Danh sách tour kèm trạng thái và nút “Chỉnh nội dung” chỉ xuất hiện với tour DRAFT "
      "được cấp quyền.")
image("staff/staff-final.png", "Danh sách tour được giao của STAFF.")
label("Chi tiết chức năng:", "")
bullets([
    "Trường được sửa: tiêu đề, mô tả, hình ảnh, highlights, dịch vụ bao gồm/không bao gồm.",
    "Không sửa giá, lịch khởi hành, chính sách huỷ hoặc trạng thái tour.",
    "Tour PENDING_REVIEW/ARCHIVED chỉ xem; tour ngoài scope không xuất hiện trong danh sách.",
])

para("7.2 Theo dõi booking", "Heading 2")
label("Kích hoạt:", "Menu “Theo dõi booking” (`/agency/work/bookings`).")
label("Mô tả:", "STAFF xem booking của các tour được giao ở mức thông tin tối thiểu để phục vụ vận hành.")
label("Chi tiết chức năng:", "")
bullets([
    "50 dòng/trang; chỉ hiển thị mã booking, khách, tour, ngày khởi hành, số khách và trạng thái.",
    "Không hiển thị doanh thu, hoa hồng, thanh toán hoặc nút xuất khách.",
    "Bộ lọc theo tour/ngày; dữ liệu giới hạn theo tour được phân công.",
])

para("7.3 Chi tiết tour read-only", "Heading 2")
label("Kích hoạt:", "STAFF mở tour từ danh sách hoặc URL `/agency/tours/:id`.")
label("Mô tả:", "STAFF xem được toàn bộ nội dung tour nhưng không có quyền chỉnh sửa.")
label("Bố cục màn hình:", "Workspace tour đầy đủ, không có nút “Sửa nội dung tour”; các trường chỉ đọc.")
image("fixes/verify-fix-staff-tour-detail.png", "STAFF xem chi tiết tour ở chế độ chỉ đọc.")
label("Chi tiết chức năng:", "")
bullets([
    "Trang chi tiết mở bằng `agency:tour-view`; nút sửa chỉ hiện khi có `tour:update-own`.",
    "Truy cập trực tiếp `/agency/tours/:id/edit` bị chặn bằng thông báo quyền.",
])

# ---------- 8 ----------
para("8. Đội ngũ & phân quyền", "Heading 1")
para("8.1 Thành viên", "Heading 2")
label("Kích hoạt:", "Menu “Thành viên & phân quyền” (`/agency/team`), chỉ OWNER.")
label("Mô tả:", "Quản lý thành viên, vai trò, trạng thái và quyền hiệu lực của từng người.")
label("Bố cục màn hình:", "Bảng thành viên với tab Thành viên / Lời mời / Yêu cầu tham gia / Role & bộ quyền; "
      "nút “Thêm thành viên” và “Mã mời”.")
image("invitation/invitation-created.png", "Tab lời mời sau khi gửi lời mời thành công.")
label("Chi tiết chức năng:", "")
bullets([
    "Bảng gồm tên, email, vai trò, trạng thái, ngày tham gia và quyền hiện tại.",
    "Đổi role/trạng thái ACTIVE/SUSPENDED/REMOVED; thay đổi có hiệu lực ngay và bump `permissionVersion`.",
    "Không thể hạ quyền OWNER cuối cùng của doanh nghiệp.",
    "Thành viên SUSPENDED/REMOVED mất quyền truy cập ngay ở lần request kế tiếp.",
])

para("8.2 Lời mời", "Heading 2")
label("Kích hoạt:", "Tab “Lời mời” trong `/agency/team`.")
label("Mô tả:", "Mời thành viên bằng email với role MANAGER/STAFF/ACCOUNTANT hoặc role tuỳ chỉnh; thu hồi lời mời "
      "đang chờ.")
label("Chi tiết chức năng:", "")
bullets([
    "Lời mời hiển thị email, role, trạng thái và hạn dùng; gửi lại/thu hồi được khi còn chờ.",
    "Email chỉ chứa hướng dẫn vào `/workplaces`; không có link token trực tiếp.",
    "Chấp nhận lời mời tạo membership; hết hạn hoặc đã thu hồi thì không dùng được.",
])

para("8.3 Yêu cầu tham gia", "Heading 2")
label("Kích hoạt:", "Tab “Yêu cầu tham gia” (`/agency/team/requests`), chỉ OWNER.")
label("Mô tả:", "Duyệt hoặc từ chối người dùng đã gửi yêu cầu bằng mã mời của doanh nghiệp.")
label("Bố cục màn hình:", "Danh sách yêu cầu kèm tên/email, thời gian gửi, select role và nút Duyệt/Từ chối.")
image("team-requests/team-requests-approved.png", "Duyệt yêu cầu tham gia với role được chọn.")
label("Chi tiết chức năng:", "")
bullets([
    "Duyệt bắt buộc chọn role hợp lệ; hệ thống tạo membership và thông báo cho người dùng.",
    "Từ chối không tạo membership; yêu cầu biến mất khỏi hàng chờ.",
    "Mã mời có thể rotate/revoke; mã cũ không dùng được sau khi rotate.",
])

para("8.4 Role tuỳ chỉnh & ma trận quyền", "Heading 2")
label("Kích hoạt:", "Tab “Role & bộ quyền” trong `/agency/team`.")
label("Mô tả:", "Tạo role riêng, chọn bộ quyền và override ALLOW/DENY cho từng thành viên hoặc tour scope.")
label("Chi tiết chức năng:", "")
bullets([
    "Bốn role hệ thống: OWNER, MANAGER, STAFF, ACCOUNTANT; OWNER không bị giới hạn bởi role tuỳ chỉnh.",
    "Quyền hiệu lực = quyền role + override ALLOW − override DENY; thay đổi bump `permissionVersion`.",
    "Tour scope giới hạn theo `title`/`summary`/`description` cho STAFF được giao.",
    "Mọi thay đổi quyền được ghi audit và áp dụng ngay, không cần đăng nhập lại.",
])

# ---------- 9 ----------
para("9. Khuyến mãi & voucher", "Heading 1")
para("9.1 Danh sách & tạo voucher", "Heading 2")
label("Kích hoạt:", "Menu “Khuyến mãi & Voucher” (`/agency/promotions`).")
label("Mô tả:", "Quản lý voucher của agency: mã, hình thức áp dụng, mức giảm, thời gian và trạng thái.")
label("Chi tiết chức năng:", "")
bullets([
    "Hình thức: CODE (nhập mã), AUTO_APPLY (tự động), COLLECTABLE (khách thu thập), UNIQUE_BATCH (batch mã dùng một lần).",
    "Loại giảm: số tiền cố định hoặc phần trăm, kèm giới hạn giảm tối đa và đơn tối thiểu.",
    "Tạo/sửa, bật/tắt, lưu trữ; voucher đã dùng không xoá cứng.",
    "Chỉ OWNER/MANAGER; STAFF và ACCOUNTANT không thấy menu.",
])

para("9.2 Batch mã dùng một lần", "Heading 2")
label("Kích hoạt:", "Chọn hình thức UNIQUE_BATCH khi tạo voucher.")
label("Mô tả:", "Sinh danh sách mã duy nhất, mỗi mã dùng một lần; theo dõi mã đã phát/đã dùng.")
label("Chi tiết chức năng:", "")
bullets([
    "Số lượng mã, tiền tố và độ dài cấu hình khi sinh; mã trùng được sinh lại.",
    "Xuất danh sách mã để gửi cho khách; mã đã dùng hiển thị trạng thái.",
    "Giới hạn lượt dùng và thời hạn theo voucher cha.",
])

# ---------- 10 ----------
para("10. Khiếu nại", "Heading 1")
para("10.1 Danh sách & hội thoại", "Heading 2")
label("Kích hoạt:", "Menu “Khiếu nại” (`/agency/complaints`), mở một phiếu để xem hội thoại.")
label("Mô tả:", "Tiếp nhận và xử lý khiếu nại của khách: thống kê, lọc, trả lời, đề xuất giải pháp và đóng phiếu.")
label("Bố cục màn hình:", "Thống kê phía trên, danh sách phiếu bên trái, hội thoại bên phải; vùng trả lời ở cuối.")
image("owner/owner-complaint-detail.png", "Chi tiết phiếu khiếu nại và hội thoại.")
label("Chi tiết chức năng:", "")
bullets([
    "Thống kê: tổng phiếu, đang đối thoại, CSAT trung bình; lọc theo trạng thái và mức độ.",
    "Hội thoại theo phiếu: gửi tin, đính kèm ảnh bằng chứng, xem lịch sử xử lý.",
    "Đề xuất giải pháp, đóng phiếu hoặc leo thang lên sàn; trạng thái chuyển tương ứng.",
    "Chỉ OWNER/MANAGER; STAFF và ACCOUNTANT không có quyền.",
])

para("10.2 Quy trình xử lý", "Heading 2")
label("Kích hoạt:", "Khi khách gửi khiếu nại hoặc agency mở phiếu từ booking.")
label("Mô tả:", "Theo dõi vòng đời phiếu từ tiếp nhận đến đóng/leo thang, đảm bảo phản hồi trong hạn.")
label("Chi tiết chức năng:", "")
bullets([
    "Trạng thái: mới → đang xử lý → đã giải quyết/đã leo thang; mỗi lần đổi trạng thái ghi audit.",
    "SLA hiển thị thời gian còn lại; quá hạn được đánh dấu để ưu tiên.",
    "Đóng phiếu bắt buộc có kết luận/giải pháp; khách có thể đánh giá CSAT sau khi đóng.",
])

# ---------- 11 ----------
para("11. Đánh giá", "Heading 1")
para("11.1 Danh sách đánh giá", "Heading 2")
label("Kích hoạt:", "Menu “Đánh giá” (`/agency/reviews`).")
label("Mô tả:", "Xem đánh giá của du khách về các tour thuộc agency; gửi phản ánh nếu đánh giá sai sự thật.")
label("Bố cục màn hình:", "Danh sách đánh giá gồm sao, tác giả (che tên), thời gian, nội dung và nút “Phản ánh đánh giá”; "
      "tab phản ánh đã gửi ở dưới.")
image("fixes/verify-fix-manager-reviews.png", "Danh sách đánh giá và tab phản ánh đã gửi.")
label("Chi tiết chức năng:", "")
bullets([
    "Chỉ hiển thị đánh giá VISIBLE của tour thuộc agency đang hoạt động; tác giả được che tên.",
    "Lọc/phân trang; đánh giá mới nhất trước.",
    "OWNER/MANAGER xem được; STAFF và ACCOUNTANT không có quyền.",
])

para("11.2 Phản ánh đánh giá", "Heading 2")
label("Kích hoạt:", "Nút “Phản ánh đánh giá” trên một đánh giá.")
label("Mô tả:", "Gửi báo cáo tới kiểm duyệt viên kèm loại vấn đề và mô tả; theo dõi quyết định sau đó.")
label("Chi tiết chức năng:", "")
bullets([
    "Bắt buộc chọn loại vấn đề và mô tả tối thiểu; không sửa/xoá đánh giá trực tiếp.",
    "Mỗi đánh giá chỉ có một phản ánh đang mở; gửi trùng trả lỗi và giữ hội thoại.",
    "Tab “Phản ánh đã gửi” hiển thị trạng thái mở/đã giải quyết và quyết định của kiểm duyệt viên.",
])

# ---------- 12 ----------
para("12. Yêu cầu đoàn", "Heading 1")
para("12.1 Danh sách & chi tiết", "Heading 2")
label("Kích hoạt:", "Menu “Yêu cầu đoàn” (`/agency/custom-tours`).")
label("Mô tả:", "Tiếp nhận yêu cầu tour riêng của khách, trao đổi và soạn thỏa thuận; theo dõi trạng thái chốt đoàn.")
label("Bố cục màn hình:", "Danh sách yêu cầu bên trái, chi tiết bên phải với thông tin đoàn, ngân sách, lịch, "
      "chat và vùng soạn thỏa thuận.")
image("fixes/verify-fix-custom-tours.png", "Danh sách yêu cầu đoàn của agency.")
label("Chi tiết chức năng:", "")
bullets([
    "Dữ liệu giới hạn theo agency của context; ACCOUNTANT bị 403, STAFF chỉ thấy yêu cầu được giao.",
    "Thông tin: điểm đến, ngày, số khách, ngân sách, yêu cầu đặc biệt và trạng thái.",
    "Soạn thỏa thuận: lưu nháp hoặc gửi offer; khách chấp nhận thì chuyển trạng thái chốt đoàn.",
    "Chat với khách ngay trong chi tiết; thông báo cho cả hai bên khi có tin mới.",
])

para("12.2 Chat & thỏa thuận", "Heading 2")
label("Kích hoạt:", "Mở một yêu cầu đoàn và chọn tab chat/thỏa thuận.")
label("Mô tả:", "Trao đổi chi tiết với khách và quản lý phiên bản thỏa thuận trước khi chốt.")
label("Chi tiết chức năng:", "")
bullets([
    "Tin nhắn realtime; lịch sử giữ khi tải lại; thông báo cho người nhận khi không mở màn hình.",
    "Offer gồm lịch trình, giá, bao gồm/không bao gồm, chính sách huỷ; có thể sửa trước khi gửi.",
    "Khách chấp nhận → tạo booking/đơn chốt đoàn theo luồng hiện hành; từ chối → lưu lý do.",
])

# ---------- 13 ----------
para("13. Hộp thư & tin nhắn", "Heading 1")
para("13.1 Hộp thư chung", "Heading 2")
label("Kích hoạt:", "Menu “Tin nhắn” (`/agency/conversations`).")
label("Mô tả:", "Hộp thư chung của agency với du khách; mọi thành viên có `chat:use` đọc và trả lời cùng một thread.")
label("Bố cục màn hình:", "Cột trái là danh sách hội thoại kèm preview và badge chưa đọc; cột phải là nội dung "
      "hoặc trạng thái rỗng khi chưa chọn.")
image("agency-chat/verify-chat-inbox.png", "Hộp thư chung của agency.")
label("Chi tiết chức năng:", "")
bullets([
    "Thread được định danh theo cặp (du khách, agency), không theo từng nhân viên.",
    "Badge chưa đọc tính chung cho agency: một thành viên đọc thì badge của cả agency được xoá.",
    "OWNER/MANAGER/STAFF có `chat:use`; ACCOUNTANT không thấy menu và bị chặn ở route.",
    "Tìm kiếm theo tên khách/nội dung; sắp xếp theo tin mới nhất.",
])

para("13.2 Hội thoại & trả lời", "Heading 2")
label("Kích hoạt:", "Chọn một hội thoại trong hộp thư.")
label("Mô tả:", "Xem lịch sử tin nhắn và trả lời khách; tin mới hiển thị realtime ở cả hai phía.")
label("Bố cục màn hình:", "Bong bóng tin nhắn hai phía, ô nhập nội dung và nút gửi; trạng thái đang nhập/đã đọc.")
image("agency-chat/verify-chat-reply.png", "Agency trả lời trong thread chung.")
label("Chi tiết chức năng:", "")
bullets([
    "Gửi tin qua REST hoặc socket; nội dung rỗng bị chặn, độ dài theo giới hạn chung.",
    "Tin của đồng nghiệp hiển thị như tin của agency, không tạo badge chưa đọc cho agency.",
    "Du khách nhận thông báo khi agency trả lời; agency nhận thông báo khi du khách gửi tin mới.",
    "Đính kèm và trạng thái hiện diện là hạng mục mở rộng, chưa có trong bản hiện tại.",
])

para("13.3 Phân quyền & cách ly", "Heading 2")
label("Kích hoạt:", "Truy cập `/agency/conversations` bằng tài khoản không có quyền hoặc agency khác.")
label("Mô tả:", "Đảm bảo thread chỉ thuộc đúng agency và chỉ thành viên có quyền chat mới đọc được.")
label("Bố cục màn hình:", "ACCOUNTANT thấy thông báo không có quyền; agency khác thấy hộp thư rỗng.")
image("agency-chat/verify-chat-other-agency-isolated.png", "Agency khác không thấy thread của agency này.")
label("Chi tiết chức năng:", "")
bullets([
    "Mọi truy vấn chat agency đều lọc theo `agencyId` của context; thread agency khác trả rỗng/404.",
    "Header `X-Agency-Id` giả mạo bị từ chối 403; không thể đọc chéo tenant.",
    "Thread guide–du khách vẫn là kênh cá nhân, tách khỏi hộp thư agency.",
])

# ---------- 14 ----------
para("14. Chiết khấu hoa hồng", "Heading 1")
para("14.1 Tổng quan chiết khấu", "Heading 2")
label("Kích hoạt:", "Menu “Chiết khấu Hoa hồng” (`/agency/settings/commission`).")
label("Mô tả:", "Hiển thị mức chiết khấu agency đang hưởng, phần nền tảng, mô phỏng theo giá tour và lịch sử yêu cầu.")
label("Bố cục màn hình:", "Thẻ mức chiết khấu hiện tại, mô phỏng doanh thu theo giá tour, lịch sử yêu cầu và nút "
      "“Gửi yêu cầu điều chỉnh” (OWNER).")
image("commission/verify-commission-owner-view.png", "Tổng quan chiết khấu góc nhìn OWNER.")
label("Chi tiết chức năng:", "")
bullets([
    "Mức hiện tại đọc từ API, không hard-code; phần nền tảng = 100% − mức agency.",
    "Mô phỏng theo giá tour 2/5/10/20 triệu để thấy số tiền agency và nền tảng nhận.",
    "OWNER/MANAGER/ACCOUNTANT xem được; chỉ OWNER thấy nút gửi/huỷ yêu cầu.",
])

para("14.2 Gửi & huỷ yêu cầu", "Heading 2")
label("Kích hoạt:", "Nút “Gửi yêu cầu điều chỉnh” trên màn hình chiết khấu (OWNER).")
label("Mô tả:", "Đề nghị thay đổi mức chiết khấu trong khoảng 0–50%, kèm lý do; có thể huỷ khi còn chờ duyệt.")
label("Bố cục màn hình:", "Hộp thoại nhập mức mong muốn và lý do; sau khi gửi hiển thị banner đang chờ duyệt.")
image("commission/verify-commission-create.png", "Gửi yêu cầu điều chỉnh 20%.")
label("Chi tiết chức năng:", "")
bullets([
    "Mức hợp lệ 0–50%; lý do bắt buộc; UI khoá nút gửi khi đang có yêu cầu chờ.",
    "Chỉ áp dụng cho booking tạo sau khi yêu cầu được duyệt; booking cũ giữ mức tại thời điểm tạo.",
    "Huỷ yêu cầu đang chờ được; yêu cầu đã duyệt/từ chối không huỷ.",
])

para("14.3 Duyệt yêu cầu", "Heading 2")
label("Kích hoạt:", "Super Admin mở `/super-admin/settings/commission`.")
label("Mô tả:", "Hàng đợi yêu cầu điều chỉnh chiết khấu từ các agency; duyệt hoặc từ chối kèm ghi chú.")
label("Bố cục màn hình:", "Bảng yêu cầu gồm agency, mức hiện tại, mức đề nghị, lý do, thời gian và nút Duyệt/Từ chối.")
image("commission/verify-commission-approve.png", "Hàng đợi duyệt yêu cầu chiết khấu.")
label("Chi tiết chức năng:", "")
bullets([
    "Duyệt ghi mức mới, tăng version cấu hình và gửi thông báo cho agency.",
    "Từ chối giữ nguyên mức cũ; lý do được lưu trong lịch sử.",
    "Chỉ Super Admin có quyền; thao tác được ghi audit.",
])

para("14.4 Mức mới áp dụng", "Heading 2")
label("Kích hoạt:", "Agency mở lại màn hình chiết khấu sau khi yêu cầu được duyệt.")
label("Mô tả:", "Hiển thị mức mới, lịch sử quyết định và mô phỏng theo mức vừa áp dụng.")
label("Bố cục màn hình:", "Thẻ mức chiết khấu cập nhật, banner không còn “đang chờ”, lịch sử có trạng thái “Đã duyệt”.")
image("commission/verify-commission-applied.png", "Mức 20% đã được duyệt và áp dụng.")
label("Chi tiết chức năng:", "")
bullets([
    "Mức mới có hiệu lực cho booking tạo sau thời điểm duyệt; báo cáo cũ không hồi tố.",
    "Lịch sử giữ mức đề nghị, trạng thái, người duyệt và ghi chú.",
    "Nếu không có yêu cầu chờ, banner và nút huỷ biến mất.",
])

# ---------- 15 ----------
para("15. Premium", "Heading 1")
para("15.1 Quản lý gói premium", "Heading 2")
label("Kích hoạt:", "Menu “Premium” (`/agency/premium`), chỉ OWNER.")
label("Mô tả:", "Bật/tắt gói premium của agency, cấu hình quà tặng, tour áp dụng và phiên bản gói.")
label("Chi tiết chức năng:", "")
bullets([
    "Bật/tắt theo vai trò; cấu hình quà tặng và tour được hưởng.",
    "Phiên bản gói xác định quyền lợi; thay đổi phiên bản có thể yêu cầu duyệt.",
    "MANAGER, STAFF, ACCOUNTANT không có `premium:contribute`; route bị chặn đúng quyền.",
])

para("15.2 Đóng góp & hoàn tiền", "Heading 2")
label("Kích hoạt:", "Khu vực đóng góp/hoàn tiền trong màn hình Premium.")
label("Mô tả:", "Theo dõi khoản đóng góp của agency và yêu cầu hoàn tiền khi đủ điều kiện.")
label("Chi tiết chức năng:", "")
bullets([
    "Hiển thị số tiền đã đóng góp, trạng thái và lịch sử.",
    "Yêu cầu hoàn tiền cần lý do; trạng thái chờ duyệt/đã xử lý.",
    "Chỉ OWNER thao tác; các vai trò khác không thấy menu.",
])

# ---------- 16 ----------
para("16. Thông báo & hồ sơ", "Heading 1")
para("16.1 Thông báo", "Heading 2")
label("Kích hoạt:", "Chuông thông báo trên header hoặc menu “Thông báo” (`/agency/notifications`).")
label("Mô tả:", "Inbox thông báo theo agency: booking mới, đánh giá, khiếu nại, yêu cầu đoàn, chat và hệ thống.")
label("Chi tiết chức năng:", "")
bullets([
    "Badge chưa đọc theo agency; mở popover hoặc trang để xem.",
    "Đánh dấu đã đọc từng thông báo hoặc tất cả; xoá khỏi inbox.",
    "Deep link tới màn hình liên quan, có phân biệt route agency và route cá nhân.",
    "Tất cả vai trò đều xem được thông báo của agency đang hoạt động.",
])

para("16.2 Hồ sơ doanh nghiệp", "Heading 2")
label("Kích hoạt:", "Menu “Hồ sơ doanh nghiệp” (`/agency/settings/profile`) hoặc luồng onboarding "
      "`/agency/application/workplace`.")
label("Mô tả:", "Xem và cập nhật thông tin pháp lý/doanh nghiệp; trạng thái xác minh và hồ sơ năng lực.")
label("Chi tiết chức năng:", "")
bullets([
    "Thông tin: tên, mã số thuế, địa chỉ, người đại diện, mô tả, giấy phép.",
    "Chỉ chủ doanh nghiệp legacy được sửa; thành viên khác chỉ xem, thấy thông báo quyền.",
    "Trạng thái UNVERIFIED/PENDING chặn các trang nghiệp vụ; OWNER được dẫn tới hoàn thiện hồ sơ.",
])

# ---------- 17 ----------
para("17. Trạng thái tài khoản & cách ly dữ liệu", "Heading 1")
para("17.1 Doanh nghiệp chưa xác minh", "Heading 2")
label("Kích hoạt:", "Đăng nhập bằng tài khoản thuộc agency UNVERIFIED/PENDING.")
label("Mô tả:", "Layout chặn mọi trang nghiệp vụ trừ đội ngũ; hiển thị thông báo và link hoàn thiện hồ sơ cho OWNER.")
label("Bố cục màn hình:", "Trang thông báo thay cho nội dung, kèm nút “Chỉnh doanh nghiệp” (OWNER).")
image("account-states/state-unverified.png", "Doanh nghiệp chưa được xác minh.")
label("Chi tiết chức năng:", "")
bullets([
    "Không thể mở tour/booking/khiếu nại… khi chưa xác minh; API tương ứng trả 403.",
    "OWNER có link hoàn thiện hồ sơ; thành viên khác chỉ thấy thông báo.",
    "Sau khi VERIFIED, quyền truy cập được mở lại theo role.",
])

para("17.2 Thành viên bị khoá", "Heading 2")
label("Kích hoạt:", "Đăng nhập bằng membership SUSPENDED/REMOVED, hoặc membership bị đổi trạng thái khi đang dùng.")
label("Mô tả:", "Không resolve được agency context; người dùng bị đưa về `/workplaces` và không mở được dữ liệu.")
label("Bố cục màn hình:", "Danh sách nơi làm việc rỗng hoặc không còn doanh nghiệp bị khoá.")
image("account-states/state-suspended.png", "Tài khoản bị khoá không còn nơi làm việc.")
label("Chi tiết chức năng:", "")
bullets([
    "Membership SUSPENDED/REMOVED bị loại khỏi danh sách active; request `/agency/*` trả 403.",
    "Chủ doanh nghiệp có thể mở lại membership; khi đó quyền theo role được khôi phục.",
])

para("17.3 Cổng du khách", "Heading 2")
label("Kích hoạt:", "Dùng tài khoản AGENCY đăng nhập form du khách (`/login`) hoặc ngược lại.")
label("Mô tả:", "Chặn sai cổng: tài khoản đối tác không vào bề mặt du khách; tài khoản du khách không vào cổng đối tác.")
label("Bố cục màn hình:", "Thông báo “Tài khoản này là tài khoản đối tác” kèm link chuyển đúng cổng.")
image("account-states/state-traveler-portal.png", "Tài khoản đối tác bị chặn ở cổng du khách.")
label("Chi tiết chức năng:", "")
bullets([
    "Backend trả `AGENCY_PORTAL_REQUIRED`; frontend hiển thị thông báo và link `/agency/login`.",
    "Tài khoản du khách vào `/agency/login` bị từ chối với thông báo tương ứng.",
    "Không tạo phiên chéo giữa hai cổng.",
])

para("17.4 Cách ly dữ liệu giữa các agency", "Heading 2")
label("Kích hoạt:", "Mở URL tour/booking của agency khác hoặc gửi header `X-Agency-Id` không thuộc quyền.")
label("Mô tả:", "Mọi truy vấn đều scope theo agency của context; dữ liệu agency khác không đọc được kể cả khi biết ID.")
label("Bố cục màn hình:", "Trang không tìm thấy/không có quyền; không lộ tên tour/khách của agency khác.")
image("isolation/isolation-tour.png", "Agency khác mở tour bằng URL bị chặn.")
label("Chi tiết chức năng:", "")
bullets([
    "Tour/booking agency khác trả 404; header `X-Agency-Id` giả mạo trả 403.",
    "Danh sách, dashboard, chat, yêu cầu đoàn đều lọc theo tenant.",
    "Kiểm thử tự động: `isolation` 5/5, `matrix` 116/116.",
])

# ---------- appendix ----------
para("Phụ lục A. Trạng thái & quy ước", "Heading 1")
table([
    ["Đối tượng", "Trạng thái", "Ý nghĩa"],
    ["Tour", "DRAFT", "Nháp, sửa được, chưa hiển thị công khai"],
    ["Tour", "PENDING_REVIEW", "Chờ duyệt, khoá nội dung"],
    ["Tour", "APPROVED", "Đã duyệt, hiển thị và nhận booking"],
    ["Tour", "ARCHIVED", "Lưu trữ, khoá nội dung, không nhận booking"],
    ["Booking", "PENDING / CONFIRMED / COMPLETED / CANCELLED", "Chờ xác nhận / đã xác nhận / hoàn thành / đã huỷ"],
    ["Thành viên", "ACTIVE / SUSPENDED / REMOVED", "Đang hoạt động / bị khoá / đã rời"],
    ["Agency", "UNVERIFIED / PENDING / VERIFIED", "Chưa xác minh / chờ duyệt / đã xác minh"],
    ["Yêu cầu chiết khấu", "Đang chờ / Đã duyệt / Từ chối / Đã huỷ", "Vòng đời yêu cầu điều chỉnh"],
], widths=[3000, 6500, 7500])

para("Phụ lục B. Nguồn & tham chiếu", "Heading 1")
bullets([
    "Danh mục tính năng và ma trận quyền: docs/testing/agency-roles/FEATURES.md.",
    "Kết quả kiểm thử và ảnh theo tính năng: docs/testing/agency-roles/REPORT.md §11.",
    "Ảnh gốc: docs/testing/agency-roles/screenshots/<feature>/.",
    "API: docs/api/ENDPOINTS.md; use case map: docs/backend/USE_CASE_MAP.md.",
    "Quy ước tenant: header X-Agency-Id do frontend gắn cho các request /agency/*.",
])

# ---------- save ----------
toc.update()
doc.storeToURL("file://" + OUT, (
    PropertyValue("FilterName", 0, "MS Word 2007 XML", 0),
    PropertyValue("Overwrite", 0, True, 0),
))
doc.close(True)
print("saved", OUT)
