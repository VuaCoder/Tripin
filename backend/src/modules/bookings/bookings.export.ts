import { createRequire } from 'node:module';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { logger } from '../../utils/logger';
import type { CustomerRow } from './bookings.types';

/** DejaVu Sans covers Vietnamese diacritics; PDFKit's built-in Helvetica does not. */
function resolveFont(file: string): string | undefined {
  const bases = [process.cwd()];
  for (const base of bases) {
    try {
      return createRequire(path.join(base, 'package.json')).resolve(`dejavu-fonts-ttf/ttf/${file}`);
    } catch {
      // try next base
    }
  }
  logger.warn(`Unicode font ${file} not found: the PDF falls back to Helvetica (Vietnamese letters may be wrong)`);
  return undefined;
}

const fmtDate = (date: Date) => date.toISOString().slice(0, 10);

export interface CustomersPdfInput {
  tourTitle: string;
  generatedAt: Date;
  rows: CustomerRow[];
  /** True when more bookings exist than were printed. */
  truncated: boolean;
}

/** Builds the customer list of a tour as a PDF stream (A4 landscape). The caller pipes it to the response. */
export function renderCustomersPdf(input: CustomersPdfInput): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: `Customers - ${input.tourTitle}` } });
  const regular = resolveFont('DejaVuSans.ttf');
  const bold = resolveFont('DejaVuSans-Bold.ttf');
  const useRegular = () => doc.font(regular ?? 'Helvetica');
  const useBold = () => doc.font(bold ?? 'Helvetica-Bold');

  const columns = [
    { title: '#', width: 28 },
    { title: 'Booking', width: 92 },
    { title: 'Departure', width: 70 },
    { title: 'Traveler', width: 170 },
    { title: 'Phone', width: 100 },
    { title: 'Pax', width: 30 },
    { title: 'Notes', width: 306 },
  ];
  const left = doc.page.margins.left;
  const bottom = () => doc.page.height - doc.page.margins.bottom - 20;

  const header = () => {
    useBold().fontSize(16).text('Customer list', left, doc.y);
    useRegular().fontSize(10);
    doc.text(`Tour: ${input.tourTitle}`);
    doc.text(`Generated: ${input.generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC   |   Customers: ${input.rows.length}${input.truncated ? ' (list truncated)' : ''}`);
    doc.moveDown(0.6);
  };
  const tableHead = () => {
    const y = doc.y;
    useBold().fontSize(9);
    let x = left;
    for (const column of columns) {
      doc.text(column.title, x, y, { width: column.width });
      x += column.width;
    }
    doc.moveTo(left, y + 13).lineTo(x, y + 13).stroke();
    doc.y = y + 17;
    useRegular().fontSize(9);
  };

  header();
  tableHead();
  input.rows.forEach((row, index) => {
    const cells = [String(index + 1), row.bookingCode, fmtDate(row.departureDate), row.travelerName, row.phone, String(row.participants), row.notes ?? ''];
    const height = Math.max(...cells.map((text, i) => doc.heightOfString(text, { width: columns[i]!.width })));
    if (doc.y + height > bottom()) {
      doc.addPage();
      tableHead();
    }
    const y = doc.y;
    let x = left;
    cells.forEach((text, i) => {
      doc.text(text, x, y, { width: columns[i]!.width });
      x += columns[i]!.width;
    });
    doc.y = y + height + 4;
  });
  if (input.rows.length === 0) doc.text('No confirmed bookings yet.', left, doc.y);
  return doc;
}
