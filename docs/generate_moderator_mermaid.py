"""Generate independent draw.io-ready Mermaid class diagrams for Moderator."""
from pathlib import Path

OPERATIONS = [
    ("View Moderation Dashboard", "Dashboard", "pendingTours: int; pendingAgencies: int; openReports: int; openTickets: int"),
    ("Browse Tours", "TourBrowse", "tourId: String; title: String; destination: String; agencyId: String; price: Decimal; itinerary: String; status: String"),
    ("Validate Tour", "TourValidation", "tourId: String; approved: boolean; reason: String; status: String"),
    ("Suspend Tour", "TourSuspension", "tourId: String; reason: String; status: String"),
    ("Verify Agency Profile", "AgencyVerification", "agencyId: String; companyName: String; licenseNumber: String; decision: String; note: String; status: String"),
    ("Moderate Reviews", "ReviewModeration", "reviewId: String; authorId: String; tourId: String; rating: int; content: String; hidden: boolean; reason: String; contentVersion: int"),
    ("Resolve Reports and Disputes", "ReportResolution", "reportId: String; reporterId: String; targetId: String; targetType: String; decision: String; note: String; status: String"),
    ("Adjudicate Tour Service Complaints", "ComplaintAdjudication", "ticketId: String; travelerId: String; agencyId: String; tourId: String; message: String; decision: String; reason: String; status: String"),
    ("Handle Platform Support Tickets", "SupportTicket", "ticketId: String; ownerId: String; category: String; reply: String; resolutionNote: String; status: String"),
    ("Ban Violating Account", "AccountBan", "targetUserId: String; reason: String; status: String"),
]

ACTION_METHODS = {
    "Dashboard": "viewSummary()",
    "TourBrowse": "listTours(); viewTourDetails()",
    "TourValidation": "approveTour(); rejectTour(reason: String)",
    "TourSuspension": "suspendTour(reason: String)",
    "AgencyVerification": "listAgencies(); viewAgencyDetails(); approveAgency(); rejectAgency(note: String); requestInformation(note: String)",
    "ReviewModeration": "listReviews(); viewReviewDetails(); hideReview(reason: String); restoreReview(reason: String)",
    "ReportResolution": "listReports(); viewReportDetails(); resolveReport(note: String); rejectReport(note: String)",
    "ComplaintAdjudication": "listComplaints(); viewComplaintDetails(); sendMessage(text: String); adjudicate(reason: String)",
    "SupportTicket": "listTickets(); viewTicketDetails(); reply(text: String); updateStatus(status: String)",
    "AccountBan": "banAccount(reason: String)",
}

FEATURES = [
    (title, stem, fields, ACTION_METHODS[stem],
     f"findById(id: String): {stem}Bean; save(bean: {stem}Bean): {stem}Bean",
     f"findById(id: String): {stem}Bean; save(bean: {stem}Bean): {stem}Bean", fields)
    for title, stem, fields in OPERATIONS
]

CONFIG = "%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%"

def members(fields, methods):
    def visibility(part):
        part = part.strip()
        return part if part.startswith(("+", "-", "#", "~")) else "+" + part
    return ["  " + visibility(part) for part in fields.split(';') if part.strip()] + ["  " + visibility(part) for part in methods.split(';') if part.strip()]

def block(name, fields="", methods=""):
    return "\n".join([f"class {name} {{", *members(fields, methods), "}"])

def diagram(item):
    title, stem, request, controller_methods, dao_methods, base_dao_methods, bean_fields = item
    c, d, b = f"{stem}Controller", f"{stem}Dao", f"{stem}Bean"
    classes = [
        block(c, "-dao: " + d + "; -utils: MyUtils", controller_methods),
        block("BaseController", "#currentUser: UserBean", "+requireModerator(): UserBean"),
        block("RequestFilter", "-userId: String; -query: String; -status: String; -page: int", "+validate(): boolean"),
        block("MyUtils", "", "+normalizeText(value: String): String; +now(): Date"),
        block("BaseDao", "#connection: Object", "+findById(id: String): BaseBean; +save(bean: BaseBean): BaseBean"),
        block(d, "-tableName: String", dao_methods),
        block("UserDao", "-tableName: String", "+findById(id: String): UserBean"),
        block("BaseBean", "#id: String; #createdAt: Date; #updatedAt: Date", "+getId(): String"),
        block(b, "; ".join("+" + x.strip() for x in bean_fields.split(';')), "+getStatus(): String"),
        block("UserBean", "+email: String; +role: String; +status: String", "+isModerator(): boolean"),
    ]
    relations = [
        f"{c} --|> BaseController", f"{c} ..> {d}", f"{c} ..> MyUtils", f"{c} ..> {b}",
        "BaseController o-- UserBean", "BaseController ..> UserDao",
        "RequestFilter ..> UserDao", "RequestFilter ..> UserBean",
        f"{d} --|> BaseDao", f"{d} ..> {b}",
        "UserDao --|> BaseDao", "UserDao ..> UserBean",
        f"{b} --|> BaseBean", "UserBean --|> BaseBean",
    ]
    return f"## Moderator - {title}\n\n```mermaid\n{CONFIG}\nclassDiagram\ndirection TB\n" + "\n".join(classes + relations) + "\n```\n"

intro = """# Moderator — Mermaid UML Class Diagrams

Nguồn: `docs/backend/USE_CASE_MAP.md` và `docs/moderator-chapter-3.md`.
Các thao tác cùng luồng được gộp thành một sơ đồ độc lập (10 sơ đồ). Trong draw.io: **Insert → Advanced → Mermaid**, chỉ copy nội dung bên trong một khối mã mỗi lần. Tên lớp/phương thức là mô hình SDS theo mẫu yêu cầu, không phải tên class thực tế trong codebase.

"""
Path(__file__).with_name("moderator-mermaid-class-diagrams.md").write_text(intro + "\n".join(map(diagram, FEATURES)), encoding="utf-8")
