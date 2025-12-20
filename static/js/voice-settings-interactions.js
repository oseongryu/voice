/**
 * Voice Settings Modal - Interaction Logic
 * Handles voice command settings, configuration, and management
 */

window.modalVoiceCommands = [];

window.showVoiceSettingsModal = function () {
    const el = document.getElementById('voiceSettingsModal');
    if (!el) return;
    const modal = bootstrap.Modal.getOrCreateInstance(el);
    modal.show();
    loadVoiceSettings();
}

window.loadVoiceSettings = async function () {
    // 인증 확인
    if (typeof AuthUtils === 'undefined') {
        console.log('AuthUtils not loaded yet');
        return;
    }

    const token = AuthUtils.getStoredToken();
    if (!token || AuthUtils.isTokenExpired(token)) {
        console.log('No valid token, cannot load voice settings');
        if (typeof showToast === 'function') {
            showToast('로그인이 필요합니다', 'warning');
        }
        return;
    }

    try {
        // Load Basic Settings
        const settingsRes = await fetch(AppConfig.getApiUrl('/api/settings'));
        const settingsData = await settingsRes.json();
        const triggerInput = document.getElementById('triggerPhraseInput');
        if (triggerInput && settingsData.triggerPhrase) {
            triggerInput.value = settingsData.triggerPhrase;
        }
        const timeoutInput = document.getElementById('timeoutInput');
        if (timeoutInput && settingsData.timeout) {
            timeoutInput.value = settingsData.timeout;
        }

        // Load Commands
        const cmdsRes = await fetch(AppConfig.getApiUrl('/api/voice-commands'));
        const cmdsData = await cmdsRes.json();
        window.modalVoiceCommands = cmdsData.commands || [];
        renderVoiceCommands();

    } catch (e) {
        console.error('설정 로드 실패:', e);
        if (typeof showToast === 'function') showToast('설정 로드 실패', 'error');
    }
}

window.saveBasicSettings = async function () {
    const phraseInput = document.getElementById('triggerPhraseInput');
    const timeoutInput = document.getElementById('timeoutInput');

    if (!phraseInput || !timeoutInput) return;

    const phrase = phraseInput.value.trim();
    const timeout = timeoutInput.value;

    if (!phrase) {
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('msg.input_trigger') : '호출어를 입력해주세요', 'warning');
        return;
    }

    try {
        const res = await fetch(AppConfig.getApiUrl('/api/settings'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                triggerPhrase: phrase,
                timeout: timeout
            })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('msg.basic_settings_saved') : '기본 설정이 저장되었습니다.', 'success');
            if (window.globalVoiceActivation) {
                window.globalVoiceActivation.triggerPhrase = phrase;
                if (timeout) window.globalVoiceActivation.commandTimeout = parseInt(timeout) * 1000;
            }
        } else {
            if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('msg.save_fail') : '저장 실패', 'error');
        }
    } catch (e) {
        console.error('저장 오류:', e);
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('msg.error') : '저장 중 오류 발생', 'error');
    }
}

window.renderVoiceCommands = function () {
    const tbody = document.getElementById('customCommandsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const actionLabels = {
        'SCREENSHOT': typeof t === 'function' ? t('action.screenshot') : '스크린샷 촬영',
        'REFRESH': typeof t === 'function' ? t('action.refresh') : '새로고침',
        'ZOOM_IN': typeof t === 'function' ? t('action.zoom_in') : '확대',
        'ZOOM_OUT': typeof t === 'function' ? t('action.zoom_out') : '축소',
        'ZOOM_RESET': typeof t === 'function' ? t('action.zoom_reset') : '줌 초기화',
        'TEXT_MODAL': typeof t === 'function' ? t('action.text_modal') : '텍스트 입력 창',
        'HISTORY_MODAL': typeof t === 'function' ? t('action.history_modal') : '히스토리 창',
        'DEBUG_MODAL': typeof t === 'function' ? t('action.debug_modal') : '설정/디버그 창',
        'CLICK_RECORDER': typeof t === 'function' ? t('action.macro_recorder') : '매크로 기록 창',
        'WS_MODE': typeof t === 'function' ? t('action.ws_mode') : '웹소켓 모드 전환',
        'SCREENSHOT_MODE': typeof t === 'function' ? t('action.screenshot_mode') : '스크린샷 모드 전환',
        'CLOSE': typeof t === 'function' ? t('action.close') : '종료 (닫기)'
    };

    if (window.modalVoiceCommands.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">등록된 커스텀 명령어가 없습니다.</td></tr>';
        return;
    }

    window.modalVoiceCommands.forEach(cmd => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
    <td><span class="badge bg-light text-dark border">${cmd.phrase}</span></td>
    <td>${actionLabels[cmd.action] || cmd.action}</td>
    <td>${cmd.description || '-'}</td>
    <td>
      <button class="btn btn-sm btn-outline-danger" onclick="deleteCustomCommand(${cmd.id})">
        <i class="bi bi-trash"></i>
      </button>
    </td>
  `;
        tbody.appendChild(tr);
    });
}

window.showAddCommandForm = function () {
    const el = document.getElementById('addCommandForm');
    if (el) el.style.display = 'block';
}

window.hideAddCommandForm = function () {
    const el = document.getElementById('addCommandForm');
    if (el) el.style.display = 'none';
    const phrase = document.getElementById('newCommandPhrase');
    if (phrase) phrase.value = '';
    const desc = document.getElementById('newCommandDesc');
    if (desc) desc.value = '';
    const action = document.getElementById('newCommandAction');
    if (action) action.value = 'SCREENSHOT';
}

window.addCustomCommand = async function () {
    const phraseInput = document.getElementById('newCommandPhrase');
    const actionInput = document.getElementById('newCommandAction');
    const descInput = document.getElementById('newCommandDesc');

    if (!phraseInput || !actionInput || !descInput) return;

    const phrase = phraseInput.value.trim();
    const action = actionInput.value;
    const desc = descInput.value.trim();

    if (!phrase) {
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('msg.input_phrase') : '명령어를 입력해주세요', 'warning');
        return;
    }

    try {
        const res = await fetch(AppConfig.getApiUrl('/api/voice-commands'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phrase, action, description: desc })
        });
        const data = await res.json();
        if (data.success) {
            if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('msg.command_added') : '명령어가 추가되었습니다', 'success');
            hideAddCommandForm();
            loadVoiceSettings(); // Reload list
            if (window.loadVoiceIntegrationSettings) window.loadVoiceIntegrationSettings();
        } else {
            if (typeof showToast === 'function') showToast('추가 실패: ' + (data.error || '알 수 없는 오류'), 'error');
        }
    } catch (e) {
        console.error('추가 오류:', e);
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('msg.error') : '추가 중 오류 발생', 'error');
    }
}

window.deleteCustomCommand = async function (id) {
    if (!confirm(typeof t === 'function' ? t('msg.confirm_delete') : '정말 삭제하시겠습니까?')) return;

    try {
        const res = await fetch(AppConfig.getApiUrl(`/api/voice-commands/${id}`), {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('msg.command_deleted') : '삭제되었습니다', 'success');
            loadVoiceSettings();
            if (window.loadVoiceIntegrationSettings) window.loadVoiceIntegrationSettings();
        } else {
            if (typeof showToast === 'function') showToast('삭제 실패', 'error');
        }
    } catch (e) {
        console.error('삭제 오류:', e);
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('msg.error') : '삭제 중 오류 발생', 'error');
    }
}
