# Moderator — Mermaid UML Class Diagrams

Nguồn: `docs/backend/USE_CASE_MAP.md` và `docs/moderator-chapter-3.md`.
Các thao tác cùng luồng được gộp thành một sơ đồ độc lập (10 sơ đồ). Trong draw.io: **Insert → Advanced → Mermaid**, chỉ copy nội dung bên trong một khối mã mỗi lần. Tên lớp/phương thức là mô hình SDS theo mẫu yêu cầu, không phải tên class thực tế trong codebase.

## Moderator - View Moderation Dashboard

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%
classDiagram
direction TB
class DashboardController {
  -dao: DashboardDao
  -utils: MyUtils
  +viewSummary()
}
class BaseController {
  #currentUser: UserBean
  +requireModerator(): UserBean
}
class RequestFilter {
  -userId: String
  -query: String
  -status: String
  -page: int
  +validate(): boolean
}
class MyUtils {
  +normalizeText(value: String): String
  +now(): Date
}
class BaseDao {
  #connection: Object
  +findById(id: String): BaseBean
  +save(bean: BaseBean): BaseBean
}
class DashboardDao {
  -tableName: String
  +findById(id: String): DashboardBean
  +save(bean: DashboardBean): DashboardBean
}
class UserDao {
  -tableName: String
  +findById(id: String): UserBean
}
class BaseBean {
  #id: String
  #createdAt: Date
  #updatedAt: Date
  +getId(): String
}
class DashboardBean {
  +pendingTours: int
  +pendingAgencies: int
  +openReports: int
  +openTickets: int
  +getStatus(): String
}
class UserBean {
  +email: String
  +role: String
  +status: String
  +isModerator(): boolean
}
DashboardController --|> BaseController
DashboardController ..> DashboardDao
DashboardController ..> MyUtils
DashboardController ..> DashboardBean
BaseController o-- UserBean
BaseController ..> UserDao
RequestFilter ..> UserDao
RequestFilter ..> UserBean
DashboardDao --|> BaseDao
DashboardDao ..> DashboardBean
UserDao --|> BaseDao
UserDao ..> UserBean
DashboardBean --|> BaseBean
UserBean --|> BaseBean
```

## Moderator - Browse Tours

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%
classDiagram
direction TB
class TourBrowseController {
  -dao: TourBrowseDao
  -utils: MyUtils
  +listTours()
  +viewTourDetails()
}
class BaseController {
  #currentUser: UserBean
  +requireModerator(): UserBean
}
class RequestFilter {
  -userId: String
  -query: String
  -status: String
  -page: int
  +validate(): boolean
}
class MyUtils {
  +normalizeText(value: String): String
  +now(): Date
}
class BaseDao {
  #connection: Object
  +findById(id: String): BaseBean
  +save(bean: BaseBean): BaseBean
}
class TourBrowseDao {
  -tableName: String
  +findById(id: String): TourBrowseBean
  +save(bean: TourBrowseBean): TourBrowseBean
}
class UserDao {
  -tableName: String
  +findById(id: String): UserBean
}
class BaseBean {
  #id: String
  #createdAt: Date
  #updatedAt: Date
  +getId(): String
}
class TourBrowseBean {
  +tourId: String
  +title: String
  +destination: String
  +agencyId: String
  +price: Decimal
  +itinerary: String
  +status: String
  +getStatus(): String
}
class UserBean {
  +email: String
  +role: String
  +status: String
  +isModerator(): boolean
}
TourBrowseController --|> BaseController
TourBrowseController ..> TourBrowseDao
TourBrowseController ..> MyUtils
TourBrowseController ..> TourBrowseBean
BaseController o-- UserBean
BaseController ..> UserDao
RequestFilter ..> UserDao
RequestFilter ..> UserBean
TourBrowseDao --|> BaseDao
TourBrowseDao ..> TourBrowseBean
UserDao --|> BaseDao
UserDao ..> UserBean
TourBrowseBean --|> BaseBean
UserBean --|> BaseBean
```

## Moderator - Validate Tour

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%
classDiagram
direction TB
class TourValidationController {
  -dao: TourValidationDao
  -utils: MyUtils
  +approveTour()
  +rejectTour(reason: String)
}
class BaseController {
  #currentUser: UserBean
  +requireModerator(): UserBean
}
class RequestFilter {
  -userId: String
  -query: String
  -status: String
  -page: int
  +validate(): boolean
}
class MyUtils {
  +normalizeText(value: String): String
  +now(): Date
}
class BaseDao {
  #connection: Object
  +findById(id: String): BaseBean
  +save(bean: BaseBean): BaseBean
}
class TourValidationDao {
  -tableName: String
  +findById(id: String): TourValidationBean
  +save(bean: TourValidationBean): TourValidationBean
}
class UserDao {
  -tableName: String
  +findById(id: String): UserBean
}
class BaseBean {
  #id: String
  #createdAt: Date
  #updatedAt: Date
  +getId(): String
}
class TourValidationBean {
  +tourId: String
  +approved: boolean
  +reason: String
  +status: String
  +getStatus(): String
}
class UserBean {
  +email: String
  +role: String
  +status: String
  +isModerator(): boolean
}
TourValidationController --|> BaseController
TourValidationController ..> TourValidationDao
TourValidationController ..> MyUtils
TourValidationController ..> TourValidationBean
BaseController o-- UserBean
BaseController ..> UserDao
RequestFilter ..> UserDao
RequestFilter ..> UserBean
TourValidationDao --|> BaseDao
TourValidationDao ..> TourValidationBean
UserDao --|> BaseDao
UserDao ..> UserBean
TourValidationBean --|> BaseBean
UserBean --|> BaseBean
```

## Moderator - Suspend Tour

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%
classDiagram
direction TB
class TourSuspensionController {
  -dao: TourSuspensionDao
  -utils: MyUtils
  +suspendTour(reason: String)
}
class BaseController {
  #currentUser: UserBean
  +requireModerator(): UserBean
}
class RequestFilter {
  -userId: String
  -query: String
  -status: String
  -page: int
  +validate(): boolean
}
class MyUtils {
  +normalizeText(value: String): String
  +now(): Date
}
class BaseDao {
  #connection: Object
  +findById(id: String): BaseBean
  +save(bean: BaseBean): BaseBean
}
class TourSuspensionDao {
  -tableName: String
  +findById(id: String): TourSuspensionBean
  +save(bean: TourSuspensionBean): TourSuspensionBean
}
class UserDao {
  -tableName: String
  +findById(id: String): UserBean
}
class BaseBean {
  #id: String
  #createdAt: Date
  #updatedAt: Date
  +getId(): String
}
class TourSuspensionBean {
  +tourId: String
  +reason: String
  +status: String
  +getStatus(): String
}
class UserBean {
  +email: String
  +role: String
  +status: String
  +isModerator(): boolean
}
TourSuspensionController --|> BaseController
TourSuspensionController ..> TourSuspensionDao
TourSuspensionController ..> MyUtils
TourSuspensionController ..> TourSuspensionBean
BaseController o-- UserBean
BaseController ..> UserDao
RequestFilter ..> UserDao
RequestFilter ..> UserBean
TourSuspensionDao --|> BaseDao
TourSuspensionDao ..> TourSuspensionBean
UserDao --|> BaseDao
UserDao ..> UserBean
TourSuspensionBean --|> BaseBean
UserBean --|> BaseBean
```

## Moderator - Verify Agency Profile

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%
classDiagram
direction TB
class AgencyVerificationController {
  -dao: AgencyVerificationDao
  -utils: MyUtils
  +listAgencies()
  +viewAgencyDetails()
  +approveAgency()
  +rejectAgency(note: String)
  +requestInformation(note: String)
}
class BaseController {
  #currentUser: UserBean
  +requireModerator(): UserBean
}
class RequestFilter {
  -userId: String
  -query: String
  -status: String
  -page: int
  +validate(): boolean
}
class MyUtils {
  +normalizeText(value: String): String
  +now(): Date
}
class BaseDao {
  #connection: Object
  +findById(id: String): BaseBean
  +save(bean: BaseBean): BaseBean
}
class AgencyVerificationDao {
  -tableName: String
  +findById(id: String): AgencyVerificationBean
  +save(bean: AgencyVerificationBean): AgencyVerificationBean
}
class UserDao {
  -tableName: String
  +findById(id: String): UserBean
}
class BaseBean {
  #id: String
  #createdAt: Date
  #updatedAt: Date
  +getId(): String
}
class AgencyVerificationBean {
  +agencyId: String
  +companyName: String
  +licenseNumber: String
  +decision: String
  +note: String
  +status: String
  +getStatus(): String
}
class UserBean {
  +email: String
  +role: String
  +status: String
  +isModerator(): boolean
}
AgencyVerificationController --|> BaseController
AgencyVerificationController ..> AgencyVerificationDao
AgencyVerificationController ..> MyUtils
AgencyVerificationController ..> AgencyVerificationBean
BaseController o-- UserBean
BaseController ..> UserDao
RequestFilter ..> UserDao
RequestFilter ..> UserBean
AgencyVerificationDao --|> BaseDao
AgencyVerificationDao ..> AgencyVerificationBean
UserDao --|> BaseDao
UserDao ..> UserBean
AgencyVerificationBean --|> BaseBean
UserBean --|> BaseBean
```

## Moderator - Moderate Reviews

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%
classDiagram
direction TB
class ReviewModerationController {
  -dao: ReviewModerationDao
  -utils: MyUtils
  +listReviews()
  +viewReviewDetails()
  +hideReview(reason: String)
  +restoreReview(reason: String)
}
class BaseController {
  #currentUser: UserBean
  +requireModerator(): UserBean
}
class RequestFilter {
  -userId: String
  -query: String
  -status: String
  -page: int
  +validate(): boolean
}
class MyUtils {
  +normalizeText(value: String): String
  +now(): Date
}
class BaseDao {
  #connection: Object
  +findById(id: String): BaseBean
  +save(bean: BaseBean): BaseBean
}
class ReviewModerationDao {
  -tableName: String
  +findById(id: String): ReviewModerationBean
  +save(bean: ReviewModerationBean): ReviewModerationBean
}
class UserDao {
  -tableName: String
  +findById(id: String): UserBean
}
class BaseBean {
  #id: String
  #createdAt: Date
  #updatedAt: Date
  +getId(): String
}
class ReviewModerationBean {
  +reviewId: String
  +authorId: String
  +tourId: String
  +rating: int
  +content: String
  +hidden: boolean
  +reason: String
  +contentVersion: int
  +getStatus(): String
}
class UserBean {
  +email: String
  +role: String
  +status: String
  +isModerator(): boolean
}
ReviewModerationController --|> BaseController
ReviewModerationController ..> ReviewModerationDao
ReviewModerationController ..> MyUtils
ReviewModerationController ..> ReviewModerationBean
BaseController o-- UserBean
BaseController ..> UserDao
RequestFilter ..> UserDao
RequestFilter ..> UserBean
ReviewModerationDao --|> BaseDao
ReviewModerationDao ..> ReviewModerationBean
UserDao --|> BaseDao
UserDao ..> UserBean
ReviewModerationBean --|> BaseBean
UserBean --|> BaseBean
```

## Moderator - Resolve Reports and Disputes

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%
classDiagram
direction TB
class ReportResolutionController {
  -dao: ReportResolutionDao
  -utils: MyUtils
  +listReports()
  +viewReportDetails()
  +resolveReport(note: String)
  +rejectReport(note: String)
}
class BaseController {
  #currentUser: UserBean
  +requireModerator(): UserBean
}
class RequestFilter {
  -userId: String
  -query: String
  -status: String
  -page: int
  +validate(): boolean
}
class MyUtils {
  +normalizeText(value: String): String
  +now(): Date
}
class BaseDao {
  #connection: Object
  +findById(id: String): BaseBean
  +save(bean: BaseBean): BaseBean
}
class ReportResolutionDao {
  -tableName: String
  +findById(id: String): ReportResolutionBean
  +save(bean: ReportResolutionBean): ReportResolutionBean
}
class UserDao {
  -tableName: String
  +findById(id: String): UserBean
}
class BaseBean {
  #id: String
  #createdAt: Date
  #updatedAt: Date
  +getId(): String
}
class ReportResolutionBean {
  +reportId: String
  +reporterId: String
  +targetId: String
  +targetType: String
  +decision: String
  +note: String
  +status: String
  +getStatus(): String
}
class UserBean {
  +email: String
  +role: String
  +status: String
  +isModerator(): boolean
}
ReportResolutionController --|> BaseController
ReportResolutionController ..> ReportResolutionDao
ReportResolutionController ..> MyUtils
ReportResolutionController ..> ReportResolutionBean
BaseController o-- UserBean
BaseController ..> UserDao
RequestFilter ..> UserDao
RequestFilter ..> UserBean
ReportResolutionDao --|> BaseDao
ReportResolutionDao ..> ReportResolutionBean
UserDao --|> BaseDao
UserDao ..> UserBean
ReportResolutionBean --|> BaseBean
UserBean --|> BaseBean
```

## Moderator - Adjudicate Tour Service Complaints

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%
classDiagram
direction TB
class ComplaintAdjudicationController {
  -dao: ComplaintAdjudicationDao
  -utils: MyUtils
  +listComplaints()
  +viewComplaintDetails()
  +sendMessage(text: String)
  +adjudicate(reason: String)
}
class BaseController {
  #currentUser: UserBean
  +requireModerator(): UserBean
}
class RequestFilter {
  -userId: String
  -query: String
  -status: String
  -page: int
  +validate(): boolean
}
class MyUtils {
  +normalizeText(value: String): String
  +now(): Date
}
class BaseDao {
  #connection: Object
  +findById(id: String): BaseBean
  +save(bean: BaseBean): BaseBean
}
class ComplaintAdjudicationDao {
  -tableName: String
  +findById(id: String): ComplaintAdjudicationBean
  +save(bean: ComplaintAdjudicationBean): ComplaintAdjudicationBean
}
class UserDao {
  -tableName: String
  +findById(id: String): UserBean
}
class BaseBean {
  #id: String
  #createdAt: Date
  #updatedAt: Date
  +getId(): String
}
class ComplaintAdjudicationBean {
  +ticketId: String
  +travelerId: String
  +agencyId: String
  +tourId: String
  +message: String
  +decision: String
  +reason: String
  +status: String
  +getStatus(): String
}
class UserBean {
  +email: String
  +role: String
  +status: String
  +isModerator(): boolean
}
ComplaintAdjudicationController --|> BaseController
ComplaintAdjudicationController ..> ComplaintAdjudicationDao
ComplaintAdjudicationController ..> MyUtils
ComplaintAdjudicationController ..> ComplaintAdjudicationBean
BaseController o-- UserBean
BaseController ..> UserDao
RequestFilter ..> UserDao
RequestFilter ..> UserBean
ComplaintAdjudicationDao --|> BaseDao
ComplaintAdjudicationDao ..> ComplaintAdjudicationBean
UserDao --|> BaseDao
UserDao ..> UserBean
ComplaintAdjudicationBean --|> BaseBean
UserBean --|> BaseBean
```

## Moderator - Handle Platform Support Tickets

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%
classDiagram
direction TB
class SupportTicketController {
  -dao: SupportTicketDao
  -utils: MyUtils
  +listTickets()
  +viewTicketDetails()
  +reply(text: String)
  +updateStatus(status: String)
}
class BaseController {
  #currentUser: UserBean
  +requireModerator(): UserBean
}
class RequestFilter {
  -userId: String
  -query: String
  -status: String
  -page: int
  +validate(): boolean
}
class MyUtils {
  +normalizeText(value: String): String
  +now(): Date
}
class BaseDao {
  #connection: Object
  +findById(id: String): BaseBean
  +save(bean: BaseBean): BaseBean
}
class SupportTicketDao {
  -tableName: String
  +findById(id: String): SupportTicketBean
  +save(bean: SupportTicketBean): SupportTicketBean
}
class UserDao {
  -tableName: String
  +findById(id: String): UserBean
}
class BaseBean {
  #id: String
  #createdAt: Date
  #updatedAt: Date
  +getId(): String
}
class SupportTicketBean {
  +ticketId: String
  +ownerId: String
  +category: String
  +reply: String
  +resolutionNote: String
  +status: String
  +getStatus(): String
}
class UserBean {
  +email: String
  +role: String
  +status: String
  +isModerator(): boolean
}
SupportTicketController --|> BaseController
SupportTicketController ..> SupportTicketDao
SupportTicketController ..> MyUtils
SupportTicketController ..> SupportTicketBean
BaseController o-- UserBean
BaseController ..> UserDao
RequestFilter ..> UserDao
RequestFilter ..> UserBean
SupportTicketDao --|> BaseDao
SupportTicketDao ..> SupportTicketBean
UserDao --|> BaseDao
UserDao ..> UserBean
SupportTicketBean --|> BaseBean
UserBean --|> BaseBean
```

## Moderator - Ban Violating Account

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'mainBkg': '#ffffff', 'nodeBorder': '#000000', 'classText': '#000000'}}}%%
classDiagram
direction TB
class AccountBanController {
  -dao: AccountBanDao
  -utils: MyUtils
  +banAccount(reason: String)
}
class BaseController {
  #currentUser: UserBean
  +requireModerator(): UserBean
}
class RequestFilter {
  -userId: String
  -query: String
  -status: String
  -page: int
  +validate(): boolean
}
class MyUtils {
  +normalizeText(value: String): String
  +now(): Date
}
class BaseDao {
  #connection: Object
  +findById(id: String): BaseBean
  +save(bean: BaseBean): BaseBean
}
class AccountBanDao {
  -tableName: String
  +findById(id: String): AccountBanBean
  +save(bean: AccountBanBean): AccountBanBean
}
class UserDao {
  -tableName: String
  +findById(id: String): UserBean
}
class BaseBean {
  #id: String
  #createdAt: Date
  #updatedAt: Date
  +getId(): String
}
class AccountBanBean {
  +targetUserId: String
  +reason: String
  +status: String
  +getStatus(): String
}
class UserBean {
  +email: String
  +role: String
  +status: String
  +isModerator(): boolean
}
AccountBanController --|> BaseController
AccountBanController ..> AccountBanDao
AccountBanController ..> MyUtils
AccountBanController ..> AccountBanBean
BaseController o-- UserBean
BaseController ..> UserDao
RequestFilter ..> UserDao
RequestFilter ..> UserBean
AccountBanDao --|> BaseDao
AccountBanDao ..> AccountBanBean
UserDao --|> BaseDao
UserDao ..> UserBean
AccountBanBean --|> BaseBean
UserBean --|> BaseBean
```
