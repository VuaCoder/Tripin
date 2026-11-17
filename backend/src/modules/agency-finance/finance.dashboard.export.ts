import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { dashboard } from './finance.dashboard';
import { excelAmount } from './finance.export';
export async function exportDashboardReport(data:Awaited<ReturnType<typeof dashboard>>,format:'xlsx'|'pdf'){
  const rows:[string,bigint][]=[['Khách thực thu',data.gmv],['Hoa hồng tạm tính',data.commission],['Hoa hồng đã ghi nhận',data.earnedCommission],['Đã giải phóng vào số dư',data.released],['Đã chuyển ngân hàng',data.paid],['Chờ quyết toán',data.balances.pending],['Có thể rút',data.balances.available],['Đang rút',data.balances.reserved],['Tạm giữ',data.balances.frozen]];
  const interval=`${new Date(data.start.getTime()+25200000).toISOString().slice(0,10)} – ${new Date(data.end.getTime()-1+25200000).toISOString().slice(0,10)}`;
  if(format==='xlsx'){
    const wb=new ExcelJS.Workbook();wb.creator='Tripri';wb.created=data.asOf;
    const summary=wb.addWorksheet('Tổng quan');summary.columns=[{header:'Chỉ số',width:40},{header:'Giá trị',width:30}];
    summary.addRows([['Kỳ (UTC+7)',interval],['Nguồn',data.origin],['Thời điểm dữ liệu',data.asOf.toISOString()],...rows.map(([name,value])=>[name,excelAmount(value)])]);
    const days=wb.addWorksheet('Theo ngày');days.columns=[{header:'Ngày',width:20},{header:'Thực thu',width:26},{header:'Đã chuyển',width:26},{header:'Hoa hồng tạm tính',width:28}];
    for(const r of data.cashflow)days.addRow([r.date,excelAmount(r.receipts),excelAmount(r.paid),excelAmount(r.commission)]);
    for(const sheet of wb.worksheets){sheet.views=[{state:'frozen',ySplit:1}];sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0F766E'}};}
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  const font=createRequire(path.join(process.cwd(),'package.json')).resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
  const pdf=new PDFDocument({size:'A4',margin:40}),chunks:Buffer[]=[];
  const result=new Promise<Buffer>((resolve,reject)=>{pdf.on('data',(b:Buffer)=>chunks.push(b));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);});
  pdf.font(font);const header=()=>{pdf.fillColor('#0f766e').fontSize(17).text('TRIPRI · KẾ TOÁN TOÀN SÀN');pdf.fillColor('#142e35').fontSize(10).text(`${interval} · ${data.origin} · VND`).moveDown();};header();
  for(const [name,value]of rows)pdf.text(`${name}: ${value.toLocaleString('vi-VN')} đ`).moveDown(.4);
  pdf.moveDown().text('Số liệu theo ngày');for(const row of data.cashflow){if(pdf.y>720){pdf.addPage();header();}pdf.fontSize(9).text(`${row.date}: thu ${row.receipts.toLocaleString('vi-VN')} · chuyển ${row.paid.toLocaleString('vi-VN')} · phí ${row.commission.toLocaleString('vi-VN')}`);}
  pdf.end();return result;
}
