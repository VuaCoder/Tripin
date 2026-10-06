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
    badge: 'Kß╗│ quan thß║┐ giß╗¢i UNESCO',
    badgeIcon: 'travel_explore',
    title: 'Chß║ím Bß║ún Sß║»c Viß╗çt ΓÇö H├ánh Tr├¼nh ─Éß╗Öc Bß║ún Theo Phong C├ích Ri├¬ng',
    subtitle: 'Trß║úi nghiß╗çm du lß╗ïch bß║ún ─æß╗ïa trß╗ìn vß║╣n vß╗¢i lß╗Ö tr├¼nh c├í nh├ón h├│a, ─æß╗æi t├íc tuyß╗ân chß╗ìn v├á gi├í ni├¬m yß║┐t minh bß║ích.',
    location: 'Vß╗ïnh Hß║í Long & Lan Hß║í, Quß║úng Ninh',
    image: 'https://lh3.googleusercontent.com/aida/AEtjO1VT-raw4Y7ggYsBWZPl-Nku0oxeiVqxgdI3-1EIOmFtTrp5cBOsWjxgarLKYM9JL2IuUa1Kyi-kIG0EFwTpZPtRQakqeJ0C_EGDdJ2WsQrI93jh2HDnAF_94dslOiqzv0v0IydU4ewcH3KOmXSyIBS2xN-X5RlFUEDt37fi1ppzD2LVBjxTXcEn65ezCNnEfOH0TFu-ZM6tKzSh6aJp6Az6WKA3HSETd5iCK9Tzj1CY6Bfv-MyXpgwaGdM',
  },
  {
    badge: 'Di sß║ún v─ân h├│a & thi├¬n nhi├¬n',
    badgeIcon: 'landscape',
    title: 'Tuyß╗çt T├íc Non N╞░ß╗¢c Ninh B├¼nh',
    subtitle: 'Lß╗»ng lß╗¥ tr├┤i thuyß╗ün giß╗»a d├▓ng s├┤ng Sao Kh├¬ xanh m├ít, xuy├¬n qua nhß╗»ng hang ─æß╗Öng huyß╗ün b├¡ nguy├¬n s╞í.',
    location: 'Tr├áng An, Ninh B├¼nh',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
  },
  {
    badge: '─É├┤ thß╗ï cß╗ò quyß║┐n r┼⌐',
    badgeIcon: 'flare',
    title: '─É├¬m Ho├ái Phß╗æ ─É├¿n Lß╗ông Lung Linh',
    subtitle: 'Dß║ío b╞░ß╗¢c giß╗»a nhß╗»ng bß╗⌐c t╞░ß╗¥ng v├áng r├¬u phong v├á nghe nhß╗ïp ch├¿o khua b├│ng n╞░ß╗¢c s├┤ng Ho├ái b├¼nh y├¬n.',
    location: 'Phß╗æ Cß╗ò Hß╗Öi An, Quß║úng Nam',
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
      tag: 'Hß║í Long ΓÇó 2N1─É',
      title: 'Du thuyß╗ün 5 Sao Hß║í Long Lan Hß║í & Hang Sß╗¡ng Sß╗æt',
      rating: 4.95,
      price: '2.450.000 Γé½',
      meta: 'H╞░ß╗¢ng dß║½n vi├¬n song ngß╗»',
      location: 'Vß╗ïnh Hß║í Long, Quß║úng Ninh',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1VT-raw4Y7ggYsBWZPl-Nku0oxeiVqxgdI3-1EIOmFtTrp5cBOsWjxgarLKYM9JL2IuUa1Kyi-kIG0EFwTpZPtRQakqeJ0C_EGDdJ2WsQrI93jh2HDnAF_94dslOiqzv0v0IydU4ewcH3KOmXSyIBS2xN-X5RlFUEDt37fi1ppzD2LVBjxTXcEn65ezCNnEfOH0TFu-ZM6tKzSh6aJp6Az6WKA3HSETd5iCK9Tzj1CY6Bfv-MyXpgwaGdM',
    },
    {
      id: 'tour-2',
      tag: 'Ninh B├¼nh ΓÇó Trong ng├áy',
      title: 'Tour Tr├áng An - B├íi ─É├¡nh: Thuyß╗ün sampan & c╞ím ch├íy',
      rating: 4.89,
      price: '980.000 Γé½',
      meta: '─É╞░a ─æ├│n tß╗½ H├á Nß╗Öi',
      location: 'Tr├áng An, Ninh B├¼nh',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
    {
      id: 'tour-3',
      tag: 'Hß╗Öi An ΓÇó Chiß╗üu tß╗æi',
      title: '─É├¬m Ho├ái Phß╗æ: Thß║ú hoa ─æ─âng, l├ám lß╗ông ─æ├¿n & nß║┐m ß║⌐m thß╗▒c',
      rating: 4.92,
      price: '550.000 Γé½',
      meta: 'H╞░ß╗¢ng dß║½n vi├¬n bß║ún ─æß╗ïa',
      location: 'Hß╗Öi An, Quß║úng Nam',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX1N3f-pvzvDYsBDNERiwEh7h89QIc_OffUr0ucrldukmz_beDvFaEgzAV5JoLdfwYJN0TCD_RlPSbqH4o8saymA7leJ0sg1s1ZpyirazSItZBQfJMcdJdrIa0Mj7K_cMfZxxLvBmnWZMKWtp0awgntGg1KeN_RiEH9IErrGTi8ZlbpnG6a0a5QaxKJa5mnzuaAfGuE7O5PJQuS0_E4oH7EvPij2eMlllXiM9oBTnwdrZMAwuXF0RfIw',
    },
    {
      id: 'tour-4',
      tag: '─É├á Nß║╡ng ΓÇó 1 Ng├áy',
      title: 'Cano cao tß╗æc C├╣ Lao Ch├ám & Lß║╖n ngß║»m san h├┤ B├úi Chß╗ông',
      rating: 4.87,
      price: '720.000 Γé½',
      meta: 'Bao gß╗ôm ─ân tr╞░a hß║úi sß║ún',
      location: 'C├╣ Lao Ch├ám, ─É├á Nß║╡ng',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
  ],
  stay: [
    {
      id: 'stay-1',
      tag: '5 Sao ΓÇó Quß║úng Ninh',
      title: 'Legacy Y├¬n Tß╗¡ - MGallery Resort',
      rating: 4.96,
      price: '3.200.000 Γé½',
      unit: '/ ─æ├¬m',
      meta: 'Bao gß╗ôm bß╗»a s├íng Ho├áng gia',
      location: 'U├┤ng B├¡, Quß║úng Ninh',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
    {
      id: 'stay-2',
      tag: 'Eco Resort ΓÇó Sapa',
      title: 'Topas Ecolodge Sapa - ─Éß╗ënh N├║i M├óy Ng├án',
      rating: 4.91,
      price: '4.850.000 Γé½',
      unit: '/ ─æ├¬m',
      meta: 'Hß╗ô b╞íi v├┤ cß╗▒c nh├¼n thung l┼⌐ng',
      location: 'Bß║ún Lß║┐ch, Sapa',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1VT-raw4Y7ggYsBWZPl-Nku0oxeiVqxgdI3-1EIOmFtTrp5cBOsWjxgarLKYM9JL2IuUa1Kyi-kIG0EFwTpZPtRQakqeJ0C_EGDdJ2WsQrI93jh2HDnAF_94dslOiqzv0v0IydU4ewcH3KOmXSyIBS2xN-X5RlFUEDt37fi1ppzD2LVBjxTXcEn65ezCNnEfOH0TFu-ZM6tKzSh6aJp6Az6WKA3HSETd5iCK9Tzj1CY6Bfv-MyXpgwaGdM',
    },
    {
      id: 'stay-3',
      tag: 'Boutique ΓÇó Hß╗Öi An',
      title: 'Hoi An Memories Resort & Spa Ven S├┤ng Ho├ái',
      rating: 4.88,
      price: '1.950.000 Γé½',
      unit: '/ ─æ├¬m',
      meta: 'Tß║╖ng v├⌐ xem K├╜ ß╗¿c Hß╗Öi An',
      location: 'Cß╗ôn Hß║┐n, Hß╗Öi An',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX1N3f-pvzvDYsBDNERiwEh7h89QIc_OffUr0ucrldukmz_beDvFaEgzAV5JoLdfwYJN0TCD_RlPSbqH4o8saymA7leJ0sg1s1ZpyirazSItZBQfJMcdJdrIa0Mj7K_cMfZxxLvBmnWZMKWtp0awgntGg1KeN_RiEH9IErrGTi8ZlbpnG6a0a5QaxKJa5mnzuaAfGuE7O5PJQuS0_E4oH7EvPij2eMlllXiM9oBTnwdrZMAwuXF0RfIw',
    },
    {
      id: 'stay-4',
      tag: 'B├ín ─Éß║úo S╞ín Tr├á',
      title: 'InterContinental Danang Sun Peninsula Resort',
      rating: 4.98,
      price: '8.900.000 Γé½',
      unit: '/ ─æ├¬m',
      meta: 'Khu nghß╗ë d╞░ß╗íng sang trß╗ìng h├áng ─æß║ºu',
      location: 'S╞ín Tr├á, ─É├á Nß║╡ng',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
  ],
  transport: [
    {
      id: 'transport-1',
      tag: 'Limousine VIP 9 Chß╗ù',
      title: 'Tuyß║┐n H├á Nß╗Öi Γåö Tuß║ºn Ch├óu / Hß║í Long ─É├│n Tß║¡n N╞íi',
      rating: 4.94,
      price: '260.000 Γé½',
      unit: '/ v├⌐',
      meta: 'Xe chß║íy cao tß╗æc 2 giß╗¥',
      location: 'H├á Nß╗Öi - Hß║í Long',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1VT-raw4Y7ggYsBWZPl-Nku0oxeiVqxgdI3-1EIOmFtTrp5cBOsWjxgarLKYM9JL2IuUa1Kyi-kIG0EFwTpZPtRQakqeJ0C_EGDdJ2WsQrI93jh2HDnAF_94dslOiqzv0v0IydU4ewcH3KOmXSyIBS2xN-X5RlFUEDt37fi1ppzD2LVBjxTXcEn65ezCNnEfOH0TFu-ZM6tKzSh6aJp6Az6WKA3HSETd5iCK9Tzj1CY6Bfv-MyXpgwaGdM',
    },
    {
      id: 'transport-2',
      tag: 'Cabin ─É├┤i Ho├áng Gia',
      title: 'Xe Gi╞░ß╗¥ng Nß║▒m VIP H├á Nß╗Öi Γåö Trung T├óm Thß╗ï X├ú Sapa',
      rating: 4.9,
      price: '380.000 Γé½',
      unit: '/ v├⌐',
      meta: 'Cß╗òng sß║íc, r├¿m ri├¬ng t╞░, massage',
      location: 'H├á Nß╗Öi - Sapa',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
    {
      id: 'transport-3',
      tag: 'Xe Ri├¬ng 7 Chß╗ù',
      title: '─É╞░a ─É├│n Ri├¬ng S├ón Bay ─É├á Nß║╡ng Γåö Kh├ích Sß║ín Phß╗æ Cß╗ò Hß╗Öi An',
      rating: 4.97,
      price: '320.000 Γé½',
      unit: '/ chuyß║┐n',
      meta: 'Bao gß╗ôm ph├¡ cß║ºu ─æ╞░ß╗¥ng & chß╗¥',
      location: '─É├á Nß║╡ng - Hß╗Öi An',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX1N3f-pvzvDYsBDNERiwEh7h89QIc_OffUr0ucrldukmz_beDvFaEgzAV5JoLdfwYJN0TCD_RlPSbqH4o8saymA7leJ0sg1s1ZpyirazSItZBQfJMcdJdrIa0Mj7K_cMfZxxLvBmnWZMKWtp0awgntGg1KeN_RiEH9IErrGTi8ZlbpnG6a0a5QaxKJa5mnzuaAfGuE7O5PJQuS0_E4oH7EvPij2eMlllXiM9oBTnwdrZMAwuXF0RfIw',
    },
    {
      id: 'transport-4',
      tag: 'Limousine 11 Chß╗ù',
      title: 'Tuyß║┐n H├á Nß╗Öi Γåö Tr├áng An - Tam Cß╗æc Ninh B├¼nh',
      rating: 4.88,
      price: '180.000 Γé½',
      unit: '/ v├⌐',
      meta: 'Khß╗ƒi h├ánh li├¬n tß╗Ñc mß╗ùi 60 ph├║t',
      location: 'H├á Nß╗Öi - Ninh B├¼nh',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
  ],
  activity: [
    {
      id: 'act-1',
      tag: 'Show Thß╗▒c Cß║únh Lß╗¢n Nhß║Ñt',
      title: 'V├⌐ Xem ─Éß║íi Show Thß╗▒c Cß║únh "K├╜ ß╗¿c Hß╗Öi An"',
      rating: 4.97,
      price: '600.000 Γé½',
      unit: '/ v├⌐',
      meta: 'V├áo cß╗òng trß╗▒c tiß║┐p bß║▒ng QR Code',
      location: 'Hß╗Öi An, Quß║úng Nam',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX1N3f-pvzvDYsBDNERiwEh7h89QIc_OffUr0ucrldukmz_beDvFaEgzAV5JoLdfwYJN0TCD_RlPSbqH4o8saymA7leJ0sg1s1ZpyirazSItZBQfJMcdJdrIa0Mj7K_cMfZxxLvBmnWZMKWtp0awgntGg1KeN_RiEH9IErrGTi8ZlbpnG6a0a5QaxKJa5mnzuaAfGuE7O5PJQuS0_E4oH7EvPij2eMlllXiM9oBTnwdrZMAwuXF0RfIw',
    },
    {
      id: 'act-2',
      tag: 'Kß╗╖ Lß╗Ñc Guinness',
      title: 'V├⌐ C├íp Treo Fansipan Sun World Legend Khß╗⌐ Hß╗ôi',
      rating: 4.92,
      price: '850.000 Γé½',
      unit: '/ v├⌐',
      meta: 'Chinh phß╗Ñc n├│c nh├á ─É├┤ng D╞░╞íng',
      location: 'Sapa, L├áo Cai',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
    {
      id: 'act-3',
      tag: 'Trß║úi Nghiß╗çm Sinh Th├íi',
      title: 'V├⌐ Ch├¿o Thuyß╗ün Th├║ng Rß╗½ng Dß╗½a Bß║úy Mß║½u Cß║⌐m Thanh',
      rating: 4.88,
      price: '150.000 Γé½',
      unit: '/ v├⌐',
      meta: 'M├║a th├║ng & gi─âng l╞░ß╗¢i bß║»t c├í',
      location: 'Hß╗Öi An, Quß║úng Nam',
      image: 'https://lh3.googleusercontent.com/aida/AEtjO1VT-raw4Y7ggYsBWZPl-Nku0oxeiVqxgdI3-1EIOmFtTrp5cBOsWjxgarLKYM9JL2IuUa1Kyi-kIG0EFwTpZPtRQakqeJ0C_EGDdJ2WsQrI93jh2HDnAF_94dslOiqzv0v0IydU4ewcH3KOmXSyIBS2xN-X5RlFUEDt37fi1ppzD2LVBjxTXcEn65ezCNnEfOH0TFu-ZM6tKzSh6aJp6Az6WKA3HSETd5iCK9Tzj1CY6Bfv-MyXpgwaGdM',
    },
    {
      id: 'act-4',
      tag: 'V├⌐ Thuyß╗ün & Tham Quan',
      title: 'V├⌐ Thuyß╗ün Danh Thß║»ng Tr├áng An Tuyß║┐n 1, 2, 3',
      rating: 4.91,
      price: '250.000 Γé½',
      unit: '/ v├⌐',
      meta: 'Kh├ím ph├í hang ─æß╗Öng huyß╗ün thoß║íi',
      location: 'Hoa L╞░, Ninh B├¼nh',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnVWy_neifdgwOmSNs-YIyAsDXmiQW08ypGzk3B2ngxdkDpHBdanHNjRCUlOAMZlMpos15kGSDw3aeS_Y1tguW2ayn9eStYAi7Qc_dY-RyYcyj6_AyvX3MM3VKkJB1pRSrmCqQfI_KpaLq9lWPMk27DxTMKigHtZYcoiDNP1RLl3JS-4X_DsrxzO_W930Y8qSzbhyOxfSOq7TN82HuWGi8kQbZSUYCPCEJTsS9RKnkMFOcYiIS7GUU7g',
    },
  ],
};

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchTab, setSearchTab] = useState<SearchTab>('tour');
  const [categoryTab, setCategoryTab] = useState<SearchTab>('tour');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-play Hero Carousel every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
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
                      <span>Kh├ím ph├í ngay</span>
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
          <div className="absolute bottom-24 left-0 right-0 z-20 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
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
                aria-label="Slide tr╞░ß╗¢c"
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md flex items-center justify-center transition-colors border border-white/20"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)}
                aria-label="Slide tiß║┐p theo"
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
        <section className="relative z-30 max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 -mt-16 lg:-mt-20 mb-16">
          <div className="rounded-3xl bg-white/90 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(8,126,139,0.22),0_12px_30px_-10px_rgba(0,0,0,0.1)] border border-white/80 overflow-hidden">
            {/* Search Category Tabs */}
            <div className="flex border-b border-surface-container/60 bg-surface-container-low/50 overflow-x-auto justify-center">
              {[
                { key: 'tour', label: 'Tour du lß╗ïch', icon: 'tour' },
                { key: 'stay', label: 'Kh├ích sß║ín & L╞░u tr├║', icon: 'hotel' },
                { key: 'transport', label: 'V├⌐ xe & Di chuyß╗ân', icon: 'directions_car' },
                { key: 'activity', label: 'V├⌐ vui ch╞íi & Trß║úi nghiß╗çm', icon: 'attractions' },
              ].map((tab) => {
                const isActive = searchTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSearchTab(tab.key as SearchTab)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all whitespace-nowrap ${
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
            <div className="p-5 lg:p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4 items-center">
                {/* Field 1: Destination / Route */}
                <div className="md:col-span-4 bg-surface-container-low hover:bg-surface-container p-3 rounded-2xl transition-colors cursor-pointer group border border-surface-container/40">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">
                    {searchTab === 'tour' && '─Éiß╗âm ─æß║┐n mong muß╗æn'}
                    {searchTab === 'stay' && '─Éiß╗âm ─æß║┐n hoß║╖c kh├ích sß║ín'}
                    {searchTab === 'transport' && 'Tuyß║┐n ─æ╞░ß╗¥ng di chuyß╗ân'}
                    {searchTab === 'activity' && '─Éß╗ïa ─æiß╗âm / Hoß║ít ─æß╗Öng'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-container text-[20px]">
                      {searchTab === 'tour' && 'location_on'}
                      {searchTab === 'stay' && 'hotel'}
                      {searchTab === 'transport' && 'commute'}
                      {searchTab === 'activity' && 'confirmation_number'}
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        searchTab === 'tour'
                          ? 'Bß║ín muß╗æn ─æi ─æ├óu? (Hß║í Long, Ninh B├¼nh...)'
                          : searchTab === 'stay'
                          ? 'Th├ánh phß╗æ, khu nghß╗ë d╞░ß╗íng, kh├ích sß║ín...'
                          : searchTab === 'transport'
                          ? 'H├á Nß╗Öi Γåö Hß║í Long / Sapa / Ninh B├¼nh'
                          : 'V├⌐ tham quan, show diß╗àn, v─ân h├│a...'
                      }
                      className="w-full bg-transparent text-sm font-semibold text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                    />
                  </div>
                </div>

                {/* Field 2: Date Selector */}
                <div className="md:col-span-3 bg-surface-container-low hover:bg-surface-container p-3 rounded-2xl transition-colors cursor-pointer group border border-surface-container/40">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">
                    {searchTab === 'stay' ? 'Nhß║¡n ph├▓ng - Trß║ú ph├▓ng' : 'Ng├áy khß╗ƒi h├ánh'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-container text-[20px]">calendar_month</span>
                    <span className="text-sm font-semibold text-on-surface">Thß╗⌐ S├íu, 24/10/2025</span>
                  </div>
                </div>

                {/* Field 3: Guests / Tickets */}
                <div className="md:col-span-3 bg-surface-container-low hover:bg-surface-container p-3 rounded-2xl transition-colors cursor-pointer group border border-surface-container/40">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">
                    {searchTab === 'activity' ? 'Sß╗æ l╞░ß╗úng v├⌐' : searchTab === 'stay' ? 'Ph├▓ng & Kh├ích' : 'Sß╗æ kh├ích'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-container text-[20px]">group</span>
                    <span className="text-sm font-semibold text-on-surface truncate">
                      {searchTab === 'stay' ? '1 ph├▓ng, 2 ng╞░ß╗¥i lß╗¢n' : '2 ng╞░ß╗¥i lß╗¢n, 1 trß║╗ em'}
                    </span>
                  </div>
                </div>

                {/* Field 4: Search Button */}
                <div className="md:col-span-2">
                  <Link
                    href={`/explore?type=${searchTab}&q=${encodeURIComponent(searchQuery)}`}
                    className="w-full min-h-[54px] bg-[#087e8b] hover:bg-[#00636e] text-white text-sm font-bold rounded-2xl shadow-lg shadow-primary-container/25 hover:shadow-xl flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
                  >
                    <span className="material-symbols-outlined text-[20px]">search</span>
                    <span>T├¼m kiß║┐m</span>
                  </Link>
                </div>
              </div>

              {/* Bottom Quick Suggestions & Tripri AI banner */}
              <div className="mt-4 pt-4 border-t border-surface-container/80 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-on-surface-variant mr-1">Dß╗ïch vß╗Ñ phß╗ò biß║┐n:</span>
                  {[
                    'Du thuyß╗ün Hß║í Long',
                    'V├⌐ thuyß╗ün Tr├áng An',
                    'Show K├╜ ß╗¿c Hß╗Öi An',
                    'Xe Limousine ─æ╞░a ─æ├│n',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSearchQuery(tag)}
                      className="px-3 py-1 rounded-full bg-surface-container text-on-surface text-xs font-medium hover:bg-primary-container hover:text-white transition-colors shadow-sm"
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <div className="w-full md:w-auto">
                  <Link
                    href="/custom-trip"
                    className="flex items-center justify-between md:justify-start gap-3 bg-secondary-container/40 hover:bg-secondary-container/70 border border-secondary-container px-4 py-2 rounded-2xl transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary-container text-[20px]">auto_awesome</span>
                      <div className="text-left">
                        <div className="text-xs font-bold text-on-surface">Tß║ío chuyß║┐n ─æi ri├¬ng vß╗¢i Tripri AI</div>
                        <div className="text-[11px] text-on-surface-variant">Tß╗▒ do gh├⌐p Tour + Ph├▓ng + Xe ─æß╗ông bß╗Ö</div>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-primary-container text-[18px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. CATEGORY SWITCHER & CARDS SHOWCASE                                     */}
        {/* ========================================================================= */}
        <section className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 mb-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary-container block mb-1">
                Lß╗▒a chß╗ìn h├áng ─æß║ºu
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Trß║úi Nghiß╗çm &amp; ─Éiß╗âm ─Éß║┐n ─É╞░ß╗úc Tuyß╗ân Chß╗ìn
              </h2>
            </div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-container transition-colors"
            >
              <span>Xem tß║Ñt cß║ú sß║ún phß║⌐m</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>

          {/* 4 Category Filter Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { key: 'tour', label: 'Tour & Trß║úi nghiß╗çm', sub: '─É╞░ß╗úc kiß╗âm ─æß╗ïnh chß║Ñt l╞░ß╗úng', icon: 'tour' },
              { key: 'stay', label: 'Kh├ích sß║ín & L╞░u tr├║', sub: 'Resort & boutique chß╗ìn lß╗ìc', icon: 'hotel' },
              { key: 'transport', label: 'V├⌐ xe & Di chuyß╗ân', sub: 'Limousine & xe ─æ├│n tß║¡n n╞íi', icon: 'directions_car' },
              { key: 'activity', label: 'V├⌐ tham quan & Show', sub: 'V├⌐ ─æiß╗çn tß╗¡ v├áo cß╗òng nhanh', icon: 'attractions' },
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
                    aria-label="L╞░u mß╗Ñc y├¬u th├¡ch"
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
                      <span>ΓÇó {item.meta}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
                    <div>
                      <span className="text-[11px] text-on-surface-variant block">Gi├í tß╗½</span>
                      <span className="font-bold text-base text-primary-container">
                        {item.price}
                        {item.unit && <span className="text-xs font-normal text-slate-500">{item.unit}</span>}
                      </span>
                    </div>
                    <Link
                      href={`/explore/${item.id}`}
                      className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-primary-container hover:text-white text-primary text-xs font-bold transition-all shadow-sm"
                    >
                      Xem chi tiß║┐t
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. CUSTOM TOUR & TRIPRI AI SECTION                                        */}
        {/* ========================================================================= */}
        <section className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 mb-20">
          <div className="bg-surface-container-lowest rounded-3xl shadow-[0_20px_50px_-15px_rgba(8,126,139,0.18)] p-8 lg:p-12 relative overflow-hidden border-2 border-slate-200/80">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-secondary-fixed/30 blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              {/* Left Column: Intro */}
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-secondary-container text-teal-900 font-bold text-xs mb-4 shadow-sm border border-teal-200/80">
                  <span className="material-symbols-outlined text-[16px] text-primary-container">psychology</span>
                  <span>Trß╗ú l├╜ Tripri AI</span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
                  Tß║ío Chuyß║┐n ─Éi Ri├¬ng Theo Phong C├ích Cß╗ºa Bß║ín
                </h2>

                <p className="text-base sm:text-lg text-slate-700 font-medium mb-6 leading-relaxed">
                  C├í nh├ón h├│a lß╗ïch tr├¼nh theo sß╗ƒ th├¡ch c├╣ng chuy├¬n gia bß║ún ─æß╗ïa. Tß╗▒ do gh├⌐p tour, ─æiß╗âm ─æß║┐n, n╞íi l╞░u tr├║ v├á nhß╗ïp ─æi mong muß╗æn.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div className="flex items-start gap-3 bg-surface-container-low p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
                    <span className="material-symbols-outlined text-primary-container text-[24px] mt-0.5">tune</span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">T├╣y biß║┐n linh hoß║ít</h4>
                      <p className="text-xs text-slate-600">Chß╗º ─æß╗Öng ─æiß╗âm ─æß║┐n, l╞░u tr├║ &amp; nhß╗ïp ─æi ri├¬ng.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-surface-container-low p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
                    <span className="material-symbols-outlined text-primary-container text-[24px] mt-0.5">badge</span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Chuy├¬n gia bß║ún ─æß╗ïa</h4>
                      <p className="text-xs text-slate-600">─Éß╗ông h├ánh am hiß╗âu s├óu sß║»c v─ân h├│a &amp; ß║⌐m thß╗▒c ─æß╗ïa ph╞░╞íng.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    href="/custom-trip"
                    className="inline-flex items-center gap-2 bg-primary-container hover:bg-primary text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-primary-container/25 transition-all transform hover:-translate-y-0.5"
                  >
                    <span>Tß║ío lß╗ïch tr├¼nh ngay</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </Link>
                  <Link
                    href="/support"
                    className="inline-flex items-center gap-2 text-slate-900 font-semibold text-sm px-5 py-3 rounded-2xl bg-white hover:bg-surface-container transition-colors border border-slate-200/80 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px] text-primary-container">support_agent</span>
                    <span>T╞░ vß║Ñn trß╗▒c tiß║┐p</span>
                  </Link>
                </div>
              </div>

              {/* Right Column: Local Guide Timeline Card */}
              <div className="lg:col-span-5">
                <div className="rounded-3xl bg-white shadow-xl border-2 border-slate-200 p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary-container text-white flex items-center justify-center text-base font-bold shadow-md">
                        HN
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-bold text-sm text-slate-900">Ho├áng Nam</h5>
                          <span className="material-symbols-outlined text-primary-container text-[18px]">verified</span>
                        </div>
                        <span className="text-xs text-slate-600 font-medium">Chuy├¬n gia bß║ún ─æß╗ïa ΓÇó Quß║úng Nam</span>
                      </div>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold border border-secondary-container/70 shadow-sm">
                      X├íc minh
                    </span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { step: '1', title: '─É├│n tß║íi s├ón bay ─É├á Nß║╡ng / kh├ích sß║ín', icon: 'check_circle' },
                      { step: '2', title: 'Ch├¿o SUP & Th─âm l├áng gß╗æm Thanh H├á', icon: 'edit' },
                      { step: '3', title: 'ß║¿m thß╗▒c phß╗æ Hß╗Öi & C├á ph├¬ ven s├┤ng Ho├ái', icon: 'edit' },
                    ].map((item) => (
                      <div
                        key={item.step}
                        className="bg-surface-container-low p-3.5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-3"
                      >
                        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {item.step}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 flex-1">{item.title}</span>
                        <span className="material-symbols-outlined text-primary-container text-[18px]">{item.icon}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 text-center">
                    <span className="text-xs text-slate-600 font-semibold flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-primary-container text-[16px]">lock_reset</span>
                      B├ío gi├í minh bß║ích, kh├┤ng ph├¡ ß║⌐n
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. TRUST & CORE VALUES                                                    */}
        {/* ========================================================================= */}
        <section className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 mb-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-container block mb-2">
              Gi├í trß╗ï cß╗æt l├╡i
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">
              An T├óm Trß╗ìn Vß║╣n Khi ─Éß║╖t Chß╗ù Tß║íi Tripri
            </h2>
            <p className="text-sm text-slate-600">
              Ch├║ng t├┤i ─æß╗ü cao t├¡nh ch├ón thß╗▒c, bß║úo vß╗ç quyß╗ün lß╗úi du kh├ích v├á x├óy dß╗▒ng ti├¬u chuß║⌐n trß║úi nghiß╗çm du lß╗ïch chuß║⌐n mß╗▒c tß║íi Viß╗çt Nam.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: 'verified_user',
                title: '─Éß╗æi t├íc kiß╗âm ─æß╗ïnh',
                desc: 'Mß╗ìi ─æ╞ín vß╗ï lß╗» h├ánh v├á h╞░ß╗¢ng dß║½n vi├¬n c├í nh├ón ─æß╗üu ─æ╞░ß╗úc ─æß╗æi chiß║┐u giß║Ñy ph├⌐p h├ánh nghß╗ü tr╞░ß╗¢c khi mß╗ƒ b├ín tour.',
              },
              {
                icon: 'payments',
                title: 'Minh bß║ích chi ph├¡',
                desc: 'Gi├í ni├¬m yß║┐t r├╡ r├áng theo VN─É, liß╗çt k├¬ chi tiß║┐t c├íc khoß║ún ─æ├ú bao gß╗ôm v├á ch╞░a bao gß╗ôm, kh├┤ng ph├¡ ß║⌐n.',
              },
              {
                icon: 'published_with_changes',
                title: 'Ch├¡nh s├ích hß╗ºy linh hoß║ít',
                desc: 'Quy tr├¼nh ho├án tiß╗ün r├╡ r├áng tu├ón thß╗º theo mß╗æc thß╗¥i gian quy ─æß╗ïnh sß║╡n, giß║úi quyß║┐t nhanh ch├│ng qua cß╗òng hß╗ù trß╗ú.',
              },
              {
                icon: 'support_agent',
                title: '─Éß╗ông h├ánh 24/7',
                desc: '─Éß╗Öi ng┼⌐ ch─âm s├│c kh├ích h├áng ─æß╗ïa ph╞░╞íng sß║╡n s├áng hß╗ù trß╗ú bß║ín tß╗½ khi l├¬n kß║┐ hoß║ích cho ─æß║┐n khi kß║┐t th├║c tour.',
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
                <h3 className="font-bold text-lg text-on-surface">Bß║ín l├á h╞░ß╗¢ng dß║½n vi├¬n hay c├┤ng ty lß╗» h├ánh?</h3>
                <p className="text-sm text-on-surface-variant">
                  Gia nhß║¡p mß║íng l╞░ß╗¢i Tripri ─æß╗â tiß║┐p cß║¡n du kh├ích trong v├á ngo├ái n╞░ß╗¢c c├│ nhu cß║ºu kh├ím ph├í trß║úi nghiß╗çm ch├ón thß╗▒c.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Link
                href="/agency"
                className="inline-flex items-center gap-2 bg-on-surface text-white hover:bg-primary font-bold text-sm px-6 py-3 rounded-2xl transition-all shadow-md transform hover:-translate-y-0.5"
              >
                <span>Truy cß║¡p Cß╗òng ─æß╗æi t├íc</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
