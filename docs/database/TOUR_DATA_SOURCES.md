# Demo tour data and photos

`pnpm --filter backend seed:demo-tours` writes illustrative development data to the configured PostgreSQL database. Tour names, places and daily routes describe real destinations; the prices, future departures, capacities and demo agencies are test fixtures, **not live offers**. The script also writes four route-specific mock reviews per demo tour. Review authors and any review photos are fixtures; the photos show the stated destination and are not presented as evidence that a real traveler took them. Rating count and average are recalculated from visible `Review` rows, so the number shown on a tour matches its displayed review list. Verify commercial terms with an operator before publishing a real booking offer. The script refuses to run with `NODE_ENV=production`.

The destinations and route ideas were checked against Vietravel's public [domestic tours](https://travel.com.vn/du-lich-viet-nam.aspx), [Phú Quốc tours](https://travel.com.vn/du-lich-phu-quoc.aspx) and [Hội An tours](https://travel.com.vn/du-lich-pho-co-hoi-an). The text in the fixture is original and only describes places and sample activities; it does not reproduce an operator's package.

The additional routes were checked against public Vietravel programs for [Hà Nội – Hạ Long – Ninh Bình](https://travel.com.vn/chuong-trinh/ha-noi-vinh-ha-long-ninh-binh-bai-dinh-trang-an-mung-3-tet-pid-10564), [Huế – Đà Nẵng – Hội An](https://travel.com.vn/chuong-trinh/hue-da-nang-ba-na-hills-hoi-an-hue-bay-cung-vietnam-airlines-skm-hoi-cho-vitm-2026-pid-9504), [Quy Nhơn – Phú Yên](https://travel.com.vn/chuong-trinh/quy-nhon-phu-yen-ky-co-eo-gio-ganh-da-dia-thap-nghinh-phong-trai-nghiem-tinh-hoa-am-thuc-xu-nau-mung-6-tet-pid-10716?fromDate=2026-10-12), [Nha Trang – Đà Lạt](https://travel.com.vn/chuong-trinh/hanh-trinh-hoa-va-bien-da-lat-nha-trang-pid-3464) and [Tây Ninh](https://travel.com.vn/chuong-trinh/rach-gia-tay-ninh-hanh-trinh-chinh-phuc-noc-nha-nam-bo-tang-ve-tham-quan-tuyen-cap-treo-van-son-1-dem-khach-san-pid-13837?fromDate=2026-10-27). These sources validate destinations and route ideas, not the sample prices or services.

The 28 distinct demo tour and review photos are downloaded from Unsplash under the [Unsplash License](https://unsplash.com/license) and kept in `frontend/public/images/tours`. Some multi-destination routes reuse a relevant destination photo. The web catalog, galleries and review photos resolve these demo image URLs to local files, while mobile uses the verified Unsplash URLs. The local filenames retain the Unsplash photo ID for traceability.

| Tour destination | Photo page |
| --- | --- |
| Hạ Long | https://unsplash.com/photos/a-group-of-boats-floating-on-top-of-a-large-body-of-water-QDc91G5Yc2w |
| Sa Pa | https://unsplash.com/s/photos/vietnam-sapa |
| Hội An | https://unsplash.com/photos/lighted-lantern-hanging-over-street-IeCSFQLc-Fs |
| TP. Hồ Chí Minh | https://unsplash.com/photos/street-food-stall-with-many-dishes-and-varied-dishes-puqIBmyZPGA |
| Phong Nha | https://unsplash.com/photos/brown-rock-cave-ezseyJBWR4I |
| Trà Sư | https://unsplash.com/photos/green-trees-on-body-of-water-during-daytime-QttaHHgHz_w |
| Nha Trang | https://unsplash.com/photos/a-view-of-a-beach-with-a-city-in-the-background-ZklRFJUVj8Y |
| Tà Năng (representative Central Highlands landscape) | https://unsplash.com/photos/a-grassy-field-with-trees-and-mountains-in-the-background-Fl3bY0hWXv4 |
| Huế | https://unsplash.com/photos/imperial-citadel-in-hue-vietnam-under-a-clear-sky-lzjlYsMGYXg |
| Hà Nội | https://unsplash.com/photos/an-old-building-with-lots-of-wires-and-wires-hanging-from-it-yD6J3ETko_Y |
| Hà Giang | https://unsplash.com/photos/a-tranquil-turquoise-lake-surrounded-by-lush-green-mountains-wMcy1wu3Ovk |
| Côn Đảo | https://unsplash.com/photos/fishing-boats-docked-in-a-calm-bay-with-green-hills-gIdSphg0H8k |
| Mộc Châu | https://unsplash.com/photos/two-people-harvesting-tea-on-a-hillside-GDp6L255rXY |
| Phú Quốc | https://unsplash.com/photos/a-beach-with-palm-trees-and-a-boat-in-the-water-IVJVh1v1PVs |
| Cần Thơ | https://unsplash.com/photos/a-group-of-people-on-a-boat-in-the-water-nd9jQ8FXMPM |
| Ninh Bình | https://unsplash.com/photos/pagoda-surrounded-by-body-of-water-and-mountains-PgSxHidgJHQ |
| Đà Lạt | https://unsplash.com/photos/misty-valley-with-mountains-and-pine-trees-egdrGoF8r0I |
| Kỳ Co, Quy Nhơn | https://unsplash.com/photos/a-beach-with-a-hill-and-a-body-of-water-AmBpgKYcswM |
| Núi Bà Đen, Tây Ninh | https://unsplash.com/photos/statue-emerges-from-clouds-at-sunrise-texDHJKkk5g |
| Vịnh Hạ Long, ảnh phụ | https://unsplash.com/photos/boats-on-turquoise-ha-long-bay-kG7pOXbBfNs |
| Cầu Vàng, Bà Nà Hills | https://unsplash.com/photos/a-bridge-over-a-river-WRvasYD88eM |
| Tràng An, Ninh Bình | https://unsplash.com/photos/a-group-of-people-in-small-boats-on-a-river-C2xFKlOR0PE |
| Ruộng bậc thang Sa Pa | https://unsplash.com/photos/a-landscape-with-trees-and-a-house-EXJPTXw48F4 |
| Động Phong Nha, ảnh phụ | https://unsplash.com/photos/a-group-of-people-standing-in-a-cave-WKlYXG3A93g |
| Sông Nho Quế, Hà Giang | https://unsplash.com/photos/a-boat-traveling-down-a-river-surrounded-by-mountains-7Sj9X8NqNAk |
| Đại Nội Huế, ảnh phụ | https://unsplash.com/photos/ancient-vietnamese-imperial-citadel-under-a-clear-blue-sky-rijCHTYRxuo |
| Chợ nổi Cần Thơ, ảnh phụ | https://unsplash.com/photos/a-boat-vendor-sells-mangoes-at-a-floating-market-oDE9F0hJ8FA |
| Tháp Rùa, hồ Hoàn Kiếm | https://unsplash.com/photos/a-small-building-sitting-in-the-middle-of-a-lake-z7XJZtoMlyk |

Before adding another demo tour, verify its photo URL returns `200` and `image/jpeg`, add a local copy to `frontend/public/images/tours`, and register its photo ID in `frontend/features/tours/utils/demoTourImage.ts`.
