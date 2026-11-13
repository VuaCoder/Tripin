import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { inject, it, expect } from 'vitest';

it('upgrades populated legacy schema, preserves six OWNER identities and business fingerprints', async () => {
  const adminUrl = inject('pgAdminUrl');
  if (new URL(adminUrl).hostname !== '127.0.0.1') throw new Error('Migration test must run on isolated localhost PostgreSQL');
  const database = 'tripri_upgrade_' + randomBytes(6).toString('hex');
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  let db: Client | undefined;
  try {
    await admin.query(`CREATE DATABASE ${database} TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
    db = new Client({ connectionString: adminUrl.replace(/\/[^/]*$/, '/' + database) });
    await db.connect();
    const dir = path.resolve(__dirname, '../../../../../prisma/migrations');
    const candidate = '20261113000100_agency_flexible_permissions';
    const migrations = readdirSync(dir).filter(n => /^\d/.test(n)).sort();
    for (const migration of migrations.filter(n => n < candidate)) await db.query(readFileSync(path.join(dir, migration, 'migration.sql'), 'utf8'));
    await db.query(`
      INSERT INTO "User"(id,email,"fullName",role,status,"updatedAt")
        SELECT gen_random_uuid(),'owner'||n||'@upgrade.test','Owner '||n,'AGENCY','ACTIVE',CURRENT_TIMESTAMP FROM generate_series(1,6) n;
      INSERT INTO "AgencyProfile"("userId","companyName","verificationStatus") SELECT id,'Historical '||"fullName",'VERIFIED' FROM "User";
      INSERT INTO "Tour"(id,"agencyId",title,destination,"durationDays","basePrice","updatedAt")
        SELECT gen_random_uuid(),id,'Historical tour','Vietnam',2,1000000,CURRENT_TIMESTAMP FROM "AgencyProfile";
      INSERT INTO "TourDeparture"(id,"tourId",date,capacity,remaining) SELECT gen_random_uuid(),id,CURRENT_TIMESTAMP+INTERVAL '30 days',10,9 FROM "Tour";
      INSERT INTO "Booking"(id,"bookingCode","travelerId","agencyId","tourId","departureId","tourTitle","departureDate","endDate",participants,"contactName","contactPhone","unitPrice",subtotal,"totalAmount","commissionBps","commissionAmount","agencyAmount","updatedAt")
        SELECT gen_random_uuid(),'HIST-'||row_number() OVER (),t."agencyId",t."agencyId",t.id,d.id,t.title,d.date,d.date+INTERVAL '2 days',1,'Historical Customer','0900000000',1000000,1000000,1000000,1000,100000,900000,CURRENT_TIMESTAMP FROM "Tour" t JOIN "TourDeparture" d ON d."tourId"=t.id;
      INSERT INTO "Payment"(id,purpose,"userId","referenceId",amount,currency,description,provider,"providerOrderCode",status,"expiresAt","updatedAt")
        SELECT gen_random_uuid(),'BOOKING',"travelerId",id,1000000,'VND','Historical payment','fixture',row_number() OVER (),'PENDING',CURRENT_TIMESTAMP+INTERVAL '1 day',CURRENT_TIMESTAMP FROM "Booking";
    `);
    async function fingerprints() {
      const result: Record<string, string> = {};
      for (const table of ['User','AgencyProfile','AgencyMember','Tour','TourDeparture','Booking','Payment']) {
        const expression = table === 'AgencyProfile' ? "to_jsonb(t)-'permissionVersion'" : table === 'AgencyMember' ? "to_jsonb(t)-'roleId'" : 'to_jsonb(t)';
        const response = await db!.query(`SELECT md5(string_agg((${expression})::text,',' ORDER BY id)) AS hash FROM "${table}" t`);
        result[table] = response.rows[0].hash;
      }
      return result;
    }
    const before = await fingerprints();
    await db.query(readFileSync(path.join(dir, candidate, 'migration.sql'), 'utf8'));
    expect(await fingerprints()).toEqual(before);
    const owners = await db.query(`SELECT m.id,m."userId",m."agencyId",r."systemRole" FROM "AgencyMember" m JOIN "AgencyRole" r ON r.id=m."roleId" WHERE m.role='OWNER' AND m.status='ACTIVE'`);
    expect(owners.rows).toHaveLength(6);
    expect(owners.rows.every(r => r.userId === r.agencyId && r.systemRole === 'OWNER')).toBe(true);
    expect((await db.query('SELECT count(*)::int n FROM "AgencyRole"')).rows[0].n).toBe(24);
    expect((await db.query('SELECT count(*)::int n FROM "AgencyMemberPermissionOverride"')).rows[0].n).toBe(0);
    expect((await db.query(`SELECT count(*)::int n FROM pg_constraint WHERE conname IN ('AgencyMember_agencyId_roleId_fkey','AgencyInvitation_agencyId_roleId_fkey','AgencyMemberPermissionOverride_agencyId_memberId_fkey','AgencyMemberTourScope_agencyId_tourId_fkey')`)).rows[0].n).toBe(4);
    const workplaceSql = readFileSync(path.join(dir, '20261113000200_agency_workplaces', 'migration.sql'), 'utf8');
    const preWorkplace = await fingerprints();
    // Rehearse transactional DDL rollback, then apply the actual forward artifact.
    await db.query('BEGIN');
    await db.query(workplaceSql.replace(/^BEGIN;\r?$/gm, '').replace(/^COMMIT;\r?$/gm, ''));
    expect((await db.query(`SELECT to_regclass('"AgencyJoinRequest"') AS name`)).rows[0].name).not.toBeNull();
    await db.query('ROLLBACK');
    expect((await db.query(`SELECT to_regclass('"AgencyJoinRequest"') AS name`)).rows[0].name).toBeNull();
    expect(await fingerprints()).toEqual(preWorkplace);
    await db.query(workplaceSql);
    expect(await fingerprints()).toEqual(preWorkplace);
    expect((await db.query(`SELECT count(*)::int n FROM "AgencyMember" WHERE role='OWNER' AND status='ACTIVE'`)).rows[0].n).toBe(6);
    expect((await db.query(`SELECT count(*)::int n FROM pg_indexes WHERE indexname IN ('AgencyJoinCode_current_key','AgencyJoinRequest_pending_key')`)).rows[0].n).toBe(2);
  } finally {
    await db?.end();
    try { await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`); } finally { await admin.end(); }
  }
}, 60000);
