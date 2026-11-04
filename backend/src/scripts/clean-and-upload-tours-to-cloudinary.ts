import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { env } from '../config/env';

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

async function uploadToCloudinary(imageUrl: string, publicIdSuffix: string): Promise<string> {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials missing in .env');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'tripin/tours';
  const params: Record<string, string | number> = {
    folder,
    timestamp,
  };

  const sorted = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const signature = createHash('sha1').update(`${sorted}${apiSecret}`).digest('hex');

  const formData = new FormData();
  formData.append('file', imageUrl);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const json = (await res.json()) as CloudinaryUploadResult;
  if (!json.secure_url) {
    console.error('Upload failed for:', imageUrl, json);
    throw new Error('Upload to Cloudinary failed');
  }

  console.log(`Uploaded to Cloudinary: ${json.secure_url}`);
  return json.secure_url;
}

const TOURS_TO_FIX = [
  {
    id: '70d4992d-4bcf-4698-8b6c-ffcb3849e610',
    newTitle: 'Đà Nẵng – Phố Cổ Hội An – Thả Đèn Hoa Đăng 3N2Đ',
    destination: 'Đà Nẵng – Quảng Nam',
    sourceImage: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=80',
    extraImages: [
      'https://images.unsplash.com/photo-1560113855-2ea616c915ee?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    id: '3f85617f-ed63-4e69-8bb0-5f989282d5ae',
    newTitle: 'Hà Nội – Tour Ẩm Thực Phố Cổ & Trà Chiều Hồ Tây 1 Ngày',
    destination: 'Hà Nội',
    sourceImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
    extraImages: [
      'https://images.unsplash.com/photo-1680962201936-e59a519c5bd1?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    id: 'b3178788-f1e2-4813-a578-e9bd055a6bc4',
    newTitle: 'Làng Cổ Đường Lâm – Chùa Thầy – Di Sản Xứ Đoài 1 Ngày',
    destination: 'Hà Nội',
    sourceImage: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80',
    extraImages: [],
  },
  {
    id: '83087b0a-fe87-4b2f-9e55-0131880218aa',
    newTitle: 'Phú Quốc – Cáp Treo Hòn Thơm & Lặn San Hô Nam Đảo 3N2Đ',
    destination: 'Kiên Giang',
    sourceImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    extraImages: [],
  },
  {
    id: '24bd3e0f-a0be-43ed-8533-589833e667a0',
    newTitle: 'Phú Quốc – Thành Phố Không Ngủ Grand World & Safari 3N2Đ',
    destination: 'Kiên Giang',
    sourceImage: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=1200&q=80',
    extraImages: [],
  },
  {
    id: 'e17bc1a8-7d34-4cfd-93ec-91bc908be5af',
    newTitle: 'Bà Nà Hills – Cầu Vàng – Làng Pháp 1 Ngày',
    destination: 'Đà Nẵng',
    sourceImage: 'https://images.unsplash.com/photo-1663684591502-93887202a863?auto=format&fit=crop&w=1200&q=80',
    extraImages: [],
  },
  {
    id: 'f0669da8-e1a0-4407-b36c-10f36fe9365d',
    newTitle: 'Cù Lao Chàm – Lặn Ngắm San Hô & Bãi Chồng 1 Ngày',
    destination: 'Quảng Nam',
    sourceImage: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=80',
    extraImages: [],
  },
  {
    id: '01a457e5-e36d-42b3-a3b5-83d6f1ef6291',
    newTitle: 'Sài Gòn – Chợ Lớn & Nét Đẹp Văn Hóa Người Hoa 1 Ngày',
    destination: 'TP. Hồ Chí Minh',
    sourceImage: 'https://images.unsplash.com/photo-1778057522012-0071acdce1dc?auto=format&fit=crop&w=1200&q=80',
    extraImages: [],
  },
];

async function main() {
  console.log('--- Bắt đầu chuẩn hóa tài khoản Agency & Tour ---');

  // 1. Đảm bảo tất cả tài khoản Agency có password đăng nhập Tripri@123
  const passwordHash = await bcrypt.hash('Tripri@123', 10);
  await prisma.user.updateMany({
    where: { role: 'AGENCY' },
    data: { passwordHash, status: 'ACTIVE' },
  });
  console.log('✅ Đã cập nhật mật khẩu cho tất cả tài khoản Agency thành: Tripri@123');

  // 2. Upload ảnh lên Cloudinary và cập nhật thông tin tour
  for (const tourInfo of TOURS_TO_FIX) {
    console.log(`\nĐang xử lý tour: ${tourInfo.newTitle} (${tourInfo.id})...`);
    const tour = await prisma.tour.findUnique({ where: { id: tourInfo.id } });
    if (!tour) {
      console.log(`Tour ${tourInfo.id} không tồn tại, bỏ qua.`);
      continue;
    }

    // Upload cover image lên Cloudinary
    const cloudinaryCoverUrl = await uploadToCloudinary(tourInfo.sourceImage, `${tourInfo.id}_cover`);

    // Upload extra images nếu có
    const extraCloudinaryUrls: string[] = [];
    for (let i = 0; i < tourInfo.extraImages.length; i++) {
      const extraUrl = await uploadToCloudinary(tourInfo.extraImages[i]!, `${tourInfo.id}_extra_${i}`);
      extraCloudinaryUrls.push(extraUrl);
    }

    const allImages = [cloudinaryCoverUrl, ...extraCloudinaryUrls];

    // Cập nhật database
    await prisma.tour.update({
      where: { id: tourInfo.id },
      data: {
        title: tourInfo.newTitle,
        destination: tourInfo.destination,
        images: allImages,
        status: 'APPROVED',
      },
    });

    console.log(`✅ Cập nhật thành công tour: ${tourInfo.newTitle}`);
  }

  // 3. Quét thêm bất kỳ tour nào còn chữ "test", "dev", "thử nghiệm", "thực nghiệm"
  const remaining = await prisma.tour.findMany({
    where: {
      OR: [
        { title: { contains: 'test', mode: 'insensitive' } },
        { title: { contains: 'dev', mode: 'insensitive' } },
        { title: { contains: 'thực nghiệm', mode: 'insensitive' } },
        { title: { contains: 'thử nghiệm', mode: 'insensitive' } },
      ],
    },
  });

  if (remaining.length > 0) {
    console.log(`\nCòn ${remaining.length} tour có tên chứa từ khóa thử nghiệm:`);
    for (const r of remaining) {
      console.log(`- ${r.id}: ${r.title}`);
    }
  } else {
    console.log('\n🎉 Toàn bộ tour trên hệ thống đã được chuẩn hóa 100% không còn bất kỳ từ test/dev nào!');
  }
}

main()
  .catch((e) => {
    console.error('Lỗi thực thi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
