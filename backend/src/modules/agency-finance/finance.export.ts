import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createRequire } from 'node:module';
import path from 'node:path';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/app-error';

const fmt=(v:bigint)=>new Intl.NumberFormat('vi-VN').format(v)+' đ';
export function excelAmount(value:bigint):number|string { return value.toString().replace('-','').length<=15?Number(value):value.toString(); }
export async function exportFinance(agencyId:string,start:Date,end:Date,format:'xlsx'|'pdf') {
  const snapshot=await prisma.$transaction(async tx=>{
    const agency=await tx.agencyProfile.findUniqueOrThrow({where:{id:agencyId},select:{companyName:true}});
    const where={agencyId,effectiveAt:{gte:start,lt:end}};
    const count=await tx.agencyTransaction.count({where});
    if(count>10000)throw AppError.badRequest('Báo cáo vượt 10.000 giao dịch. Hãy chọn khoảng ngày ngắn hơn.');
    const rows=await tx.agencyTransaction.findMany({where,orderBy:[{effectiveAt:'asc'},{id:'asc'}],include:{entries:true}});
    return {agency,rows,asOf:new Date()};
  },{isolationLevel:'RepeatableRead'});
  const rows=snapshot.rows;
  const amounts=rows.map(r=>r.amount),total=amounts.reduce((s,v)=>s+v,0n);
  const exact=amounts.every(v=>typeof excelAmount(v)==='number')&&typeof excelAmount(total)==='number';
  const from=new Date(start.getTime()+25200000).toISOString().slice(0,10),to=new Date(end.getTime()-1+25200000).toISOString().slice(0,10);
  if(format==='xlsx'){
    const wb=new ExcelJS.Workbook();wb.creator='Tripri';wb.created=snapshot.asOf;
    const summary=wb.addWorksheet('Tổng hợp');summary.columns=[{width:36},{width:70}];
    summary.addRows([['Agency',snapshot.agency.companyName],['Từ ngày (UTC+7)',from],['Đến ngày (UTC+7)',to],['Đơn vị','VND'],['Thời điểm xuất',snapshot.asOf.toISOString()],['Số chứng từ',rows.length],['Tổng giá trị chứng từ',exact?Number(total):total.toString()],['Lưu ý','Tổng giá trị chứng từ không phải doanh thu; xem phân loại và các vế ghi sổ.'],['Chế độ số',exact?'Số nguyên chính xác, có SUM':'Dạng text chính xác; tổng tính bằng BigInt, không dùng SUM.']]);
    const sheet=wb.addWorksheet('Giao dịch');sheet.columns=[{header:'Ngày (UTC+7)',key:'date',width:22},{header:'Mã booking',key:'booking',width:24},{header:'Loại',key:'type',width:18},{header:'Số tiền (VND)',key:'amount',width:24},{header:'Nội dung',key:'description',width:55},{header:'Mã chứng từ',key:'id',width:40}];
    for(const r of rows)sheet.addRow({date:new Date(r.effectiveAt.getTime()+25200000).toISOString().replace('T',' ').slice(0,19),booking:r.bookingCode??'',type:r.type,amount:exact?Number(r.amount):r.amount.toString(),description:r.description,id:r.id});
    if(rows.length){const last=sheet.addRow({type:'Tổng',amount:exact?{formula:`SUM(D2:D${rows.length+1})`,result:Number(total)}:total.toString()});last.font={bold:true};}
    const ledger=wb.addWorksheet('Các vế ghi sổ');ledger.columns=[{header:'Mã chứng từ',width:40},{header:'Tài khoản',width:28},{header:'Nợ (VND)',width:24},{header:'Có (VND)',width:24}];
    for(const r of rows)for(const e of r.entries)ledger.addRow([r.id,e.account,excelAmount(e.debit),excelAmount(e.credit)]);
    for(const s of wb.worksheets){s.views=[{state:'frozen',ySplit:1}];s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0F766E'}};s.getRow(1).height=26;}
    sheet.getColumn(4).numFmt='#,##0';ledger.getColumn(3).numFmt='#,##0';ledger.getColumn(4).numFmt='#,##0';
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  const resolve=createRequire(path.join(process.cwd(),'package.json'));
  const font=resolve.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
  const pdf=new PDFDocument({size:'A4',margin:40,bufferPages:true});const chunks:Buffer[]=[];
  const result=new Promise<Buffer>((resolve,reject)=>{pdf.on('data',(v:Buffer)=>chunks.push(v));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);});
  pdf.font(font);
  const title=()=>{pdf.fontSize(18).fillColor('#0f766e').text('TRIPRI · BÁO CÁO TÀI CHÍNH');pdf.fontSize(11).fillColor('#0f172a').text(snapshot.agency.companyName).text(`${from} – ${to} · VND · UTC+7`).moveDown();};title();
  pdf.fontSize(10).text(`${rows.length} chứng từ · Tổng giá trị chứng từ: ${fmt(total)}`).text('Bảng kê nghiệp vụ, không phải hóa đơn thuế.').moveDown();
  for(const row of rows){if(pdf.y>700){pdf.addPage();title();}pdf.fontSize(10).text(`${row.bookingCode??'Quyết toán'} · ${row.type} · ${fmt(row.amount)}`).fontSize(9).fillColor('#475569').text(row.description).fillColor('#0f172a').moveDown(0.6);}
  if(pdf.y>620){pdf.addPage();title();}pdf.moveDown(2).fontSize(10).text('Người lập báo cáo                                      Đại diện đơn vị').text('(Ký, ghi rõ họ tên)                                     (Ký, ghi rõ họ tên)');
  pdf.end();return result;
}
