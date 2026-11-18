(function () {
  const $ = (id) => document.getElementById(id);
  let savedRange = null;

  function saveSelection() {
    const body = $('documentBody');
    const selection = window.getSelection();
    if (!body || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (body.contains(range.commonAncestorContainer) && !range.collapsed) savedRange = range.cloneRange();
  }

  function restoreSelection() {
    const body = $('documentBody');
    if (!body || !savedRange || !body.contains(savedRange.commonAncestorContainer)) return false;
    body.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);
    return true;
  }

  document.addEventListener('selectionchange', saveSelection);

  function text(id, value) { const el = $(id); if (el) el.textContent = value || ''; }
  function val(id, value) { const el = $(id); if (el) el.value = value == null ? '' : value; }

  function setLogo(profile) {
    const paper = $('paper');
    const type = $('templateSelect').value;
    const isMemo = type === 'memo';
    const selectedId = isMemo ? profile.selectedMemoGaruda : profile.selectedExternalGaruda;
    const list = profile.garudas || [];
    const item = list.find(x => x.id === selectedId) || list[0];
    const img = $('paperGaruda');
    const placeholder = $('paperGarudaWrap').querySelector('.garuda-placeholder');
    if (item) {
      img.src = item.dataUrl;
      img.hidden = false;
      placeholder.hidden = true;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
      placeholder.hidden = false;
    }
    const seal = (profile.seals || []).find(x => x.id === profile.selectedSeal) || (profile.seals || [])[0];
    const sealImg = $('paperSeal');
    if (seal) {
      sealImg.src = seal.dataUrl;
      sealImg.hidden = false;
      $('paperSealWrap').hidden = false;
    } else {
      sealImg.removeAttribute('src');
      sealImg.hidden = true;
      $('paperSealWrap').hidden = true;
    }
    $('garudaPicker').querySelector('span').textContent = item ? item.name : 'ยังไม่ได้อัปโหลดตราครุฑ';
    $('sealPicker').querySelector('span').textContent = seal ? seal.name : 'ยังไม่ได้อัปโหลดตราหน่วยงาน';
    paper.classList.toggle('memo', isMemo);
    paper.classList.toggle('announcement', type === 'announcement');
    $('referenceLine').style.display = isMemo ? 'none' : '';
    $('attachmentLine').style.display = isMemo ? 'none' : '';
    $('externalFields').style.display = isMemo ? 'none' : '';
    text('toLabel', isMemo ? 'เรียน' : 'เรียน');
    text('formatStatus', `${isMemo ? 'ตราครุฑ 1.5 ซม.' : 'ตราครุฑ 3 ซม.'} · TH Sarabun PSK · 16 pt · ระยะบรรทัด 1 เท่า`);
    requestAnimationFrame(window.EOEditor.updatePaperScale);
  }

  function updatePaperScale() {
    const stage = $('paperStage');
    const paper = $('paper');
    if (!stage || !paper) return;
    const width = paper.offsetWidth;
    const available = Math.max(250, stage.clientWidth - 32);
    const scale = Math.min(1, available / width);
    paper.style.setProperty('--paper-scale', scale);
    paper.style.transform = `scale(${scale})`;
    let frame = stage.querySelector('.paper-frame');
    if (!frame) {
      frame = document.createElement('div');
      frame.className = 'paper-frame';
      paper.parentNode.insertBefore(frame, paper);
      frame.appendChild(paper);
    }
    frame.style.width = `${width * scale}px`;
    frame.style.height = `${Math.max(paper.offsetHeight, paper.scrollHeight) * scale}px`;
    const zoomLabel = $('zoomLabel');
    if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  function applyTemplate(profile) {
    const type = $('templateSelect').value;
    if (type === 'memo') {
      $('paperTopline').innerHTML = '<span id="renderOrg"></span><span id="renderDocNumber"></span>';
      text('renderOrg', `ส่วนราชการ  ${profile.orgName || '................................'}`);
      text('renderDocNumber', `ที่ ${$('docNumber').value || '................................'}`);
      $('renderDate').style.display = '';
    } else {
      $('paperTopline').innerHTML = '<span id="renderDocNumber">ที่ ................................</span><span id="renderOrg">ส่วนราชการเจ้าของหนังสือ</span>';
      text('renderDocNumber', `ที่ ${$('docNumber').value || '................................'}`);
      text('renderOrg', profile.orgName || 'ส่วนราชการเจ้าของหนังสือ');
      $('renderDate').style.display = '';
    }
    $('paper').classList.toggle('memo', type === 'memo');
    $('paper').classList.toggle('announcement', type === 'announcement');
    text('renderSubject', $('docSubject').value || 'เรื่องของหนังสือ');
    text('renderDate', type === 'memo' ? `วันที่ ${$('docDate').value || '................................'}` : ($('docDate').value || 'วันที่ ................................'));
    text('renderTo', $('docTo').value || 'ผู้รับหนังสือ');
    text('renderReference', $('docReference').value || '-');
    text('renderAttachment', $('docAttachment').value || '-');
    text('renderSigner', `(${ $('docSigner').value || 'ชื่อ - นามสกุล' })`);
    text('renderPosition', $('docPosition').value || 'ตำแหน่ง');
    text('renderPhone', $('docPhone').value ? `โทร. ${$('docPhone').value}` : (profile.orgPhone ? `โทร. ${profile.orgPhone}` : 'โทร. ................................'));
    text('renderEmail', profile.orgEmail || '');
    setLogo(profile);
  }

  function captureDocument() {
    return {
      id: $('docId').value || '',
      type: $('templateSelect').value,
      subject: $('docSubject').value.trim(),
      documentNo: $('docNumber').value.trim(),
      date: $('docDate').value.trim(),
      to: $('docTo').value.trim(),
      reference: $('docReference').value.trim(),
      attachment: $('docAttachment').value.trim(),
      signer: $('docSigner').value.trim(),
      position: $('docPosition').value.trim(),
      phone: $('docPhone').value.trim(),
      bodyHtml: $('documentBody').innerHTML,
      updatedAt: new Date().toISOString(),
      status: 'DRAFT'
    };
  }

  function loadDocument(doc, profile) {
    $('docId').value = doc.id || '';
    val('templateSelect', doc.type || 'external');
    val('docSubject', doc.subject);
    val('docNumber', doc.documentNo);
    val('docDate', doc.date);
    val('docTo', doc.to);
    val('docReference', doc.reference);
    val('docAttachment', doc.attachment);
    val('docSigner', doc.signer);
    val('docPosition', doc.position);
    val('docPhone', doc.phone);
    $('documentBody').innerHTML = doc.bodyHtml || '<p><br></p>';
    applyTemplate(profile);
  }

  function newDocument(profile) {
    $('docId').value = '';
    val('templateSelect', 'external');
    ['docSubject','docNumber','docTo','docReference','docAttachment','docSigner','docPosition','docPhone'].forEach(id => val(id, ''));
    val('docDate', thaiDate(new Date()));
    $('documentBody').innerHTML = '<p>ด้วยหน่วยงานมีความประสงค์จะ........................................................................................................................</p><p>ในการนี้ จึงเรียนมาเพื่อโปรดพิจารณาดำเนินการในส่วนที่เกี่ยวข้องต่อไป</p>';
    applyTemplate(profile);
  }

  function thaiDate(date) {
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  }

  function runCommand(command) {
    if (!restoreSelection()) $('documentBody').focus();
    document.execCommand(command, false, null);
    updatePaperScale();
  }

  function setFontSize(size) {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      const body = $('documentBody');
      body.style.fontSize = `${size}pt`;
      return;
    }
    const span = document.createElement('span');
    span.style.fontSize = `${size}pt`;
    try {
      range.surroundContents(span);
    } catch (_) {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    selection.removeAllRanges();
    updatePaperScale();
  }

  function setFontFamily(font) {
    if (!restoreSelection()) $('documentBody').focus();
    document.execCommand('fontName', false, font);
  }

  window.EOEditor = { applyTemplate, updatePaperScale, captureDocument, loadDocument, newDocument, runCommand, setFontSize, setFontFamily, thaiDate, saveSelection };
})();
