/**
 * Voice Activation Integration
 * 음성 활성화와 기존 시스템 통합 모듈
 */

// 전역 변수
let globalVoiceActivation = null;
let globalSpeechToText = null;
let isVoiceActivationActive = false;

/**
 * 음성 활성화 통합 초기화
 */
async function initializeVoiceActivationIntegration() {
  if (!window.VoiceActivation || !window.SpeechToText) {
    // 모듈들이 로드될 때까지 대기
    setTimeout(initializeVoiceActivationIntegration, 100);
    return;
  }

  const settings = await loadVoiceIntegrationSettings();

  // 음성 인식용 SpeechToText 인스턴스 생성
  globalSpeechToText = new SpeechToText({
    apiEndpoint: '/transcribe',
    onTranscriptionSuccess: (text) => {
      handleVoiceCommand(text);
    },
    onTranscriptionError: (error) => {
      showToast(`음성 인식 오류: ${error}`, 'error');
    },
    onError: (message, error) => {
      showToast(`음성 오류: ${message}`, 'error');
      console.error('Voice activation speech error:', error);
    }
  });

  // 음성 활성화 인스턴스 생성
  globalVoiceActivation = new VoiceActivation({
    triggerPhrase: settings.triggerPhrase,
    commandTimeout: settings.timeout,
    speechToText: globalSpeechToText,
    onActivationStart: () => {
      updateVoiceActivationUI(true);
      showToast(`🎙️ 음성 활성화 시작 - "${globalVoiceActivation.triggerPhrase}"라고 말하세요 (대기: ${globalVoiceActivation.commandTimeout / 1000}초)`, 'info');
    },
    onActivationStop: () => {
      updateVoiceActivationUI(false);
      showToast('🎙️ 음성 활성화 중지', 'info');
    },
    onTriggerDetected: () => {
      showToast('🎯 명령을 말씀하세요...', 'success');
      // 버튼에 시각적 피드백
      pulseVoiceActivationButton();
      // 플로팅 메뉴 표시
      showVoiceOverlay();
    },
    onCommandReceived: (command) => {
      // 명령 수신 시 오버레이 상태 업데이트 (즉시 닫지 않음, 처리 결과에 따라 닫음)
      updateVoiceOverlayStatus(`수신됨: "${command}"...`);
      // showToast(`📝 명령 수신: "${command}"`, 'info'); 
    },
    onCommandTimeout: () => {
      showToast('⏰ 명령 대기 시간 초과', 'warning');
      hideVoiceOverlay();
    },
    onPermissionDenied: (error) => {
      showToast(error, 'error');
      hideVoiceOverlay();
    },
    onError: (error) => {
      showToast(`음성 활성화 오류: ${error}`, 'error');
      hideVoiceOverlay();
    }
  });

  // console.log('음성 활성화 통합 초기화 완료');
}

/**
 * 음성 활성화 토글
 */
function toggleVoiceActivation() {
  if (!globalVoiceActivation) {
    showToast('음성 활성화 모듈이 준비되지 않았습니다.', 'error');
    return;
  }

  if (isVoiceActivationActive) {
    globalVoiceActivation.stopActivation();
    isVoiceActivationActive = false;
    hideVoiceOverlay();
  } else {
    globalVoiceActivation.startActivation().then(success => {
      if (success) {
        isVoiceActivationActive = true;
      }
    });
  }
}

/**
 * 음성 오버레이 표시
 */
function showVoiceOverlay() {
  const overlay = document.getElementById('voiceCommandOverlay');
  const status = document.getElementById('voiceCommandStatus');
  if (overlay) {
    overlay.style.display = 'block';
    if (status) status.textContent = "명령을 말씀하세요...";
  }
}

/**
 * 음성 오버레이 숨김
 */
function hideVoiceOverlay() {
  const overlay = document.getElementById('voiceCommandOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * 음성 오버레이 상태 텍스트 업데이트
 */
function updateVoiceOverlayStatus(text) {
  const status = document.getElementById('voiceCommandStatus');
  if (status) {
    status.textContent = text;
  }
}

let customVoiceCommands = [];

async function loadVoiceIntegrationSettings() {
  try {
    // Load Voice Settings
    const settingsRes = await fetch('/api/settings');
    const settingsData = await settingsRes.json();

    if (globalVoiceActivation) {
      if (settingsData.triggerPhrase) {
        globalVoiceActivation.triggerPhrase = settingsData.triggerPhrase;
      }
      if (settingsData.timeout) {
        globalVoiceActivation.commandTimeout = settingsData.timeout * 1000; // ms conversion
      }
    }

    // Load Commands
    const cmdsRes = await fetch('/api/voice-commands');
    const cmdsData = await cmdsRes.json();
    customVoiceCommands = cmdsData.commands || [];

    return {
      triggerPhrase: settingsData.triggerPhrase || '인식해줘',
      timeout: settingsData.timeout ? settingsData.timeout * 1000 : 5000
    };
  } catch (e) {
    console.error('Failed to load voice settings:', e);
    return {
      triggerPhrase: '인식해줘',
      timeout: 5000
    };
  }
}

function executeAction(actionCode) {
  switch (actionCode) {
    case 'SCREENSHOT':
      if (typeof getCurrentInputMode === 'function' && getCurrentInputMode() === 'websocket') {
        if (typeof requestWebSocketScreenshot === 'function') requestWebSocketScreenshot();
      } else {
        takeNewScreenshot();
      }
      showToast('📸 스크린샷을 촬영합니다', 'success');
      return true;
    case 'REFRESH':
      if (typeof getCurrentInputMode === 'function' && getCurrentInputMode() === 'websocket') {
        if (typeof requestWebSocketScreenshot === 'function') requestWebSocketScreenshot();
      } else {
        takeNewScreenshot();
      }
      showToast('🔄 화면을 새로고침합니다', 'success');
      return true;
    case 'ZOOM_IN':
      zoomIn();
      showToast('🔍 화면을 확대합니다', 'success');
      return true;
    case 'ZOOM_OUT':
      zoomOut();
      showToast('🔍 화면을 축소합니다', 'success');
      return true;
    case 'ZOOM_RESET':
      resetZoom();
      showToast('🔍 줌을 리셋합니다', 'success');
      return true;
    case 'TEXT_MODAL':
      showTypeTextModal();
      showToast('⌨️ 텍스트 입력 창을 엽니다', 'success');
      return true;
    case 'HISTORY_MODAL':
      showVoiceHistoryModal();
      showToast('🎤 음성 히스토리를 엽니다', 'success');
      return true;
    case 'DEBUG_MODAL':
      showDebugModal();
      showToast('🔧 디버그 창을 엽니다', 'success');
      return true;
    case 'CLICK_RECORDER':
      showClickRecorderModal();
      showToast('📹 클릭 기록 창을 엽니다', 'success');
      return true;
    case 'WS_MODE':
      switchToWebSocketMode();
      showToast('📡 웹소켓 모드로 전환합니다', 'success');
      return true;
    case 'SCREENSHOT_MODE':
      switchToScreenshotMode();
      showToast('📸 스크린샷 모드로 전환합니다', 'success');
      return true;
    case 'CLOSE':
      hideVoiceOverlay();
      return true;
    default:
      return false;
  }
}

/**
 * 음성 명령 처리
 */
function handleVoiceCommand(command) {
  const normalizedCommand = command.trim().toLowerCase();

  console.log('음성 명령 처리:', command);

  // 1. "닫아줘" / "종료" / "취소" 명령 처리 (즉시 종료)
  if (normalizedCommand.includes('닫아') || normalizedCommand.includes('종료') || normalizedCommand.includes('취소') || normalizedCommand.includes('그만')) {
    showToast('명령 대기를 종료합니다', 'info');
    hideVoiceOverlay();
    return;
  }

  // Custom Commands check
  for (const cmd of customVoiceCommands) {
    if (normalizedCommand.includes(cmd.phrase)) {
      console.log('커스텀 명령 실행:', cmd.phrase, cmd.action);
      executeAction(cmd.action);
      setTimeout(hideVoiceOverlay, 1000);
      return;
    }
  }

  // 명령 실행 후 오버레이를 닫을지 여부 (기본값: 닫음)
  let shouldCloseOverlay = true;

  // 스크린샷 관련 명령
  if (normalizedCommand.includes('스크린샷') || normalizedCommand.includes('화면') || normalizedCommand.includes('캡처')) {
    if (typeof getCurrentInputMode === 'function' && getCurrentInputMode() === 'websocket') {
      if (typeof requestWebSocketScreenshot === 'function') {
        requestWebSocketScreenshot();
      }
    } else {
      takeNewScreenshot();
    }
    showToast('📸 스크린샷을 촬영합니다', 'success');
  }

  // 새로고침 명령
  else if (normalizedCommand.includes('새로고침') || normalizedCommand.includes('리프레시') || normalizedCommand.includes('갱신')) {
    if (typeof getCurrentInputMode === 'function' && getCurrentInputMode() === 'websocket') {
      if (typeof requestWebSocketScreenshot === 'function') {
        requestWebSocketScreenshot();
      }
    } else {
      takeNewScreenshot();
    }
    showToast('🔄 화면을 새로고침합니다', 'success');
  }

  // 줌 관련 명령
  else if (normalizedCommand.includes('확대') || normalizedCommand.includes('줌인')) {
    zoomIn();
    showToast('🔍 화면을 확대합니다', 'success');
  }

  else if (normalizedCommand.includes('축소') || normalizedCommand.includes('줌아웃')) {
    zoomOut();
    showToast('🔍 화면을 축소합니다', 'success');
  }

  else if (normalizedCommand.includes('줌') && normalizedCommand.includes('리셋')) {
    resetZoom();
    showToast('🔍 줌을 리셋합니다', 'success');
  }

  // 모달 관련 명령
  else if (normalizedCommand.includes('텍스트') && normalizedCommand.includes('입력')) {
    showTypeTextModal();
    showToast('⌨️ 텍스트 입력 창을 엽니다', 'success');
  }

  else if (normalizedCommand.includes('음성') && normalizedCommand.includes('히스토리')) {
    showVoiceHistoryModal();
    showToast('🎤 음성 히스토리를 엽니다', 'success');
  }

  else if (normalizedCommand.includes('디버그') || normalizedCommand.includes('설정')) {
    showDebugModal();
    showToast('🔧 디버그 창을 엽니다', 'success');
  }

  // 클릭 기록 관련
  else if (normalizedCommand.includes('클릭') && normalizedCommand.includes('기록')) {
    showClickRecorderModal();
    showToast('📹 클릭 기록 창을 엽니다', 'success');
  }

  // WebSocket 모드 관련
  else if (normalizedCommand.includes('웹소켓') || normalizedCommand.includes('실시간')) {
    switchToWebSocketMode();
    showToast('📡 웹소켓 모드로 전환합니다', 'success');
  }

  else if (normalizedCommand.includes('스크린샷') && normalizedCommand.includes('모드')) {
    switchToScreenshotMode();
    showToast('📸 스크린샷 모드로 전환합니다', 'success');
  }

  // 좌표 클릭 명령 (예: "1백 2백 클릭", "일백 이백 클릭")
  else if (normalizedCommand.match(/(\d+).*?(\d+).*?(클릭|터치)/)) {
    const clickMatch = normalizedCommand.match(/(\d+).*?(\d+).*?(클릭|터치)/);
    const x = parseInt(clickMatch[1]);
    const y = parseInt(clickMatch[2]);

    if (!isNaN(x) && !isNaN(y)) {
      // 좌표 클릭 실행
      if (typeof performClickAtCoordinates === 'function') {
        performClickAtCoordinates(x, y);
        showToast(`👆 좌표 (${x}, ${y})를 클릭합니다`, 'success');
      } else {
        showToast(`좌표 클릭 기능을 찾을 수 없습니다`, 'error');
      }
    }
  }

  // 텍스트 입력 명령 (예: "hello 입력", "안녕하세요 타이핑")
  else if (normalizedCommand.match(/(.+?)\s*(입력|타이핑|타이프)/)) {
    const textMatch = normalizedCommand.match(/(.+?)\s*(입력|타이핑|타이프)/);
    const textToType = textMatch[1].trim();
    if (textToType) {
      if (typeof typeTextViaAPI === 'function') {
        typeTextViaAPI(textToType);
        showToast(`⌨️ "${textToType}"를 입력합니다`, 'success');
      } else {
        showToast(`텍스트 입력 기능을 찾을 수 없습니다`, 'error');
      }
    }
  }

  // 녹음 및 입력 명령 (예: "녹음 안녕하세요", "기록 hello")
  else if (normalizedCommand.match(/^(녹음|기록)\s+(.+)/)) {
    const match = normalizedCommand.match(/^(녹음|기록)\s+(.+)/);
    const textToType = match[2].trim();
    if (textToType) {
      executeRecordAndPaste(textToType);
    }
  }
  else {
    // 인식하지 못한 명령
    shouldCloseOverlay = false; // 창을 닫지 않고 다시 시도할 기회 제공?
    // 아니면 그냥 닫고 알려줌? 
    // "handleCommand"가 끝나면 isWaitingForCommand가 false가 되므로, 
    // VoiceActivation loop는 Trigger 감지 모드로 돌아감.
    // 따라서 오버레이는 닫아주는게 UX상 맞음 (이미 명령 시퀀스가 끝남).

    // 하지만 "인식하지 못함"을 표시하고 잠시 후 닫는게 좋음
    updateVoiceOverlayStatus("❌ 알 수 없는 명령입니다");
    setTimeout(hideVoiceOverlay, 1500);
    return; // 아래 공통 닫기 로직 스킵
  }

  // 공통: 명령 처리 후 오버레이 닫기 (약간의 지연 후)
  if (shouldCloseOverlay) {
    setTimeout(hideVoiceOverlay, 1000);
  }
}
/**
 * 음성 활성화 UI 업데이트
 */
function updateVoiceActivationUI(isActive) {
  const buttons = ['voiceBtn', 'voiceBtnWs'];

  buttons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      if (isActive) {
        btn.classList.add('active', 'btn-success');
        btn.classList.remove('btn-outline-secondary');
        btn.title = '음성 활성화 중 - 클릭하여 중지';
      } else {
        btn.classList.remove('active', 'btn-success');
        btn.classList.add('btn-outline-secondary');
        btn.title = '음성 활성화 시작';
      }
    }
  });

  isVoiceActivationActive = isActive;
}

/**
 * 음성 활성화 버튼에 펄스 효과
 */
function pulseVoiceActivationButton() {
  const buttons = ['voiceBtn', 'voiceBtnWs'];

  buttons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn && btn.offsetParent !== null) { // 버튼이 보이는 경우만
      btn.style.transform = 'scale(1.2)';
      btn.style.transition = 'transform 0.2s ease';

      setTimeout(() => {
        btn.style.transform = 'scale(1)';
      }, 200);
    }
  });
}

/**
 * 토스트 메시지 표시
 */
function showToast(message, type = 'info') {
  // 기존 토스트 시스템 활용
  if (typeof showBottomToast === 'function') {
    showBottomToast(message, type);
  } else {
    // 폴백: 콘솔 로그
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * 녹음된 내용을 현재 위치에 클릭 후 붙여넣き
 */
async function executeRecordAndPaste(text) {
  if (!text) return;

  showToast(`📝 녹음 내용 입력 중: "${text}"`, 'info');

  try {
    // 1. 현재 위치 클릭 (API가 x,y 없을 시 현재 위치 클릭하도록 수정됨)
    await fetch('/api/click_position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ click_type: 'left' })
    });

    // 약간 대기 (클릭 포커스 확보)
    await new Promise(r => setTimeout(r, 100));

    // 2. 텍스트 입력
    if (typeof window.TextInputUtils !== 'undefined' && window.TextInputUtils.typeText) {
      await window.TextInputUtils.typeText(text);
    } else if (typeof typeTextViaAPI === 'function') {
      await typeTextViaAPI(text);
    } else {
      // Fallback
      await fetch('/api/type_text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      });
    }

  } catch (e) {
    console.error('녹음/입력 실패:', e);
    showToast('입력 작업 실패', 'error');
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 다른 모듈들이 로드된 후 초기화
  setTimeout(initializeVoiceActivationIntegration, 500);
});

// 전역 함수로 등록
if (typeof window !== 'undefined') {
  window.toggleVoiceActivation = toggleVoiceActivation;
  window.initializeVoiceActivationIntegration = initializeVoiceActivationIntegration;
  window.loadVoiceIntegrationSettings = loadVoiceIntegrationSettings;
}