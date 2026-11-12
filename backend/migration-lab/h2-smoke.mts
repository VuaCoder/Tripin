// Persistent fixtures in a newly created loopback-only lab database. No cleanup/reset.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';

const target = new URL(process.env.DATABASE_URL!);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.pathname, '/lab_fresh');
assert.equal(process.env.NODE_ENV, 'test');
const { prisma, disconnectDatabase } = await import('../src/config/database.ts');
const { createApp } = await import('../src/app.ts');
const { mailProvider } = await import('../src/integrations/mail/index.ts');
const { googleIdentityVerifier } = await import('../src/integrations/google/index.ts');
const { decodeMailBody } = await import('../src/modules/notifications/mail-outbox.ts');
let mailText = '';
mailProvider.send = async message => { mailText = message.text; };
const app = createApp();
const api = '/api/v1';
let checks = 0;
function pass(name: string, condition: unknown) { assert.ok(condition, name); checks++; console.log('PASS '+name); }
const password = 'H2-Local-Only!2026';
const passwordHash = await bcrypt.hash(password, 4);
async function user(role: 'TRAVELER'|'AGENCY' = 'TRAVELER') {
  const id = randomUUID();
  return prisma.user.create({ data: { id, email: id+'@example.invalid', fullName: 'H2 fixture', role, status: 'ACTIVE', emailVerifiedAt: new Date(), passwordHash,
    ...(role === 'AGENCY' ? { agencyProfile: { create: { companyName: 'Legacy fixture', verificationStatus: 'VERIFIED' } } } : {}) } });
}
async function login(u: {email:string}, agency = true) {
  const r = await request(app).post(api+(agency?'/auth/agency/login':'/auth/login')).send({email:u.email,password});
  assert.equal(r.status,200,JSON.stringify(r.body)); return r;
}
const auth = (token:string, agency:string) => ({ Authorization:'Bearer '+token, 'X-Agency-Id':agency });
try {
  const owners = [];
  for(let i=0;i<6;i++) { const u=await user('AGENCY'); const r=await login(u); owners.push({u,r});
    pass('legacy OWNER login '+(i+1),r.body.data.agencies.length===1 && r.body.data.agencies[0].agencyId===u.id && r.body.data.agencies[0].memberRole==='OWNER'); }
  const owner=owners[0], a=owner.u.id, b=owners[1].u.id, ownerToken=owner.r.body.data.accessToken;
  const accountant=await user(), staff=await user(), outsider=await user();
  const accountantLogin=await login(accountant,false), staffLogin=await login(staff,false), outsiderLogin=await login(outsider,false);
  const at=accountantLogin.body.data.accessToken, st=staffLogin.body.data.accessToken;
  async function invite(u:{email:string},role:string) {
    const r=await request(app).post(api+'/agency/invitations').set(auth(ownerToken,a)).send({email:u.email,role});
    assert.equal(r.status,201,JSON.stringify(r.body));
    const out=await prisma.mailOutbox.findFirstOrThrow({where:{dedupKey:'agency-invitation:'+r.body.data.id}});
    const token=decodeMailBody(out.text).split('token=')[1];
    pass('invitation API hides token and hash',!r.body.data.token && !r.body.data.tokenHash);
    return {id:r.body.data.id,token};
  }
  const inv=await invite(accountant,'ACCOUNTANT');
  let r=await request(app).post(api+'/agency-invitations/accept').set('Authorization','Bearer '+outsiderLogin.body.data.accessToken).send({token:inv.token});
  pass('wrong email cannot accept invitation',r.status===400);
  r=await request(app).post(api+'/agency-invitations/accept').set('Authorization','Bearer '+at).send({token:inv.token});
  pass('Traveler accepts Accountant invitation',r.status===200 && r.body.data.role==='ACCOUNTANT');
  const accountantMember=r.body.data.id;
  const saved=await prisma.user.findUniqueOrThrow({where:{id:accountant.id}});
  pass('invitation preserves global role and credentials',saved.role==='TRAVELER' && saved.passwordHash===passwordHash);
  r=await request(app).post(api+'/agency-invitations/accept').set('Authorization','Bearer '+at).send({token:inv.token});
  pass('invitation is single use',r.status===400);
  const si=await invite(staff,'STAFF');
  r=await request(app).post(api+'/agency-invitations/accept').set('Authorization','Bearer '+st).send({token:si.token});
  assert.equal(r.status,200); const staffMember=r.body.data.id;
  const accountantPortal=await login(accountant);
  pass('agency login accepts Traveler membership',accountantPortal.body.data.agencies[0].memberRole==='ACCOUNTANT');
  r=await request(app).get(api+'/agency/context').set(auth(at,a));
  pass('context separates tenant and actor',r.status===200 && r.body.data.agencyId===a && r.body.data.actorUserId===accountant.id && r.body.data.memberId===accountantMember);
  r=await request(app).get(api+'/agency/context').set(auth(at,b)); pass('cross agency selection denied',r.status===403);
  r=await request(app).get(api+'/agency/finance/summary').set(auth(st,a)); pass('STAFF finance forbidden',r.status===403);
  r=await request(app).get(api+'/agency/finance/summary').set(auth(at,a)); pass('ACCOUNTANT finance allowed',r.status===200 && r.body.data.agencyId===a);
  r=await request(app).get(api+'/agency/tours').set(auth(at,a)); pass('ACCOUNTANT tour management forbidden',r.status===403);
  const ta=await prisma.tour.create({data:{agencyId:a,title:'Agency A',destination:'Lab',durationDays:1,basePrice:1000}});
  const tb=await prisma.tour.create({data:{agencyId:b,title:'Agency B',destination:'Lab',durationDays:1,basePrice:1000}});
  const list1=await request(app).get(api+'/agency/tours').set(auth(st,a));
  const list2=await request(app).get(api+'/agency/tours').set(auth(ownerToken,a));
  pass('same agency members see same scoped tours',list1.status===200 && list2.status===200 && JSON.stringify(list1.body.data)===JSON.stringify(list2.body.data) && JSON.stringify(list1.body.data).includes(ta.id) && !JSON.stringify(list1.body.data).includes(tb.id));
  r=await request(app).get(api+'/agency/tours/'+tb.id).set(auth(st,a)); pass('cross agency tour ID denied',r.status===404 || r.status===403);
  await prisma.agencyMember.create({data:{agencyId:b,userId:staff.id,role:'STAFF'}});
  r=await request(app).get(api+'/agency/context').set('Authorization','Bearer '+st); pass('multi agency requires explicit selector',r.status===403);
  r=await request(app).get(api+'/agency/tours').set(auth(st,b)); pass('multi agency switch isolates data',r.status===200 && JSON.stringify(r.body.data).includes(tb.id) && !JSON.stringify(r.body.data).includes(ta.id));
  r=await request(app).patch(api+'/agency/members/'+accountantMember).set(auth(ownerToken,a)).send({status:'SUSPENDED'}); assert.equal(r.status,200);
  r=await request(app).get(api+'/agency/context').set(auth(at,a)); pass('suspended membership rejects old access JWT',r.status===403);
  r=await request(app).post(api+'/auth/refresh').set('Cookie',accountantPortal.headers['set-cookie']);
  pass('refresh does not restore suspended membership',r.status===200 && r.body.data.agencies.length===0);
  r=await request(app).get(api+'/users/me').set('Authorization','Bearer '+at); pass('suspension preserves personal Traveler access',r.status===200);
  await request(app).patch(api+'/agency/members/'+accountantMember).set(auth(ownerToken,a)).send({status:'ACTIVE'}).expect(200);
  await prisma.user.update({where:{id:accountant.id},data:{twoFactorEnabled:true}});
  r=await login(accountant); pass('agency member 2FA challenge',r.body.data.twoFactorRequired===true);
  const code=mailText.match(/\b\d{6}\b/)?.[0]; assert.ok(code,'OTP captured in memory');
  r=await request(app).post(api+'/auth/agency/verify-otp').send({email:accountant.email,purpose:'LOGIN_2FA',code});
  pass('2FA preserves membership and limited role',r.status===200 && r.body.data.agencies[0].memberRole==='ACCOUNTANT');
  const twoFactorSession=r;
  r=await request(app).post(api+'/auth/refresh').set('Cookie',twoFactorSession.headers['set-cookie']); pass('2FA refresh retains membership',r.status===200 && r.body.data.agencies[0].memberRole==='ACCOUNTANT');
  googleIdentityVerifier.verifyIdToken=async()=>({googleId:'h2-google-'+accountant.id,email:accountant.email,emailVerified:true,fullName:'Google fixture'});
  r=await request(app).post(api+'/auth/agency/google').send({idToken:'local-fake-google'}); pass('Google agency login supports Traveler member',r.status===200 && r.body.data.agencies[0].memberRole==='ACCOUNTANT');
  r=await request(app).post(api+'/auth/google').send({idToken:'local-fake-google'}); pass('Google personal login retains agency memberships',r.status===200 && r.body.data.user.role==='TRAVELER' && r.body.data.agencies.length===1);
  await request(app).patch(api+'/agency/members/'+staffMember).set(auth(ownerToken,a)).send({status:'REMOVED'}).expect(200);
  r=await request(app).get(api+'/agency/context').set(auth(st,a)); pass('removed membership rejects old JWT',r.status===403);
  const ownerMember=owner.r.body.data.agencies[0].memberId;
  r=await request(app).patch(api+'/agency/members/'+ownerMember).set(auth(ownerToken,a)).send({role:'STAFF'}); pass('last OWNER protected',r.status===409);
  r=await request(app).patch(api+'/agency/members/'+ownerMember).set(auth(at,a)).send({status:'REMOVED'}); pass('ACCOUNTANT cannot manage team',r.status===403);
  const ri=await invite(outsider,'STAFF');
  await request(app).post(api+'/agency/invitations/'+ri.id+'/revoke').set(auth(ownerToken,a)).expect(200);
  r=await request(app).post(api+'/agency-invitations/accept').set('Authorization','Bearer '+outsiderLogin.body.data.accessToken).send({token:ri.token}); pass('revoked invitation denied',r.status===400);
  const expiredToken='expired-'+randomUUID();
  await prisma.agencyInvitation.create({data:{agencyId:a,email:outsider.email,role:'STAFF',tokenHash:createHash('sha256').update(expiredToken).digest('hex'),invitedByUserId:owner.u.id,createdAt:new Date(Date.now()-60000),expiresAt:new Date(Date.now()-10000)}});
  r=await request(app).post(api+'/agency-invitations/accept').set('Authorization','Bearer '+outsiderLogin.body.data.accessToken).send({token:expiredToken}); pass('expired invitation denied',r.status===400);
  r=await request(app).get(api+'/agency/context').set(auth(ownerToken,'not-a-uuid')); pass('invalid selector rejected',r.status===400);
  r=await request(app).patch(api+'/agency/members/'+ownerMember).set(auth(ownerToken,a)).send({userId:outsider.id}); pass('membership mass assignment rejected',r.status===400);
  const roleless=await user('AGENCY');
  await prisma.agencyMember.updateMany({where:{userId:roleless.id},data:{status:'SUSPENDED'}});
  r=await request(app).post(api+'/auth/agency/login').send({email:roleless.email,password}); pass('global AGENCY alone grants no agency login',r.status===401);
  const org=await prisma.agencyProfile.create({data:{companyName:'Independent company',verificationStatus:'VERIFIED'}});
  const coowner=await prisma.agencyMember.create({data:{agencyId:org.id,userId:owner.u.id,role:'OWNER'}});
  const coowner2=await prisma.agencyMember.create({data:{agencyId:org.id,userId:owners[1].u.id,role:'OWNER'}});
  r=await request(app).get(api+'/agency/finance/summary').set(auth(ownerToken,org.id)); pass('Finance uses independent AgencyProfile ID, not User ID',r.status===200 && r.body.data.agencyId===org.id && org.id!==owner.u.id && org.userId===null);
  const concurrent=await Promise.all([
    request(app).patch(api+'/agency/members/'+coowner.id).set(auth(ownerToken,org.id)).send({role:'STAFF'}),
    request(app).patch(api+'/agency/members/'+coowner2.id).set(auth(owners[1].r.body.data.accessToken,org.id)).send({role:'STAFF'}),
  ]);
  pass('concurrent OWNER demotions serialize safely',concurrent.filter(x=>x.status===200).length===1 && concurrent.filter(x=>x.status===409).length===1 && await prisma.agencyMember.count({where:{agencyId:org.id,role:'OWNER',status:'ACTIVE'}})===1);
  console.log(`H2 ${checks}/${checks} PASS`);
} finally { await disconnectDatabase(); }
