/* Isolated migration experiment. No reset/drop/resolve or remote writes. */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { Client } = require('pg');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'backend');
const history = path.join(root, 'prisma/migrations');
const candidateName = '20261112000100_agency_multimember_foundation';
const reconciliationName = '20261112000000_agency_calendar_index';
const candidateNames = [reconciliationName, '20261112000050_agency_onboarding_guard', candidateName,
  '20261112000200_agency_legacy_onboarding', '20261112000300_agency_notification_scope',
  '20261112000400_agency_onboarding_release'];
const foundationOnly = process.argv.includes('--foundation-only');
const qi = (s) => '"' + s.replaceAll('"', '""') + '"';
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const tenantModels = ['Tour','Booking','ETicket','Review','Report','ComplaintTicket','ComplaintFeedback','Earning','GuidePayoutLedger','PremiumContribution'];
const report = { productionWrites: false, resetOrDrop: false, checks: [], scenarios: {} };
let runRoot;
let port;
let native;
let server;
const allowedDatabases = new Set(['lab_fresh', 'lab_clone', 'lab_baseline', 'lab_rollback', 'lab_window']);
const check = (name, passed, detail) => {
  report.checks.push({ name, passed, ...(detail === undefined ? {} : { detail }) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
};

function historyHashes() {
  return Object.fromEntries(fs.readdirSync(history).sort().filter(n => fs.existsSync(path.join(history, n, 'migration.sql')))
    .map(n => [n, hash(fs.readFileSync(path.join(history, n, 'migration.sql')))]));
}
function run(exe, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: root, windowsHide: true, ...options });
    let output = '';
    child.stdout?.on('data', b => { output += b; });
    child.stderr?.on('data', b => { output += b; });
    child.once('error', reject);
    child.once('exit', code => resolve({ code, output }));
  });
}
function localUrl(db) {
  if (!allowedDatabases.has(db)) throw new Error('Database is not in the test allowlist');
  return `postgresql://postgres@127.0.0.1:${port}/${db}`;
}
function guardLocal(url) {
  const u = new URL(url);
  if (u.hostname !== '127.0.0.1' || u.port !== String(port) || !allowedDatabases.has(u.pathname.slice(1))) {
    throw new Error('Refusing non-lab write target');
  }
}
async function localClient(db) {
  const connectionString = localUrl(db);
  guardLocal(connectionString);
  const c = new Client({ connectionString, options: '-c timezone=UTC' });
  await c.connect();
  return c;
}
async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

async function catalog(c) {
  const q = async (sql) => (await c.query(sql)).rows;
  const unsupported = await q(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND (c.relkind IN ('p','v','m','S','f') OR c.relrowsecurity OR c.relispartition)`);
  if (unsupported.length) throw new Error('Snapshot exporter does not support these relations: ' + unsupported.map(x => x.relname).join(','));
  const tables = await q(`SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`);
  const columns = await q(`SELECT c.relname AS tbl,a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,
    a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS def,a.attgenerated,a.attidentity,a.attnum
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`);
  if (columns.some(x => x.attgenerated || x.attidentity)) throw new Error('Generated/identity columns require pg_dump, not this exporter');
  const enums = await q(`SELECT t.typname AS name,array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE n.nspname='public' GROUP BY t.typname ORDER BY t.typname`);
  const functions = await q(`SELECT p.proname AS name,pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.classid='pg_proc'::regclass AND d.deptype='e') ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)`);
  const constraints = await q(`SELECT c.relname AS tbl,k.conname AS name,k.contype AS kind,
    pg_get_constraintdef(k.oid) AS def,k.convalidated AS validated FROM pg_constraint k
    JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' ORDER BY c.relname,k.conname`);
  const indexes = await q(`SELECT t.relname AS tbl,i.relname AS name,pg_get_indexdef(i.oid) AS def,
    x.indisvalid AS valid,x.indisready AS ready FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid
    JOIN pg_class t ON t.oid=x.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND NOT EXISTS(SELECT 1 FROM pg_constraint k WHERE k.conindid=i.oid AND k.contype IN ('p','u','x')) ORDER BY t.relname,i.relname`);
  const triggers = await q(`SELECT c.relname AS tbl,t.tgname AS name,pg_get_triggerdef(t.oid) AS def,t.tgenabled AS enabled
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`);
  if (triggers.some(x => x.enabled !== 'O')) throw new Error('Non-default trigger enablement requires pg_dump');
  return { tables, columns, enums, functions, constraints, indexes, triggers };
}
function ddl(cat) {
  const sql = [];
  for (const e of cat.enums) sql.push(`CREATE TYPE ${qi(e.name)} AS ENUM (${e.labels.map(x => "'" + x.replaceAll("'", "''") + "'").join(',')});`);
  for (const f of cat.functions) sql.push(f.def + ';');
  for (const t of cat.tables) sql.push(`CREATE TABLE ${qi(t.name)} (${cat.columns.filter(x => x.tbl === t.name).map(x => `${qi(x.name)} ${x.type}${x.def ? ' DEFAULT ' + x.def : ''}${x.not_null ? ' NOT NULL' : ''}`).join(',\n')});`);
  const after = [];
  for (const k of [...cat.constraints].sort((a,b) => Number(a.kind==='f')-Number(b.kind==='f'))) after.push(`ALTER TABLE ${qi(k.tbl)} ADD CONSTRAINT ${qi(k.name)} ${k.def};`);
  for (const i of cat.indexes) after.push(i.def + ';');
  for (const t of cat.triggers) after.push(t.def + ';');
  return { before: sql.join('\n'), after: after.join('\n') };
}
function normalizedCatalog(cat) {
  // Physical column order and table owners are not logical schema differences.
  return JSON.stringify({ ...cat, columns: cat.columns.map(({attnum,...x}) => x).sort((a,b)=>(a.tbl+'.'+a.name).localeCompare(b.tbl+'.'+b.name)) });
}
async function fingerprints(c, tables, legacyOnly = false) {
  const out = {};
  for (const {name} of tables) {
    if (legacyOnly && name === '_prisma_migrations') continue;
    const expr = legacyOnly && name === 'AgencyProfile' ? "to_jsonb(t) - 'id'"
      : legacyOnly && name === 'Notification' ? "to_jsonb(t) - 'agencyId'" : 'to_jsonb(t)';
    const r = await c.query(`SELECT md5((${expr})::text) AS h FROM ${qi(name)} t ORDER BY 1`);
    out[name] = { count: r.rowCount, hash: hash(r.rows.map(x=>x.h).join('\n')) };
  }
  return out;
}
function configFile(dir, schemaPath, migrationPath) {
  const f = path.join(dir, 'prisma.config.cjs');
  fs.writeFileSync(f, `const {defineConfig}=require(${JSON.stringify(path.join(backend,'node_modules/prisma/config.js'))});\nmodule.exports=defineConfig({schema:${JSON.stringify(schemaPath)},migrations:{path:${JSON.stringify(migrationPath)}},datasource:{url:process.env.LAB_DATABASE_URL}});\n`);
  return f;
}
async function prisma(db, config, args) {
  const url = localUrl(db); guardLocal(url);
  return run(process.execPath, [path.join(backend,'node_modules/prisma/build/index.js'), ...args, '--config', config], {
    cwd: backend, env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url, LAB_DATABASE_URL: url },
  });
}
function save(name, value) { fs.writeFileSync(path.join(runRoot,name), typeof value==='string'?value:JSON.stringify(value,null,2)); }

function targetSchema(original) {
  if (original.includes('model AgencyMember {')) return original;
  let s=original.replace(/model User \{([\s\S]*?)\n\}/,(_all,body)=>`model User {${body}\n  agencyMembers AgencyMember[]\n  agencyInvitesSent AgencyInvitation[] @relation("AgencyInviteSender")\n  agencyInvitesTaken AgencyInvitation[] @relation("AgencyInviteAcceptor")\n}`);
  s=s.replace(/model AgencyProfile \{([\s\S]*?)\n\}/,(_all,body)=>{
    body=body.replace(/userId\s+String\s+@id\s+@db.Uuid/,'id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid\n  userId String? @unique(map: "AgencyProfile_legacy_user_key") @db.Uuid');
    body=body.replace(/user User @relation\(([^\n]*)onDelete: Cascade\)/,'user User? @relation($1onDelete: Restrict, onUpdate: NoAction)');
    return `model AgencyProfile {${body}\n  members AgencyMember[]\n  invitations AgencyInvitation[]\n${tenantModels.map(m=>'  owned'+m+' '+m+'[]').join('\n')}\n}`;
  });
  for(const m of tenantModels){
    const re=new RegExp('model '+m+' \\{([\\s\\S]*?)\\n\\}');
    s=s.replace(re,(_all,body)=>`model ${m} {${body}\n  agency AgencyProfile${m==='Report'?'?':''} @relation(fields: [agencyId], references: [id], onDelete: Restrict, onUpdate: NoAction)\n}`);
  }
  for(const [model,action] of [['GuidePayoutAccount','Cascade'],['GuidePayoutLedger','Restrict']]){
    const re=new RegExp('model '+model+' \\{([\\s\\S]*?)\\n\\}');
    s=s.replace(re,(_all,body)=>`model ${model} {${body.replace('onDelete: '+action+')','onDelete: '+action+', onUpdate: NoAction)')}\n}`);
  }
  s=s.replace(/model TourDeparture \{([\s\S]*?)\n\}/,(_all,body)=>`model TourDeparture {${body}\n  @@index([tourId, date])\n}`);
  // SQL omitted ON UPDATE, whose actual PostgreSQL behavior is NO ACTION.
  s+='\n'+fs.readFileSync(path.join(__dirname,'target-models.prisma'),'utf8');
  return s;
}

async function main() {
  if(foundationOnly && !process.argv.includes('--snapshot')) throw new Error('--foundation-only requires a retained --snapshot; remote access disabled');
  const originalHashes = historyHashes();
  report.originalMigrationHashes = originalHashes;
  fs.mkdirSync(path.join(root,'.test-artifacts'), {recursive:true});
  runRoot=fs.mkdtempSync(path.join(root,'.test-artifacts/migration-lab-'));
  report.artifactDirectory=path.relative(root,runRoot);
  report.startedAt=new Date().toISOString();
  report.branch=execFileSync('git',['branch','--show-current'],{cwd:root}).toString().trim();
  if (report.branch==='main') throw new Error('Run this lab on a separate development branch');
  console.log('Artifacts: '+report.artifactDirectory);
  port=await freePort();
  const embeddedRequire=createRequire(require.resolve('embedded-postgres'));
  native=path.resolve(path.dirname(embeddedRequire.resolve('@embedded-postgres/windows-x64')),'../native/bin');
  if(process.platform!=='win32') throw new Error('This lab launcher currently supports Windows only');
  const dataDir=path.join(runRoot,'data');
  const init=await run(path.join(native,'initdb.exe'),['-D',dataDir,'--username=postgres','--auth=trust','--encoding=UTF8','--locale=C']);
  save('initdb.log',init.output);if(init.code!==0)throw new Error('initdb failed; see local log');
  server=spawn(path.join(native,'postgres.exe'),['-D',dataDir,'-p',String(port),'-h','127.0.0.1'],{cwd:runRoot,windowsHide:true});
  const serverLog=fs.createWriteStream(path.join(runRoot,'postgres.log'));server.stderr.pipe(serverLog);
  await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('Local PostgreSQL start timeout')),30000);server.once('error',reject);server.stderr.on('data',b=>{text+=b;if(text.includes('database system is ready to accept connections')){clearTimeout(timer);resolve();}});});
  const admin=new Client({connectionString:`postgresql://postgres@127.0.0.1:${port}/postgres`});await admin.connect();
  for(const db of allowedDatabases)await admin.query(`CREATE DATABASE ${qi(db)} TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`);
  await admin.end();

  // dotenv.parse does not inject a shared URL into CLI process environments.
  const env=dotenv.parse(fs.readFileSync(path.join(root,'.env')));
  const sourceUrl=env.DATABASE_URL_UNPOOLED||env.DATABASE_URL;
  if(!sourceUrl)throw new Error('No source connection configured');
  let sourceCat,sourceData,sourceFingerprints,sourceLegacy,sourceLedger;
  const snapshotArg=process.argv.indexOf('--snapshot');
  if(snapshotArg>=0){
    const f=fs.realpathSync(path.resolve(root,process.argv[snapshotArg+1]||''));
    const permitted=fs.realpathSync(path.join(root,'.test-artifacts'))+path.sep;
    if(!f.startsWith(permitted)||path.basename(f)!=='source-private-snapshot.json')throw new Error('Snapshot must be a retained private lab artifact');
    const snap=JSON.parse(fs.readFileSync(f,'utf8'));sourceCat=snap.catalog;sourceData=snap.data;
    for(const e of sourceCat.enums)if(typeof e.labels==='string'){
      if(!/^\{[A-Z0-9_,]+\}$/.test(e.labels))throw new Error('Unsupported archived enum representation');
      e.labels=e.labels.slice(1,-1).split(',');
    }
    sourceFingerprints=JSON.parse(fs.readFileSync(path.join(path.dirname(f),'source-fingerprints.json'),'utf8'));
    sourceLegacy={...sourceFingerprints};delete sourceLegacy._prisma_migrations;
    sourceLedger=sourceData._prisma_migrations;
    report.snapshotReused=path.relative(root,f);
    check('using retained read-only source snapshot',true);
  }else{
  const source=new Client({connectionString:sourceUrl,options:'-c default_transaction_read_only=on -c timezone=UTC',connectionTimeoutMillis:15000});
  await source.connect();
  try {
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const ro=(await source.query('SHOW transaction_read_only')).rows[0].transaction_read_only;
    if(ro!=='on')throw new Error('Source connection is not read-only');
    check('source transaction is read-only',true);
    sourceCat=await catalog(source); sourceData={};
    for(const {name} of sourceCat.tables)sourceData[name]=(await source.query(`SELECT row_to_json(t)::text AS row FROM ${qi(name)} t`)).rows.map(x=>x.row);
    sourceFingerprints=await fingerprints(source,sourceCat.tables);
    sourceLegacy=await fingerprints(source,sourceCat.tables,true);
    sourceLedger=sourceData._prisma_migrations;
    await source.query('COMMIT');
  } finally {await source.end();}
  }
  save('source-private-snapshot.json',{catalog:sourceCat,data:sourceData});
  save('source-fingerprints.json',sourceFingerprints);
  const schemaDdl=ddl(sourceCat);
  for(const cloneDb of ['lab_clone','lab_rollback','lab_window']){
  const clone=await localClient(cloneDb);
  try {
    await clone.query('BEGIN');await clone.query(schemaDdl.before);
    for(const {name} of sourceCat.tables){if(sourceData[name].length)await clone.query(`INSERT INTO ${qi(name)} SELECT * FROM json_populate_recordset(NULL::${qi(name)},$1::json)`,['['+sourceData[name].join(',')+']']);}
    await clone.query(schemaDdl.after);await clone.query('COMMIT');
    check(cloneDb+' catalog equals source',normalizedCatalog(await catalog(clone))===normalizedCatalog(sourceCat));
    check(cloneDb+' all rows equal source',JSON.stringify(await fingerprints(clone,sourceCat.tables))===JSON.stringify(sourceFingerprints));
  } catch(e){await clone.query('ROLLBACK');throw e;} finally{await clone.end();}
  }
  // Real commit boundaries and two independent connections, not one atomic mock.
  const windowDdl=await localClient('lab_window'),windowWriter=await localClient('lab_window');
  try {
    await windowWriter.query('BEGIN');
    await windowWriter.query('LOCK TABLE "AgencyProfile" IN ROW EXCLUSIVE MODE');
    await windowDdl.query("SET lock_timeout='150ms'");
    let blocked=false;
    try { await windowDdl.query(fs.readFileSync(path.join(history,'20261112000050_agency_onboarding_guard/migration.sql'),'utf8')); }
    catch(e){blocked=e.code==='55P03';await windowDdl.query('ROLLBACK');}
    check('guard installation waits for in-flight profile writers',blocked);
    await windowWriter.query('ROLLBACK');await windowDdl.query('RESET lock_timeout');
    const id=crypto.randomUUID();
    await windowWriter.query(`INSERT INTO "User" (id,email,"fullName",role,status,"updatedAt") VALUES ($1,$2,'Committed window fixture','AGENCY','ACTIVE',now())`,[id,id+'@example.invalid']);
    for(const name of candidateNames){
      await windowDdl.query(fs.readFileSync(path.join(history,name,'migration.sql'),'utf8'));
      if(['20261112000050_agency_onboarding_guard',candidateName,'20261112000200_agency_legacy_onboarding'].includes(name)){
        let denied=false;
        try{await windowWriter.query('INSERT INTO "AgencyProfile" ("userId") VALUES ($1)',[id]);}catch(e){denied=e.code==='55000';}
        check('committed window rejects concurrent onboarding after '+name,denied);
      }
    }
    await windowWriter.query('INSERT INTO "AgencyProfile" ("userId") VALUES ($1)',[id]);
    const ready=(await windowWriter.query(`SELECT a.id FROM "AgencyProfile" a JOIN "AgencyMember" m ON m."agencyId"=a.id
      WHERE a.id=$1 AND a."userId"=$1 AND m."userId"=$1 AND m.role='OWNER' AND m.status='ACTIVE'`,[id])).rowCount;
    check('onboarding succeeds with correct ID and OWNER after committed release',ready===1);
  }finally{await windowDdl.end();await windowWriter.end();}
  const rollback=await localClient('lab_rollback');
  try{
    await rollback.query('BEGIN');
    const legacyUser=crypto.randomUUID();
    await rollback.query(`INSERT INTO "User" (id,email,"fullName",role,status,"updatedAt") VALUES ($1,$2,'Window fixture','AGENCY','ACTIVE',now())`,[legacyUser,legacyUser+'@example.invalid']);
    for (const name of candidateNames) {
      await rollback.query(fs.readFileSync(path.join(history,name,'migration.sql'),'utf8').replace(/^\s*(?:BEGIN|COMMIT);\s*$/gm,''));
      if (['20261112000050_agency_onboarding_guard',candidateName,'20261112000200_agency_legacy_onboarding'].includes(name)) {
        await rollback.query('SAVEPOINT onboarding_probe');let denied=false;
        try{await rollback.query('INSERT INTO "AgencyProfile" ("userId") VALUES ($1)',[legacyUser]);}catch(e){denied=e.code==='55000';}
        await rollback.query('ROLLBACK TO SAVEPOINT onboarding_probe');check('onboarding quarantined after '+name,denied);
      }
    }
    await rollback.query('INSERT INTO "AgencyProfile" ("userId") VALUES ($1)',[legacyUser]);
    const mapped=(await rollback.query(`SELECT a.id,a."userId",count(m.id)::int owners FROM "AgencyProfile" a
      LEFT JOIN "AgencyMember" m ON m."agencyId"=a.id AND m."userId"=a."userId" AND m.role='OWNER' AND m.status='ACTIVE'
      WHERE a."userId"=$1 GROUP BY a.id,a."userId"`,[legacyUser])).rows[0];
    check('released onboarding preserves legacy identity and exactly one OWNER',mapped.id===legacyUser&&mapped.owners===1);
    check('candidate executes inside a DDL transaction',true);await rollback.query('ROLLBACK');
    check('DDL rollback restores original catalog',normalizedCatalog(await catalog(rollback))===normalizedCatalog(sourceCat));
    check('DDL rollback preserves all rows and ledger',JSON.stringify(await fingerprints(rollback,sourceCat.tables))===JSON.stringify(sourceFingerprints));
  }finally{await rollback.end();}

  const stage=path.join(runRoot,'history');fs.mkdirSync(stage);
  for(const n of Object.keys(originalHashes)){fs.mkdirSync(path.join(stage,n));fs.copyFileSync(path.join(history,n,'migration.sql'),path.join(stage,n,'migration.sql'));}
  fs.copyFileSync(path.join(history,'migration_lock.toml'),path.join(stage,'migration_lock.toml'));
  const currentSchema=path.join(root,'prisma/schema.prisma');
  const targetPath=path.join(runRoot,'target.prisma');
  fs.writeFileSync(targetPath,targetSchema(fs.readFileSync(currentSchema,'utf8')));
  const targetConfig=configFile(path.join(runRoot),targetPath,stage);
  const targetValidation=await prisma('lab_fresh',targetConfig,['validate']);save('target-validate.log',targetValidation.output);check('target Prisma schema validates',targetValidation.code===0);
  // Keep current schema validation separate from the candidate schema contract.
  const config=configFile(runRoot,currentSchema,stage);
  const validation=await prisma('lab_fresh',config,['validate']);save('prisma-validate.log',validation.output);check('current Prisma schema validates',validation.code===0);
  const fresh=await prisma('lab_fresh',config,['migrate','deploy']);save('fresh-history.log',fresh.output);
  report.scenarios.freshHistory={passed:fresh.code===0,exitCode:fresh.code,log:'fresh-history.log'};
  check('fresh unchanged history deploy',fresh.code===0);

  let baseConfig;
  if (!foundationOnly) {
  // Experimental baseline has its own directory and is never resolved into an existing ledger.
  const baselineRoot=path.join(runRoot,'baseline');fs.mkdirSync(path.join(baselineRoot,'00000000000000_catalog_baseline'),{recursive:true});
  fs.copyFileSync(path.join(history,'migration_lock.toml'),path.join(baselineRoot,'migration_lock.toml'));
  const baselineCat={...sourceCat,tables:sourceCat.tables.filter(x=>x.name!=='_prisma_migrations'),columns:sourceCat.columns.filter(x=>x.tbl!=='_prisma_migrations'),constraints:sourceCat.constraints.filter(x=>x.tbl!=='_prisma_migrations'),indexes:sourceCat.indexes.filter(x=>x.tbl!=='_prisma_migrations')};
  const baselineDdl=ddl(baselineCat);
  fs.writeFileSync(path.join(baselineRoot,'00000000000000_catalog_baseline/migration.sql'),baselineDdl.before+'\n'+baselineDdl.after);
  baseConfig=configFile(baselineRoot,currentSchema,baselineRoot);
  const baseline=await prisma('lab_baseline',baseConfig,['migrate','deploy']);save('baseline.log',baseline.output);
  const bc=await localClient('lab_baseline');
  let baselineEqual=false;
  try{const cat=await catalog(bc);baselineEqual=normalizedCatalog({...cat,tables:cat.tables.filter(x=>x.name!=='_prisma_migrations'),columns:cat.columns.filter(x=>x.tbl!=='_prisma_migrations'),constraints:cat.constraints.filter(x=>x.tbl!=='_prisma_migrations'),indexes:cat.indexes.filter(x=>x.tbl!=='_prisma_migrations')})===normalizedCatalog(baselineCat);}finally{await bc.end();}
  report.scenarios.baseline={passed:baseline.code===0&&baselineEqual,exitCode:baseline.code,catalogEqual:baselineEqual};check('experimental baseline reproduces source catalog',baseline.code===0&&baselineEqual);
  // Source ledger lacks this local migration; reconcile forward, never rewrite baseline history.
  const pendingEnum='20261110000000_subscription_expiring_soon';
  fs.mkdirSync(path.join(baselineRoot,pendingEnum));
  fs.copyFileSync(path.join(history,pendingEnum,'migration.sql'),path.join(baselineRoot,pendingEnum,'migration.sql'));
  for(const name of candidateNames) {
    fs.mkdirSync(path.join(baselineRoot,name));
    fs.copyFileSync(path.join(history,name,'migration.sql'),path.join(baselineRoot,name,'migration.sql'));
  }
  }
  report.migrationHistoryReconciliation = foundationOnly ? 'DEFERRED; baseline experiment skipped' : 'lab experiment only';
  for(const db of (foundationOnly ? ['lab_fresh','lab_clone'] : ['lab_fresh','lab_clone','lab_baseline'])){
    if(db==='lab_fresh'&&fresh.code!==0){report.scenarios[db]={passed:false,reason:'Blocked by unchanged historical migration failure'};continue;}
    const cfg=db==='lab_baseline'?baseConfig:config;
    const deployed=await prisma(db,cfg,['migrate','deploy']);save(db+'-candidate.log',deployed.output);
    report.scenarios[db]={passed:deployed.code===0,exitCode:deployed.code};check(db+' candidate deploy',deployed.code===0);
    if(deployed.code!==0)continue;
    const status=await prisma(db,cfg,['migrate','status']);save(db+'-status.log',status.output);check(db+' Prisma migration status',status.code===0);
    const diff=await prisma(db,cfg,['migrate','diff','--from-config-datasource','--to-schema',targetPath,'--exit-code']);save(db+'-schema-diff.log',diff.output);check(db+' matches target Prisma schema',diff.code===0);
    const client=await localClient(db);
    try{
      const owners=(await client.query(`SELECT count(*)::int n FROM "AgencyMember" WHERE role='OWNER' AND status='ACTIVE'`)).rows[0].n;
      if(db==='lab_clone'){
        check('six existing OWNER memberships',owners===6,{actual:owners});
        const preserved=(await client.query(`SELECT count(*)::int n FROM "AgencyProfile" a JOIN "AgencyMember" m
          ON m."agencyId"=a.id AND m."userId"=a."userId" AND m.role='OWNER' AND m.status='ACTIVE'
          WHERE a.id=a."userId"`)).rows[0].n;
        check('all six legacy identities map to their original ACTIVE OWNER',preserved===6);
        check('all original business rows unchanged',JSON.stringify(await fingerprints(client,sourceCat.tables,true))===JSON.stringify(sourceLegacy));
        const oldIds=sourceLedger.map(x=>JSON.parse(x).id);
        const restored=(await client.query('SELECT row_to_json(t)::text AS row FROM "_prisma_migrations" t WHERE id=ANY($1::varchar[])',[oldIds])).rows.map(x=>x.row);
        check('original migration ledger rows unchanged',hash([...restored].sort().join('\n'))===hash([...sourceLedger].sort().join('\n')));
      }
      const fks=(await client.query(`SELECT count(*)::int n FROM pg_constraint WHERE contype='f' AND confrelid='"AgencyProfile"'::regclass`)).rows[0].n;
      check(db+' agency FKs present',fks===13,{actual:fks});
      // Negative checks are rolled back; no persistent fixture data is deleted.
      await client.query('BEGIN');await client.query('SAVEPOINT negative');
      let rejected=false;
      try{await client.query(`INSERT INTO "AgencyMember" ("agencyId","userId",role) VALUES (gen_random_uuid(),gen_random_uuid(),'STAFF')`);}catch(e){rejected=e.code==='23503';}
      await client.query('ROLLBACK TO SAVEPOINT negative');check(db+' rejects orphan membership',rejected);
      const u=crypto.randomUUID(),a=crypto.randomUUID(),b=crypto.randomUUID();
      await client.query(`INSERT INTO "User" (id,email,"fullName",role,status,"updatedAt") VALUES ($1,$2,'Lab member','TRAVELER','ACTIVE',now())`,[u,'lab-'+u+'@example.invalid']);
      await client.query(`INSERT INTO "AgencyProfile" (id) VALUES ($1),($2)`,[a,b]);
      await client.query(`INSERT INTO "AgencyMember" ("agencyId","userId",role) VALUES ($1,$3,'ACCOUNTANT'),($2,$3,'STAFF')`,[a,b,u]);
      check(db+' traveler can join two independent agencies',(await client.query('SELECT role FROM "User" WHERE id=$1',[u])).rows[0].role==='TRAVELER');
      await client.query('SAVEPOINT duplicate');rejected=false;
      try{await client.query(`INSERT INTO "AgencyMember" ("agencyId","userId",role) VALUES ($1,$2,'STAFF')`,[a,u]);}catch(e){rejected=e.code==='23505';}
      await client.query('ROLLBACK TO SAVEPOINT duplicate');check(db+' rejects duplicate membership',rejected);
      async function expectRejected(name,sql,values,code){
        await client.query('SAVEPOINT boundary');let denied=false;
        try{await client.query(sql,values);}catch(e){denied=e.code===code;}
        await client.query('ROLLBACK TO SAVEPOINT boundary');check(db+' '+name,denied);
      }
      await expectRejected('rejects OWNER invitation',`INSERT INTO "AgencyInvitation" ("agencyId",email,role,"tokenHash","invitedByUserId","expiresAt") VALUES ($1,'lab@example.invalid','OWNER','lab-owner',$2,now()+interval '1 day')`,[a,u],'23514');
      await client.query(`INSERT INTO "AgencyInvitation" ("agencyId",email,role,"tokenHash","invitedByUserId","expiresAt") VALUES ($1,'lab@example.invalid','STAFF','lab-first',$2,now()+interval '1 day')`,[a,u]);
      await expectRejected('rejects duplicate pending invitation',`INSERT INTO "AgencyInvitation" ("agencyId",email,role,"tokenHash","invitedByUserId","expiresAt") VALUES ($1,'lab@example.invalid','STAFF','lab-second',$2,now()+interval '1 day')`,[a,u],'23505');
      await expectRejected('rejects business row without agency',`INSERT INTO "Tour" (id,"agencyId",title,destination,"durationDays","basePrice","updatedAt") VALUES (gen_random_uuid(),gen_random_uuid(),'Lab tour','Lab',1,1000,now())`,[],'23503');
      await client.query('ROLLBACK');
      const invalid=(await client.query(`SELECT count(*)::int n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND NOT c.convalidated`)).rows[0].n;
      check(db+' all constraints validated',invalid===0,{unvalidated:invalid});
      const invalidIndexes=(await client.query(`SELECT count(*)::int n FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (NOT i.indisvalid OR NOT i.indisready)`)).rows[0].n;
      check(db+' all indexes valid and ready',invalidIndexes===0,{invalid:invalidIndexes});
      save(db+'-catalog.json',await catalog(client));
    }finally{await client.end();}
  }
  const smoke = await run(process.execPath, [path.join(backend,'node_modules/tsx/dist/cli.mjs'),path.join(__dirname,'h2-smoke.mts')], {
    cwd:backend, env:{...process.env,NODE_ENV:'test',JOBS_ENABLED:'false',DATABASE_URL:localUrl('lab_fresh'),DATABASE_URL_UNPOOLED:localUrl('lab_fresh'),JWT_ACCESS_SECRET:'h2-isolated-access-secret',JWT_REFRESH_SECRET:'h2-isolated-refresh-secret',CLIENT_URL:'http://localhost:3000',BREVO_API_KEY:'',SMTP_HOST:'',PAYOS_CLIENT_ID:'',PAYOS_API_KEY:'',PAYOS_CHECKSUM_KEY:''}
  });
  save('h2-smoke.log',smoke.output); check('H2 API and authentication smoke suite',smoke.code===0);
  const h27 = await run(process.execPath, [path.join(backend,'node_modules/tsx/dist/cli.mjs'),path.join(__dirname,'h27-smoke.mts')], {
    cwd:backend, env:{...process.env,NODE_ENV:'test',JOBS_ENABLED:'false',DATABASE_URL:localUrl('lab_fresh'),DATABASE_URL_UNPOOLED:localUrl('lab_fresh'),JWT_ACCESS_SECRET:'h2-isolated-access-secret',JWT_REFRESH_SECRET:'h2-isolated-refresh-secret',CLIENT_URL:'http://localhost:3000',BREVO_API_KEY:'',SMTP_HOST:'',PAYOS_CLIENT_ID:'',PAYOS_API_KEY:'',PAYOS_CHECKSUM_KEY:''}
  });
  save('h27-smoke.log',h27.output); check('H2.7 notification revocation and transfer quarantine suite',h27.code===0);
  check('historical migration files byte-for-byte unchanged',JSON.stringify(historyHashes())===JSON.stringify(originalHashes));
}

main().catch(e=>{report.fatal={code:e.code||e.name,message:e.message};console.error('Lab failed: '+(e.code||e.name));process.exitCode=1;}).finally(async()=>{
  if(server&&native&&runRoot){const stopped=await run(path.join(native,'pg_ctl.exe'),['-D',path.join(runRoot,'data'),'-m','fast','-w','stop']);save('stop.log',stopped.output);report.serverStopped=stopped.code===0;}
  report.passed=!report.fatal&&report.checks.every(x=>x.passed);
  if(runRoot)save('report.json',report);
  console.log('Result: '+(report.passed?'PASS':'NOT READY')+'; artifacts retained');
  if(!report.passed)process.exitCode=1;
});
