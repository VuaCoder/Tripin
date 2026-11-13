// Persistent synthetic fixtures only, on the allowlisted PostgreSQL lab. No reset/drop.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
const target = new URL(process.env.DATABASE_URL!);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.pathname, '/lab_fresh');
assert.equal(process.env.DATABASE_URL_UNPOOLED, process.env.DATABASE_URL);
assert.equal(process.env.NODE_ENV, 'test');
const { prisma, disconnectDatabase } = await import('../src/config/database.ts');
const { createApp } = await import('../src/app.ts');
const { signAccessToken } = await import('../src/modules/auth/auth.tokens.ts');
const { notificationsService } = await import('../src/modules/notifications/notifications.service.ts');
const { writeAgencyNotification } = await import('../src/modules/notifications/notifications.writer.ts');
const { flushMailOutbox } = await import('../src/modules/notifications/mail-outbox.ts');
const { mailProvider } = await import('../src/integrations/mail/index.ts');
const app = createApp(), api = '/api/v1';
const sent: string[] = [], pushed: string[] = [];
mailProvider.send = async message => { sent.push(message.to); };
notificationsService.setPublisher(userId => { pushed.push(userId); });
let checks = 0;
function pass(name: string, condition: unknown) { assert.ok(condition, name); checks++; console.log('PASS '+name); }
async function user(role: 'AGENCY'|'TRAVELER'|'TOUR_GUIDE' = 'TRAVELER') {
  const id = randomUUID();
  const u = await prisma.user.create({data:{id,email:id+'@example.invalid',fullName:'H2.7 fixture',role,status:'ACTIVE',emailVerifiedAt:new Date(),
    ...(role === 'AGENCY' ? {extraPermissions:['tour:update-own'],agencyProfile:{create:{companyName:'Legacy company',verificationStatus:'VERIFIED'}}} : {})}});
  return {...u, token:signAccessToken(u.id,u.role,u.tokenVersion)};
}
const auth = (u:{token:string}, agencyId:string) => ({Authorization:'Bearer '+u.token,'X-Agency-Id':agencyId});
const inbox = async (u:{token:string}) => (await request(app).get(api+'/notifications').set('Authorization','Bearer '+u.token).expect(200)).body.data;
try {
  // Drain unrelated H2 synthetic invitation emails before recording this suite's recipients.
  await flushMailOutbox(); sent.length=0;
  const legacy=await user('AGENCY'), owner=await user(), staff=await user(), accountant=await user(), removed=await user(), banned=await user();
  const a=legacy.id;
  for(const [u,role,status] of [[owner,'OWNER','ACTIVE'],[staff,'STAFF','ACTIVE'],[accountant,'ACCOUNTANT','ACTIVE'],[removed,'STAFF','REMOVED'],[banned,'STAFF','ACTIVE']] as const) {
    await prisma.agencyMember.create({data:{agencyId:a,userId:u.id,role,status}});
  }
  await prisma.user.update({where:{id:banned.id},data:{status:'BANNED'}});
  const b=await prisma.agencyProfile.create({data:{companyName:'Independent agency B',verificationStatus:'VERIFIED'}});
  await prisma.agencyMember.create({data:{agencyId:b.id,userId:legacy.id,role:'OWNER'}});
  const first={type:'BOOKING_CONFIRMED' as const,title:'H27 initial agency event',body:'Scoped fixture'};
  await notificationsService.notifyAgency(a,first,{email:true});
  let rows=await prisma.notification.findMany({where:{agencyId:a,title:first.title}});
  pass('fanout includes four ACTIVE authorized members, not removed/banned users',rows.length===4 && !rows.some(x=>[removed.id,banned.id].includes(x.userId)));
  pass('realtime publisher receives only ACTIVE authorized users',pushed.length===4 && !pushed.includes(removed.id) && !pushed.includes(banned.id));
  const old=rows.find(x=>x.userId===legacy.id)!;
  pass('active legacy OWNER sees scoped notification', (await inbox(legacy)).some((x:{id:string})=>x.id===old.id));
  const member=await prisma.agencyMember.findUniqueOrThrow({where:{agencyId_userId:{agencyId:a,userId:legacy.id}}});
  await request(app).patch(api+'/agency/members/'+member.id).set(auth(owner,a)).send({status:'SUSPENDED'}).expect(200);
  pass('old JWT cannot read agency context after suspension',(await request(app).get(api+'/agency/context').set(auth(legacy,a))).status===403);
  pass('old JWT inbox hides already stored agency notification',!(await inbox(legacy)).some((x:{id:string})=>x.id===old.id));
  pass('revoked inbox cannot mark hidden notification read',(await request(app).patch(api+'/notifications/'+old.id+'/read').set('Authorization','Bearer '+legacy.token)).status===404);
  pass('revoked inbox cannot delete hidden notification',(await request(app).delete(api+'/notifications/'+old.id).set('Authorization','Bearer '+legacy.token)).status===404);
  pass('revoked agency notification excluded from unread count',(await request(app).get(api+'/notifications/unread-count').set('Authorization','Bearer '+legacy.token)).body.data.unread===0);
  await request(app).post(api+'/notifications/read-all').set('Authorization','Bearer '+legacy.token).expect(200);
  pass('bulk mark-read does not mutate inaccessible agency rows',(await prisma.notification.findUniqueOrThrow({where:{id:old.id}})).readAt===null);
  pushed.length=0;
  const second={...first,title:'H27 after suspension'};
  await notificationsService.notifyAgency(a,second,{email:true});
  rows=await prisma.notification.findMany({where:{agencyId:a,title:second.title}});
  pass('new notifications exclude suspended legacy OWNER despite global AGENCY',rows.length===3 && !rows.some(x=>x.userId===legacy.id));
  pass('suspended legacy OWNER receives no socket push',!pushed.includes(legacy.id));
  await flushMailOutbox();
  pass('queued and new emails recheck membership before sending',sent.length===6 && !sent.includes(legacy.email) && !sent.includes(removed.email));
  const retained=await prisma.mailOutbox.findFirstOrThrow({where:{dedupKey:`agency-notification:${a}:${legacy.id}:${old.id}`}});
  pass('revoked queued email retained unsent',retained.sentAt===null);
  await notificationsService.notifyAgency(b.id,{...first,title:'H27 agency B event'});
  await notificationsService.notify(legacy.id,{type:'PAYMENT_SUCCEEDED',title:'H27 personal event',body:'Personal Traveler activity'});
  const visible=await inbox(legacy);
  pass('multi-agency inbox keeps B and personal activity, not suspended A',visible.length===2 && visible.some((x:{title:string;agencyId?:string})=>x.title==='H27 agency B event' && x.agencyId===b.id));
  await request(app).patch(api+'/agency/members/'+member.id).set(auth(owner,a)).send({status:'REMOVED'}).expect(200);
  pushed.length=0;
  await notificationsService.notifyAgency(a,{...first,title:'H27 after removal'});
  pass('REMOVED member receives neither stored event nor socket push',!pushed.includes(legacy.id) && await prisma.notification.count({where:{agencyId:a,userId:legacy.id,title:'H27 after removal'}})===0);
  await prisma.$transaction(tx=>writeAgencyNotification(tx,a,{type:'REVIEW_MODERATED',title:'H27 transactional review',body:'Moderation fixture'}));
  const moderation=await prisma.notification.findMany({where:{agencyId:a,title:'H27 transactional review'}});
  pass('transactional writer uses membership and role permissions',moderation.length===2 && moderation.every(x=>[owner.id,staff.id].includes(x.userId)));
  // A real pending ledger proves the disabled endpoint performs zero transfer/audit writes.
  const guide=await user('TOUR_GUIDE');
  const tour=await prisma.tour.create({data:{agencyId:a,title:'H27 payout fixture',destination:'Lab',durationDays:1,basePrice:1000}});
  const earning=await prisma.earning.create({data:{agencyId:a,guideId:guide.id,tourId:tour.id,bookingId:randomUUID(),bookingCode:'H27-'+randomUUID(),tourTitle:tour.title,amount:1000,earnedAt:new Date()}});
  const ledger=await prisma.guidePayoutLedger.create({data:{earningId:earning.id,guideId:guide.id,agencyId:a,tourId:tour.id,amount:1000}});
  const transfer=(u:{token:string},id=a)=>request(app).post(api+'/earnings/payouts/'+ledger.id+'/transfer').set(auth(u,id)).send({transferReference:'H27-NO-REAL-TRANSFER'});
  let r=await transfer(owner);
  pass('authorized OWNER receives explicit quarantine 410',r.status===410 && r.body.error.code==='LEGACY_TRANSFER_QUARANTINED');
  pass('removed legacy OWNER with extra global permission cannot transfer',(await transfer(legacy)).status===403);
  pass('STAFF cannot transfer',(await transfer(staff)).status===403);
  pass('ACCOUNTANT cannot transfer',(await transfer(accountant)).status===403);
  pass('foreign agency OWNER still cannot mutate ledger',(await transfer(legacy,b.id)).status===410);
  pass('quarantine leaves ledger and audit untouched',(await prisma.guidePayoutLedger.findUniqueOrThrow({where:{id:ledger.id}})).status==='PENDING' && await prisma.auditLog.count({where:{targetId:ledger.id}})===0);
  // The writer participates in the caller's transaction, including rollback.
  const before=await prisma.notification.count({where:{agencyId:a}});
  await assert.rejects(prisma.$transaction(async tx=>{
    await writeAgencyNotification(tx,a,{type:'REVIEW_MODERATED',title:'H27 rolled-back event',body:'Rollback fixture'});
    throw new Error('rollback synthetic business action');
  }));
  pass('transaction rollback leaves neither notification nor queued email',await prisma.notification.count({where:{agencyId:a}})===before && await prisma.mailOutbox.count({where:{subject:'H27 rolled-back event'}})===0);
  const staffMembership=await prisma.agencyMember.findUniqueOrThrow({where:{agencyId_userId:{agencyId:a,userId:staff.id}}});
  await request(app).patch(api+'/agency/members/'+staffMembership.id).set(auth(owner,a)).send({role:'ACCOUNTANT'}).expect(200);
  pass('role downgrade hides previously authorized review content',!(await inbox(staff)).some((x:{title:string})=>x.title==='H27 transactional review'));
  await request(app).patch(api+'/agency/members/'+staffMembership.id).set(auth(owner,a)).send({role:'STAFF'}).expect(200);
  await flushMailOutbox();
  await notificationsService.notifyAgency(a,{...first,title:'H27 concurrent email'},{email:true});
  let release!:()=>void, started!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const sending=new Promise<void>(resolve=>{started=resolve;});
  mailProvider.send=async message=>{if(message.to===staff.email){started();await gate;}sent.push(message.to);};
  const worker=flushMailOutbox();
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    await Promise.race([sending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Email fixture did not start')),10_000);})]);
    let revoked=false;
    const revocation=request(app).patch(api+'/agency/members/'+staffMembership.id).set(auth(owner,a)).send({status:'SUSPENDED'}).then(r=>{assert.equal(r.status,200);revoked=true;});
    await new Promise(resolve=>setTimeout(resolve,150));
    pass('revocation waits for the already in-flight agency email',!revoked);
    release();await worker;await revocation;
    const deliveries=sent.filter(email=>email===staff.email).length;
    await notificationsService.notifyAgency(a,{...first,title:'H27 after concurrent revocation'},{email:true});
    await flushMailOutbox();
    pass('no email starts for that member after revocation commits',sent.filter(email=>email===staff.email).length===deliveries);
  } finally { if(timer)clearTimeout(timer);release();await worker; }
  console.log(`H2.7 ${checks}/${checks} PASS`);
} finally { notificationsService.setPublisher(undefined); await disconnectDatabase(); }
