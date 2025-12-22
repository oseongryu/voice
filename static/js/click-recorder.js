/* Click Recorder Module
   - Records click events on the screenshot image while modal is open
   - Stores list of {t:timestamp(ms), type: 'left'|'right'|'double', x, y}
   - Can export/import JSON, playback sequentially to server using performClick
*/

// i18n 텍스트 헬퍼 함수 (auth-utils.js에서 이미 정의됨)
// const getText = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);

// 클릭 레코더 관련 텍스트 (i18n 지원)
const RECORDER_TEXT = {
  get screenshotFirst() { return getText('recorder.screenshot_first', '녹화하려면 먼저 스크린샷을 촬영하세요.'); },
  get start() { return getText('recorder.start', '녹화 시작: 스크린샷을 클릭하면 이벤트가 기록됩니다'); },
  get stop() { return getText('recorder.stop', '녹화 중지'); },
  get clearConfirm() { return getText('recorder.clear_confirm', '녹화된 이벤트를 모두 삭제하겠습니까?'); },
  get deleteAllConfirm() { return getText('recorder.delete_all_confirm', '선택된 항목이 없습니다. 전체를 삭제하시겠습니까?'); },
  deletedItems(count) { return getText('recorder.deleted_items', '선택된 {count}개 항목을 삭제했습니다.').replace('{count}', count); },
  get noEvents() { return getText('recorder.no_events', '저장할 이벤트가 없습니다'); },
  get groupSaved() { return getText('recorder.group_saved', '그룹 저장 완료'); },
  get groupSaveFailed() { return getText('recorder.group_save_failed', '그룹 저장 실패'); },
  get selectGroupLoad() { return getText('recorder.select_group_load', '불러올 그룹을 선택하세요'); },
  get groupLoaded() { return getText('recorder.group_loaded', '그룹 불러오기 완료'); },
  get groupLoadFailed() { return getText('recorder.group_load_failed', '그룹 불러오기 실패'); },
  get selectGroupDelete() { return getText('recorder.select_group_delete', '삭제할 그룹을 선택하세요'); },
  get deleteGroupConfirm() { return getText('recorder.delete_group_confirm', '선택한 그룹을 삭제하시겠습니까?'); },
  get groupDeleted() { return getText('recorder.group_deleted', '그룹 삭제 완료'); },
  get groupDeleteFailed() { return getText('recorder.group_delete_failed', '그룹 삭제 실패'); },
  get selectGroupRun() { return getText('recorder.select_group_run', '실행할 그룹을 선택하세요'); },
  get groupRunFailed() { return getText('recorder.group_run_failed', '그룹 실행 실패'); },
  get importSuccess() { return getText('recorder.import_success', '녹화 불러오기 완료'); },
  get importFailed() { return getText('recorder.import_failed', '불러오기 실패: 잘못된 파일입니다'); },
  get playbackStart() { return getText('recorder.playback_start', '재생 시작...'); },
  get playbackComplete() { return getText('recorder.playback_complete', '재생 완료'); }
};


let clickRecording = [];
let isRecordingClicks = false;
let clickRecorderImgListener = null;
let clickRecorderContextMenuListener = null;
let clickRecorderDblListener = null;
// no floating controls; use header global buttons instead
let diagnosticAttached = false;
let diagImgCaptureListener = null;
let diagImgPointerListener = null;
let lastRecordedTime = 0;
let docCaptureInstalled = false;

function showClickRecorderModal() {
  const modalEl = document.getElementById('clickRecorderModal');
  if (!modalEl) return;

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  // init state
  updateRecordUI();
  attachClickRecorderListeners();
}

function closeClickRecorderModal() {
  const modalEl = document.getElementById('clickRecorderModal');
  if (!modalEl) return;

  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) {
    modal.hide();
  }

  // keep listeners attached so user can re-open without reattaching frequently
  detachClickRecorderListeners();
}

function updateRecordUI() {
  document.getElementById('recordCount').textContent = clickRecording.length;
  document.getElementById('recordList').value = clickRecording.map(e => `${e.t} | ${e.type} | ${e.x},${e.y}`).join('\n');
  document.getElementById('playbackBtn').disabled = clickRecording.length === 0;
  document.getElementById('exportBtn').disabled = clickRecording.length === 0;
  // update global playback button enabled state
  const gPlay = document.getElementById('globalPlaybackBtn');
  if (gPlay) gPlay.disabled = clickRecording.length === 0;
}

function attachClickRecorderListeners() {
  const img = document.getElementById('screenshotImage');
  // console.log('click-recorder: attachClickRecorderListeners called, img=', img);
  if (!img) return;

  try {
    const cs = window.getComputedStyle(img);
    // console.log('click-recorder: screenshotImage style', {display: cs.display, visibility: cs.visibility, pointerEvents: cs.pointerEvents, opacity: cs.opacity});
    // console.log('click-recorder: screenshotImage rect', img.getBoundingClientRect());
  } catch (e) {
    console.log('click-recorder: error reading img style/rect', e);
  }

  // if listeners already attached, skip
  if (clickRecorderImgListener) return;

  // keep handlers to remove later
  clickRecorderImgListener = async function (e) {
    if (!isRecordingClicks) return;
    e.preventDefault();
    console.debug('click-recorder: image click', { clientX: e.clientX, clientY: e.clientY });

    const coords = calculateClickCoordinates(e, img, currentScreenshot.screen_width, currentScreenshot.screen_height);
    const rec = { t: Date.now(), type: 'left', x: coords.x, y: coords.y };
    clickRecording.push(rec);
    updateRecordUI();

    // mark last recorded time so doc-level fallback can ignore duplicates
    lastRecordedTime = Date.now();

    // visual indicator to user
    showClickIndicatorAtPosition(coords.x, coords.y, img, null, currentScreenshot);
  };

  clickRecorderContextMenuListener = function (e) {
    if (!isRecordingClicks) return;
    e.preventDefault();
    console.debug('click-recorder: contextmenu', { clientX: e.clientX, clientY: e.clientY });
    const coords = calculateClickCoordinates(e, img, currentScreenshot.screen_width, currentScreenshot.screen_height);
    const rec = { t: Date.now(), type: 'right', x: coords.x, y: coords.y };
    clickRecording.push(rec);
    updateRecordUI();
    showClickIndicatorAtPosition(coords.x, coords.y, img, null, currentScreenshot);
    lastRecordedTime = Date.now();
  };

  clickRecorderDblListener = function (e) {
    if (!isRecordingClicks) return;
    e.preventDefault();
    console.debug('click-recorder: dblclick', { clientX: e.clientX, clientY: e.clientY });
    const coords = calculateClickCoordinates(e, img, currentScreenshot.screen_width, currentScreenshot.screen_height);
    const rec = { t: Date.now(), type: 'double', x: coords.x, y: coords.y };
    clickRecording.push(rec);
    updateRecordUI();
    showClickIndicatorAtPosition(coords.x, coords.y, img, null, currentScreenshot);
    lastRecordedTime = Date.now();
  };

  img.addEventListener('click', clickRecorderImgListener);
  img.addEventListener('contextmenu', clickRecorderContextMenuListener);
  img.addEventListener('dblclick', clickRecorderDblListener);

  // add capture-phase diagnostics on the image so we can see if clicks reach it
  diagImgCaptureListener = function (e) {
    // console.log('click-recorder: img capture-phase click', {type: e.type, clientX: e.clientX, clientY: e.clientY, target: e.target});
  };
  diagImgPointerListener = function (e) {
    // console.log('click-recorder: img capture-phase pointerdown', {type: e.type, clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType});
  };
  img.addEventListener('click', diagImgCaptureListener, true);
  img.addEventListener('pointerdown', diagImgPointerListener, true);

  // console.log('click-recorder: listeners attached to screenshotImage');

  // install document-level capture fallback once
  if (!docCaptureInstalled) {
    document.addEventListener('click', function docCaptureRecord(ev) {
      try {
        if (!isRecordingClicks) return;
        const now = Date.now();
        if (now - lastRecordedTime < 80) return; // de-dupe if image handler already took it

        const clientX = ev.clientX, clientY = ev.clientY;
        const targetImg = document.getElementById('screenshotImage');

        const fakeEv = { clientX: clientX, clientY: clientY };
        const coords = calculateClickCoordinates(fakeEv, targetImg, currentScreenshot.screen_width, currentScreenshot.screen_height);
        const rec = { t: Date.now(), type: 'left', x: coords.x, y: coords.y };
        clickRecording.push(rec);
        updateRecordUI();
        lastRecordedTime = Date.now();
        // console.log('click-recorder: docCaptureRecord saved coords', rec);
      } catch (err) {
        console.error('click-recorder: docCaptureRecord error', err);
      }
    }, true);
    docCaptureInstalled = true;
  }

  // buttons
  document.getElementById('startRecordBtn').onclick = startRecordingClicks;
  document.getElementById('stopRecordBtn').onclick = stopRecordingClicks;
  document.getElementById('playbackBtn').onclick = playbackRecording;
  const gPlay = document.getElementById('globalPlaybackBtn');
  if (gPlay) gPlay.onclick = () => playbackRecording();
  document.getElementById('clearRecordingBtn').onclick = clearRecording;
  // wire new delete-selected button
  const delSelBtn = document.getElementById('deleteSelectedRecordingBtn');
  if (delSelBtn) delSelBtn.onclick = deleteSelectedRecording;
  document.getElementById('exportBtn').onclick = exportRecording;
  document.getElementById('importBtn').onclick = () => document.getElementById('importFileInput').click();
  document.getElementById('importFileInput').onchange = importRecordingFromFile;
  // save/load groups UI
  const saveBtn = document.getElementById('saveGroupBtn');
  const saveName = document.getElementById('saveGroupName');
  const savedSelect = document.getElementById('savedGroupsSelect');
  const loadBtn = document.getElementById('loadGroupBtn');
  const deleteBtn = document.getElementById('deleteGroupBtn');
  const runBtn = document.getElementById('runGroupBtn');

  if (saveName) saveName.oninput = () => { if (saveBtn) saveBtn.disabled = !saveName.value || clickRecording.length === 0; };
  if (saveBtn) saveBtn.onclick = saveCurrentGroup;
  if (loadBtn) loadBtn.onclick = loadSelectedGroup;
  if (deleteBtn) deleteBtn.onclick = deleteSelectedGroup;
  if (runBtn) runBtn.onclick = runSelectedGroup;

  // populate saved groups on open
  refreshSavedGroups();
}

function detachClickRecorderListeners() {
  const img = document.getElementById('screenshotImage');
  if (img && clickRecorderImgListener) img.removeEventListener('click', clickRecorderImgListener);
  if (img && clickRecorderContextMenuListener) img.removeEventListener('contextmenu', clickRecorderContextMenuListener);
  if (img && clickRecorderDblListener) img.removeEventListener('dblclick', clickRecorderDblListener);

  // clear handler refs so attachClickRecorderListeners can re-create them later
  clickRecorderImgListener = null;
  clickRecorderContextMenuListener = null;
  clickRecorderDblListener = null;
  // remove diag refs
  if (diagImgCaptureListener && img) img.removeEventListener('click', diagImgCaptureListener, true);
  if (diagImgPointerListener && img) img.removeEventListener('pointerdown', diagImgPointerListener, true);
  diagImgCaptureListener = null;
  diagImgPointerListener = null;

  // reset buttons
  document.getElementById('startRecordBtn').onclick = null;
  document.getElementById('stopRecordBtn').onclick = null;
  document.getElementById('playbackBtn').onclick = null;
  document.getElementById('clearRecordingBtn').onclick = null;
  const delSelBtn = document.getElementById('deleteSelectedRecordingBtn');
  if (delSelBtn) delSelBtn.onclick = null;
  document.getElementById('exportBtn').onclick = null;
  document.getElementById('importBtn').onclick = null;
  document.getElementById('importFileInput').onchange = null;
}

function startRecordingClicks() {
  // require a screenshot to be loaded so coordinates can be mapped
  if (!currentScreenshot) {
    showToast(RECORDER_TEXT.screenshotFirst, 'error');
    return;
  }

  isRecordingClicks = true;
  const sBtn = document.getElementById('startRecordBtn');
  const tBtn = document.getElementById('stopRecordBtn');
  if (sBtn) sBtn.style.display = 'none';
  if (tBtn) tBtn.style.display = 'inline-block';
  showToast(RECORDER_TEXT.start, 'info');
  // reflect on header buttons if present
  const gStart = document.getElementById('globalStartRecordBtn');
  const gStop = document.getElementById('globalStopRecordBtn');
  if (gStart) gStart.style.display = 'none';
  if (gStop) gStop.style.display = 'inline-block';
}

function stopRecordingClicks() {
  isRecordingClicks = false;
  const sBtn = document.getElementById('startRecordBtn');
  const tBtn = document.getElementById('stopRecordBtn');
  if (sBtn) sBtn.style.display = 'inline-block';
  if (tBtn) tBtn.style.display = 'none';
  showToast(RECORDER_TEXT.stop, 'success');
  const gStart = document.getElementById('globalStartRecordBtn');
  const gStop = document.getElementById('globalStopRecordBtn');
  if (gStart) gStart.style.display = 'inline-block';
  if (gStop) gStop.style.display = 'none';
}

function clearRecording() {
  if (!confirm(RECORDER_TEXT.clearConfirm)) return;
  clickRecording = [];
  updateRecordUI();
  // update global UI count if present
  const gStart = document.getElementById('globalStartRecordBtn');
  const gStop = document.getElementById('globalStopRecordBtn');
  if (gStart) gStart.textContent = '⏺️ 녹화 시작'; // header count sync (not present by default)
  if (gStop) gStop.style.display = 'none'; // header count sync (not present by default)
  const gPlay = document.getElementById('globalPlaybackBtn');
  if (gPlay) gPlay.disabled = true;
}

function deleteSelectedRecording() {
  const textarea = document.getElementById('recordList');
  if (!textarea) return;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  if (selectionStart === selectionEnd) {
    // nothing selected - ask to clear all instead
    if (!confirm(RECORDER_TEXT.deleteAllConfirm)) return;
    clickRecording = [];
    updateRecordUI();
    return;
  }

  // compute which lines are selected
  const fullText = textarea.value;
  const before = fullText.slice(0, selectionStart);
  const selected = fullText.slice(selectionStart, selectionEnd);
  const after = fullText.slice(selectionEnd);

  // find line indices
  const linesBefore = before.split('\n');
  const startLine = linesBefore.length - 1;
  const selectedLines = selected.split('\n');
  const numSelectedLines = selectedLines.length;

  // remove corresponding entries from clickRecording
  // clickRecording is displayed as: `${e.t} | ${e.type} | ${e.x},${e.y}` per updateRecordUI
  if (startLine < 0) return;
  const newRecording = [];
  for (let i = 0; i < clickRecording.length; i++) {
    if (i >= startLine && i < startLine + numSelectedLines) {
      // skip (delete)
      continue;
    }
    newRecording.push(clickRecording[i]);
  }

  clickRecording = newRecording;
  updateRecordUI();
  showToast(RECORDER_TEXT.deletedItems(numSelectedLines), 'success');
}

// --- Group persistence functions (server-backed) ---
async function refreshSavedGroups() {
  try {
    const res = await fetch(AppConfig.getApiUrl('/api/click-groups'));
    const data = await res.json();
    const sel = document.getElementById('savedGroupsSelect');
    if (!sel) return;
    sel.innerHTML = '';
    (data.groups || []).forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.name} (${g.created_at})`;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to fetch click groups', err);
  }
}

async function saveCurrentGroup() {
  const nameEl = document.getElementById('saveGroupName');
  const name = nameEl && nameEl.value ? nameEl.value : `Group ${new Date().toISOString()}`;
  if (clickRecording.length === 0) { showToast(RECORDER_TEXT.noEvents, 'error'); return; }
  try {
    // assume currentScreenshot exists and has screen_width/height
    const res = await fetch(AppConfig.getApiUrl('/api/click-groups'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, events: clickRecording, ref_width: currentScreenshot.screen_width, ref_height: currentScreenshot.screen_height })
    });
    if (!res.ok) throw new Error('save failed');
    const data = await res.json();
    showToast(RECORDER_TEXT.groupSaved, 'success');
    if (nameEl) nameEl.value = '';
    refreshSavedGroups();
  } catch (err) {
    console.error('saveCurrentGroup error', err);
    showToast(RECORDER_TEXT.groupSaveFailed, 'error');
  }
}

async function loadSelectedGroup() {
  const sel = document.getElementById('savedGroupsSelect');
  if (!sel || !sel.value) return showToast(RECORDER_TEXT.selectGroupLoad, 'error');
  try {
    const res = await fetch(AppConfig.getApiUrl(`/api/click-groups/${sel.value}`));
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    // store original reference size with the local recording for playback scaling
    // assume ref_width/ref_height and events are present
    clickRecording = data.events.map(e => ({ t: e.t, type: e.type, x: +e.x, y: +e.y }));
    clickRecording._ref_width = data.ref_width;
    clickRecording._ref_height = data.ref_height;
    updateRecordUI();
    showToast(RECORDER_TEXT.groupLoaded, 'success');
  } catch (err) {
    console.error('loadSelectedGroup error', err);
    showToast(RECORDER_TEXT.groupLoadFailed, 'error');
  }
}

async function deleteSelectedGroup() {
  const sel = document.getElementById('savedGroupsSelect');
  if (!sel || !sel.value) return showToast(RECORDER_TEXT.selectGroupDelete, 'error');
  if (!confirm(RECORDER_TEXT.deleteGroupConfirm)) return;
  try {
    const res = await fetch(AppConfig.getApiUrl(`/api/click-groups/${sel.value}`), { method: 'DELETE' });
    if (!res.ok) throw new Error('delete failed');
    showToast(RECORDER_TEXT.groupDeleted, 'success');
    refreshSavedGroups();
  } catch (err) {
    console.error('deleteSelectedGroup error', err);
    showToast(RECORDER_TEXT.groupDeleteFailed, 'error');
  }
}

async function runSelectedGroup() {
  const sel = document.getElementById('savedGroupsSelect');
  if (!sel || !sel.value) return showToast(RECORDER_TEXT.selectGroupRun, 'error');
  try {
    const res = await fetch(AppConfig.getApiUrl(`/api/click-groups/${sel.value}`));
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    // assume all fields present
    clickRecording = data.events.map(e => ({ t: e.t, type: e.type, x: +e.x, y: +e.y }));
    clickRecording._ref_width = data.ref_width;
    clickRecording._ref_height = data.ref_height;
    updateRecordUI();
    await playbackRecording();
  } catch (err) {
    console.error('runSelectedGroup error', err);
    showToast(RECORDER_TEXT.groupRunFailed, 'error');
  }
}

function exportRecording() {
  // include attached _ref_* metadata
  const out = { events: clickRecording, ref_width: clickRecording._ref_width, ref_height: clickRecording._ref_height };
  const dataStr = JSON.stringify(out, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'click_recording.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importRecordingFromFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      // support both raw array exports and {events, ref_width, ref_height} exports
      // expect file format { events, ref_width, ref_height }
      clickRecording = parsed.events.map(p => ({ t: p.t, type: p.type, x: +p.x, y: +p.y }));
      clickRecording._ref_width = parsed.ref_width;
      clickRecording._ref_height = parsed.ref_height;
      updateRecordUI();
      showToast(RECORDER_TEXT.importSuccess, 'success');
    } catch (err) {
      showToast(RECORDER_TEXT.importFailed, 'error');
    }
  };
  reader.readAsText(file);
  // reset input
  e.target.value = '';
}

async function playbackRecording() {
  if (clickRecording.length === 0) return;

  const speed = parseFloat(document.getElementById('playbackSpeed').value) || 1;
  showToast(RECORDER_TEXT.playbackStart, 'info');

  // play sequentially using intervals derived from timestamps
  // compute relative delays between events and play adjusted by speed
  const recRefW = clickRecording._ref_width || null;
  const recRefH = clickRecording._ref_height || null;

  for (let i = 0; i < clickRecording.length; i++) {
    const ev = clickRecording[i];
    const prev = i > 0 ? clickRecording[i - 1] : null;
    const delta = prev ? (ev.t - prev.t) : 0;
    const waitMs = Math.max(0, delta / speed);
    if (waitMs > 0) await new Promise((res) => setTimeout(res, waitMs));

    // send to server via performClick
    try {
      // if scaling needed, convert stored coords (based on ref) to current screen coords
      const scaledCoords = scaleCoordinates(
        ev.x, ev.y,
        recRefW, recRefH,
        currentScreenshot?.screen_width, currentScreenshot?.screen_height
      );
      await performClick(scaledCoords.x, scaledCoords.y, ev.type);
    } catch (err) {
      console.error('Playback error', err);
    }
  }

  showToast(RECORDER_TEXT.playbackComplete, 'success');
}

// expose some functions for external use/testing
window.showClickRecorderModal = showClickRecorderModal;
window.closeClickRecorderModal = closeClickRecorderModal;

// wire global header buttons so user can start/stop without opening modal
function initGlobalRecorderButtons() {
  const gStart = document.getElementById('globalStartRecordBtn');
  const gStop = document.getElementById('globalStopRecordBtn');
  if (gStart) gStart.onclick = () => {
    attachClickRecorderListeners();
    startRecordingClicks();
  };
  if (gStop) gStop.onclick = () => {
    stopRecordingClicks();
  };
  // ensure listeners present so clicks record immediately
  attachClickRecorderListeners();
}

document.addEventListener('DOMContentLoaded', () => {
  try { initGlobalRecorderButtons(); } catch (e) { console.warn('recorder init failed', e); }
});

// also try to initialize immediately (script is loaded at end of body)
try { initGlobalRecorderButtons(); } catch (e) { /* ignore */ }

// Diagnostic: capture all clicks at document level in capture phase and log targets
function installDiagnosticCapture() {
  if (diagnosticAttached) return;
  document.addEventListener('click', (e) => {
    try {
      const el = e.target;
      const ptEl = document.elementFromPoint(e.clientX, e.clientY);
      // console.debug('click-recorder: doc click captured', {clientX: e.clientX, clientY: e.clientY, target: el, elementFromPoint: ptEl});
    } catch (err) {
      console.debug('click-recorder: doc click diagnostic error', err);
    }
  }, true); // capture phase
  diagnosticAttached = true;
}

try { installDiagnosticCapture(); } catch (e) { console.warn('diagnostic capture install failed', e); }

