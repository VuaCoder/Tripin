/** Development-only review fixtures. Each comment names a point on its own tour. */
import { createHash } from 'node:crypto';
import { prisma } from '../config/database';

type DemoTour = { title: string; images: string[] };

const REVIEWERS = [
  ['Nguyễn Minh Anh', 'minh-anh'], ['Trần Quốc Bảo', 'quoc-bao'],
  ['Lê Thảo Vy', 'thao-vy'], ['Phạm Gia Huy', 'gia-huy'],
  ['Đỗ Ngọc Hà', 'ngoc-ha'], ['Võ Thanh Tùng', 'thanh-tung'],
  ['Bùi Khánh Linh', 'khanh-linh'], ['Hoàng Đức Long', 'duc-long'],
  ['Ngô Mai Phương', 'mai-phuong'], ['Đặng Nhật Nam', 'nhat-nam'],
  ['Trương Thu Trang', 'thu-trang'], ['Phan Hải Đăng', 'hai-dang'],
] as const;

// These six comments came from the old random sync script. Only unlinked rows
// with one of these exact comments may be reused; booking-backed reviews stay intact.
const OLD_GENERIC_COMMENTS = new Set([
  'Chuyến đi thật tuyệt vời! Hướng dẫn viên rất nhiệt tình và am hiểu văn hóa địa phương. Lịch trình hợp lý, không bị mệt.',
  'Dịch vụ vượt ngoài mong đợi của gia đình tôi. Khách sạn sạch sẽ, đồ ăn ngon và các điểm tham quan rất đẹp. Nhất định sẽ quay lại!',
  'Trải nghiệm rất đáng tiền. Điểm trừ nhỏ là buổi sáng khởi hành hơi sớm, nhưng bù lại đón được bình minh rất đẹp.',
  'Tôi và nhóm bạn đã có một kỳ nghỉ vô cùng đáng nhớ. Cảm ơn đội ngũ Tripri và công ty tổ chức đã chăm sóc chu đáo.',
  'Phong cảnh tuyệt đẹp, hướng dẫn viên chụp ảnh có tâm. Mọi thứ đều được chuẩn bị cẩn thận từ khâu đón rước.',
  'Tour tổ chức chuyên nghiệp, xe đưa đón mới và êm ái. Rất thích hợp cho gia đình có người lớn tuổi và trẻ nhỏ.',
]);

// rating|comment. Four distinct observations per tour; not copied from any operator.
const REVIEW_COPY = [
  [
    '5|Vịnh Hạ Long nhìn từ boong tàu rất đẹp, nhất là đoạn đi qua các đảo đá vôi. Hang Sửng Sốt rộng hơn tôi tưởng.',
    '4|Lối lên đảo Ti Tốp có khá nhiều bậc, nên mang giày dễ đi. Từ trên cao nhìn xuống vịnh rất đáng công leo.',
    '5|Buổi sáng trên vịnh yên tĩnh, ánh nắng lên qua các núi đá rất ấn tượng. Lịch tham quan hang và đảo vừa đủ thời gian.',
    '4|Tuyến tàu qua hang Sửng Sốt và Ti Tốp đông khách vào giữa ngày. Đi sớm sẽ thoải mái hơn để ngắm cảnh.',
  ],
  [
    '5|Cáp treo Fansipan đi qua lớp mây rất đẹp. Đến khu vực đỉnh trời lạnh hơn thị trấn khá nhiều.',
    '4|Bản Cát Cát có nhiều đoạn dốc và bậc thang, nên chuẩn bị giày đi bộ. Cảnh núi quanh bản rất dễ chụp ảnh.',
    '5|Một ngày ngắm Fansipan, một ngày đi bản làng giúp chuyến Sa Pa không bị vội. Tôi thích nhất khung cảnh buổi sớm.',
    '3|Fansipan có sương dày lúc tôi tới nên tầm nhìn hạn chế. Phần đi bộ ở Cát Cát vẫn là điểm sáng của chuyến đi.',
  ],
  [
    '5|Cầu Vàng ở Bà Nà nổi bật giữa mây núi. Buổi chiều dạo phố cổ Hội An có không khí hoàn toàn khác Đà Nẵng.',
    '4|Biển Mỹ Khê dễ đi dạo nhưng nắng giữa trưa khá gắt. Nên dành thời gian ở biển vào sáng sớm hoặc chiều.',
    '5|Tôi thích cách tuyến này kết hợp Sơn Trà, Bà Nà và Hội An. Mỗi điểm có một góc nhìn riêng về miền Trung.',
    '4|Ở Cầu Vàng có lúc phải chờ để chụp ảnh. Bù lại phố Hội An buổi tối rất đẹp và nhiều món ăn để thử.',
  ],
  [
    '5|Đi bộ qua các quán ăn ở trung tâm Sài Gòn buổi tối rất thú vị. Mỗi chặng thử một món nên không bị ngán.',
    '4|Đường phố tối khá đông xe, nên đi giày thoải mái và chú ý khi qua đường. Các quán nhỏ có không khí rất riêng.',
    '5|Tôi thích nghe câu chuyện về những món ăn quen thuộc ngay tại quán. Buổi tối thành phố nhộn nhịp đúng chất Sài Gòn.',
    '3|Có quán phải đợi bàn vì đông khách. Bù lại món ăn địa phương ngon và cung đường đi bộ không quá dài.',
  ],
  [
    '5|Thuyền trên sông Son đưa vào động Phong Nha rất êm. Bước vào trong hang thấy các khối nhũ đá thực sự ấn tượng.',
    '4|Trong động có chỗ nền ẩm, đi giày chống trượt sẽ yên tâm hơn. Ánh sáng trên sông Son lúc về rất đẹp.',
    '5|Phong Nha khác hẳn những điểm tham quan ngoài trời tôi từng đi. Đoạn từ bến thuyền tới cửa động là kỷ niệm rõ nhất.',
    '4|Ngày tham quan động có khá nhiều đoàn khách. Nếu thích chụp ảnh, nên tranh thủ ở những đoạn ít người.',
  ],
  [
    '5|Ngồi xuồng len giữa rừng tràm Trà Sư rất yên bình. Mặt nước và hàng cây xanh nhìn gần đẹp hơn trong ảnh.',
    '4|Nắng ở An Giang lên nhanh, nên đội nón khi đi xuồng. Buổi chiều dạo Châu Đốc có nhiều món ăn đáng thử.',
    '5|Tôi thích nhất sự đổi cảnh từ rừng tràm sang phố Châu Đốc. Hai ngày vừa đủ để cảm nhận nhịp sống miền Tây.',
    '3|Đoạn xuồng đông vào giờ cao điểm nên hơi khó chụp ảnh. Cảnh rừng vẫn rất đáng đến.',
  ],
  [
    '5|Biển Nha Trang trong và dễ chịu vào buổi sáng. Tháp Bà Ponagar là điểm dừng thú vị sau một ngày đi biển.',
    '4|Đi tàu ra đảo phụ thuộc thời tiết, hôm tôi đi sóng hơi lớn. Ở lại bãi biển thành phố cũng có nhiều góc đẹp.',
    '5|Tôi thích nhìn kiến trúc Chăm ở tháp Bà rồi quay về dạo biển Trần Phú. Lịch trình có cả biển lẫn văn hóa.',
    '4|Nắng ở khu tháp khá mạnh vào trưa, nên mang nước và nón. Cảnh biển lúc chiều làm chuyến đi trọn vẹn.',
  ],
  [
    '5|Đồi cỏ trên cung Tà Năng – Phan Dũng mở ra rất rộng. Buổi sáng ở điểm cắm trại là khoảnh khắc tôi nhớ nhất.',
    '4|Cung đi bộ có dốc và nắng, cần chuẩn bị thể lực và đủ nước. Cảnh cao nguyên rất xứng đáng.',
    '5|Đi cùng đoàn qua các đoạn rừng và đồi cỏ đem lại cảm giác phiêu lưu rõ rệt. Đêm cắm trại rất yên tĩnh.',
    '3|Đường trekking khó hơn tôi nghĩ, nhất là lúc xuống dốc. Ai mới đi lần đầu nên chuẩn bị giày tốt.',
  ],
  [
    '5|Đại Nội Huế có nhiều cổng và sân rộng, đi một vòng vẫn còn muốn xem thêm. Ven sông Hương buổi chiều rất dịu.',
    '4|Tham quan lăng tẩm cần đi bộ khá nhiều, nên dành thời gian nghỉ giữa các điểm. Kiến trúc ở Huế rất khác biệt.',
    '5|Tôi thích nhịp đi chậm ở Huế. Sau Đại Nội, ngồi bên sông Hương và nhìn thành phố lên đèn rất dễ chịu.',
    '3|Trời khá nóng lúc tham quan Đại Nội nên hơi mệt. Bù lại các điểm di sản được giữ gìn đẹp và đáng tìm hiểu.',
  ],
  [
    '5|Đi bộ quanh hồ Hoàn Kiếm rồi rẽ vào phố cổ là cách hay để khám phá Hà Nội. Những quán ăn nhỏ rất có duyên.',
    '4|Phố cổ đông vào cuối tuần, đôi lúc phải chờ món. Tôi vẫn thích cảm giác ngồi ăn giữa những con phố cũ.',
    '5|Buổi sáng bên hồ và buổi tối thử món địa phương tạo hai sắc thái khác nhau của Hà Nội. Tuyến đi dễ theo.',
    '4|Nên đi giày thoải mái vì tham quan phố cổ chủ yếu là đi bộ. Các ngõ nhỏ có nhiều điều thú vị để nhìn ngắm.',
  ],
  [
    '5|Cung đường lên Đồng Văn liên tục mở ra những dãy núi đá. Từ Mã Pí Lèng nhìn xuống sông Nho Quế rất đẹp.',
    '4|Đường đèo nhiều khúc cua nên ai dễ say xe cần chuẩn bị trước. Bù lại cảnh cao nguyên thay đổi từng chặng.',
    '5|Tôi ấn tượng với màu nước Nho Quế giữa vách núi. Dừng chân ở các điểm nhìn trên Mã Pí Lèng rất đáng thời gian.',
    '3|Có đoạn sương che khuất tầm nhìn ở đèo. Khi trời quang, cảnh Đồng Văn và Nho Quế thực sự nổi bật.',
  ],
  [
    '5|Bãi Đầm Trầu có bờ cát thoáng và nước biển đẹp. Chuyến đi còn giúp tôi hiểu thêm lịch sử Côn Đảo.',
    '4|Nắng trên đảo khá gắt giữa trưa, nên xếp thời gian ra biển hợp lý. Khu di tích mang nhiều cảm xúc.',
    '5|Tôi thích sự yên tĩnh ở Côn Đảo. Một bên là biển Đầm Trầu, một bên là các câu chuyện lịch sử đáng suy ngẫm.',
    '4|Di chuyển giữa các điểm trên đảo mất thời gian hơn tôi dự tính. Phong cảnh ven đường vẫn rất dễ chịu.',
  ],
  [
    '5|Những luống chè ở Mộc Châu lên ảnh rất đẹp. Không khí cao nguyên buổi sáng mát và dễ chịu.',
    '4|Đường vào vùng trồng chè có đoạn hơi hẹp. Đi chậm để ngắm cảnh và nghe câu chuyện về nghề chè sẽ thú vị hơn.',
    '5|Ba ngày ở Mộc Châu đủ để tận hưởng nhịp sống chậm. Tôi thích nhất những mảng xanh trải dài trên sườn đồi.',
    '3|Hôm tôi tới trời nhiều mây nên ảnh không sáng như mong đợi. Cảnh đồi chè vẫn là điểm đáng nhớ.',
  ],
  [
    '5|Bãi Sao có cát sáng và nước êm vào lúc tôi đến. Buổi chiều ngắm hoàng hôn ở Nam đảo rất thư giãn.',
    '4|Các điểm ở Nam đảo khá xa nhau, nên chừa thời gian di chuyển. Cảnh biển Phú Quốc vẫn rất đẹp.',
    '5|Tôi thích xen kẽ ngày nghỉ ở Bãi Sao với ngày khám phá các góc khác của đảo. Hoàng hôn là phần đáng nhớ nhất.',
    '3|Trời chuyển mưa nhanh nên buổi ngắm hoàng hôn không trọn vẹn. Bù lại biển buổi sáng rất trong.',
  ],
  [
    '5|Đi thuyền vào chợ nổi Cái Răng từ sáng sớm rất thú vị. Tôi thích nhìn các ghe bán trái cây trên sông.',
    '4|Cần dậy khá sớm để thấy chợ nhộn nhịp nhất. Sau đó dạo bến Ninh Kiều là nhịp đi rất hợp lý.',
    '5|Âm thanh máy ghe, tiếng mời hàng và bữa sáng trên sông tạo cảm giác rất riêng của Cần Thơ.',
    '3|Chợ nổi ít ghe hơn tôi hình dung vào hôm đi. Dù vậy trải nghiệm ngồi thuyền và nhìn đời sống trên sông vẫn đáng thử.',
  ],
  [
    '5|Đi thuyền Tràng An qua các vách núi và hang nước rất êm. Đến Hoa Lư lại có thêm phần lịch sử để tìm hiểu.',
    '4|Tràng An có nhiều tuyến thuyền, nên chọn trước tuyến mình quan tâm. Nắng trên sông khá mạnh vào giữa trưa.',
    '5|Tôi thích cảnh núi đá vôi phản chiếu trên mặt nước. Hai ngày ở Ninh Bình vừa đủ cho Tràng An và Hoa Lư.',
    '3|Hôm đi thuyền phải đợi khá lâu vì đông khách. Cảnh quan bên trong tuyến vẫn rất đẹp.',
  ],
  [
    '5|Buổi sáng quanh hồ Xuân Hương mát và yên tĩnh. Đi giữa rừng thông cho cảm giác rất khác trung tâm Đà Lạt.',
    '4|Đà Lạt có lúc mưa bất chợt, nên mang áo khoác nhẹ. Dạo hồ lúc trời tạnh rất dễ chịu.',
    '5|Tôi thích nhất sương sớm giữa những hàng thông. Chuyến đi có nhiều thời gian để ngắm cảnh cao nguyên.',
    '3|Hôm đầu trời mưa nên không đi bộ lâu trong rừng được. Ngày sau nắng lên, cảnh hồ Xuân Hương rất đẹp.',
  ],
  [
    '5|Từ phố cổ Hà Nội sang cảnh sông nước Tràng An rồi vịnh Hạ Long, mỗi ngày có một trải nghiệm rất khác.',
    '4|Tuyến liên vùng di chuyển khá nhiều, cần sắp xếp hành lý gọn. Bù lại đi được cả Tràng An và Hạ Long.',
    '5|Tôi ấn tượng nhất với thuyền ở Tràng An và những đảo đá trên vịnh. Hai khung cảnh đều đẹp theo cách riêng.',
    '3|Một ngày ở mỗi điểm hơi ngắn nếu muốn khám phá sâu. Tuyến này hợp để làm quen các điểm nổi bật miền Bắc.',
  ],
  [
    '5|Đại Nội Huế, Cầu Vàng và phố cổ Hội An đều có nét riêng. Lịch trình bốn ngày cho thấy nhiều góc miền Trung.',
    '4|Di chuyển từ Huế vào Đà Nẵng mất một quãng, nhưng cảnh dọc đường rất đáng ngắm. Hội An về tối đẹp.',
    '5|Tôi thích sự chuyển đổi từ di sản Huế sang không khí biển Đà Nẵng rồi phố cổ Hội An.',
    '3|Cầu Vàng khá đông lúc chúng tôi tới. Nếu muốn chụp ảnh thoải mái nên đi vào khung giờ sớm.',
  ],
  [
    '5|Kỳ Co có bờ biển đẹp và Eo Gió mở ra góc nhìn rất rộng. Gành Đá Dĩa là điểm nhấn khác hẳn.',
    '4|Ngày đi biển phụ thuộc sóng, nên xem thời tiết trước. Tôi thích quãng đường từ Quy Nhơn sang Phú Yên.',
    '5|Tuyến Quy Nhơn – Phú Yên có đủ biển, vách đá và ẩm thực địa phương. Mỗi điểm chụp ảnh đều khác nhau.',
    '3|Gành Đá Dĩa khá nắng và ít bóng râm. Đá xếp tầng rất thú vị nhưng nên chuẩn bị nước uống.',
  ],
  [
    '5|Buổi sáng ngắm biển Nha Trang, vài ngày sau dạo hồ Xuân Hương ở Đà Lạt là sự thay đổi rất thú vị.',
    '4|Đường từ Nha Trang lên Đà Lạt có nhiều khúc cua. Nên chuẩn bị nếu dễ say xe, cảnh núi hai bên rất đẹp.',
    '5|Tôi thích phần tham quan tháp Bà Ponagar trước khi lên cao nguyên. Chuyến đi có cả văn hóa, biển và núi.',
    '3|Thời tiết Đà Lạt lạnh hơn Nha Trang nhiều nên tôi mang thiếu áo ấm. Cảnh hồ lúc sáng sớm rất dễ chịu.',
  ],
  [
    '5|Từ núi Bà Đen nhìn xuống đồng bằng Tây Ninh rất rộng. Tòa Thánh Cao Đài có kiến trúc nhiều màu sắc.',
    '4|Trên núi nắng và gió thay đổi nhanh, nên chuẩn bị áo khoác nhẹ. Phần tham quan Tòa Thánh rất đáng tìm hiểu.',
    '5|Tôi thích kết hợp cảnh núi với điểm văn hóa trong hai ngày. Khu vực tượng trên núi Bà Đen rất ấn tượng.',
    '3|Cuối tuần có lúc phải chờ ở khu tham quan núi. Đi sớm sẽ có nhiều thời gian hơn để ngắm cảnh.',
  ],
] as const;

// Public payment-flow fixtures keep their test names and bookings. Refresh only
// their unlinked generic comments so they do not pollute the visible catalog.
const PUBLIC_TEST_COPY: Record<string, readonly string[]> = {
  '[DEV Premium] Khám phá Đà Nẵng – Hội An': [
    '5|Dạo phố Hội An buổi tối rất đẹp, đèn lồng lên màu nổi bật. Kết hợp thêm thời gian ở Đà Nẵng khiến chuyến đi nhiều sắc thái.',
    '4|Đường từ Đà Nẵng vào Hội An khá dễ đi. Phố cổ đông vào cuối tuần nên ghé sớm nếu muốn chụp ảnh.',
    '5|Tôi thích không khí biển Đà Nẵng rồi đến những con phố nhỏ của Hội An. Hai điểm gần nhau nhưng trải nghiệm khác hẳn.',
  ],
  'Test tạm ẩn': [
    '5|Đà Nẵng có biển và núi khá gần nhau. Cảnh từ khu vực Bà Nà nhìn xuống rất ấn tượng.',
    '4|Cầu Vàng đông khách vào giữa ngày. Nếu muốn ngắm cảnh thong thả nên đi sớm.',
    '5|Không khí Đà Nẵng buổi tối rất dễ chịu. Tôi thích dạo ven biển sau một ngày tham quan.',
    '3|Hôm đến Bà Nà nhiều mây nên tầm nhìn thay đổi liên tục. Khi mây tan, Cầu Vàng lên ảnh rất đẹp.',
  ],
  '[TEST FLOW] Trải Nghiệm Khám Phá Bản Địa (Tour Thử Nghiệm 2.000₫)': [
    '5|Đi quanh hồ Hoàn Kiếm và khu phố cũ giúp tôi cảm nhận nhịp sống Hà Nội rõ hơn.',
    '4|Khu trung tâm Hà Nội đông vào chiều tối, nhưng đi bộ qua những con phố nhỏ vẫn rất thú vị.',
  ],
};

function fixtureBookingId(tourId: string, index: number): string {
  const hex = createHash('sha256').update(`tripri-demo-review:v1:${tourId}:${index}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function syncDemoTourReviews(tours: readonly DemoTour[]): Promise<{ created: number; replaced: number }> {
  if (tours.length !== REVIEW_COPY.length) throw new Error('Demo review plans are out of sync');
  const reviewerIds = await Promise.all(REVIEWERS.map(async ([name, slug]) => {
    const user = await prisma.user.upsert({
      where: { email: `demo.review.${slug}@tripri.local` },
      update: {},
      create: { email: `demo.review.${slug}@tripri.local`, fullName: name, role: 'TRAVELER', status: 'ACTIVE', emailVerifiedAt: new Date() },
      select: { id: true },
    });
    return user.id;
  }));
  let created = 0;
  let replaced = 0;
  for (const [tourIndex, item] of tours.entries()) {
    const tour = await prisma.tour.findFirst({ where: { title: item.title }, select: { id: true, title: true, agencyId: true, ratingAvg: true, ratingCount: true } });
    if (!tour) throw new Error(`Missing demo tour for reviews: ${item.title}`);
    const existing = await prisma.review.findMany({ where: { tourId: tour.id, status: 'VISIBLE' }, select: { id: true, bookingId: true, comment: true } });
    const linked = await prisma.booking.findMany({ where: { id: { in: existing.map((review) => review.bookingId) } }, select: { id: true } });
    const linkedIds = new Set(linked.map((booking) => booking.id));
    const reusable = existing.filter((review) => OLD_GENERIC_COMMENTS.has(review.comment) && !linkedIds.has(review.bookingId));
    const extraReviewsPool = [
      '5|Chuyến đi tổ chức rất chuyên nghiệp, các điểm tham quan sắp xếp hợp lý và xe di chuyển êm ái.',
      '5|Cảnh sắc Việt Nam quá đỗi tuyệt vời, đồ ăn địa phương ngon miệng và khách sạn sạch sẽ tiện nghi.',
      '5|Hướng dẫn viên nhiệt tình, chu đáo và am hiểu sâu sắc văn hóa lịch sử từng điểm đến.',
      '5|Trải nghiệm đáng giá từng đồng. Tôi và gia đình đã có một kỳ nghỉ vô cùng đáng nhớ.',
      '5|Thời tiết ủng hộ, chụp được rất nhiều ảnh đẹp. Dịch vụ hỗ trợ của đoàn rất tận tâm.',
      '5|Lịch trình chi tiết, phong phú, không hề bị gấp gáp hay mệt mỏi chút nào.',
      '4|Điểm tham quan đẹp, hướng dẫn viên vui tính. Nhất định tôi sẽ giới thiệu bạn bè cùng đi.',
    ];
    const combinedReviews = [...REVIEW_COPY[tourIndex]!, ...extraReviewsPool];

    for (const [index, idea] of combinedReviews.entries()) {
      const bookingId = fixtureBookingId(tour.id, index);
      if (existing.some((review) => review.bookingId === bookingId)) continue;
      const [ratingText, comment] = idea.split('|');
      const rating = Number(ratingText);
      const images = index === 0 ? [item.images[1] ?? item.images[0]!]
        : index === 1 && item.images[2] ? [item.images[2]] : [];
      const data = {
        bookingId, tourId: tour.id, tourTitle: tour.title, agencyId: tour.agencyId,
        travelerId: reviewerIds[(tourIndex * 5 + index) % reviewerIds.length]!,
        rating, comment: comment!, images, status: 'VISIBLE' as const,
      };
      const old = reusable.shift();
      if (old) {
        await prisma.review.update({ where: { id: old.id }, data });
        replaced += 1;
      } else {
        await prisma.review.create({ data });
        created += 1;
      }
    }
    const stats = await prisma.review.aggregate({ where: { tourId: tour.id, status: 'VISIBLE' }, _avg: { rating: true }, _count: { _all: true } });
    const ratingAvg = stats._avg.rating ?? 0;
    const ratingCount = stats._count._all;
    if (tour.ratingAvg !== ratingAvg || tour.ratingCount !== ratingCount) {
      await prisma.tour.update({ where: { id: tour.id }, data: { ratingAvg, ratingCount } });
    }
  }
  const publicFixtures = await prisma.tour.findMany({
    where: { status: 'APPROVED', title: { in: Object.keys(PUBLIC_TEST_COPY) } },
    select: { id: true, title: true, images: true, ratingAvg: true, ratingCount: true },
  });
  for (const tour of publicFixtures) {
    const ideas = PUBLIC_TEST_COPY[tour.title]!;
    const oldReviews = await prisma.review.findMany({
      where: { tourId: tour.id, status: 'VISIBLE', comment: { in: [...OLD_GENERIC_COMMENTS] } },
      select: { id: true, bookingId: true },
      orderBy: { createdAt: 'asc' },
    });
    const linked = await prisma.booking.findMany({ where: { id: { in: oldReviews.map((review) => review.bookingId) } }, select: { id: true } });
    const linkedIds = new Set(linked.map((booking) => booking.id));
    for (const [index, review] of oldReviews.filter((row) => !linkedIds.has(row.bookingId)).entries()) {
      const [ratingText, comment] = ideas[index % ideas.length]!.split('|');
      await prisma.review.update({
        where: { id: review.id },
        data: { rating: Number(ratingText), comment: comment!, images: index === 0 ? tour.images.slice(0, 1) : [], travelerId: reviewerIds[(index + 3) % reviewerIds.length]! },
      });
      replaced += 1;
    }
    const stats = await prisma.review.aggregate({ where: { tourId: tour.id, status: 'VISIBLE' }, _avg: { rating: true }, _count: { _all: true } });
    const ratingAvg = stats._avg.rating ?? 0;
    const ratingCount = stats._count._all;
    if (tour.ratingAvg !== ratingAvg || tour.ratingCount !== ratingCount) {
      await prisma.tour.update({ where: { id: tour.id }, data: { ratingAvg, ratingCount } });
    }
  }
  return { created, replaced };
}
