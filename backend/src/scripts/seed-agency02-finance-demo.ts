/** Explicit, idempotent TEST fixture. Never contacts a payment gateway or bank. */
import bcrypt from 'bcryptjs';
import { prisma, disconnectDatabase } from '../config/database';
import { env } from '../config/env';
import { auditFinance, lockAgency, post } from '../modules/agency-finance/finance.service';
import { evaluateSettlement, walletBalances } from '../modules/agency-finance/finance.wallet';
import { completionService } from '../modules/tour-completion/completion.service';

const EMAIL='agency02@tripri.test', PREFIX='TRP-A02-SETTLE-', TITLE='Agency02 — Đà Nẵng 2 ngày 1 đêm';
async function main() {
  if(process.argv[2]!=='--apply-agency02-demo'||env.NODE_ENV==='production')throw new Error('Development only; explicit --apply-agency02-demo required.');
  const password=process.env.DEV_AGENCY02_PASSWORD;
  if(!password||password.length<10)throw new Error('DEV_AGENCY02_PASSWORD must have at least 10 characters.');
  const hash=await bcrypt.hash(password,10),now=new Date(),day=(n:number)=>new Date(now.getTime()+n*86400000);
  const travelers=await prisma.user.findMany({where:{role:'TRAVELER',email:{in:['traveler01@tripri.test','traveler02@tripri.test','traveler03@tripri.test']}},orderBy:{email:'asc'}});
  if(travelers.length!==3)throw new Error('Expected three existing test travelers.');
  const existing=await prisma.user.findUnique({where:{email:EMAIL},include:{agencyProfile:true}});
  if(existing&&(!existing.agencyProfile?.companyName?.startsWith('Agency02 — Test quyết toán')||existing.role!=='AGENCY'))throw new Error('Existing account is not this fixture; refusing changes.');
  const result=await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('agency02-finance-fixture'))`;
    const owner=existing??await tx.user.create({data:{email:EMAIL,fullName:'Agency02',passwordHash:hash,role:'AGENCY',status:'ACTIVE',emailVerifiedAt:now}});
    const agency=await tx.agencyProfile.findUnique({where:{userId:owner.id}})??await tx.agencyProfile.create({data:{id:owner.id,userId:owner.id,companyName:'Agency02 — Test quyết toán',address:'Đà Nẵng',verificationStatus:'VERIFIED',verifiedAt:now}});
    await lockAgency(tx,agency.id);
    const prior=await tx.booking.findMany({where:{bookingCode:{startsWith:PREFIX}},orderBy:{bookingCode:'asc'}});
    if(prior.length){if(prior.length!==3||prior.some(b=>b.agencyId!==agency.id))throw new Error('Incomplete or conflicting fixture; refusing changes.');return {agencyId:agency.id,tourId:prior[0]!.tourId,departureId:prior[0]!.departureId,bookings:prior};}
    const imageSource=await tx.tour.findFirst({where:{images:{isEmpty:false}},select:{images:true}});
    const tour=await tx.tour.create({data:{agencyId:agency.id,title:TITLE,summary:'Chuyến đi kiểm thử luồng hoàn tất và quyết toán.',destination:'Đà Nẵng',durationDays:2,basePrice:1000000n,maxGroupSize:10,status:'APPROVED',visibility:'PRIVATE',images:imageSource?.images??[]}});
    const departure=await tx.tourDeparture.create({data:{tourId:tour.id,date:day(-3),capacity:10,remaining:2,isOpen:false}});
    const bookings=[];
    for(let i=0;i<3;i++){
      const traveler=travelers[i]!,participants=[4,2,2][i]!,amount=BigInt(participants)*1000000n,commission=amount/10n,paidAt=day(-5);
      const b=await tx.booking.create({data:{bookingCode:`${PREFIX}${String(i+1).padStart(3,'0')}`,travelerId:traveler.id,agencyId:agency.id,tourId:tour.id,departureId:departure.id,tourTitle:TITLE,departureDate:departure.date,endDate:day(-1),participants,contactName:traveler.fullName,contactPhone:'0900000002',unitPrice:1000000n,subtotal:amount,totalAmount:amount,commissionBps:1000,commissionAmount:commission,agencyAmount:amount-commission,status:'CONFIRMED',isPaid:true,confirmedAt:paidAt,fulfillmentStatus:'COMPLETED',notes:'Agency02 finance sandbox fixture.'}});
      const payment=await tx.payment.create({data:{purpose:'BOOKING',referenceId:b.id,userId:traveler.id,amount,currency:'VND',provider:'TEST-FINANCE',providerOrderCode:BigInt(Date.now())*1000n+BigInt(i),status:'PAID',paidAt,fulfilledAt:now,expiresAt:now,description:'Agency02 sandbox receipt'}});
      await tx.agencyFinanceSource.create({data:{paymentId:payment.id,origin:'TEST'}});
      await tx.agencyFinanceReceipt.create({data:{paymentId:payment.id,agencyId:agency.id,bookingId:b.id,amount,actualAmount:amount,currency:'VND',paidAt,checkedAt:now,reconciliationStatus:'MATCHED',gatewayRef:`SANDBOX-A02-${i+1}`}});
      await post(tx,{agencyId:agency.id,bookingId:b.id,bookingCode:b.bookingCode,type:'PAYMENT',amount,eventKey:`booking-receipt:${b.id}`,actorId:owner.id,effectiveAt:paidAt,description:'Khách thanh toán chuyến đi Agency02'},[{account:'PLATFORM_CASH',debit:amount,credit:0n},{account:'AGENCY_PAYABLE',debit:0n,credit:amount-commission},{account:'PLATFORM_COMMISSION',debit:0n,credit:commission}]);
      await tx.financeOutbox.update({where:{paymentId:payment.id},data:{processedAt:now}});
      bookings.push(b);
    }
    await auditFinance(tx,agency.id,owner.id,'TEST_FIXTURE_CREATED',tour.id,{origin:'TEST',prefix:PREFIX,description:'Three matched sandbox receipts. No gateway or bank operation.'});
    return {agencyId:agency.id,tourId:tour.id,departureId:departure.id,bookings};
  },{timeout:60000,maxWait:15000});
  // Preserve reports, releases, credentials and user-entered bank details on repeat runs.
  const completion=await prisma.tourCompletion.findUnique({where:{departureId:result.departureId}});
  if(!completion?.completedAt)await completionService.save({agencyId:result.agencyId,userId:result.agencyId,role:'AGENCY'},result.tourId,result.departureId,{expectedRevision:completion?.revision??0,actualEndAt:day(-1).toISOString(),summary:'Đã thực hiện đầy đủ lịch trình, 8 khách tham gia và hoàn tất chuyến đi.',changes:'',incidents:'',evidence:[],amendmentReason:'',attendance:result.bookings.map(b=>({bookingId:b.id,attendedCount:b.participants}))},true);
  env.FINANCE_SANDBOX_AGENCY_IDS=[env.FINANCE_SANDBOX_AGENCY_IDS,result.agencyId].filter(Boolean).join(',');
  for(const b of result.bookings)await evaluateSettlement(b.id);
  console.log(JSON.stringify({email:EMAIL,agencyId:result.agencyId,tourId:result.tourId,bookings:result.bookings.map(b=>b.bookingCode),balances:await walletBalances(prisma,result.agencyId),settlements:await prisma.agencySettlement.findMany({where:{agencyId:result.agencyId},select:{reasons:true,eligibleAt:true,releasedAt:true}})},(_,v)=>typeof v==='bigint'?String(v):v,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(disconnectDatabase);
