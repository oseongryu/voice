/**
 * Text Input Utils Module
 * 텍스트 입력 및 키보드 조작 공통 유틸리티 함수들
 * - 텍스트 타이핑
 * - 단일 키 입력
 * - 키 조합 입력
 * - HTTP/WebSocket 자동 선택
 */

/**
 * 현재 모드 확인 (WebSocket/Screenshot)
 * @returns {string} 'websocket' 또는 'screenshot'
 */
function getCurrentInputMode() {
  // 웹소켓이 연결되어 있으면 우선적으로 웹소켓 모드 사용
  if (isWebSocketConnected()) {
    return 'websocket';
  }

  if (typeof getCurrentMode === 'function') {
    return getCurrentMode();
  }
  return 'screenshot'; // 기본값
}

/**
 * WebSocket 연결 상태 확인
 * @returns {boolean} WebSocket 연결 여부
 */
function isWebSocketConnected() {
  return typeof isConnected !== 'undefined' && isConnected;
}

/**
 * 인증 헤더 생성 (공통 모듈 사용)
 * @returns {Object} HTTP 요청용 헤더 객체
 */
function createAuthHeaders() {
  if (typeof window.AuthUtils !== 'undefined' && window.AuthUtils.createAuthHeaders) {
    return window.AuthUtils.createAuthHeaders({ "Content-Type": "application/json" });
  }

  // 폴백: 기존 방식
  const headers = {
    "Content-Type": "application/json",
  };

  const token = localStorage.getItem('authToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * 텍스트 타이핑 실행 (공통 인터페이스)
 * @param {string} text - 타이핑할 텍스트
 * @param {Object} options - 옵션 설정
 * @returns {Promise<boolean>} 성공 여부
 */
async function typeText(text, options = {}) {
  if (!text || text.trim() === '') {
    if (typeof showToast === 'function') {
      showToast("❌ 타이핑할 텍스트를 입력해주세요", "error");
    }
    return false;
  }

  const trimmedText = text.trim();
  const displayText = trimmedText.length > 30 ?
    trimmedText.substring(0, 30) + "..." : trimmedText;

  try {
    if (typeof showToast === 'function') {
      showToast(`⌨️ 텍스트를 타이핑합니다: "${displayText}"`, "info", 2000);
    }

    // 모드에 따른 API 선택
    if (getCurrentInputMode() === 'websocket') {
      return await typeTextViaWebSocket(trimmedText, options);
    } else {
      return await typeTextViaHTTP(trimmedText, options);
    }
  } catch (error) {
    console.error("텍스트 타이핑 오류:", error);
    if (typeof showToast === 'function') {
      showToast(`❌ 텍스트 타이핑 오류: ${error.message}`, "error");
    }
    return false;
  }
}

/**
 * WebSocket을 통한 텍스트 타이핑
 * @param {string} text - 타이핑할 텍스트
 * @param {Object} options - 옵션 설정
 * @returns {Promise<boolean>} 성공 여부
 */
async function typeTextViaWebSocket(text, options = {}) {
  if (!isWebSocketConnected()) {
    if (typeof showToast === 'function') {
      showToast("❌ WebSocket이 연결되지 않았습니다", "error");
    }
    return false;
  }

  if (typeof webSocketTypeText === 'function') {
    // Promise로 응답 대기 (타임아웃 5초)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (typeof socket !== 'undefined') {
          socket.off('text_typed', handler);
        }
        resolve(true); // 타임아웃 시에도 true 반환 (이미 전송됨)
      }, 5000);

      const handler = (data) => {
        clearTimeout(timeout);
        if (typeof socket !== 'undefined') {
          socket.off('text_typed', handler);
        }
        resolve(data.success);
      };

      if (typeof socket !== 'undefined') {
        socket.once('text_typed', handler);
      }

      webSocketTypeText(text);
    });
  } else {
    if (typeof showToast === 'function') {
      showToast("❌ WebSocket 텍스트 타이핑 함수를 찾을 수 없습니다", "error");
    }
    return false;
  }
}

/**
 * HTTP API를 통한 텍스트 타이핑
 * @param {string} text - 타이핑할 텍스트
 * @param {Object} options - 옵션 설정
 * @returns {Promise<boolean>} 성공 여부
 */
async function typeTextViaHTTP(text, options = {}) {
  try {
    const response = await fetch(AppConfig.getApiUrl("/api/type_text"), {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ text: text }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      if (typeof showToast === 'function') {
        showToast(`✅ 텍스트 타이핑 완료 (HTTP)`, "success", 2000);
      }

      // 타이핑 후 자동 스크린샷 (기본값: 설정값 또는 1초 후) - 웹소켓 모드가 아닐 때만
      if (options.autoScreenshot !== false && typeof takeNewScreenshot === 'function' && getCurrentInputMode() !== 'websocket') {
        const defaultDelay = (typeof window.SCREENSHOT_DELAY_MS !== 'undefined') ? window.SCREENSHOT_DELAY_MS : 1000;
        setTimeout(() => {
          if (typeof showToast === 'function') {
            showToast("🔄 화면 업데이트 중...", "info", 1500);
          }
          takeNewScreenshot();
        }, options.screenshotDelay || defaultDelay);
      }

      return true;
    } else {
      if (typeof showToast === 'function') {
        showToast(`❌ 텍스트 타이핑 실패: ${result.message || result.error}`, "error");
      }
      return false;
    }
  } catch (error) {
    console.error("HTTP 텍스트 타이핑 오류:", error);
    if (typeof showToast === 'function') {
      showToast(`❌ HTTP 텍스트 타이핑 오류: ${error.message}`, "error");
    }
    return false;
  }
}

/**
 * 단일 키 입력 실행 (공통 인터페이스)
 * @param {string} key - 누를 키 이름
 * @param {Object} options - 옵션 설정
 * @returns {Promise<boolean>} 성공 여부
 */
async function pressKey(key, options = {}) {
  if (!key) {
    console.error("pressKey: 키 이름이 필요합니다");
    return false;
  }

  try {
    if (typeof showToast === 'function') {
      showToast(`⌨️ ${key} 키를 누릅니다`, "info", 1500);
    }

    // 모드에 따른 API 선택
    if (getCurrentInputMode() === 'websocket') {
      return await pressKeyViaWebSocket(key, options);
    } else {
      return await pressKeyViaHTTP(key, options);
    }
  } catch (error) {
    console.error("키 입력 오류:", error);
    if (typeof showToast === 'function') {
      showToast(`❌ 키 입력 오류: ${error.message}`, "error");
    }
    return false;
  }
}

/**
 * WebSocket을 통한 단일 키 입력
 * @param {string} key - 누를 키 이름
 * @param {Object} options - 옵션 설정
 * @returns {Promise<boolean>} 성공 여부
 */
async function pressKeyViaWebSocket(key, options = {}) {
  if (!isWebSocketConnected()) {
    if (typeof showToast === 'function') {
      showToast("❌ WebSocket이 연결되지 않았습니다", "error");
    }
    return false;
  }

  if (typeof webSocketPressKey === 'function') {
    // Promise로 응답 대기 (타임아웃 3초)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (typeof socket !== 'undefined') {
          socket.off('key_pressed', handler);
        }
        resolve(true);
      }, 3000);

      const handler = (data) => {
        clearTimeout(timeout);
        if (typeof socket !== 'undefined') {
          socket.off('key_pressed', handler);
        }
        resolve(data.success);
      };

      if (typeof socket !== 'undefined') {
        socket.once('key_pressed', handler);
      }

      webSocketPressKey(key);
    });
  } else {
    if (typeof showToast === 'function') {
      showToast("❌ WebSocket 키 입력 함수를 찾을 수 없습니다", "error");
    }
    return false;
  }
}

/**
 * HTTP API를 통한 단일 키 입력
 * @param {string} key - 누를 키 이름
 * @param {Object} options - 옵션 설정
 * @returns {Promise<boolean>} 성공 여부
 */
async function pressKeyViaHTTP(key, options = {}) {
  try {
    const response = await fetch(AppConfig.getApiUrl("/api/press_key"), {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ key: key }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      if (typeof showToast === 'function') {
        showToast(`✅ ${key} 키 입력 완료 (HTTP)`, "success", 1500);
      }

      // 키 입력 후 자동 스크린샷 (기본값: 0.5초 후) - 웹소켓 모드가 아닐 때만
      if (options.autoScreenshot !== false && typeof takeNewScreenshot === 'function' && getCurrentInputMode() !== 'websocket') {
        setTimeout(() => {
          takeNewScreenshot();
        }, options.screenshotDelay || 500);
      }

      return true;
    } else {
      if (typeof showToast === 'function') {
        showToast(`❌ 키 입력 실패: ${result.message || result.error}`, "error");
      }
      return false;
    }
  } catch (error) {
    console.error("HTTP 키 입력 오류:", error);
    if (typeof showToast === 'function') {
      showToast(`❌ HTTP 키 입력 오류: ${error.message}`, "error");
    }
    return false;
  }
}

/**
 * 키 조합 입력 실행 (공통 인터페이스)
 * @param {Array<string>} keys - 키 조합 배열 (예: ['ctrl', 'c'])
 * @param {Object} options - 옵션 설정
 * @returns {Promise<boolean>} 성공 여부
 */
async function pressKeyCombination(keys, options = {}) {
  if (!Array.isArray(keys) || keys.length === 0) {
    console.error("pressKeyCombination: 키 배열이 필요합니다");
    return false;
  }

  try {
    const keyText = keys.join("+");
    if (typeof showToast === 'function') {
      showToast(`⌨️ ${keyText} 조합을 누릅니다`, "info", 1500);
    }

    // 모드에 따른 API 선택
    if (getCurrentInputMode() === 'websocket') {
      return await pressKeyCombinationViaWebSocket(keys, options);
    } else {
      return await pressKeyCombinationViaHTTP(keys, options);
    }
  } catch (error) {
    console.error("키 조합 입력 오류:", error);
    if (typeof showToast === 'function') {
      showToast(`❌ 키 조합 입력 오류: ${error.message}`, "error");
    }
    return false;
  }
}

/**
 * WebSocket을 통한 키 조합 입력
 * @param {Array<string>} keys - 키 조합 배열
 * @param {Object} options - 옵션 설정
 * @returns {Promise<boolean>} 성공 여부
 */
async function pressKeyCombinationViaWebSocket(keys, options = {}) {
  if (!isWebSocketConnected()) {
    if (typeof showToast === 'function') {
      showToast("❌ WebSocket이 연결되지 않았습니다", "error");
    }
    return false;
  }

  if (typeof webSocketPressKeyCombination === 'function') {
    const keyText = keys.join("+");

    // Promise로 응답 대기 (타임아웃 3초)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (typeof socket !== 'undefined') {
          socket.off('key_combination_pressed', handler);
        }
        resolve(true);
      }, 3000);

      const handler = (data) => {
        clearTimeout(timeout);
        if (typeof socket !== 'undefined') {
          socket.off('key_combination_pressed', handler);
        }
        resolve(data.success);
      };

      if (typeof socket !== 'undefined') {
        socket.once('key_combination_pressed', handler);
      }

      webSocketPressKeyCombination(keys);
    });
  } else {
    if (typeof showToast === 'function') {
      showToast("❌ WebSocket 키 조합 입력 함수를 찾을 수 없습니다", "error");
    }
    return false;
  }
}

/**
 * HTTP API를 통한 키 조합 입력
 * @param {Array<string>} keys - 키 조합 배열
 * @param {Object} options - 옵션 설정
 * @returns {Promise<boolean>} 성공 여부
 */
async function pressKeyCombinationViaHTTP(keys, options = {}) {
  try {
    const response = await fetch(AppConfig.getApiUrl("/api/press_key_combination"), {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({ keys: keys }),
    });

    const result = await response.json();
    const keyText = keys.join("+");

    if (response.ok && result.success) {
      if (typeof showToast === 'function') {
        showToast(`✅ ${keyText} 조합 입력 완료 (HTTP)`, "success", 1500);
      }

      // 키 조합 입력 후 자동 스크린샷 (기본값: 0.5초 후) - 웹소켓 모드가 아닐 때만
      if (options.autoScreenshot !== false && typeof takeNewScreenshot === 'function' && getCurrentInputMode() !== 'websocket') {
        setTimeout(() => {
          takeNewScreenshot();
        }, options.screenshotDelay || 500);
      }

      return true;
    } else {
      if (typeof showToast === 'function') {
        showToast(`❌ 키 조합 입력 실패: ${result.message || result.error}`, "error");
      }
      return false;
    }
  } catch (error) {
    console.error("HTTP 키 조합 입력 오류:", error);
    if (typeof showToast === 'function') {
      showToast(`❌ HTTP 키 조합 입력 오류: ${error.message}`, "error");
    }
    return false;
  }
}

/**
 * DOM 요소에서 텍스트를 가져와서 타이핑 (편의 함수)
 * @param {string} elementId - 텍스트를 가져올 요소 ID
 * @param {Object} options - 옵션 설정
 * @returns {Promise<boolean>} 성공 여부
 */
async function typeTextFromElement(elementId, options = {}) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`typeTextFromElement: 요소를 찾을 수 없습니다: ${elementId}`);
    return false;
  }

  const text = element.value || element.textContent || element.innerText;
  return await typeText(text, options);
}

/**
 * 키 매핑 함수 (특수 키 이름 통일)
 * @param {string} key - 원본 키 이름
 * @returns {string} 매핑된 키 이름
 */
function mapKeyName(key) {
  const keyMap = {
    'Enter': 'return',
    'Return': 'return',
    'Escape': 'escape',
    'Esc': 'escape',
    'Space': 'space',
    'Tab': 'tab',
    'Backspace': 'backspace',
    'Delete': 'delete',
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    'ArrowLeft': 'left',
    'ArrowRight': 'right',
    'PageUp': 'pageup',
    'PageDown': 'pagedown',
    'Home': 'home',
    'End': 'end',
    'Insert': 'insert',
    'F1': 'f1', 'F2': 'f2', 'F3': 'f3', 'F4': 'f4',
    'F5': 'f5', 'F6': 'f6', 'F7': 'f7', 'F8': 'f8',
    'F9': 'f9', 'F10': 'f10', 'F11': 'f11', 'F12': 'f12'
  };

  return keyMap[key] || key.toLowerCase();
}

/**
 * 키보드 이벤트로부터 키 조합 추출
 * @param {KeyboardEvent} event - 키보드 이벤트
 * @returns {Array<string>} 키 조합 배열
 */
function getKeyCombinationFromEvent(event) {
  const keys = [];

  if (event.ctrlKey) keys.push('ctrl');
  if (event.altKey) keys.push('alt');
  if (event.shiftKey) keys.push('shift');
  if (event.metaKey) keys.push('cmd'); // Windows키/Cmd키

  // 주요 키 추가 (Ctrl 등의 수정키가 아닌 경우)
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
    keys.push(mapKeyName(event.key));
  }

  return keys;
}

// 전역 스코프에 함수들 노출
if (typeof window !== 'undefined') {
  window.TextInputUtils = {
    typeText,
    typeTextViaWebSocket,
    typeTextViaHTTP,
    pressKey,
    pressKeyViaWebSocket,
    pressKeyViaHTTP,
    pressKeyCombination,
    pressKeyCombinationViaWebSocket,
    pressKeyCombinationViaHTTP,
    typeTextFromElement,
    mapKeyName,
    getKeyCombinationFromEvent,
    getCurrentInputMode,
    isWebSocketConnected,
    createAuthHeaders
  };

  // 기존 함수명 호환성 유지
  window.performTypeText = async function () {
    return await typeTextFromElement("textToType");
  };

  window.performKeyPress = pressKey;
  window.performKeyCombination = pressKeyCombination;
}