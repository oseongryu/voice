/**
 * Screenshot Modals Module
 * 스크린샷 페이지의 모달 관리 기능
 */

/**
 * Settings Management (Server-side JSON sync)
 */
const SettingsAPI = {
  async save(category, key, value) {
    try {
      await fetch(AppConfig.getApiUrl('/api/settings/update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, key, value })
      });
    } catch (e) {
      console.error('Settings save error:', e);
    }
  },

  async load() {
    try {
      const res = await fetch(AppConfig.getApiUrl('/api/settings/get_all'));
      const data = await res.json();
      return data.success ? data.settings : null;
    } catch (e) {
      console.error('Settings load error:', e);
      return null;
    }
  },

  async reset() {
    try {
      const res = await fetch(AppConfig.getApiUrl('/api/settings/reset'), { method: 'POST' });
      const data = await res.json();
      return data.success ? data.settings : null;
    } catch (e) {
      console.error('Settings reset error:', e);
      return null;
    }
  }
};

// 설정 초기화 함수 (UI에서 호출)
async function resetSettings() {
  if (!confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) {
    return;
  }

  const settings = await SettingsAPI.reset();
  if (settings && settings.ui) {
    const ui = settings.ui;

    // UI 업데이트 및 로컬 스토리지 동기화
    changeHeaderMode(ui.header_mode, false);
    localStorage.setItem('headerMode', ui.header_mode);

    changeTextModalPosition(ui.text_modal_position, false);
    localStorage.setItem('textModalPosition', ui.text_modal_position);

    changeUserMenuPosition(ui.user_menu_position, false);
    localStorage.setItem('userMenuPosition', ui.user_menu_position);

    changeScreenshotDelay(ui.screenshot_delay, false);
    localStorage.setItem('screenshotDelay', ui.screenshot_delay);

    if (ui.language) {
      localStorage.setItem('language', ui.language); // i18n 모듈이 사용
      // 페이지 새로고침하여 언어 적용
      window.location.reload();
      return;
    }

    // 모달 UI 업데이트
    const headerSelect = document.getElementById('headerModeSelect');
    if (headerSelect) headerSelect.value = ui.header_mode;

    const posSelect = document.getElementById('textModalPositionSelect');
    if (posSelect) posSelect.value = ui.text_modal_position;

    const userMenuPosSelect = document.getElementById('userMenuPositionSelect');
    if (userMenuPosSelect) userMenuPosSelect.value = ui.user_menu_position;

    const delayInput = document.getElementById('screenshotDelayInput');
    if (delayInput) delayInput.value = ui.screenshot_delay;

    const langSelect = document.getElementById('languageSelect');
    if (langSelect) langSelect.value = ui.language || 'ko';

    showToast('✅ 모든 설정이 초기화되었습니다.', 'success');
  } else {
    showToast('❌ 설정 초기화 실패', 'error');
  }
}

// 초기화 및 서버 설정 동기화 (인증 후에만)
document.addEventListener('DOMContentLoaded', async () => {
  // 인증 확인 - 토큰이 있고 유효한 경우에만 설정 로드
  if (typeof AuthUtils === 'undefined') {
    console.log('AuthUtils not loaded yet, skipping settings load');
    return;
  }

  const token = AuthUtils.getStoredToken();
  if (!token || AuthUtils.isTokenExpired(token)) {
    console.log('No valid token, skipping settings load');
    return;
  }

  // 인증된 경우에만 설정 로드
  const settings = await SettingsAPI.load();
  if (settings && settings.ui) {
    const ui = settings.ui;

    // 1. Header Mode
    if (ui.header_mode) {
      changeHeaderMode(ui.header_mode, false);
      const select = document.getElementById('headerModeSelect');
      if (select) select.value = ui.header_mode;
    }

    // 2. Text Modal Position
    if (ui.text_modal_position) {
      changeTextModalPosition(ui.text_modal_position, false);
      const select = document.getElementById('textModalPositionSelect');
      if (select) select.value = ui.text_modal_position;
    }

    // 3. User Menu Position
    if (ui.user_menu_position) {
      changeUserMenuPosition(ui.user_menu_position, false);
      const select = document.getElementById('userMenuPositionSelect');
      if (select) select.value = ui.user_menu_position;
    }

    // 4. Screenshot Delay
    if (ui.screenshot_delay) {
      changeScreenshotDelay(ui.screenshot_delay, false);
      const input = document.getElementById('screenshotDelayInput');
      if (input) input.value = ui.screenshot_delay;
    }

    // 5. Language
    if (ui.language) {
      // i18n 모듈이 있으면 언어 설정 (setLanguage 함수가 있다고 가정)
      if (typeof setLanguage === 'function') {
        const select = document.getElementById('languageSelect');
        if (select) select.value = ui.language;
        // setLanguage는 보통 내부적으로 로컬리소스를 다시 로드하므로
        // 여기서 호출하면 됨. 단, 무한루프 방지 주의
      }
    }

    // 6. Header Items
    if (ui.header_items) {
      applyHeaderItemsSettings(ui.header_items);
    }
  }
});

// 텍스트 모달 위치 적용 (UI Only)
function applyTextModalPosition(position) {
  const dialog = document.getElementById('typeTextModalDialog');
  if (!dialog) return;

  // 기존 위치 클래스 제거
  dialog.classList.remove('modal-dialog-centered', 'modal-dialog-scrollable');

  // 스타일 초기화
  dialog.style.marginTop = '';
  dialog.style.marginLeft = '';

  // 위치에 따라 스타일 적용
  switch (position) {
    case 'center':
      dialog.classList.add('modal-dialog-centered');
      break;
    case 'top':
      dialog.style.marginTop = '60px';
      break;
    case 'top-start':
      dialog.style.marginTop = '60px';
      dialog.style.marginLeft = '10px';
      break;
  }
}

// 헤더 모드 변경 함수
function changeHeaderMode(mode, save = true) {
  const navbar = document.getElementById('topNavbar');
  if (!navbar) return;

  const body = document.body;

  navbar.classList.remove('fixed-top');
  body.classList.remove('floating-header-mode');
  body.classList.remove('header-visible');
  navbar.classList.remove('show');
  body.style.paddingTop = '0px';

  switch (mode) {
    case 'fixed':
      navbar.classList.add('fixed-top');
      const navbarHeight = navbar.offsetHeight || 60;
      body.style.paddingTop = navbarHeight + 'px';
      break;
    case 'floating':
      body.classList.add('floating-header-mode');
      break;
    case 'normal':
    default:
      break;
  }

  if (save) {
    SettingsAPI.save('ui', 'header_mode', mode);
    localStorage.setItem('headerMode', mode); // Fallback & rapid access

    if (typeof showToast === 'function') {
      let modeName = mode === 'fixed' ? '상단 고정' : mode === 'floating' ? '플로팅 자동 숨김' : '기본 (스크롤)';
      showToast(`✅ 헤더 스타일 변경: ${modeName}`, 'success', 1000);
    }
  }
}

// 구형 함수 호환성
function toggleHeaderFixed(isFixed) {
  changeHeaderMode(isFixed ? 'fixed' : 'normal');
}

// 텍스트 모달 위치 변경
function changeTextModalPosition(position, save = true) {
  applyTextModalPosition(position);

  if (save) {
    SettingsAPI.save('ui', 'text_modal_position', position);
    localStorage.setItem('textModalPosition', position);

    if (typeof showToast === 'function') {
      const positionName = position === 'center' ? '중앙' : position === 'top' ? '상단' : '왼쪽 상단';
      showToast(`✅ 텍스트 입력 팝업 위치: ${positionName}`, 'success', 1500);
    }
  }
}

// 설정 메뉴 모달 열기
function showSettingsMenuModal() {
  const modalEl = document.getElementById('settingMenuModal');
  if (!modalEl) {
    console.error('settingMenuModal not found');
    return;
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  // 위치 적용
  const position = localStorage.getItem('userMenuPosition') || 'center';
  applyUserMenuPosition(position);
}

// 사용자 메뉴 모달 닫기
function closesettingMenuModal() {
  const modalEl = document.getElementById('settingMenuModal');
  if (!modalEl) return;

  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) {
    modal.hide();
  }
}

// 사용자 메뉴 위치 적용 (UI Only)
function applyUserMenuPosition(position) {
  const dialog = document.getElementById('settingMenuModalDialog');
  if (!dialog) return;

  // 기존 위치 클래스 제거
  dialog.classList.remove('modal-dialog-centered', 'modal-dialog-scrollable');
  dialog.classList.remove('user-menu-top', 'user-menu-center', 'user-menu-top-start');

  // 스타일 초기화
  dialog.style.marginTop = '';
  dialog.style.marginLeft = '';

  // 위치에 따라 스타일 적용
  switch (position) {
    case 'center':
      dialog.classList.add('modal-dialog-centered');
      break;
    case 'top':
      dialog.style.marginTop = '60px';
      break;
    case 'top-start':
      dialog.style.marginTop = '60px';
      dialog.style.marginLeft = '10px';
      break;
  }
}

// 사용자 메뉴 위치 변경
function changeUserMenuPosition(position, save = true) {
  applyUserMenuPosition(position);

  if (save) {
    SettingsAPI.save('ui', 'user_menu_position', position);
    localStorage.setItem('userMenuPosition', position);

    if (typeof showToast === 'function') {
      const positionName = position === 'center' ? '중앙' : position === 'top' ? '상단' : '왼쪽 상단';
      showToast(`✅ 사용자 메뉴 위치: ${positionName}`, 'success', 1500);
    }
  }
}

// 스크린샷 지연시간 변경
function changeScreenshotDelay(value, save = true) {
  const delay = parseInt(value, 10);
  if (isNaN(delay) || delay < 0) return;

  window.SCREENSHOT_DELAY_MS = delay;

  if (save) {
    SettingsAPI.save('ui', 'screenshot_delay', delay);
    localStorage.setItem('screenshotDelay', delay);

    if (typeof showToast === 'function') {
      showToast(`✅ 갱신 지연시간 저장됨: ${delay}ms`, 'success', 1000);
    }
  }
}

// 헤더 항목 표시/숨기기
async function toggleHeaderItem(itemName, visible) {
  const element = document.querySelector(`[data-header-item="${itemName}"]`);
  if (!element) return;

  if (visible) {
    element.style.display = '';
  } else {
    element.style.display = 'none';
  }

  // 현재 header_items 설정 가져오기
  const settings = await SettingsAPI.load();
  if (settings && settings.ui && settings.ui.header_items) {
    settings.ui.header_items[itemName] = visible;
    // 전체 header_items 저장
    await SettingsAPI.save('ui', 'header_items', settings.ui.header_items);
  }
}

// 모든 헤더 항목 설정 적용
function applyHeaderItemsSettings(headerItems) {
  if (!headerItems) return;

  Object.keys(headerItems).forEach(itemName => {
    const visible = headerItems[itemName];
    const element = document.querySelector(`[data-header-item="${itemName}"]`);
    if (element) {
      element.style.display = visible ? '' : 'none';
    }

    // 체크박스 상태 업데이트
    const checkbox = document.getElementById(`headerItem${itemName.charAt(0).toUpperCase() + itemName.slice(1)}`);
    if (checkbox) {
      checkbox.checked = visible;
    }
  });
}

// 전역 노출
window.showSettingsMenuModal = showSettingsMenuModal;
window.closesettingMenuModal = closesettingMenuModal;
window.changeHeaderMode = changeHeaderMode;
window.toggleHeaderFixed = toggleHeaderFixed;
window.changeTextModalPosition = changeTextModalPosition;
window.changeScreenshotDelay = changeScreenshotDelay;
window.toggleHeaderItem = toggleHeaderItem;



// ESC 키로 팝업 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeTypeTextModal();
    closeSettingModal();
    closeVoiceHistoryModal();
    if (typeof closeClickRecorderModal === 'function') {
      closeClickRecorderModal();
    }
  }
});

// 설정 모달 표시
function showSettingModal() {
  // 직접 입력 모드가 활성화되어 있으면 비활성화
  if (typeof disableDirectInputMode === 'function' && window.directInputMode) {
    disableDirectInputMode();
  }

  const modalEl = document.getElementById("settingModal");
  if (!modalEl) return;

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

// 설정 모달 닫기
function closeSettingModal() {
  const modalEl = document.getElementById("settingModal");
  if (!modalEl) return;

  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) {
    modal.hide();
  }
}

// 음성 히스토리 모달 표시
function showVoiceHistoryModal() {
  // 직접 입력 모드가 활성화되어 있으면 비활성화
  if (typeof disableDirectInputMode === 'function' && window.directInputMode) {
    disableDirectInputMode();
  }

  const modalEl = document.getElementById("voiceHistoryModal");
  if (!modalEl) return;

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  // 모달이 완전히 열린 후 음성 기능 초기화
  modalEl.addEventListener('shown.bs.modal', function onShown() {
    if (typeof initializeVoiceFeatures === 'function') {
      initializeVoiceFeatures();
    }
    modalEl.removeEventListener('shown.bs.modal', onShown); // 일회성 리스너
  });
}

// 음성 히스토리 모달 닫기
function closeVoiceHistoryModal() {
  const modalEl = document.getElementById("voiceHistoryModal");
  if (!modalEl) return;

  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) {
    modal.hide();
  }

  // 음성 기능 정리
  if (window.voiceStt) {
    window.voiceStt.destroy();
  }
}

// 텍스트 입력 모달 표시
function showTypeTextModal() {
  // 직접 입력 모드가 활성화되어 있으면 비활성화
  if (typeof disableDirectInputMode === 'function' && window.directInputMode) {
    disableDirectInputMode();
  }


  // 1. 모달 요소 가져오기
  const modalEl = document.getElementById("typeTextModal");
  if (!modalEl) return;

  // 2. Bootstrap 모달 인스턴스 생성 (없으면 생성)
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  // 3. 모달 표시
  modal.show();

  // 4. 모달이 완전히 열린 후 포커스 및 스크롤 핸들러 부착
  modalEl.addEventListener('shown.bs.modal', function onShown() {
    const input = document.getElementById("textToType");
    if (input) input.focus();
    modalEl.removeEventListener('shown.bs.modal', onShown); // 일회성 리스너
  });

  // attach wheel-to-key handler so scrolling inside the typing modal sends page up/down to server
  try {
    const modalEl = document.getElementById('typeTextModal');
    if (modalEl && !modalEl._wheelHandlerInstalled) {
      // debounce to avoid flooding
      let lastWheelAt = 0;
      const wheelHandler = (ev) => {
        const now = Date.now();
        if (now - lastWheelAt < 150) return; // throttle 150ms
        lastWheelAt = now;

        // deltaY > 0 means scrolling down -> page down
        if (ev.deltaY > 0) {
          if (typeof performKeyPress === 'function') performKeyPress('pagedown');
        } else if (ev.deltaY < 0) {
          if (typeof performKeyPress === 'function') performKeyPress('pageup');
        }

        // prevent the modal's own scroll from also moving underlying page
        ev.preventDefault();
      };

      // use passive: false so preventDefault works
      modalEl.addEventListener('wheel', wheelHandler, { passive: false });
      modalEl._wheelHandler = wheelHandler;
      modalEl._wheelHandlerInstalled = true;
    }
  } catch (e) { /* ignore */ }
}

// 텍스트 입력 모달 닫기
function closeTypeTextModal() {
  const modalEl = document.getElementById("typeTextModal");
  if (modalEl) {
    const modal = bootstrap.Modal.getInstance(modalEl); // 이미 존재하는 인스턴스 가져오기
    if (modal) {
      modal.hide();
    }
  }

  // 입력창 초기화
  document.getElementById("textToType").value = "";

  // 음성 녹음 정리
  if (window.textModalStt) {
    window.textModalStt.destroy();
    window.textModalStt = null;
  }

  // 음성 버튼 상태 초기화
  updateTextModalVoiceButton('idle');

  // detach wheel handler if present
  try {
    const modalEl = document.getElementById('typeTextModal');
    if (modalEl && modalEl._wheelHandlerInstalled && modalEl._wheelHandler) {
      modalEl.removeEventListener('wheel', modalEl._wheelHandler);
      delete modalEl._wheelHandler;
      modalEl._wheelHandlerInstalled = false;
    }
  } catch (e) { /* ignore */ }
}

// 텍스트 모달 음성 녹음 상태
let textModalVoiceState = 'idle'; // idle, recording, processing

// 텍스트 모달 음성 녹음 토글
function toggleTextModalRecording() {
  if (textModalVoiceState === 'idle') {
    startTextModalRecording();
  } else if (textModalVoiceState === 'recording') {
    stopTextModalRecording();
  }
  // processing 상태일 때는 아무것도 하지 않음
}

// 텍스트 모달용 음성 녹음 시작
function startTextModalRecording() {
  // SpeechToText 클래스 확인
  if (typeof SpeechToText === 'undefined') {
    if (typeof showToast === 'function') {
      showToast('❌ 음성 인식 기능을 사용할 수 없습니다', 'error');
    }
    return;
  }

  // 기존 인스턴스 정리
  if (window.textModalStt) {
    window.textModalStt.destroy();
  }

  // 새 음성 인식 인스턴스 생성
  window.textModalStt = new SpeechToText({
    apiEndpoint: '/transcribe',
    onPermissionGranted: () => {
      console.log('텍스트 모달: 마이크 권한 허용됨');
    },
    onPermissionDenied: (error) => {
      updateTextModalVoiceButton('idle');
      if (typeof showToast === 'function') {
        showToast(`❌ ${error}`, 'error');
      }
    },
    onRecordingStart: () => {
      updateTextModalVoiceButton('recording');
    },
    onRecordingStop: () => {
      updateTextModalVoiceButton('processing');
    },
    onTranscriptionStart: () => {
      updateTextModalVoiceButton('processing');
    },
    onTranscriptionSuccess: (text) => {
      // 인식된 텍스트를 textarea에 추가
      const textarea = document.getElementById('textToType');
      if (textarea) {
        const currentText = textarea.value;
        textarea.value = currentText ? currentText + ' ' + text : text;
      }
      updateTextModalVoiceButton('idle');
      if (typeof showToast === 'function') {
        showToast(`✅ 음성 인식 완료`, 'success', 1500);
      }
    },
    onTranscriptionError: (error) => {
      updateTextModalVoiceButton('idle');
      if (typeof showToast === 'function') {
        showToast(`❌ 변환 실패: ${error}`, 'error');
      }
    },
    onError: (message, error) => {
      updateTextModalVoiceButton('idle');
      if (typeof showToast === 'function') {
        showToast(`❌ 오류: ${message}`, 'error');
      }
      console.error('Text modal voice error:', error);
    }
  });

  // 녹음 시작
  window.textModalStt.startRecording();
}

// 텍스트 모달용 음성 녹음 중지
function stopTextModalRecording() {
  if (window.textModalStt) {
    window.textModalStt.stopRecording();
  }
}

// 텍스트 모달 음성 버튼 상태 업데이트
function updateTextModalVoiceButton(state) {
  textModalVoiceState = state;
  const btn = document.getElementById('textModalVoiceBtn');
  if (!btn) return;

  const icon = btn.querySelector('i');

  switch (state) {
    case 'recording':
      btn.className = 'btn btn-dark w-100';
      if (icon) icon.className = 'bi bi-stop-fill';
      btn.innerHTML = '<i class="bi bi-stop-fill"></i> 중지';
      btn.disabled = false;
      break;
    case 'processing':
      btn.className = 'btn btn-warning w-100';
      if (icon) icon.className = 'bi bi-hourglass-split';
      btn.innerHTML = '<i class="bi bi-hourglass-split"></i> 변환중';
      btn.disabled = true;
      break;
    case 'idle':
    default:
      btn.className = 'btn btn-danger w-100';
      if (icon) icon.className = 'bi bi-mic-fill';
      btn.innerHTML = '<i class="bi bi-mic-fill"></i> 녹음';
      btn.disabled = false;
      break;
  }
}



