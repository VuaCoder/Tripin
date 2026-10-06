'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout';

interface Slide {
  badge: string;
  badgeIcon: string;
  title: string;
  subtitle: string;
  location: string;
  image: string;
}

const HERO_SLIDES: Slide[] = [
  {
    badge: 'Kỳ quan thế giới UNESCO',
    badgeIcon: 'travel_explore',
    title: 'Chạm Bản Sắc Việt — Hành Trình Độc Bản Theo Phong Cách Riêng',
    subtitle: 'Trải nghiệm du lịch bản địa trọn vẹn với lộ trình cá nhân hóa, đối tác tuyển chọn và giá niêm yết minh bạch.',
    location: 'Vịnh Hạ Long & Lan Hạ, Quảng Ninh',
    image: 'https://lh3.googleusercontent.com/aida/AEtjO1VT-raw4Y7ggYsBWZPl-Nku0oxeiVqxgdI3-1EIOmFtTrp5cBOsWjxgarLKYM9JL2IuUa1Kyi-kIG0EFwTpZPtRQakqeJ0C_EGDdJ2WsQrI93jh2HDnAF_94dslOiqzv0v0IydU4ewcH3KOmXSyIBS2xN-X5RlFUEDt37fi1ppzD2LVBjxTXcEn65ezCNnEfOH0TFu-ZM6tKzSh6aJp6Az6WKA3HSETd5iCK9Tzj1CY6Bfv-MyXpgwaGdM',
  },
  {
    badge: 'Di sản văn hóa & thiên nhiên',
    badgeIcon: 'landscape',
    title: 'Tuyệt Tác Non Nước Ninh Bình',
    subtitle: 'Lững lờ trôi thuyền giữa dòng sông Sao Khê xanh mát, xuyên qua những hang động huyền bí nguyên sơ.',
    location: 'Tràng An, Ninh Bình',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
  },
  {
    badge: 'Đô thị cổ quyến rũ',
    badgeIcon: 'flare',
    title: 'Đêm Hoài Phố Đèn Lồng Lung Linh',
    subtitle: 'Dạo bước giữa những bức tường vàng rêu phong và nghe nhịp chèo khua bóng nước sông Hoài bình yên.',
    location: 'Phố Cổ Hội An, Quảng Nam',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX1N3f-pvzvDYsBDNERiwEh7h89QIc_OffUr0ucrldukmz_beDvFaEgzAV5JoLdfwYJN0TCD_RlPSbqH4o8saymA7leJ0sg1s1ZpyirazSItZBQfJMcdJdrIa0Mj7K_cMfZxxLvBmnWZMKWtp0awgntGg1KeN_RiEH9IErrGTi8ZlbpnG6a0a5QaxKJa5mnzuaAfGuE7O5PJQuS0_E4oH7EvPij2eMlllXiM9oBTnwdrZMAwuXF0RfIw',
  },
];

type SearchTab = 'tour' | 'stay' | 'transport' | 'activity';

interface ProductCard {
  id: string;
  tag: string;
  title: string;
  rating: number;
  price: string;
  unit?: string;
  image: string;
  meta: string;
  location?: string;
}

const CATEGORY_PRODUCTS: Record<SearchTab, ProductCard[]> = {
  tour: [
    {
      id: 'tour-1',
      tag: 'Hạ Long • 2N1Đ',
      title: 'Du thuyền 5 Sao Hạ Long Lan Hạ & Hang Sửng Sốt',
      rating: 4.95,
      price: '2.450.000 ₫',
      meta: 'Hướng dẫn viên song ngữ',
      location: 'Vịnh Hạ Long, Quảng Ninh',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1VT-raw4Y7ggYsBWZPl-Nku0oxeiVqxgdI3-1EIOmFtTrp5cBOsWjxgarLKYM9JL2IuUa1Kyi-kIG0EFwTpZPtRQakqeJ0C_EGDdJ2WsQrI93jh2HDnAF_94dslOiqzv0v0IydU4ewcH3KOmXSyIBS2xN-X5RlFUEDt37fi1ppzD2LVBjxTXcEn65ezCNnEfOH0TFu-ZM6tKzSh6aJp6Az6WKA3HSETd5iCK9Tzj1CY6Bfv-MyXpgwaGdM',
    },
    {
      id: 'tour-2',
      tag: 'Ninh Bình • Trong ngày',
      title: 'Tour Tràng An - Bái Đính: Thuyền sampan & cơm cháy',
      rating: 4.89,
      price: '980.000 ₫',
      meta: 'Đưa đón từ Hà Nội',
      location: 'Tràng An, Ninh Bình',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
    {
      id: 'tour-3',
      tag: 'Hội An • Chiều tối',
      title: 'Đêm Hoài Phố: Thả hoa đăng, làm lồng đèn & nếm ẩm thực',
      rating: 4.92,
      price: '550.000 ₫',
      meta: 'Hướng dẫn viên bản địa',
      location: 'Hội An, Quảng Nam',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX1N3f-pvzvDYsBDNERiwEh7h89QIc_OffUr0ucrldukmz_beDvFaEgzAV5JoLdfwYJN0TCD_RlPSbqH4o8saymA7leJ0sg1s1ZpyirazSItZBQfJMcdJdrIa0Mj7K_cMfZxxLvBmnWZMKWtp0awgntGg1KeN_RiEH9IErrGTi8ZlbpnG6a0a5QaxKJa5mnzuaAfGuE7O5PJQuS0_E4oH7EvPij2eMlllXiM9oBTnwdrZMAwuXF0RfIw',
    },
    {
      id: 'tour-4',
      tag: 'Đà Nẵng • 1 Ngày',
      title: 'Cano cao tốc Cù Lao Chàm & Lặn ngắm san hô Bãi Chồng',
      rating: 4.87,
      price: '720.000 ₫',
      meta: 'Bao gồm ăn trưa hải sản',
      location: 'Cù Lao Chàm, Đà Nẵng',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
  ],
  stay: [
    {
      id: 'stay-1',
      tag: '5 Sao • Quảng Ninh',
      title: 'Legacy Yên Tử - MGallery Resort',
      rating: 4.96,
      price: '3.200.000 ₫',
      unit: '/ đêm',
      meta: 'Bao gồm bữa sáng Hoàng gia',
      location: 'Uông Bí, Quảng Ninh',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
    {
      id: 'stay-2',
      tag: 'Eco Resort • Sapa',
      title: 'Topas Ecolodge Sapa - Đỉnh Núi Mây Ngàn',
      rating: 4.91,
      price: '4.850.000 ₫',
      unit: '/ đêm',
      meta: 'Hồ bơi vô cực nhìn thung lũng',
      location: 'Bản Lếch, Sapa',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1VT-raw4Y7ggYsBWZPl-Nku0oxeiVqxgdI3-1EIOmFtTrp5cBOsWjxgarLKYM9JL2IuUa1Kyi-kIG0EFwTpZPtRQakqeJ0C_EGDdJ2WsQrI93jh2HDnAF_94dslOiqzv0v0IydU4ewcH3KOmXSyIBS2xN-X5RlFUEDt37fi1ppzD2LVBjxTXcEn65ezCNnEfOH0TFu-ZM6tKzSh6aJp6Az6WKA3HSETd5iCK9Tzj1CY6Bfv-MyXpgwaGdM',
    },
    {
      id: 'stay-3',
      tag: 'Boutique • Hội An',
      title: 'Hoi An Memories Resort & Spa Ven Sông Hoài',
      rating: 4.88,
      price: '1.950.000 ₫',
      unit: '/ đêm',
      meta: 'Tặng vé xem Ký Ức Hội An',
      location: 'Cồn Hến, Hội An',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX1N3f-pvzvDYsBDNERiwEh7h89QIc_OffUr0ucrldukmz_beDvFaEgzAV5JoLdfwYJN0TCD_RlPSbqH4o8saymA7leJ0sg1s1ZpyirazSItZBQfJMcdJdrIa0Mj7K_cMfZxxLvBmnWZMKWtp0awgntGg1KeN_RiEH9IErrGTi8ZlbpnG6a0a5QaxKJa5mnzuaAfGuE7O5PJQuS0_E4oH7EvPij2eMlllXiM9oBTnwdrZMAwuXF0RfIw',
    },
    {
      id: 'stay-4',
      tag: 'Bán Đảo Sơn Trà',
      title: 'InterContinental Danang Sun Peninsula Resort',
      rating: 4.98,
      price: '8.900.000 ₫',
      unit: '/ đêm',
      meta: 'Khu nghỉ dưỡng sang trọng hàng đầu',
      location: 'Sơn Trà, Đà Nẵng',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
  ],
  transport: [
    {
      id: 'transport-1',
      tag: 'Limousine VIP 9 Chỗ',
      title: 'Tuyến Hà Nội ↔ Tuần Châu / Hạ Long Đón Tận Nơi',
      rating: 4.94,
      price: '260.000 ₫',
      unit: '/ vé',
      meta: 'Xe chạy cao tốc 2 giờ',
      location: 'Hà Nội - Hạ Long',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1VT-raw4Y7ggYsBWZPl-Nku0oxeiVqxgdI3-1EIOmFtTrp5cBOsWjxgarLKYM9JL2IuUa1Kyi-kIG0EFwTpZPtRQakqeJ0C_EGDdJ2WsQrI93jh2HDnAF_94dslOiqzv0v0IydU4ewcH3KOmXSyIBS2xN-X5RlFUEDt37fi1ppzD2LVBjxTXcEn65ezCNnEfOH0TFu-ZM6tKzSh6aJp6Az6WKA3HSETd5iCK9Tzj1CY6Bfv-MyXpgwaGdM',
    },
    {
      id: 'transport-2',
      tag: 'Cabin Đôi Hoàng Gia',
      title: 'Xe Giường Nằm VIP Hà Nội ↔ Trung Tâm Thị Xã Sapa',
      rating: 4.9,
      price: '380.000 ₫',
      unit: '/ vé',
      meta: 'Cổng sạc, rèm riêng tư, massage',
      location: 'Hà Nội - Sapa',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
    {
      id: 'transport-3',
      tag: 'Xe Riêng 7 Chỗ',
      title: 'Đưa Đón Riêng Sân Bay Đà Nẵng ↔ Khách Sạn Phố Cổ Hội An',
      rating: 4.97,
      price: '320.000 ₫',
      unit: '/ chuyến',
      meta: 'Bao gồm phí cầu đường & chờ',
      location: 'Đà Nẵng - Hội An',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX1N3f-pvzvDYsBDNERiwEh7h89QIc_OffUr0ucrldukmz_beDvFaEgzAV5JoLdfwYJN0TCD_RlPSbqH4o8saymA7leJ0sg1s1ZpyirazSItZBQfJMcdJdrIa0Mj7K_cMfZxxLvBmnWZMKWtp0awgntGg1KeN_RiEH9IErrGTi8ZlbpnG6a0a5QaxKJa5mnzuaAfGuE7O5PJQuS0_E4oH7EvPij2eMlllXiM9oBTnwdrZMAwuXF0RfIw',
    },
    {
      id: 'transport-4',
      tag: 'Limousine 11 Chỗ',
      title: 'Tuyến Hà Nội ↔ Tràng An - Tam Cốc Ninh Bình',
      rating: 4.88,
      price: '180.000 ₫',
      unit: '/ vé',
      meta: 'Khởi hành liên tục mỗi 60 phút',
      location: 'Hà Nội - Ninh Bình',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
  ],
  activity: [
    {
      id: 'act-1',
      tag: 'Show Thực Cảnh Lớn Nhất',
      title: 'Vé Xem Đại Show Thực Cảnh "Ký Ức Hội An"',
      rating: 4.97,
      price: '600.000 ₫',
      unit: '/ vé',
      meta: 'Vào cổng trực tiếp bằng QR Code',
      location: 'Hội An, Quảng Nam',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX1N3f-pvzvDYsBDNERiwEh7h89QIc_OffUr0ucrldukmz_beDvFaEgzAV5JoLdfwYJN0TCD_RlPSbqH4o8saymA7leJ0sg1s1ZpyirazSItZBQfJMcdJdrIa0Mj7K_cMfZxxLvBmnWZMKWtp0awgntGg1KeN_RiEH9IErrGTi8ZlbpnG6a0a5QaxKJa5mnzuaAfGuE7O5PJQuS0_E4oH7EvPij2eMlllXiM9oBTnwdrZMAwuXF0RfIw',
    },
    {
      id: 'act-2',
      tag: 'Kỷ Lục Guinness',
      title: 'Vé Cáp Treo Fansipan Sun World Legend Khứ Hồi',
      rating: 4.92,
      price: '850.000 ₫',
      unit: '/ vé',
      meta: 'Chinh phục nóc nhà Đông Dương',
      location: 'Sapa, Lào Cai',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
    {
      id: 'act-3',
      tag: 'Trải Nghiệm Sinh Thái',
      title: 'Vé Chèo Thuyền Thúng Rừng Dừa Bảy Mẫu Cẩm Thanh',
      rating: 4.88,
      price: '150.000 ₫',
      unit: '/ vé',
      meta: 'Múa thúng & giăng lưới bắt cá',
      location: 'Hội An, Quảng Nam',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1VT-raw4Y7ggYsBWZPl-Nku0oxeiVqxgdI3-1EIOmFtTrp5cBOsWjxgarLKYM9JL2IuUa1Kyi-kIG0EFwTpZPtRQakqeJ0C_EGDdJ2WsQrI93jh2HDnAF_94dslOiqzv0v0IydU4ewcH3KOmXSyIBS2xN-X5RlFUEDt37fi1ppzD2LVBjxTXcEn65ezCNnEfOH0TFu-ZM6tKzSh6aJp6Az6WKA3HSETd5iCK9Tzj1CY6Bfv-MyXpgwaGdM',
    },
    {
      id: 'act-4',
      tag: 'Vé Thuyền & Tham Quan',
      title: 'Vé Thuyền Danh Thắng Tràng An Tuyến 1, 2, 3',
      rating: 4.91,
      price: '250.000 ₫',
      unit: '/ vé',
      meta: 'Khám phá hang động huyền thoại',
      location: 'Hoa Lư, Ninh Bình',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
  ],
};

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchTab, setSearchTab] = useState<SearchTab>('tour');
  const [categoryTab, setCategoryTab] = useState<SearchTab>('tour');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchSticky, setIsSearchSticky] = useState(false);

  // Search Dropdown States
  const [activeDropdown, setActiveDropdown] = useState<'location' | 'date' | 'guests' | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pets, setPets] = useState(0);

  // Auto-play Hero Carousel every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    
    const handleScroll = () => {
      const searchConsole = document.getElementById('search-console');
      if (searchConsole) {
        setIsSearchSticky(window.scrollY > searchConsole.offsetTop + searchConsole.offsetHeight - 80);
      } else {
        setIsSearchSticky(window.scrollY > 600);
      }
    };
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const slide = HERO_SLIDES[currentSlide];

  return (
    <AppShell role="PUBLIC" fullBleed>
      <div className="flex flex-col w-full -mt-20">
        {/* ========================================================================= */}
        {/* 1. HERO SECTION WITH BACKGROUND CAROUSEL                                  */}
        {/* ========================================================================= */}
        <section className="relative w-full h-[620px] lg:h-[700px] overflow-hidden bg-surface-container-highest">
          {HERO_SLIDES.map((item, index) => {
            const isActive = index === currentSlide;
            return (
              <div
                key={item.location}
                className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${
                  isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                {/* Background Image with Ambient Filter */}
                <div
                  className={`absolute inset-0 bg-cover bg-center transition-transform duration-[6000ms] ${
                    isActive ? 'scale-105' : 'scale-100'
                  }`}
                  style={{
                    backgroundImage: `url("${item.image}")`,
                    filter: 'brightness(0.85) saturate(1.1) contrast(1.02)',
                  }}
                />

                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1d26] via-[#0d1d26]/40 to-black/30" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#004f57]/50 via-transparent to-transparent" />

                {/* Hero Content */}
                <div className="relative max-w-[1280px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-32 lg:pb-36 pt-24 text-white">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md w-fit mb-4 text-secondary-fixed border border-white/20 shadow-sm">
                    <span className="material-symbols-outlined text-[16px]">{item.badgeIcon}</span>
                    <span className="text-xs uppercase font-bold tracking-wider">{item.badge}</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl font-extrabold max-w-3xl mb-4 leading-tight drop-shadow-md">
                    {item.title}
                  </h1>

                  <p className="text-base sm:text-lg text-surface-container-low max-w-xl mb-6 drop-shadow leading-relaxed">
                    {item.subtitle}
                  </p>

                  <div className="flex items-center gap-4 flex-wrap">
                    <Link
                      href="/explore"
                      className="inline-flex items-center justify-center gap-2 bg-[#087e8b] hover:bg-[#00636e] text-white font-semibold text-sm sm:text-base px-6 py-3 rounded-2xl shadow-xl shadow-primary-container/30 transition-all transform hover:-translate-y-0.5 border border-white/20 h-12"
                    >
                      <span>Khám phá ngay</span>
                      <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </Link>

                    <span className="text-xs sm:text-sm text-surface-variant flex items-center gap-1.5 backdrop-blur-md px-3.5 py-2 rounded-xl bg-slate-900/40 border border-white/10 shadow-sm h-12">
                      <span className="material-symbols-outlined text-[16px] text-secondary-fixed">photo_camera</span>
                      {item.location}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Carousel Progress Indicator & Navigation Controls */}
          <div className="absolute bottom-32 lg:bottom-40 left-0 right-0 z-20 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-40 sm:w-48 h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary-fixed transition-all duration-500"
                  style={{ width: `${((currentSlide + 1) / HERO_SLIDES.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-white/80">
                0{currentSlide + 1} / 0{HERO_SLIDES.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
                aria-label="Slide trước"
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md flex items-center justify-center transition-colors border border-white/20"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)}
                aria-label="Slide tiếp theo"
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md flex items-center justify-center transition-colors border border-white/20"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-surface via-surface/40 to-transparent pointer-events-none z-10" />
        </section>

        {/* ========================================================================= */}
        {/* 2. OVERLAPPING SEARCH CONSOLE                                             */}
        {/* ========================================================================= */}
        <section id="search-console" className="relative z-30 max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 -mt-16 lg:-mt-20 mb-16 transition-all duration-300">
          {activeDropdown && (
             <div className="fixed inset-0 z-20 bg-black/5" onClick={() => setActiveDropdown(null)} />
          )}
          <div className={`rounded-3xl backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(8,126,139,0.22),0_12px_30px_-10px_rgba(0,0,0,0.1)] border border-white/80 relative z-30 ${activeDropdown ? 'bg-surface-container-low' : 'bg-white/90'}`}>
            {/* Search Category Tabs */}
            <div className="flex border-b border-surface-container/60 bg-surface-container-low/50 overflow-x-auto justify-between rounded-t-3xl">
                {[
                  { key: 'tour', label: 'Tour du lịch', icon: 'tour' },
                  { key: 'stay', label: 'Khách sạn & Lưu trú', icon: 'hotel' },
                  { key: 'transport', label: 'Vé xe & Di chuyển', icon: 'directions_car' },
                  { key: 'activity', label: 'Vé vui chơi & Trải nghiệm', icon: 'attractions' },
                ].map((tab) => {
                  const isActive = searchTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSearchTab(tab.key as SearchTab)}
                      className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap ${
                        isActive
                          ? 'text-primary-container border-b-2 border-primary-container bg-surface-container-lowest shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

            {/* Tab Inputs Panel */}
            <div className="p-4 lg:p-6">
              <div className="flex flex-col md:flex-row items-stretch md:items-center bg-transparent md:bg-white md:rounded-full md:border md:border-slate-200 md:shadow-sm relative gap-2 md:gap-0">
                {/* Field 1: Destination / Route */}
                <div 
                  className={`relative flex-1 w-full p-3 md:py-3 md:px-6 md:rounded-full transition-colors cursor-pointer group ${activeDropdown === 'location' ? 'bg-white shadow-lg z-10 rounded-2xl md:rounded-full md:border-transparent border border-slate-200' : 'bg-surface-container-low md:bg-transparent hover:bg-slate-200 rounded-2xl'}`}
                  onClick={() => setActiveDropdown('location')}
                >
                  <label className="block text-xs font-bold text-on-surface mb-0.5 ml-1">
                    Địa điểm
                  </label>
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm điểm đến"
                      className="w-full bg-transparent text-sm font-semibold text-on-surface placeholder:text-on-surface-variant focus:outline-none cursor-pointer ml-1"
                    />
                    {activeDropdown === 'location' && searchQuery && (
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors ml-2 flex-shrink-0"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    )}
                  </div>
                  {/* Location Popup */}
                  {activeDropdown === 'location' && (
                    <div className="absolute top-[120%] left-0 w-[calc(100vw-32px)] sm:w-[400px] bg-white rounded-3xl shadow-xl border border-slate-100 p-6 z-[70] cursor-default" onClick={e => e.stopPropagation()}>
                      <div className="text-xs font-bold text-slate-500 mb-4">Điểm đến được đề xuất</div>
                      <div className="flex flex-col gap-1 max-h-[350px] overflow-y-auto pr-2">
                        {[
                          { title: 'Lân cận', desc: 'Tìm xung quanh bạn', icon: 'near_me' },
                          { title: 'Thành phố Hồ Chí Minh', desc: 'Có các thắng cảnh như Chợ Bến Thành', icon: 'location_city' },
                          { title: 'Bangkok', desc: 'Có cuộc sống về đêm náo nhiệt', icon: 'temple_buddhist' },
                          { title: 'Kuala Lumpur, Malaysia', desc: 'Có kiến trúc ấn tượng', icon: 'apartment' },
                          { title: 'Thành phố Huế', desc: 'Thích hợp cho kỳ nghỉ hè', icon: 'fort' },
                          { title: 'Paris', desc: 'Có các thắng cảnh như Tháp Eiffel', icon: 'tour' }
                        ].map(item => (
                          <div key={item.title} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); setSearchQuery(item.title); setActiveDropdown('date'); }}>
                            <div className="w-12 h-12 flex-shrink-0 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                              <span className="material-symbols-outlined">{item.icon}</span>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-800">{item.title}</div>
                              <div className="text-xs text-slate-500">{item.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px h-8 bg-slate-200 self-center"></div>

                {/* Field 2: Date Selector */}
                <div 
                  className={`relative flex-1 w-full p-3 md:py-3 md:px-6 md:rounded-full transition-colors cursor-pointer group ${activeDropdown === 'date' ? 'bg-white shadow-lg z-10 rounded-2xl md:rounded-full md:border-transparent border border-slate-200' : 'bg-surface-container-low md:bg-transparent hover:bg-slate-200 rounded-2xl'}`}
                  onClick={() => setActiveDropdown('date')}
                >
                  <label className="block text-xs font-bold text-on-surface mb-0.5 ml-1">
                    Thời gian
                  </label>
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      readOnly
                      value={selectedDate}
                      placeholder="Thêm ngày"
                      className="w-full bg-transparent text-sm font-semibold text-on-surface placeholder:text-on-surface-variant focus:outline-none cursor-pointer ml-1"
                    />
                    {activeDropdown === 'date' && selectedDate && (
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setSelectedDate(''); }}
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors ml-2 flex-shrink-0"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    )}
                  </div>
                  {/* Date Popup */}
                  {activeDropdown === 'date' && (
                    <div className="absolute top-[120%] left-1/2 -translate-x-1/2 w-[calc(100vw-32px)] sm:w-[700px] bg-white rounded-3xl shadow-xl border border-slate-100 p-6 z-[70] cursor-default" onClick={e => e.stopPropagation()}>
                       <div className="flex justify-center mb-6">
                         <div className="bg-slate-100 p-1 rounded-full flex gap-1">
                           <button className="px-6 py-2 bg-white rounded-full text-sm font-bold shadow-sm">Ngày</button>
                           <button className="px-6 py-2 rounded-full text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors">Linh hoạt</button>
                         </div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         {/* Month 1 */}
                         <div>
                           <div className="text-center font-bold mb-6 text-slate-800 text-base">Tháng 10 năm 2026</div>
                           <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-4">
                             <div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div><div>CN</div>
                           </div>
                           <div className="grid grid-cols-7 text-center text-sm font-semibold gap-y-2">
                              <div/><div/><div/>
                              {Array.from({length: 31}).map((_, i) => {
                                const dateStr = `${i+1} thg 10`;
                                return (
                                <div key={i} onClick={(e) => { e.stopPropagation(); setSelectedDate(dateStr); setActiveDropdown('guests'); }} className={`w-10 h-10 flex items-center justify-center rounded-full cursor-pointer mx-auto transition-all ${selectedDate === dateStr ? 'bg-slate-800 text-white' : 'hover:border hover:border-slate-800 text-slate-800'}`}>{i+1}</div>
                              )})}
                           </div>
                         </div>
                         {/* Month 2 */}
                         <div className="hidden md:block">
                           <div className="text-center font-bold mb-6 text-slate-800 text-base">Tháng 11 năm 2026</div>
                           <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 mb-4">
                             <div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div><div>CN</div>
                           </div>
                           <div className="grid grid-cols-7 text-center text-sm font-semibold gap-y-2">
                              <div/><div/><div/><div/><div/><div/>
                              {Array.from({length: 30}).map((_, i) => {
                                const dateStr = `${i+1} thg 11`;
                                return (
                                <div key={i} onClick={(e) => { e.stopPropagation(); setSelectedDate(dateStr); setActiveDropdown('guests'); }} className={`w-10 h-10 flex items-center justify-center rounded-full cursor-pointer mx-auto transition-all ${selectedDate === dateStr ? 'bg-slate-800 text-white' : 'hover:border hover:border-slate-800 text-slate-800'}`}>{i+1}</div>
                              )})}
                           </div>
                         </div>
                       </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px h-8 bg-slate-200 self-center"></div>

                {/* Field 3: Guests / Tickets */}
                <div 
                  className={`relative flex-1 w-full p-3 md:py-3 md:pl-6 md:pr-2 md:rounded-full transition-colors cursor-pointer group flex items-center justify-between ${activeDropdown === 'guests' ? 'bg-white shadow-lg z-10 rounded-2xl md:rounded-full md:border-transparent border border-slate-200' : 'bg-surface-container-low md:bg-transparent hover:bg-slate-200 rounded-2xl'}`}
                  onClick={() => setActiveDropdown('guests')}
                >
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-on-surface mb-0.5 ml-1">
                      Khách
                    </label>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold truncate ml-1 ${adults + children + infants > 0 ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                        {adults + children + infants > 0 ? `${adults + children} khách${infants > 0 ? `, ${infants} em bé` : ''}${pets > 0 ? `, ${pets} thú cưng` : ''}` : 'Thêm khách'}
                      </span>
                    </div>
                  </div>
                  {/* Search Button for Desktop */}
                  <div className="hidden md:block ml-4 pr-1">
                    <Link
                      href={`/explore?type=${searchTab}&q=${encodeURIComponent(searchQuery)}`}
                      className="w-12 h-12 bg-[#087e8b] hover:bg-[#00636e] text-white rounded-full flex items-center justify-center transition-transform transform hover:scale-105 shadow-md flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[24px]">search</span>
                    </Link>
                  </div>
                  {/* Guests Popup */}
                  {activeDropdown === 'guests' && (
                    <div className="absolute top-[120%] right-0 w-[calc(100vw-32px)] sm:w-[350px] bg-white rounded-3xl shadow-xl border border-slate-100 p-6 z-[70] cursor-default" onClick={e => e.stopPropagation()}>
                       <div className="flex flex-col gap-6 divide-y divide-slate-100">
                          <div className="flex items-center justify-between pt-2">
                             <div>
                               <div className="text-sm font-bold text-slate-800">Người lớn</div>
                               <div className="text-xs text-slate-500">Từ 13 tuổi trở lên</div>
                             </div>
                             <div className="flex items-center gap-3">
                               <button className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={() => setAdults(Math.max(0, adults - 1))}>-</button>
                               <span className="w-4 text-center font-semibold text-sm text-slate-800">{adults}</span>
                               <button className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={() => setAdults(adults + 1)}>+</button>
                             </div>
                          </div>
                          <div className="flex items-center justify-between pt-6">
                             <div>
                               <div className="text-sm font-bold text-slate-800">Trẻ em</div>
                               <div className="text-xs text-slate-500">Độ tuổi 2 – 12</div>
                             </div>
                             <div className="flex items-center gap-3">
                               <button className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={() => setChildren(Math.max(0, children - 1))}>-</button>
                               <span className="w-4 text-center font-semibold text-sm text-slate-800">{children}</span>
                               <button className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={() => setChildren(children + 1)}>+</button>
                             </div>
                          </div>
                          <div className="flex items-center justify-between pt-6">
                             <div>
                               <div className="text-sm font-bold text-slate-800">Em bé</div>
                               <div className="text-xs text-slate-500">Dưới 2 tuổi</div>
                             </div>
                             <div className="flex items-center gap-3">
                               <button className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={() => setInfants(Math.max(0, infants - 1))}>-</button>
                               <span className="w-4 text-center font-semibold text-sm text-slate-800">{infants}</span>
                               <button className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={() => setInfants(infants + 1)}>+</button>
                             </div>
                          </div>
                          <div className="flex items-center justify-between pt-6">
                             <div>
                               <div className="text-sm font-bold text-slate-800">Thú cưng</div>
                               <div className="text-xs text-slate-500 underline cursor-pointer hover:text-slate-800">Bạn sẽ mang theo động vật phục vụ?</div>
                             </div>
                             <div className="flex items-center gap-3">
                               <button className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={() => setPets(Math.max(0, pets - 1))}>-</button>
                               <span className="w-4 text-center font-semibold text-sm text-slate-800">{pets}</span>
                               <button className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:border-slate-800 hover:text-slate-800 transition-colors" onClick={() => setPets(pets + 1)}>+</button>
                             </div>
                          </div>
                       </div>
                    </div>
                  )}
                </div>

                {/* Mobile Search Button */}
                <div className="md:hidden mt-2 w-full">
                  <Link
                    href={`/explore?type=${searchTab}&q=${encodeURIComponent(searchQuery)}`}
                    className="w-full min-h-[54px] bg-[#087e8b] hover:bg-[#00636e] text-white text-sm font-bold rounded-2xl shadow-lg shadow-[#087e8b]/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
                  >
                    <span className="material-symbols-outlined text-[20px]">search</span>
                    <span>Tìm kiếm</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Floating Mini Search Console in Header */}
        <div className={`fixed top-4 lg:top-3 left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-full ${
          isSearchSticky ? "translate-y-0 opacity-100 pointer-events-auto scale-100" : "-translate-y-10 opacity-0 pointer-events-none scale-95"
        }`}>
          <div className="flex items-center bg-white rounded-full border border-slate-200 p-1.5 pl-5 h-[52px]">
             <div className="flex items-center divide-x divide-slate-200 text-sm font-semibold text-slate-800">
               <button 
                 type="button" 
                 onClick={() => { document.getElementById('search-console')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setActiveDropdown('location'); }}
                 className="pr-4 hover:text-primary transition-colors truncate max-w-[150px]"
               >
                 {searchQuery || 'Mọi nơi'}
               </button>
               <button 
                 type="button"
                 onClick={() => { document.getElementById('search-console')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setActiveDropdown('date'); }}
                 className="px-4 hover:text-primary transition-colors whitespace-nowrap"
               >
                 Bất kỳ lúc nào
               </button>
               <button 
                 type="button"
                 onClick={() => { document.getElementById('search-console')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setActiveDropdown('guests'); }}
                 className="px-4 hover:text-primary transition-colors whitespace-nowrap text-slate-500 font-normal"
               >
                 {adults + children > 0 ? `${adults + children} khách` : 'Thêm khách'}
               </button>
             </div>
             <button 
               type="button"
               onClick={() => document.getElementById('search-console')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
               className="w-10 h-10 ml-1 rounded-full bg-[#087e8b] hover:bg-[#00636e] text-white flex items-center justify-center transition-colors shadow-md"
             >
               <span className="material-symbols-outlined text-[18px]">search</span>
             </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. CATEGORY SWITCHER & CARDS SHOWCASE                                     */}
        {/* ========================================================================= */}
        <section className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 mb-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary-container block mb-1">
                Lựa chọn hàng đầu
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Trải Nghiệm &amp; Điểm Đến Được Tuyển Chọn
              </h2>
            </div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-container transition-colors"
            >
              <span>Xem tất cả sản phẩm</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>

          {/* 4 Category Filter Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { key: 'tour', label: 'Tour & Trải nghiệm', sub: 'Được kiểm định chất lượng', icon: 'tour' },
              { key: 'stay', label: 'Khách sạn & Lưu trú', sub: 'Resort & boutique chọn lọc', icon: 'hotel' },
              { key: 'transport', label: 'Vé xe & Di chuyển', sub: 'Limousine & xe đón tận nơi', icon: 'directions_car' },
              { key: 'activity', label: 'Vé tham quan & Show', sub: 'Vé điện tử vào cổng nhanh', icon: 'attractions' },
            ].map((cat) => {
              const active = categoryTab === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategoryTab(cat.key as SearchTab)}
                  className={`rounded-2xl p-4 flex items-center gap-3 transition-all duration-300 text-left ${
                    active
                      ? 'bg-primary-container text-white shadow-lg shadow-primary-container/30 -translate-y-1'
                      : 'bg-white/80 backdrop-blur-md border border-slate-100 text-on-surface hover:bg-white hover:shadow-xl hover:-translate-y-0.5'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                      active ? 'bg-white/20 text-white' : 'bg-primary-container/10 text-primary-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]">{cat.icon}</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold leading-snug">{cat.label}</div>
                    <div className={`text-xs ${active ? 'text-white/80' : 'text-on-surface-variant'}`}>{cat.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CATEGORY_PRODUCTS[categoryTab].map((item) => (
              <div
                key={item.id}
                className="rounded-3xl bg-white shadow-[0_12px_35px_-6px_rgba(0,0,0,0.08)] hover:shadow-[0_22px_45px_-6px_rgba(8,126,139,0.2)] border border-slate-100 hover:-translate-y-1.5 transition-all overflow-hidden flex flex-col group"
              >
                {/* Image Cover */}
                <div className="relative w-full aspect-[16/10] overflow-hidden">
                  <div
                    className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url('${item.image}')` }}
                  />
                  <div className="absolute top-3.5 left-3.5">
                    <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-slate-900 font-bold text-xs shadow-sm">
                      {item.tag}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Lưu mục yêu thích"
                    className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/85 backdrop-blur-md flex items-center justify-center text-on-surface-variant hover:text-red-500 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">favorite</span>
                  </button>
                </div>

                {/* Card Content */}
                <div className="p-5 flex flex-col flex-1 justify-between">
                  <div>
                    {item.location && (
                      <div className="flex items-center gap-1.5 text-on-surface-variant text-xs mb-1">
                        <span className="material-symbols-outlined text-[15px] text-primary-container">location_on</span>
                        <span>{item.location}</span>
                      </div>
                    )}
                    <h3 className="font-bold text-base text-slate-900 mb-2 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-2 mb-3 text-xs text-on-surface-variant">
                      <div className="flex items-center text-amber-500 font-bold">
                        <span className="material-symbols-outlined text-[16px]">star</span>
                        <span className="ml-1 text-slate-900">{item.rating}</span>
                      </div>
                      <span>• {item.meta}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
                    <div>
                      <span className="text-[11px] text-on-surface-variant block">Giá từ</span>
                      <span className="font-bold text-base text-primary-container">
                        {item.price}
                        {item.unit && <span className="text-xs font-normal text-slate-500">{item.unit}</span>}
                      </span>
                    </div>
                    <Link
                      href={`/explore/${item.id}`}
                      className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-primary-container hover:text-white text-primary text-xs font-bold transition-all shadow-sm"
                    >
                      Xem chi tiết
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>



        {/* ========================================================================= */}
        {/* 5. TRUST & CORE VALUES                                                    */}
        {/* ========================================================================= */}
        <section className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 mb-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-container block mb-2">
              Giá trị cốt lõi
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
              An Tâm Trọn Vẹn Khi Đặt Chỗ Tại Tripri
            </h2>
            <p className="text-sm text-slate-600">
              Chúng tôi đề cao tính chân thực, bảo vệ quyền lợi du khách và xây dựng tiêu chuẩn trải nghiệm du lịch chuẩn mực tại Việt Nam.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: 'verified_user',
                title: 'Đối tác kiểm định',
                desc: 'Mọi đơn vị lữ hành và hướng dẫn viên cá nhân đều được đối chiếu giấy phép hành nghề trước khi mở bán tour.',
              },
              {
                icon: 'payments',
                title: 'Minh bạch chi phí',
                desc: 'Giá niêm yết rõ ràng theo VNĐ, liệt kê chi tiết các khoản đã bao gồm và chưa bao gồm, không phí ẩn.',
              },
              {
                icon: 'published_with_changes',
                title: 'Chính sách hủy linh hoạt',
                desc: 'Quy trình hoàn tiền rõ ràng tuân thủ theo mốc thời gian quy định sẵn, giải quyết nhanh chóng qua cổng hỗ trợ.',
              },
              {
                icon: 'support_agent',
                title: 'Đồng hành 24/7',
                desc: 'Đội ngũ chăm sóc khách hàng địa phương sẵn sàng hỗ trợ bạn từ khi lên kế hoạch cho đến khi kết thúc tour.',
              },
            ].map((val) => (
              <div
                key={val.title}
                className="rounded-2xl bg-white shadow-[0_8px_25px_-5px_rgba(0,0,0,0.06)] border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all p-6"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-[28px]">{val.icon}</span>
                </div>
                <h3 className="font-bold text-base text-slate-900 mb-2">{val.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{val.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. PARTNER CALLOUT BANNER                                                 */}
        {/* ========================================================================= */}
        <section className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 mb-16">
          <div className="rounded-3xl shadow-xl border border-surface-container bg-gradient-to-r from-surface-container-high to-surface-container p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-container text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary-container/25">
                <span className="material-symbols-outlined text-[28px]">handshake</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-on-surface">Bạn là hướng dẫn viên hay công ty lữ hành?</h3>
                <p className="text-sm text-on-surface-variant">
                  Gia nhập mạng lưới Tripri để tiếp cận du khách trong và ngoài nước có nhu cầu khám phá trải nghiệm chân thực.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Link
                href="/agency"
                className="inline-flex items-center gap-2 bg-on-surface text-white hover:bg-primary font-bold text-sm px-6 py-3 rounded-2xl transition-all shadow-md transform hover:-translate-y-0.5"
              >
                <span>Truy cập Cổng đối tác</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
