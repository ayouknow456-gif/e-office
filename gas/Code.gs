/**
 * E-OFFICE Full Workflow Backend — Google Sheets only.
 * Keep this project bound to the target spreadsheet. No Drive API is used.
 *
 * IMPORTANT SECURITY:
 * This starter still uses JSONP GET for compatibility with GitHub Pages.
 * It is not suitable for confidential/personally identifiable government records.
 * Before production, move authentication to a trusted server-side identity layer
 * and restrict Web App access to the organization's Google Workspace.
 */
const EO = {
  NAME: 'E-OFFICE FULL WORKFLOW API',
  VERSION: '2.0.0',
  TZ: 'Asia/Bangkok',
  MAX_CELL: 45000,
  CHUNK: 800,
  TABLES: {
    Documents: ['id','documentNo','subject','detail','type','date','to','reference','attachment','signer','position','phone','bodyHtml','status','createdAt','updatedAt'],
    Profiles: ['id','profileJson','updatedAt'],
    Assets: ['assetId','kind','name','mimeType','chunkIndex','chunkData','totalLength','updatedAt'],
    AuditLogs: ['id','action','module','recordId','actor','detail','createdAt'],
    Incoming: ['id','dataJson','createdAt','updatedAt'],
    Outgoing: ['id','dataJson','createdAt','updatedAt'],
    Tasks: ['id','dataJson','createdAt','updatedAt'],
    Workflows: ['id','dataJson','createdAt','updatedAt'],
    Users: ['id','dataJson','createdAt','updatedAt'],
    Notifications: ['id','dataJson','createdAt','updatedAt'],
    Settings: ['id','dataJson','createdAt','updatedAt'],
    Sequences: ['id','dataJson','createdAt','updatedAt']
  }
};

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('กรุณาเปิด Apps Script จาก Google Sheets ฐานข้อมูล');
  Object.keys(EO.TABLES).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = EO.TABLES[name];
    if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
    else {
      const existing = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
      // Safe additive migration for the v1.1 AuditLogs table.
      if (name === 'AuditLogs' && existing.join('|') === 'id|action|recordId|detail|createdAt') {
        const oldRows = sh.getLastRow() > 1 ? sh.getRange(2,1,sh.getLastRow()-1,5).getValues() : [];
        sh.clearContents();
        sh.getRange(1,1,1,headers.length).setValues([headers]);
        if (oldRows.length) {
          const migrated = oldRows.map(r => [r[0],r[1],'',r[2],'',r[3],r[4]]);
          sh.getRange(2,1,migrated.length,headers.length).setValues(migrated);
        }
      } else if (existing.join('|') !== headers.join('|')) {
        throw new Error('โครงสร้างชีต ' + name + ' ไม่ตรงกับรุ่น 2.0 กรุณาสำรองข้อมูลและตรวจสอบก่อนปรับโครงสร้าง');
      }
    }
    sh.setFrozenRows(1);
  });
  PropertiesService.getScriptProperties().setProperty('EO_DATABASE_ID', ss.getId());
  return {success:true, version:EO.VERSION, spreadsheetId:ss.getId(), tables:Object.keys(EO.TABLES)};
}

function upgradeSheetsV2() { return setupSheets(); }

function setApiKeyOnce() {
  const key = 'REPLACE_WITH_A_LONG_RANDOM_KEY';
  if (key.indexOf('REPLACE_') === 0) throw new Error('แก้ค่า key ก่อนเรียกฟังก์ชันนี้');
  PropertiesService.getScriptProperties().setProperty('EO_API_KEY', key);
}

function doGet(e) {
  const p = e && e.parameter || {};
  const callback = String(p.callback || '');
  let result;
  try {
    authorize_(p.key);
    const payload = p.payload ? JSON.parse(p.payload) : {};
    result = {success:true, data:dispatch_(String(p.action || 'health'), payload)};
  } catch (err) {
    result = {success:false, error:String(err && err.message || err)};
  }
  const body = callback && /^[A-Za-z_$][\w$]*$/.test(callback)
    ? callback + '(' + JSON.stringify(result) + ');'
    : JSON.stringify(result);
  return ContentService.createTextOutput(body).setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function dispatch_(a,p) {
  switch(a) {
    case 'health': return {app:EO.NAME,version:EO.VERSION,status:'ONLINE',time:now_(),database:!!db_(),modules:Object.keys(EO.TABLES)};
    case 'getProfile': return getProfile_();
    case 'saveProfile': return saveProfile_(p.profile||{});
    case 'listDocuments': return listDocuments_();
    case 'getDocument': return getDocument_(p.id);
    case 'saveDocument': return saveDocument_(p.document||{});
    case 'deleteDocument': return deleteDocument_(p.id);
    case 'assetStart': return assetStart_(p);
    case 'assetChunk': return assetChunk_(p);
    case 'assetFinish': return assetFinish_(p);
    case 'dashboard': return dashboard_();
    case 'listModule': return listModule_(p.module,p.filters||{});
    case 'saveModule': return saveModule_(p.module,p.record||{});
    case 'deleteModule': return deleteModule_(p.module,p.id);
    case 'nextDocumentNumber': return nextDocumentNumber_(p.kind,p.year);
    case 'listAudit': return listAudit_(p.limit);
    case 'exportModule': return listModule_(p.module,{});
    default: throw new Error('ไม่รู้จัก API: '+a);
  }
}

function authorize_(provided) {
  const required=PropertiesService.getScriptProperties().getProperty('EO_API_KEY');
  if(required && String(provided||'')!==required) throw new Error('API key ไม่ถูกต้อง');
}
function db_() {
  const id=PropertiesService.getScriptProperties().getProperty('EO_DATABASE_ID');
  if(!id) throw new Error('ยังไม่ได้ติดตั้งฐานข้อมูล กรุณารัน setupSheets()');
  return SpreadsheetApp.openById(id);
}
function sheet_(name) {
  if(!EO.TABLES[name]) throw new Error('ไม่อนุญาตให้เข้าถึงตารางนี้');
  const sh=db_().getSheetByName(name);
  if(!sh) throw new Error('ไม่พบชีต '+name+' กรุณารัน setupSheets()');
  return sh;
}
function now_(){return Utilities.formatDate(new Date(),EO.TZ,"yyyy-MM-dd'T'HH:mm:ss.SSSXXX");}
function id_(){return Utilities.getUuid();}
function actor_(){try{return Session.getActiveUser().getEmail()||'ไม่ทราบผู้ใช้';}catch(e){return 'ไม่ทราบผู้ใช้';}}
function audit_(action,module,recordId,detail){
  sheet_('AuditLogs').appendRow([id_(),action,module||'',recordId||'',actor_(),String(detail||'').slice(0,2000),now_()]);
}
function rows_(name){
  const v=sheet_(name).getDataRange().getValues();
  if(v.length<2)return [];
  const h=v.shift();
  return v.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])));
}
function findRow_(name,key,value){
  const sh=sheet_(name),v=sh.getDataRange().getValues(),h=v[0]||[],c=h.indexOf(key);
  if(c<0)throw new Error('Missing key column '+key);
  for(let r=1;r<v.length;r++)if(String(v[r][c])===String(value))return r+1;
  return 0;
}
function getProfile_(){
  const row=findRow_('Profiles','id','default');let profile={};
  if(row)profile=JSON.parse(sheet_('Profiles').getRange(row,2).getValue()||'{}');
  profile.seals=(profile.seals||[]).map(a=>({...a,dataUrl:assetData_(a.id,'seals')}));
  profile.garudas=(profile.garudas||[]).map(a=>({...a,dataUrl:assetData_(a.id,'garudas')}));
  return profile;
}
function saveProfile_(profile){
  const clean={...profile,seals:(profile.seals||[]).map(({dataUrl,...a})=>a),garudas:(profile.garudas||[]).map(({dataUrl,...a})=>a)};
  const json=JSON.stringify(clean);if(json.length>EO.MAX_CELL)throw new Error('ข้อมูลโปรไฟล์เกินขนาดที่รองรับ');
  const sh=sheet_('Profiles'),row=findRow_('Profiles','id','default');
  if(row)sh.getRange(row,2,1,2).setValues([[json,now_()]]);else sh.appendRow(['default',json,now_()]);
  audit_('UPDATE','Profiles','default','แก้ไขข้อมูลหน่วยงาน');return {saved:true};
}
function listDocuments_(){return rows_('Documents').map(d=>({...d,id:String(d.id)})).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}
function getDocument_(id){const d=rows_('Documents').find(x=>String(x.id)===String(id));if(!d)throw new Error('ไม่พบเอกสาร');return d;}
function saveDocument_(doc){
  if(!String(doc.subject||'').trim())throw new Error('กรุณาระบุชื่อเรื่อง');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const sh=sheet_('Documents'),id=String(doc.id||id_()),row=findRow_('Documents','id',id),old=row?getDocument_(id):null;
    const record={id,documentNo:String(doc.documentNo||''),subject:String(doc.subject||''),detail:String(doc.detail||''),type:String(doc.type||'external'),date:String(doc.date||''),to:String(doc.to||''),reference:String(doc.reference||''),attachment:String(doc.attachment||''),signer:String(doc.signer||''),position:String(doc.position||''),phone:String(doc.phone||''),bodyHtml:String(doc.bodyHtml||''),status:String(doc.status||'DRAFT'),createdAt:old?old.createdAt:now_(),updatedAt:now_()};
    const vals=EO.TABLES.Documents.map(k=>record[k]??'');if(vals.some(v=>String(v).length>EO.MAX_CELL))throw new Error('ข้อมูลช่องใดช่องหนึ่งยาวเกินขีดจำกัด');
    if(row)sh.getRange(row,1,1,vals.length).setValues([vals]);else sh.appendRow(vals);
    audit_(old?'UPDATE':'CREATE','Documents',id,record.subject);return record;
  }finally{lock.releaseLock();}
}
function deleteDocument_(id){
  const row=findRow_('Documents','id',id);if(!row)throw new Error('ไม่พบเอกสาร');
  sheet_('Documents').deleteRow(row);audit_('DELETE','Documents',id,'ลบเอกสาร');return {deleted:true};
}

/** Generic structured modules: incoming, outgoing, tasks, workflows, users, notifications, settings. */
const MODULES_={incoming:'Incoming',outgoing:'Outgoing',tasks:'Tasks',workflows:'Workflows',users:'Users',notifications:'Notifications',settings:'Settings',sequences:'Sequences'};
function moduleSheet_(module){const name=MODULES_[String(module||'').toLowerCase()];if(!name)throw new Error('โมดูลไม่ถูกต้อง');return name;}
function listModule_(module,filters){
  const name=moduleSheet_(module);
  return rows_(name).map(r=>{let d={};try{d=JSON.parse(r.dataJson||'{}');}catch(e){}return {...d,id:String(r.id),createdAt:r.createdAt,updatedAt:r.updatedAt};})
    .filter(r=>Object.keys(filters||{}).every(k=>!filters[k]||String(r[k]||'').toLowerCase().includes(String(filters[k]).toLowerCase())))
    .sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
function saveModule_(module,record){
  const name=moduleSheet_(module),lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const sh=sheet_(name),id=String(record.id||id_()),row=findRow_(name,'id',id),old=row?rows_(name).find(r=>String(r.id)===id):null;
    const clean={...record,id};delete clean.createdAt;delete clean.updatedAt;
    const json=JSON.stringify(clean);if(json.length>EO.MAX_CELL)throw new Error('ข้อมูลมีขนาดเกินขีดจำกัด Google Sheets');
    const created=old?old.createdAt:now_(),updated=now_(),vals=[id,json,created,updated];
    if(row)sh.getRange(row,1,1,4).setValues([vals]);else sh.appendRow(vals);
    audit_(old?'UPDATE':'CREATE',name,id,String(clean.subject||clean.title||clean.name||clean.status||'บันทึกรายการ'));
    if(module==='incoming'&&(!old||old.status!==clean.status))notify_('หนังสือรับ',`มีการปรับปรุงรายการ ${clean.registerNo||clean.subject||id}`,clean.assignee||'');
    return {...clean,createdAt:created,updatedAt:updated};
  }finally{lock.releaseLock();}
}
function deleteModule_(module,id){
  const name=moduleSheet_(module),row=findRow_(name,'id',id);if(!row)throw new Error('ไม่พบรายการ');
  sheet_(name).deleteRow(row);audit_('DELETE',name,id,'ลบรายการ');return {deleted:true};
}
function notify_(title,message,recipient){
  sheet_('Notifications').appendRow([id_(),JSON.stringify({title,message,recipient,status:'UNREAD'}),now_(),now_()]);
}
function dashboard_(){
  const incoming=listModule_('incoming',{}),outgoing=listModule_('outgoing',{}),tasks=listModule_('tasks',{}),workflows=listModule_('workflows',{});
  const docs=listDocuments_();
  return {documents:docs.length,incoming:incoming.length,outgoing:outgoing.length,tasksOpen:tasks.filter(x=>!['DONE','CANCELLED'].includes(x.status)).length,workflowsPending:workflows.filter(x=>['PENDING','IN_REVIEW'].includes(x.status)).length,
    incomingRecent:incoming.slice(0,5),outgoingRecent:outgoing.slice(0,5),tasksRecent:tasks.slice(0,5)};
}
function nextDocumentNumber_(kind,year){
  const k=String(kind||'outgoing'),y=String(year||new Date().getFullYear()+543),id=k+'-'+y;
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const sh=sheet_('Sequences'),row=findRow_('Sequences','id',id);let n=1;
    if(row){const obj=JSON.parse(sh.getRange(row,2).getValue()||'{}');n=Number(obj.next||1);}
    const obj={kind:k,year:y,next:n+1};if(row)sh.getRange(row,2,1,3).setValues([[JSON.stringify(obj),row?sh.getRange(row,3).getValue():now_(),now_()]]);else sh.appendRow([id,JSON.stringify(obj),now_(),now_()]);
    audit_('NUMBER','Sequences',id,'ออกเลขลำดับ '+n);
    return {number:String(n).padStart(4,'0')+'/'+y,sequence:n,kind:k,year:y};
  }finally{lock.releaseLock();}
}
function listAudit_(limit){return rows_('AuditLogs').slice(-Math.min(Number(limit)||100,500)).reverse();}

function assetStart_(p){
  if(!p.id||!['seals','garudas'].includes(p.kind))throw new Error('ข้อมูลภาพไม่ถูกต้อง');
  const sh=sheet_('Assets'),v=sh.getDataRange().getValues();
  for(let r=v.length-1;r>=1;r--)if(String(v[r][0])===String(p.id)&&String(v[r][1])===String(p.kind))sh.deleteRow(r+1);
  sh.appendRow([String(p.id),p.kind,String(p.name||''),String(p.type||'image/png'),-1,'',0,now_()]);return {started:true};
}
function assetChunk_(p){
  if(!p.id||!['seals','garudas'].includes(p.kind)||!Number.isInteger(Number(p.index)))throw new Error('ข้อมูลชิ้นภาพไม่ถูกต้อง');
  const chunk=String(p.chunk||'');if(chunk.length>EO.CHUNK+100)throw new Error('ชิ้นภาพใหญ่เกินกำหนด');
  sheet_('Assets').appendRow([String(p.id),p.kind,'','',Number(p.index),chunk,0,now_()]);return {chunkSaved:true,index:Number(p.index)};
}
function assetFinish_(p){
  const sh=sheet_('Assets'),v=sh.getDataRange().getValues();let meta=0,chunks=[];
  for(let i=1;i<v.length;i++)if(String(v[i][0])===String(p.id)&&String(v[i][1])===String(p.kind)){if(Number(v[i][4])===-1)meta=i+1;else chunks.push({index:Number(v[i][4]),data:String(v[i][5]||'')});}
  if(!meta)throw new Error('ไม่พบข้อมูลเริ่มต้นของภาพ');chunks.sort((a,b)=>a.index-b.index);
  const total=chunks.reduce((n,c)=>n+c.data.length,0);if(total!==Number(p.total))throw new Error('ข้อมูลภาพไม่ครบ');
  sh.getRange(meta,7).setValue(total);return {finished:true,total};
}
function assetData_(assetId,kind){
  const all=rows_('Assets'),parts=all.filter(x=>String(x.assetId)===String(assetId)&&String(x.kind)===String(kind)&&Number(x.chunkIndex)>=0).sort((a,b)=>Number(a.chunkIndex)-Number(b.chunkIndex));
  if(!parts.length)return '';const meta=all.find(x=>String(x.assetId)===String(assetId)&&String(x.kind)===String(kind)&&Number(x.chunkIndex)===-1);
  return 'data:'+(meta&&meta.mimeType||'image/png')+';base64,'+parts.map(x=>x.chunkData).join('');
}
