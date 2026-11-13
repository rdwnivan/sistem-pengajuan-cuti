import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { get, put, list } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const phase = process.argv[2];
const prefix = 'security-rollout/2026-11-13/';
const token = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
const oldToken = process.env.BLOB_READ_WRITE_TOKEN;
const digest = b => createHash('sha256').update(b).digest('hex');
const quote = s => '"' + s.replaceAll('"','""') + '"';
const publicBlob = s => /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(s);
async function readPrivate(name) {
 const result = await get(prefix+name,{token,access:'private',useCache:false});
 if (!result) return null;
 if(result.statusCode!==200) throw Error('PRIVATE_READ');
 return Buffer.from(await new Response(result.stream).arrayBuffer());
}
async function writePrivate(name,bytes) {await put(prefix+name,bytes,{token,access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',cacheControlMaxAge:60});}
async function inventory() {
 const u=new URL(process.env.DATABASE_URL);u.hostname=u.hostname.replace('-pooler.','.');
 const c=new Client({connectionString:u.toString(),connectionTimeoutMillis:15000});await c.connect();
 let names;try{names=(await c.query("SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate ORDER BY datname")).rows.map(r=>r.datname);}finally{await c.end();}
 const result=[];
 for(const database of names){
  const url=new URL(u);url.pathname='/'+database;const db=new Client({connectionString:url.toString(),connectionTimeoutMillis:15000});await db.connect();
  try{
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const columns=(await db.query("SELECT table_schema,table_name,column_name FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') AND column_name IN ('lampiranPath','path') ORDER BY table_schema,table_name,column_name")).rows;
   const references=[];
   for(const col of columns){
    if(!['Pengajuan','LaporanLapangan','LaporanFoto'].includes(col.table_name))throw Error('UNKNOWN_FILE_CONSUMER');
    const rows=(await db.query('SELECT id,'+quote(col.column_name)+' AS reference FROM '+quote(col.table_schema)+'.'+quote(col.table_name)+' WHERE '+quote(col.column_name)+' IS NOT NULL')).rows;
    references.push(...rows.map(r=>({...col,...r})));
   }
   result.push({database,schemas:[...new Set(columns.map(c=>c.table_schema))],references});await db.query('COMMIT');
  }finally{await db.end();}
 }
 return result;
}
async function main(){
 if(!['dry-run','copy','revoke'].includes(phase)||process.env.VERCEL_ENV!=='production'||!token||!oldToken)throw Error('ENVIRONMENT_GATE');
 if(new URL(process.env.DATABASE_URL).pathname!=='/neondb')throw Error('DATABASE_GATE');
 const initial=await inventory();
 console.log(JSON.stringify({phase,inventory:initial.map(d=>({database:d.database,schemas:d.schemas,publicReferences:d.references.filter(r=>publicBlob(r.reference)).length}))}));
 const foreign=initial.filter(d=>d.database!=='neondb').flatMap(d=>d.references).filter(r=>publicBlob(r.reference));
 if(foreign.length)throw Error('OTHER_DATABASE_PUBLIC_REFERENCES');
 const blobs=[];let cursor;
 do{const page=await list({token:oldToken,limit:1000,cursor});blobs.push(...page.blobs);cursor=page.hasMore?page.cursor:undefined;}while(cursor);
 const scope=blobs.filter(b=>/^(lampiran|laporan|laporan-foto)\//.test(b.pathname));
 console.log(JSON.stringify({publicInventory:blobs.length,attachmentInventory:scope.length,outsideAttachmentPrefixes:blobs.length-scope.length}));
 let manifestBytes=await readPrivate('manifest.json');
 if(!manifestBytes){
  if(phase!=='dry-run')throw Error('DRY_RUN_REQUIRED');
  const files=[];
  for(const b of scope){const res=await fetch(b.url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});if(res.status!==200)throw Error('ORIGINAL_NOT_READABLE');const bytes=Buffer.from(await res.arrayBuffer());files.push({source:b.url,pathname:b.pathname,bytes:bytes.length,sha256:digest(bytes),beforeStatus:200});}
  manifestBytes=Buffer.from(JSON.stringify({database:'neondb',createdAt:new Date().toISOString(),inventory:initial,files}));
  await writePrivate('manifest.json',manifestBytes);
 }
 const manifest=JSON.parse(manifestBytes);
 if(manifest.database!=='neondb'||!Array.isArray(manifest.files))throw Error('MANIFEST_GATE');
 if(phase!=='revoke'&&scope.some(b=>!manifest.files.some(f=>f.source===b.url)))throw Error('NEW_PUBLIC_FILE_REQUIRES_REVIEW');
 fs.mkdirSync('.private',{recursive:true});
 const journalPath=path.join('.private','production.json');const journalBytes=await readPrivate('production.json');
 if(journalBytes)fs.writeFileSync(journalPath,journalBytes,{mode:0o600});
 const args=['node_modules/tsx/dist/cli.mjs','scripts/migrate-attachments.ts','--journal-name=production.json'];
 if(phase!=='dry-run')args.push('--apply');
 if(phase==='revoke'){
  const remaining=initial.flatMap(d=>d.references).filter(r=>manifest.files.some(f=>f.source===r.reference));
  if(remaining.length)throw Error('SHARED_REFERENCES_REMAIN');
  args.push('--revoke-old','--exclusive-storage');
 }
 let run;
 try{run=spawnSync(process.execPath,args,{env:process.env,encoding:'utf8',timeout:300000});
  // Migrator emits only count summaries and a fixed failure marker.
  process.stdout.write(run.stdout||'');if(run.status!==0)throw Error('MIGRATOR_FAILED');
 }finally{if(fs.existsSync(journalPath))await writePrivate('production.json',fs.readFileSync(journalPath));}
 const after=await inventory();
 const journal=fs.existsSync(journalPath)?JSON.parse(fs.readFileSync(journalPath,'utf8')):{entries:[]};
 const checks=[];
 for(const entry of journal.entries){
  const original=manifest.files.find(f=>f.source===entry.source);if(!original||entry.sha256!==original.sha256)throw Error('ORIGINAL_DIGEST_MISMATCH');
  const copied=await get(entry.destination,{token,access:'private',useCache:false});if(!copied||copied.statusCode!==200)throw Error('COPY_NOT_READABLE');
  const hash=digest(Buffer.from(await new Response(copied.stream).arrayBuffer()));if(hash!==original.sha256)throw Error('COPY_DIGEST_MISMATCH');
  const res=await fetch(entry.source,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(phase==='revoke'&&![403,404,410].includes(res.status))throw Error('REVOCATION_NOT_VERIFIED');
  checks.push({sourceSha256:digest(entry.source),bytes:original.bytes,contentSha256:hash,originalStatus:original.beforeStatus,oldStatus:res.status,migrated:entry.migrated,revoked:entry.done});
 }
 const summary={phase,publicReferencesAfter:after.flatMap(d=>d.references).filter(r=>publicBlob(r.reference)).length,checks,unreferencedPublicFilesRetained:scope.filter(b=>!journal.entries.some(e=>e.source===b.url)).length};
 await writePrivate('result-'+phase+'.json',Buffer.from(JSON.stringify({summary,inventory:after})));
 console.log(JSON.stringify(summary));
}
main().catch(()=>{console.error('[SECURITY-RELEASE-FAILED] Check managed configuration and private rollout journal. No credential or raw attachment URL is logged.');process.exitCode=1;});
