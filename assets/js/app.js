(function () {
  const $ = (id) => document.getElementById(id);
  let profile;
  let activeView = 'dashboard';
  let toastTimer;
  let zoomFactor = 1;

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function shortDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()+543}`;
  }

  function nav(view) {
    activeView = view;
    document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
    document.querySelectorAll('.nav-item[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    const current = document.querySelector(`.nav-item[data-view="${view}"] span:nth-child(2)`);
    $('breadcrumbCurrent').textContent = current ? current.textContent : 'พื้นที่ทำงาน';
    $('sidebar').classList.remove('open');
    if (view === 'documents' || view === 'archive' || view === 'dashboard') renderDocuments();
    if (view === 'settings') renderSettings();
    if (view === 'editor') requestAnimationFrame(editorResizeFix);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function editorResizeFix() { if (window.EOEditor) window.EOEditor.updatePaperScale(); }

  function addDocumentRow(doc, archiveMode) {
    const status = doc.status === 'ARCHIVED' ? 'เก็บเข้าคลัง' : 'ฉบับร่าง';
    const type = ({ external: 'หนังสือภายนอก', memo: 'บันทึกข้อความ', announcement: 'ประกาศ' })[doc.type] || 'หนังสือ';
    const title = escapeHtml(doc.subject || 'ไม่มีชื่อเรื่อง');
    const no = escapeHtml(doc.documentNo || 'ยังไม่กำหนดเลขที่');
    const action = archiveMode
      ? `<button class="row-action" data-action="restore" data-id="${doc.id}">นำกลับ</button>`
      : `<button class="row-action" data-action="edit" data-id="${doc.id}">เปิดแก้ไข</button> <button class="row-action" data-action="archive" data-id="${doc.id}">เก็บ</button>`;
    if (archiveMode) return `<tr><td class="doc-title-cell"><strong>${title}</strong><small>${no}</small></td><td>${type}</td><td>${shortDate(doc.updatedAt)}</td><td>${action}</td></tr>`;
    return `<tr><td class="doc-title-cell"><strong>${title}</strong><small>${no}</small></td><td>${type}</td><td>${shortDate(doc.updatedAt)}</td><td><span class="status-pill ${doc.status === 'SAVED' ? 'saved' : ''}">${status}</span></td><td>${action}</td></tr>`;
  }

  async function renderDocuments() {
    const docs = await EOStorage.listDocuments();
    $('docCount').textContent = docs.filter(d => d.status !== 'ARCHIVED').length;
    $('statTotal').textContent = docs.length;
    $('statDraft').textContent = docs.filter(d => d.status === 'DRAFT').length;
    $('statReady').textContent = docs.filter(d => d.status === 'SAVED').length;
    $('statArchive').textContent = docs.filter(d => d.status === 'ARCHIVED').length;
    const recent = docs.filter(d => d.status !== 'ARCHIVED').slice(0, 5);
    $('recentRows').innerHTML = recent.length ? recent.map(doc => `
      <tr><td class="doc-title-cell"><strong>${escapeHtml(doc.subject || 'ไม่มีชื่อเรื่อง')}</strong><small>${escapeHtml(doc.documentNo || 'ยังไม่กำหนดเลขที่')}</small></td><td>${({external:'หนังสือภายนอก',memo:'บันทึกข้อความ',announcement:'ประกาศ'})[doc.type] || 'หนังสือ'}</td><td>${shortDate(doc.updatedAt)}</td><td><span class="status-pill">ฉบับร่าง</span></td><td><button class="row-action" data-action="edit" data-id="${doc.id}">เปิด</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-cell">ยังไม่มีเอกสาร เริ่มสร้างหนังสือฉบับแรกของคุณ</td></tr>';
    const q = ($('documentSearch').value || '').toLowerCase();
    const filter = $('documentFilter').value;
    const visible = docs.filter(d => d.status !== 'ARCHIVED' && (!q || `${d.subject} ${d.documentNo}`.toLowerCase().includes(q)) && (filter === 'all' || d.type === filter));
    $('documentRows').innerHTML = visible.length ? visible.map(doc => addDocumentRow(doc, false)).join('') : '<tr><td colspan="5" class="empty-cell">ไม่พบเอกสารที่ตรงกับเงื่อนไข</td></tr>';
    const archived = docs.filter(d => d.status === 'ARCHIVED');
    $('archiveRows').innerHTML = archived.length ? archived.map(doc => addDocumentRow(doc, true)).join('') : '<tr><td colspan="4" class="empty-cell">ยังไม่มีเอกสารในคลัง</td></tr>';
  }

  function populateSettings() {
    $('orgName').value = profile.orgName || '';
    $('orgAddress').value = profile.orgAddress || '';
    $('orgPhone').value = profile.orgPhone || '';
    $('orgEmail').value = profile.orgEmail || '';
    $('profileName').value = profile.profileName || '';
    const gasCfg = window.EOGAS ? window.EOGAS.config() : {};
    if ($('gasUrl')) $('gasUrl').value = gasCfg.url || '';
    if ($('gasApiKey')) $('gasApiKey').value = gasCfg.apiKey || '';
    if ($('connectionStatus')) $('connectionStatus').textContent = gasCfg.url ? 'กำหนด URL แล้ว · ยังไม่ทดสอบ' : 'ยังไม่ได้เชื่อมต่อ';
    $('sidebarUser').textContent = profile.profileName || 'ผู้ปฏิบัติงาน';
    $('sidebarOrg').textContent = profile.orgName || 'หน่วยงานของฉัน';
    $('userAvatar').textContent = (profile.profileName || 'ผ').trim().charAt(0);
    $('topAvatar').textContent = (profile.profileName || 'ผ').trim().charAt(0);
    editorResizeFix();
  }

  async function renderSettings() {
    profile = await EOStorage.getProfile();
    populateSettings();
    renderAssetCards('seals', 'sealAssets');
    renderAssetCards('garudas', 'garudaAssets');
  }

  function renderAssetCards(kind, targetId) {
    const list = profile[kind] || [];
    const selected = kind === 'seals' ? profile.selectedSeal : (profile.selectedExternalGaruda || profile.selectedMemoGaruda);
    const target = $(targetId);
    target.innerHTML = list.map((asset) => {
      const active = asset.id === selected || (kind === 'garudas' && (asset.id === profile.selectedExternalGaruda || asset.id === profile.selectedMemoGaruda));
      const controls = kind === 'garudas'
        ? `<button class="${asset.id === profile.selectedExternalGaruda ? 'asset-use-selected' : ''}" data-asset-action="use-external" data-kind="garudas" data-id="${asset.id}">ภายนอก</button><button class="${asset.id === profile.selectedMemoGaruda ? 'asset-use-selected' : ''}" data-asset-action="use-memo" data-kind="garudas" data-id="${asset.id}">บันทึก</button>`
        : `<button data-asset-action="select" data-kind="seals" data-id="${asset.id}">เลือกใช้</button>`;
      return `
      <div class="asset-card ${active ? 'selected' : ''}">
        <div class="asset-preview"><img src="${asset.dataUrl}" alt="${escapeHtml(asset.name)}"></div>
        <div class="asset-name" title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</div>
        <div class="asset-actions">${controls}<button class="delete-asset" data-asset-action="delete" data-kind="${kind}" data-id="${asset.id}">ลบ</button></div>
      </div>`;
    }).join('');
  }

  async function saveSettings() {
    if (window.EOGAS) window.EOGAS.save({url:$('gasUrl').value.trim(),apiKey:$('gasApiKey').value.trim()});
    profile.orgName = $('orgName').value.trim();
    profile.orgAddress = $('orgAddress').value.trim();
    profile.orgPhone = $('orgPhone').value.trim();
    profile.orgEmail = $('orgEmail').value.trim();
    profile.profileName = $('profileName').value.trim() || 'ผู้ปฏิบัติงาน';
    await EOStorage.saveProfile(profile);
    populateSettings();
    editorResizeFix();
    toast('บันทึกการตั้งค่าหน่วยงานและการเชื่อมต่อแล้ว');
  }

  async function readImage(file) {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) throw new Error('รองรับเฉพาะไฟล์ PNG, JPG และ WebP');
    if (file.size > 5 * 1024 * 1024) throw new Error('ไฟล์ภาพต้องมีขนาดไม่เกิน 5 MB ต่อภาพ');
    const original = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('อ่านไฟล์ภาพไม่สำเร็จ'));
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('เปิดไฟล์ภาพไม่สำเร็จ')); img.src = original;
    });
    const scale = Math.min(1, 500 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const dataUrl = canvas.toDataURL('image/webp', 0.88); // WebP retains alpha transparency in supported browsers.
    const type = dataUrl.slice(5, dataUrl.indexOf(';'));
    return { id: crypto.randomUUID(), name: file.name, type, dataUrl };
  }

  async function addImages(kind, files) {
    const max = kind === 'seals' ? 3 : 4;
    profile[kind] = profile[kind] || [];
    for (const file of Array.from(files)) {
      if (profile[kind].length >= max) { toast(`อัปโหลดได้สูงสุด ${max} ภาพ`); break; }
      try {
        const asset = await readImage(file);
        profile[kind].push(asset);
        if (kind === 'seals' && !profile.selectedSeal) profile.selectedSeal = asset.id;
        if (kind === 'garudas' && !profile.selectedExternalGaruda) profile.selectedExternalGaruda = asset.id;
        if (kind === 'garudas' && !profile.selectedMemoGaruda) profile.selectedMemoGaruda = asset.id;
      } catch (error) { toast(error.message); }
    }
    await EOStorage.saveProfile(profile);
    renderAssetCards(kind, kind === 'seals' ? 'sealAssets' : 'garudaAssets');
    editorResizeFix();
  }

  async function assetAction(action, kind, id) {
    const list = profile[kind] || [];
    if (action === 'delete') {
      profile[kind] = list.filter(x => x.id !== id);
      if (kind === 'seals' && profile.selectedSeal === id) profile.selectedSeal = profile.seals[0]?.id || '';
      if (kind === 'garudas') {
        if (profile.selectedExternalGaruda === id) profile.selectedExternalGaruda = profile.garudas[0]?.id || '';
        if (profile.selectedMemoGaruda === id) profile.selectedMemoGaruda = profile.garudas[0]?.id || '';
      }
    } else if (kind === 'seals') {
      profile.selectedSeal = id;
    } else if (action === 'use-external') {
      profile.selectedExternalGaruda = id;
    } else if (action === 'use-memo') {
      profile.selectedMemoGaruda = id;
    } else {
      profile.selectedExternalGaruda = id;
      profile.selectedMemoGaruda = id;
    }
    await EOStorage.saveProfile(profile);
    renderAssetCards(kind, kind === 'seals' ? 'sealAssets' : 'garudaAssets');
    editorResizeFix();
  }

  async function saveCurrentDocument() {
    const doc = EOEditor.captureDocument();
    if (!doc.subject) { toast('กรุณาระบุชื่อเรื่องก่อนบันทึก'); $('docSubject').focus(); return; }
    if (!doc.id) doc.id = crypto.randomUUID();
    doc.status = 'DRAFT';
    await EOStorage.saveDocument(doc);
    $('docId').value = doc.id;
    await renderDocuments();
    toast('บันทึกฉบับร่างในอุปกรณ์นี้แล้ว');
  }

  async function openDocument(id) {
    const doc = await EOStorage.getDocument(id);
    if (!doc) { toast('ไม่พบเอกสาร'); return; }
    profile = await EOStorage.getProfile();
    EOEditor.loadDocument(doc, profile);
    nav('editor');
  }

  async function newDocument() {
    profile = await EOStorage.getProfile();
    EOEditor.newDocument(profile);
    nav('editor');
  }

  function openPreview() {
    EOEditor.applyTemplate(profile);
    const clone = $('paper').cloneNode(true);
    clone.id = 'previewPaper';
    clone.style.transform = 'none';
    clone.style.setProperty('--paper-scale', '1');
    $('previewPaperHost').replaceChildren(clone);
    $('previewModal').classList.add('open');
    $('previewModal').setAttribute('aria-hidden', 'false');
  }

  function closePreview() {
    $('previewModal').classList.remove('open');
    $('previewModal').setAttribute('aria-hidden', 'true');
  }

  async function exportPng() {
    if (typeof html2canvas !== 'function') { toast('โหลดเครื่องมือบันทึกภาพไม่สำเร็จ กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต'); return; }
    EOEditor.applyTemplate(profile);
    const source = $('paper');
    const clone = source.cloneNode(true);
    clone.style.transform = 'none';
    clone.style.position = 'fixed';
    clone.style.left = '-12000px';
    clone.style.top = '0';
    clone.style.width = '210mm';
    clone.style.minHeight = '297mm';
    clone.style.boxShadow = 'none';
    document.body.appendChild(clone);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const canvas = await html2canvas(clone, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 1200 });
      const link = document.createElement('a');
      link.download = `eoffice-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('สร้างภาพ PNG แล้ว');
    } catch (error) {
      console.error(error);
      toast('บันทึกภาพไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally { clone.remove(); }
  }


  async function printDocument() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    EOEditor.applyTemplate(profile);
    const clone = $('paper').cloneNode(true);
    clone.id = 'paper';
    clone.style.transform = 'none';
    clone.style.setProperty('--paper-scale', '1');
    $('printHost').replaceChildren(clone);
    window.print();
  }

  function setToday() {
    const now = new Date();
    $('todayLabel').textContent = EOEditor.thaiDate(now);
  }

  function bindEvents() {
    document.querySelectorAll('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => nav(button.dataset.view)));
    document.querySelectorAll('[data-goto]').forEach(button => button.addEventListener('click', () => nav(button.dataset.goto)));
    $('newDocDashboard').addEventListener('click', newDocument);
    $('newDocList').addEventListener('click', newDocument);
    $('saveSettings').addEventListener('click', saveSettings);
    $('testConnection').addEventListener('click', async () => {
      window.EOGAS.save({url:$('gasUrl').value.trim(),apiKey:$('gasApiKey').value.trim()});
      $('connectionStatus').textContent = 'กำลังทดสอบ...';
      try { const r=await window.EOGAS.test(); $('connectionStatus').textContent = 'เชื่อมต่อสำเร็จ · '+(r.data?.version || 'GAS online'); toast('เชื่อมต่อ GAS สำเร็จ'); }
      catch(err) { $('connectionStatus').textContent = 'เชื่อมต่อไม่สำเร็จ'; toast(err.message); }
    });
    $('saveDraftTop').addEventListener('click', saveCurrentDocument);
    $('saveDraftSide').addEventListener('click', saveCurrentDocument);
    $('openPreview').addEventListener('click', openPreview);
    $('closePreview').addEventListener('click', closePreview);
    $('previewModal').addEventListener('click', e => { if (e.target === $('previewModal')) closePreview(); });
    $('printDoc').addEventListener('click', printDocument);
    $('previewPrint').addEventListener('click', () => { closePreview(); printDocument(); });
    $('exportPng').addEventListener('click', exportPng);
    $('templateSelect').addEventListener('change', () => EOEditor.applyTemplate(profile));
    ['docSubject','docNumber','docDate','docTo','docReference','docAttachment','docSigner','docPosition','docPhone'].forEach(id => $(id).addEventListener('input', () => EOEditor.applyTemplate(profile)));
    $('documentBody').addEventListener('input', () => EOEditor.updatePaperScale());
    $('documentBody').addEventListener('keyup', () => EOEditor.updatePaperScale());
    document.querySelectorAll('[data-command]').forEach(button => {
      button.addEventListener('pointerdown', () => EOEditor.saveSelection());
      button.addEventListener('mousedown', e => e.preventDefault());
      button.addEventListener('click', () => EOEditor.runCommand(button.dataset.command));
    });
    $('fontSelect').addEventListener('pointerdown', () => EOEditor.saveSelection());
    $('fontSizeSelect').addEventListener('pointerdown', () => EOEditor.saveSelection());
    $('fontSelect').addEventListener('change', e => EOEditor.setFontFamily(e.target.value));
    $('fontSizeSelect').addEventListener('change', e => EOEditor.setFontSize(e.target.value));
    $('indentBtn').addEventListener('click', () => EOEditor.runCommand('indent'));
    $('outdentBtn').addEventListener('click', () => EOEditor.runCommand('outdent'));
    $('undoBtn').addEventListener('click', () => EOEditor.runCommand('undo'));
    $('redoBtn').addEventListener('click', () => EOEditor.runCommand('redo'));
    $('lineSpacing').addEventListener('change', e => { $('documentBody').style.lineHeight = e.target.value; });
    $('firstIndent').addEventListener('change', e => $('documentBody').style.setProperty('--paragraph-indent', `${e.target.value}cm`));
    $('zoomIn').addEventListener('click', () => { zoomFactor = Math.min(1.4, zoomFactor + .1); window.EOPaperZoom = zoomFactor; EOEditor.updatePaperScale(); });
    $('zoomOut').addEventListener('click', () => { zoomFactor = Math.max(.5, zoomFactor - .1); window.EOPaperZoom = zoomFactor; EOEditor.updatePaperScale(); });
    $('mobileMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
    $('documentSearch').addEventListener('input', renderDocuments);
    $('documentFilter').addEventListener('change', renderDocuments);

    $('chooseSeal').addEventListener('click', () => $('sealUpload').click());
    $('chooseGaruda').addEventListener('click', () => $('garudaUpload').click());
    $('sealDrop').addEventListener('click', e => { if (e.target === $('sealDrop')) $('sealUpload').click(); });
    $('garudaDrop').addEventListener('click', e => { if (e.target === $('garudaDrop')) $('garudaUpload').click(); });
    $('sealUpload').addEventListener('change', async e => { await addImages('seals', e.target.files); e.target.value = ''; });
    $('garudaUpload').addEventListener('change', async e => { await addImages('garudas', e.target.files); e.target.value = ''; });

    document.addEventListener('click', async e => {
      const action = e.target.closest('[data-action]');
      if (action) {
        const doc = await EOStorage.getDocument(action.dataset.id);
        if (action.dataset.action === 'edit') await openDocument(action.dataset.id);
        if (action.dataset.action === 'archive' && doc) {
          doc.status = 'ARCHIVED'; doc.updatedAt = new Date().toISOString();
          await EOStorage.saveDocument(doc); await renderDocuments(); toast('ย้ายเอกสารเข้าคลังแล้ว');
        }
        if (action.dataset.action === 'restore' && doc) {
          doc.status = 'DRAFT'; doc.updatedAt = new Date().toISOString();
          await EOStorage.saveDocument(doc); await renderDocuments(); toast('นำเอกสารกลับแล้ว');
        }
      }
      const asset = e.target.closest('[data-asset-action]');
      if (asset) await assetAction(asset.dataset.assetAction, asset.dataset.kind, asset.dataset.id);
    });

    window.addEventListener('resize', () => EOEditor.updatePaperScale());
    window.addEventListener('beforeprint', () => EOEditor.applyTemplate(profile));
    window.addEventListener('afterprint', () => { $('printHost').replaceChildren(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview(); });
  }

  async function init() {
    profile = await EOStorage.getProfile();
    populateSettings();
    setToday();
    bindEvents();
    await renderDocuments();
    EOEditor.newDocument(profile);
    EOEditor.applyTemplate(profile);
    requestAnimationFrame(() => EOEditor.updatePaperScale());
  }

  window.addEventListener('DOMContentLoaded', () => {
    init().catch(err => { console.error(err); toast('เริ่มต้นระบบไม่สำเร็จ: ' + err.message); });
  });
})();
