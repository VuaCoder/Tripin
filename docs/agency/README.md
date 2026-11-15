# Tài liệu chức năng — Cổng đối tác Agency

| Tệp | Nội dung |
|---|---|
| [`AGENCY-FUNCTIONS.docx`](./AGENCY-FUNCTIONS.docx) | 16 nhóm chức năng (`3.2`–`3.17`), 41 chức năng (không gồm đăng nhập Agency), 41 ảnh nhúng; nội dung tiếng Anh, nhãn UI tiếng Việt đặt trong ngoặc kép; format theo tài liệu Super Admin: heading Calibri xanh, thân bài đen, bullet `•`, ảnh full-width, mỗi chức năng một trang (41 trang). |
| [`AGENCY-FUNCTIONS.pdf`](./AGENCY-FUNCTIONS.pdf) | Bản xem nhanh cùng nội dung, 41 trang. |
| [`build_agency_doc.py`](./build_agency_doc.py) | Script sinh lại DOCX từ nội dung trong script và ảnh tại `docs/testing/agency-roles/screenshots/` |
| [`AGENCY-SEQUENCE.md`](./AGENCY-SEQUENCE.md) | 41 sequence diagram (mục `3.2.1`–`3.17.4`), nội dung tiếng Anh, ở dạng đọc nhanh, render được trên GitHub/IDE. |
| [`sequence/`](./sequence/) | Nguồn Mermaid thuần: mỗi chức năng một tệp `.mmd`, không code fence, dán trực tiếp vào draw.io. |
| `sequence/png/` | Bản PNG xuất từ `sequence/` (nền trắng, rộng 2400px, đen–trắng) để chèn vào tài liệu/báo cáo. |
| [`build_sequence_doc.py`](./build_sequence_doc.py) | Sinh lại `AGENCY-SEQUENCE.md` từ `sequence/`; kiểm tra đánh số mũi tên, cân bằng khối `alt`/`opt`/`loop` và luồng `activate`/`deactivate`. Kiểm tra riêng vài tệp: `python3 docs/agency/build_sequence_doc.py --check 3.4.2-tao-tour.mmd`. |
| [`AGENCY-CLASS.mmd`](./AGENCY-CLASS.mmd) | Class diagram (Monolith) cho module `agencies`: controller → service → repository → model/DTO, kèm quan hệ và multiplicity. Bắt đầu bằng `classDiagram`, dán trực tiếp vào draw.io. |
| [`classes/`](./classes/) | 41 class diagram, mỗi chức năng một tệp `.mmd` trùng tên với tệp trong `sequence/`. |
| `classes/png/` | Bản PNG xuất từ `classes/` (nền trắng, bề ngang tự nhiên, không co chữ) để chèn vào tài liệu/báo cáo. |
| [`check_class_diagrams.py`](./check_class_diagrams.py) | Kiểm tra `classes/`: mở đầu `classDiagram`, không code fence, không `;`, quan hệ hợp lệ, và đủ tệp so với `sequence/`. |

## Sinh lại tài liệu

Yêu cầu: LibreOffice (có `soffice`) và Python UNO.

```bash
soffice --headless --accept='socket,host=127.0.0.1,port=2002;urp;StarOffice.ServiceManager' &
python3 docs/agency/build_agency_doc.py
```

Sequence diagram chỉ cần Python 3 (không phụ thuộc thư viện):

```bash
python3 docs/agency/build_sequence_doc.py
```

Class diagram cũng chỉ cần Python 3 để kiểm tra:

```bash
python3 docs/agency/check_class_diagrams.py
```

Cách dùng với draw.io: mở draw.io → **Arrange → Insert → Advanced → Mermaid**, dán nguyên nội dung tệp `.mmd`
(bắt đầu bằng `%%{init:` và `sequenceDiagram`, hoặc `classDiagram` với tệp trong `classes/`).
Tệp không chứa code fence nên không cần xoá dòng nào.

Xuất PNG (cần Node + Chromium; dùng `PUPPETEER_EXECUTABLE_PATH` nếu không muốn tải Chrome của Puppeteer):

```bash
npx -y @mermaid-js/mermaid-cli@11.4.2 \
  -i docs/agency/sequence/3.4.2-tao-tour.mmd \
  -o docs/agency/sequence/png/3.4.2-tao-tour.png -w 2400
```

Xuất cả 41 tệp: lặp lệnh trên cho mọi `docs/agency/sequence/*.mmd` (cùng tên đầu ra trong `sequence/png/`).

Class diagram rộng hơn nên xuất ở `-w 4800` để Mermaid không thu nhỏ chữ:

```bash
npx -y @mermaid-js/mermaid-cli@11.4.2 \
  -i docs/agency/classes/3.4.2-tao-tour.mmd \
  -o docs/agency/classes/png/3.4.2-tao-tour.png -b white -w 4800
```

Nội dung tham chiếu:

- [`docs/testing/agency-roles/FEATURES.md`](../testing/agency-roles/FEATURES.md)
- [`docs/testing/agency-roles/REPORT.md`](../testing/agency-roles/REPORT.md) §11
- Ảnh: [`docs/testing/agency-roles/screenshots/`](../testing/agency-roles/screenshots/); ảnh chụp mới cho tài liệu nằm trong [`doc/`](../testing/agency-roles/screenshots/doc/).
