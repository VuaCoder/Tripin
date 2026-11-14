# Tài liệu chức năng — Cổng đối tác Agency

| Tệp | Nội dung |
|---|---|
| [`AGENCY-FUNCTIONS.docx`](./AGENCY-FUNCTIONS.docx) | Tài liệu chức năng đầy đủ: 17 nhóm, 23 màn hình, 27 ảnh chụp, ma trận quyền và trạng thái |
| [`AGENCY-FUNCTIONS.pdf`](./AGENCY-FUNCTIONS.pdf) | Bản PDF để xem nhanh (43 trang) |
| [`build_agency_doc.py`](./build_agency_doc.py) | Script sinh lại DOCX từ nội dung trong script và ảnh tại `docs/testing/agency-roles/screenshots/` |

## Sinh lại tài liệu

Yêu cầu: LibreOffice (có `soffice`) và Python UNO.

```bash
soffice --headless --accept='socket,host=127.0.0.1,port=2002;urp;StarOffice.ServiceManager' &
python3 docs/agency/build_agency_doc.py
```

Nội dung tham chiếu:

- [`docs/testing/agency-roles/FEATURES.md`](../testing/agency-roles/FEATURES.md)
- [`docs/testing/agency-roles/REPORT.md`](../testing/agency-roles/REPORT.md) §11
- Ảnh: [`docs/testing/agency-roles/screenshots/`](../testing/agency-roles/screenshots/)
