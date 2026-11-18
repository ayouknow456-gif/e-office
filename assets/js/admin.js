/* E-OFFICE v2.0 administrative modules — requires configured GAS connection. */
(function(){
  const $=id=>document.getElementById(id);
  const modules={
    incoming:{title:'ทะเบียนหนังสือรับ',desc:'ลงทะเบียนหนังสือที่หน่วยงานได้รับ',fields:[['registerNo','เลขทะเบียนรับ'],['receivedDate','วันที่รับ','date'],['documentDate','วันที่หนังสือ','date'],['sender','จากหน่วยงาน'],['subject','เรื่อง'],['category','ประเภทหนังสือ'],['priority','ชั้นความเร็ว'],['assignee','ผู้รับผิดชอบ'],['dueDate','กำหนดดำเนินการ','date'],['status','สถานะ','select','RECEIVED|กำลังดำเนินการ|COMPLETED|เสร็จสิ้น'],['note','หมายเหตุ','textarea']]},
    outgoing:{title:'ทะเบียนหนังสือส่ง',desc:'จัดทำทะเบียนหนังสือที่ส่งออกจากหน่วยงาน',fields:[['registerNo','เลขทะเบียนส่ง'],['documentNo','เลขที่หนังสือ'],['sendDate','วันที่ส่ง','date'],['recipient','ส่งถึง'],['subject','เรื่อง'],['channel','ช่องทางส่ง'],['trackingNo','เลขติดตาม'],['signer','ผู้ลงนาม'],['status','สถานะ','select','DRAFT|รอลงนาม|SENT|ส่งแล้ว'],['note','หมายเหตุ','textarea']]},
    tasks:{title:'งานมอบหมาย',desc:'กำหนดผู้รับผิดชอบ วันครบกำหนด และติดตามผล',fields:[['title','ชื่องาน'],['description','รายละเอียด','textarea'],['assignee','ผู้รับผิดชอบ'],['assignedBy','ผู้มอบหมาย'],['startDate','วันที่เริ่ม','date'],['dueDate','กำหนดเสร็จ','date'],['priority','ความสำคัญ','select','ปกติ|ด่วน|ด่วนมาก'],['status','สถานะ','select','OPEN|IN_PROGRESS|WAITING|DONE|CANCELLED'],['result','ผลการดำเนินงาน','textarea']]},
    workflows:{title:'เสนอและอนุมัติ',desc:'ติดตามลำดับเสนอ ตรวจสอบ อนุมัติ และส่งกลับแก้ไข',fields:[['subject','เรื่อง'],['documentNo','เลขที่หนังสือ'],['requester','ผู้เสนอ'],['reviewer','ผู้ตรวจ'],['approver','ผู้อนุมัติ'],['step','ขั้นตอนปัจจุบัน'],['status','สถานะ','select','PENDING|IN_REVIEW|APPROVED|REJECTED|REVISION'],['comment','ความเห็น','textarea'],['actionDate','วันที่ดำเนินการ','date']]},
    users:{title:'ผู้ใช้งานและบทบาท',desc:'ทะเบียนบัญชีและบทบาทที่หน่วยงานกำหนด (ยังไม่ใช่ระบบล็อกอินที่ปลอดภัย)',fields:[['name','ชื่อ–นามสกุล'],['email','อีเมล'],['department','กลุ่มงาน/ฝ่าย'],['role','บทบาท','select','ADMIN|EXECUTIVE|OFFICER|VIEWER'],['status','สถานะ','select','ACTIVE|DISABLED'],['note','หมายเหตุ','textarea']]},
    notifications:{title:'การแจ้งเตือน',desc:'บันทึกการแจ้งเตือนภายในระบบ',fields:[['title','หัวข้อ'],['message','ข้อความ','textarea'],['recipient','ผู้รับ'],['status','สถานะ','select','UNREAD|READ']]},
    settings:{title:'ตั้งค่าระบบ',desc:'จัดเก็บค่ากำหนดเพิ่มเติมของหน่วยงาน',fields:[['key','รหัสการตั้งค่า'],['value','ค่า','textarea'],['description','คำอธิบาย','textarea']]},
    audit:{title:'ประวัติการใช้งาน',desc:'ตรวจสอบรายการสร้าง แก้ไข ลบ และออกเลขทะเบียน',fields:[]}
  };
  let active='incoming', cache={};
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function toast(s){const el=$('toast');if(el){el.textContent=s;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2800);}else alert(s);}
  function connected(){return window.EOGAS&&window.EOGAS.config().url;}
  function inject(){
    const nav=document.querySelector('.nav-list');
    if(!nav)return;
    const group=document.createElement('div');group.className='eo-admin-nav';group.innerHTML='<div class="workspace-label">OFFICE OPERATIONS</div>'+
      Object.entries(modules).map(([k,v])=>`<button class="nav-item eo-module-nav" data-module="${k}"><span class="nav-icon">${({incoming:'↙',outgoing:'↗',tasks:'☷',workflows:'✓',users:'♙',notifications:'♢',settings:'⚙',audit:'≡'})[k]}</span><span>${v.title}</span></button>`).join('');
    nav.appendChild(group);
    const main=document.querySelector('.main-area');
    const section=document.createElement('section');section.className='view eo-module-view';section.id='view-eo-module';section.innerHTML=`
      <div class="page-heading"><div><span class="eyebrow">OFFICE OPERATIONS</span><h1 id="eoModuleTitle">ทะเบียนหนังสือรับ</h1><p id="eoModuleDesc"></p></div><div class="eo-actions"><button class="secondary-button" id="eoRefresh">รีเฟรช</button><button class="primary-button" id="eoAdd">＋ เพิ่มรายการ</button></div></div>
      <div class="eo-module-toolbar"><input id="eoSearch" placeholder="ค้นหาเรื่อง เลขทะเบียน หรือผู้รับผิดชอบ"><button class="secondary-button" id="eoExport">ส่งออก CSV</button><button class="secondary-button" id="eoNextNo">ออกเลขลำดับถัดไป</button></div>
      <div class="content-card"><div class="table-wrap"><table class="eo-data-table"><thead id="eoHead"></thead><tbody id="eoRows"><tr><td>กำลังโหลด...</td></tr></tbody></table></div></div>
      <p class="eo-security-note">ข้อมูลจัดเก็บใน Google Sheets ผ่าน GAS · ตรวจสอบสิทธิ์และความถูกต้องก่อนบันทึก · รุ่นนี้ยังไม่เหมาะกับเอกสารลับหรือข้อมูลส่วนบุคคลจริง</p>
      <dialog id="eoDialog" class="eo-dialog"><form id="eoForm" method="dialog"><div class="eo-dialog-head"><h2 id="eoFormTitle">เพิ่มรายการ</h2><button type="button" class="icon-button" id="eoClose">✕</button></div><div id="eoFields" class="eo-fields"></div><div class="eo-dialog-actions"><button type="button" class="secondary-button" id="eoCancel">ยกเลิก</button><button type="submit" class="primary-button">บันทึกข้อมูล</button></div></form></dialog>`;
    main.appendChild(section);
    document.addEventListener('click',e=>{
      const b=e.target.closest('.eo-module-nav');if(b){e.preventDefault();openModule(b.dataset.module);}
      const a=e.target.closest('[data-eo-edit]');if(a)editRecord(a.dataset.eoEdit);
      const d=e.target.closest('[data-eo-delete]');if(d)removeRecord(d.dataset.eoDelete);
    });
    $('eoRefresh').onclick=load;
    $('eoAdd').onclick=()=>showForm({});
    $('eoClose').onclick=$('eoCancel').onclick=()=>$('eoDialog').close();
    $('eoForm').onsubmit=saveForm;
    $('eoSearch').oninput=renderRows;
    $('eoExport').onclick=exportCsv;
    $('eoNextNo').onclick=nextNo;
  }
  function openModule(key){
    active=key;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    $('view-eo-module').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.module===key));
    $('eoModuleTitle').textContent=modules[key].title;$('eoModuleDesc').textContent=modules[key].desc;
    const crumb=$('breadcrumbCurrent');if(crumb)crumb.textContent=modules[key].title;
    const sidebar=$('sidebar');if(sidebar)sidebar.classList.remove('open');
    $('eoAdd').hidden=key==='audit';$('eoNextNo').hidden=!['incoming','outgoing'].includes(key);
    $('eoSearch').value='';load();window.scrollTo({top:0,behavior:'smooth'});
  }
  async function call(action,payload){
    if(!connected())throw new Error('กรุณาเชื่อมต่อ GAS URL ในเมนูตั้งค่าหน่วยงานก่อน');
    const r=await window.EOGAS.call(action,payload||{});return r.data;
  }
  async function load(){
    $('eoRows').innerHTML='<tr><td>กำลังโหลดข้อมูล...</td></tr>';
    try{
      cache[active]=active==='audit'?await call('listAudit',{limit:300}):await call('listModule',{module:active});
      renderRows();
    }catch(e){$('eoRows').innerHTML=`<tr><td class="empty-cell">${esc(e.message)}</td></tr>`;}
  }
  function renderRows(){
    const rows=cache[active]||[],q=($('eoSearch').value||'').toLowerCase();
    const fields=modules[active].fields;
    const cols=active==='audit'?['action','module','recordId','actor','detail','createdAt']:fields.map(f=>f[0]);
    const labels=active==='audit'?['การกระทำ','โมดูล','รหัสรายการ','ผู้ดำเนินการ','รายละเอียด','เวลา']:fields.map(f=>f[1]);
    $('eoHead').innerHTML='<tr>'+labels.map(x=>`<th>${esc(x)}</th>`).join('')+(active==='audit'?'':'<th>จัดการ</th>')+'</tr>';
    const visible=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
    $('eoRows').innerHTML=visible.length?visible.map(r=>'<tr>'+cols.map(k=>`<td>${esc(r[k]||'—')}</td>`).join('')+(active==='audit'?'':`<td class="eo-row-actions"><button class="row-action" data-eo-edit="${esc(r.id)}">แก้ไข</button><button class="row-action danger" data-eo-delete="${esc(r.id)}">ลบ</button></td>`)+'</tr>').join(''):`<tr><td colspan="${cols.length+1}" class="empty-cell">ยังไม่มีรายการ</td></tr>`;
  }
  function showForm(record){
    $('eoFormTitle').textContent=record.id?'แก้ไขรายการ':'เพิ่ม'+modules[active].title;
    $('eoFields').innerHTML=modules[active].fields.map(([k,label,type,opts])=>{
      const val=record[k]??'';
      if(type==='textarea')return `<label>${esc(label)}<textarea name="${k}" rows="3">${esc(val)}</textarea></label>`;
      if(type==='select')return `<label>${esc(label)}<select name="${k}">${String(opts||'').split('|').map(x=>`<option value="${esc(x)}" ${x===val?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`;
      return `<label>${esc(label)}<input name="${k}" type="${type==='date'?'date':'text'}" value="${esc(val)}"></label>`;
    }).join('');
    $('eoForm').dataset.recordId=record.id||'';$('eoDialog').showModal();
  }
  function editRecord(id){const r=(cache[active]||[]).find(x=>String(x.id)===String(id));if(r)showForm(r);}
  async function saveForm(e){
    e.preventDefault();const record={id:$('eoForm').dataset.recordId||undefined};
    new FormData($('eoForm')).forEach((v,k)=>record[k]=v);
    try{await call('saveModule',{module:active,record});$('eoDialog').close();toast('บันทึกข้อมูลแล้ว');await load();}
    catch(err){toast('บันทึกไม่สำเร็จ: '+err.message);}
  }
  async function removeRecord(id){
    if(!confirm('ยืนยันลบรายการนี้?'))return;
    try{await call('deleteModule',{module:active,id});toast('ลบรายการแล้ว');await load();}catch(e){toast(e.message);}
  }
  async function nextNo(){
    try{const r=await call('nextDocumentNumber',{kind:active,year:new Date().getFullYear()+543});toast('เลขลำดับถัดไป: '+r.number);}
    catch(e){toast(e.message);}
  }
  function exportCsv(){
    const rows=cache[active]||[];if(!rows.length){toast('ไม่มีข้อมูลส่งออก');return;}
    const keys=active==='audit'?['action','module','recordId','actor','detail','createdAt']:modules[active].fields.map(f=>f[0]);
    const csv=[keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`eoffice-${active}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  }
  window.addEventListener('DOMContentLoaded',inject);
})();
