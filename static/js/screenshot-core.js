/**
 * Screenshot Core Module
 * 스크린샷 촬영 및 표시 핵심 기능
 */

// 전역 변수
let currentScreenshot = null;
let zoomLevel = 1;

// 헤더 토스트 알림 표시
function showHeaderToast(message, type = "info", duration = 3000) {
  // keep compatibility by forwarding to bottom toast
  showBottomToast(message, type, duration);
}

// 토스트 알림 표시 (헤더 토스트 사용)
function showToast(message, type = "info", duration = 3000) {
  showBottomToast(message, type, duration);
}

// Bottom toast implementation (fixed bottom center)
function showBottomToast(message, type = 'info', duration = 3000) {
  // 전역 설정 확인
  if (window.TOAST_SETTINGS) {
    // 1. 전체 토스트 비활성화 확인
    if (!window.TOAST_SETTINGS.ENABLED) {
      return;
    }

    // 2. 메시지 내용 기반 필터링
    let shouldShow = window.TOAST_SETTINGS.SHOW_UNCATEGORIZED;
    let categoryFound = false;

    // 카테고리 매칭 확인
    if (window.TOAST_SETTINGS.CATEGORIES) {
      for (const [catName, catConfig] of Object.entries(window.TOAST_SETTINGS.CATEGORIES)) {
        // 해당 카테고리의 키워드가 메시지에 포함되어 있는지 확인
        if (catConfig.keywords && catConfig.keywords.some(keyword => message.includes(keyword))) {
          shouldShow = catConfig.show;
          categoryFound = true;
          // console.log(`Toast matched category: ${catName}, show: ${shouldShow}`);
          break; // 첫 번째 매칭되는 카테고리 설정을 따름
        }
      }
    }

    // 카테고리를 찾지 못했지만, 에러 타입인 경우 항상 표시 (안전장치)
    if (!categoryFound && type === 'error') {
      shouldShow = true;
    }

    if (!shouldShow) {
      // console.log(`Toast suppressed by settings: ${message}`);
      return;
    }
  }

  const toast = document.getElementById('bottomToast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `bottom-toast ${type} show`;
  // remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// 상태 업데이트 (제거됨 - 더 이상 status 요소가 없음)
function updateStatus(message, type = "info") {
  // status 요소가 제거되었으므로 아무것도 하지 않음
}

// 새 스크린샷 촬영
async function takeNewScreenshot() {
  const container = document.getElementById("screenshotContainer");
  const btn = document.getElementById("takeScreenshotBtn");

  // DOM 요소 확인
  if (!btn) {
    console.error("takeNewScreenshot: takeScreenshotBtn 요소를 찾을 수 없습니다");
    return;
  }

  try {
    showToast("📸 서버 화면 스크린샷을 촬영하는 중...", "info");
    btn.disabled = true;

    // console.log("스크린샷 API 요청 시작");

    const headers = {
      "Content-Type": "application/json",
    };

    // 인증 헤더 추가 (공통 모듈 사용)
    if (typeof window.AuthUtils !== 'undefined' && window.AuthUtils.createAuthHeaders) {
      Object.assign(headers, window.AuthUtils.createAuthHeaders());
    } else {
      const token = localStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(AppConfig.getApiUrl("/api/take_screenshot"), {
      method: "POST",
      headers: headers,
    });

    // console.log("스크린샷 API 응답 상태:", response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    // console.log("스크린샷 API 응답 데이터:", result);

    if (response.ok && result.success) {
      currentScreenshot = result;
      displayScreenshot(
        result.image_base64,
        result.screen_width,
        result.screen_height
      );
      showToast(
        `✅ 스크린샷 촬영 완료 (${result.screen_width}x${result.screen_height})`,
        "success"
      );

      // 방법 정보 표시
      if (result.method) {
        showToast(`🔧 사용된 방법: ${result.method}`, "info");
      }
    } else if (result.action === "remote_required") {
      // 원격 연결이 필요한 경우
      showToast(`⚠️ ${result.message}`, "warning");

      // 화면이 잠겨있거나 로그인 화면일 수 있으므로 원격 로그인 모달 표시
      if (typeof showRemoteLoginModal === 'function') {
        showRemoteLoginModal(result.message || '원격 로그인 필요');
      }

      // 세션 상태 정보 자동 표시
      const statusDiv = document.getElementById("sessionStatusInfo");
      const statusText = document.getElementById("sessionStatusText");

      if (result.session_status && statusDiv && statusText) {
        const status = result.session_status;
        let statusHTML = `
        <strong>⚠️ 원격 연결 필요:</strong><br>
        • 세션 유효: ${status.session_valid ? "✅ 예" : "❌ 아니오"}<br>
        • 원격 연결: ${status.is_remote ? "✅ 예" : "❌ 아니오"}<br>
        <small>${status.message}</small><br><br>
        <strong>해결 방법:</strong><br>
      `;

        if (result.instructions) {
          result.instructions.forEach((instruction) => {
            statusHTML += `• ${instruction}<br>`;
          });
        }

        statusText.innerHTML = statusHTML;
        statusDiv.style.display = "block";
      }
    } else {
      showToast(
        `❌ 스크린샷 촬영 실패: ${result.message || result.error}`,
        "error"
      );
    }
  } catch (error) {
    console.error("스크린샷 촬영 오류 상세 정보:");
    console.error("- 오류 타입:", error.name);
    console.error("- 오류 메시지:", error.message);
    console.error("- 오류 스택:", error.stack);

    let errorMessage = "알 수 없는 오류";
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      errorMessage = "네트워크 연결 오류 - 서버에 연결할 수 없습니다";
    } else if (error.name === "SyntaxError") {
      errorMessage = "서버 응답 형식 오류 - JSON 파싱 실패";
    } else if (error.message.includes("HTTP")) {
      errorMessage = `서버 응답 오류: ${error.message}`;
    } else {
      errorMessage = error.message || "알 수 없는 오류";
    }

    showToast(`❌ 스크린샷 촬영 오류: ${errorMessage}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
    }
  }
}

// 스크린샷 표시
function displayScreenshot(imageBase64, screenWidth, screenHeight) {
  const container = document.getElementById("screenshotContainer");
  const img = document.getElementById("screenshotImage");
  const coordsDiv = document.getElementById("coordinates");
  const welcomeMessage = document.getElementById("welcomeMessage");

  // If user scrolls while over the coordinates display, forward as remote page up/down
  // Use a single attached handler (remove previous if present) and throttle to avoid flooding
  if (coordsDiv) {
    if (coordsDiv._wheelHandler) {
      coordsDiv.removeEventListener('wheel', coordsDiv._wheelHandler);
      coordsDiv._wheelHandler = null;
    }
    let lastWheelTs = 0;
    const wheelHandler = (ev) => {
      // prevent default page scrolling while interacting with the coordinates control
      ev.preventDefault();
      const now = Date.now();
      if (now - lastWheelTs < 150) return; // throttle ~150ms
      lastWheelTs = now;

      // deltaY < 0 => wheel up, deltaY > 0 => wheel down
      if (ev.deltaY < 0) {
        // WebSocket이 연결되어 있으면 WebSocket 키 입력 사용
        if (typeof isConnected !== 'undefined' && isConnected && typeof webSocketPressKey === 'function') {
          webSocketPressKey('pageup');
        } else {
          // 일반 API 키 입력 사용
          if (typeof performKeyPress === 'function') performKeyPress('pageup');
        }
      } else if (ev.deltaY > 0) {
        // WebSocket이 연결되어 있으면 WebSocket 키 입력 사용
        if (typeof isConnected !== 'undefined' && isConnected && typeof webSocketPressKey === 'function') {
          webSocketPressKey('pagedown');
        } else {
          // 일반 API 키 입력 사용
          if (typeof performKeyPress === 'function') performKeyPress('pagedown');
        }
      }
    };
    coordsDiv.addEventListener('wheel', wheelHandler, { passive: false });
    coordsDiv._wheelHandler = wheelHandler;
    // Make coordinates focusable and attach a keydown handler directly so typing works reliably
    coordsDiv.tabIndex = coordsDiv.tabIndex || 0;
    // focus on pointer enter so key events go to this element
    const focusOnEnter = () => { try { coordsDiv.focus(); } catch (e) { } };
    const blurOnLeave = () => { try { coordsDiv.blur(); } catch (e) { } };
    // remove previous pointer handlers if present
    if (coordsDiv._pointerEnter) coordsDiv.removeEventListener('pointerenter', coordsDiv._pointerEnter);
    if (coordsDiv._pointerLeave) coordsDiv.removeEventListener('pointerleave', coordsDiv._pointerLeave);
    coordsDiv.addEventListener('pointerenter', focusOnEnter);
    coordsDiv.addEventListener('pointerleave', blurOnLeave);
    coordsDiv._pointerEnter = focusOnEnter;
    coordsDiv._pointerLeave = blurOnLeave;

    // remove previous key handler if present
    if (coordsDiv._keyHandler) {
      coordsDiv.removeEventListener('keydown', coordsDiv._keyHandler);
      coordsDiv._keyHandler = null;
    }

    let lastKeyTs = 0;
    const keyHandler = async (ev) => {
      try {
        // ignore modifier combos (allow user to use system shortcuts locally)
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

        // throttle to avoid flooding
        const now = Date.now();
        if (now - lastKeyTs < 25) return;
        lastKeyTs = now;

        // prevent default so typing doesn't affect other focused elements
        ev.preventDefault();

        const k = ev.key;

        // Printable single characters -> send as typed text
        if (k && k.length === 1) {
          // 공통 모듈을 사용하여 텍스트 타이핑
          if (typeof typeText === 'function') {
            await typeText(k, { screenshotDelay: 400 });
          }
          return;
        }

        // Map special keys to names used by performKeyPress
        const specialMap = {
          'Enter': 'enter',
          'Backspace': 'backspace',
          'Tab': 'tab',
          'Escape': 'escape',
          'Delete': 'delete',
          ' ': 'space',
          'ArrowUp': 'arrowup',
          'ArrowDown': 'arrowdown',
          'ArrowLeft': 'arrowleft',
          'ArrowRight': 'arrowright',
          'PageUp': 'pageup',
          'PageDown': 'pagedown',
          'Home': 'home',
          'End': 'end'
        };

        const mapped = specialMap[k];
        if (mapped) {
          // WebSocket이 연결되어 있으면 WebSocket 키 입력 사용
          if (typeof isConnected !== 'undefined' && isConnected && typeof webSocketPressKey === 'function') {
            webSocketPressKey(mapped);
          } else {
            // 일반 API 키 입력 사용
            if (typeof performKeyPress === 'function') performKeyPress(mapped);
          }
        }
      } catch (e) {
        console.error('coords key handler error', e);
      }
    };
    coordsDiv.addEventListener('keydown', keyHandler);
    coordsDiv._keyHandler = keyHandler;
  }

  // 환영 메시지 숨기기
  if (welcomeMessage) {
    welcomeMessage.style.display = "none";
  }

  // 이미지 소스 설정
  img.src = `data:image/png;base64,${imageBase64}`;
  container.classList.add("visible");

  // 스크롤 위치 저장 (이미지 교체 전)
  const scrollContainer = document.querySelector('.screenshot-content');
  let savedScrollLeft = 0;
  let savedScrollTop = 0;
  if (scrollContainer) {
    savedScrollLeft = scrollContainer.scrollLeft;
    savedScrollTop = scrollContainer.scrollTop;
  }

  // 기존 이벤트 리스너들을 안전하게 제거
  const newImg = img.cloneNode(true);
  newImg.id = "screenshotImage";
  img.parentNode.replaceChild(newImg, img);
  // console.log("스크린샷 이미지 교체 완료:", newImg ? "성공" : "실패");

  // ensure transform origin is top-left so top-aligned rendering scales from top
  newImg.style.transformOrigin = "top left";
  newImg.style.willChange = "transform";

  // Render the image at the captured screen pixel width so zoom works in pixel space
  try {
    if (screenWidth && !isNaN(screenWidth)) {
      newImg.style.width = `${screenWidth}px`;
      newImg.style.height = 'auto';
      newImg.dataset.screenWidth = String(screenWidth);
      newImg.dataset.screenHeight = String(screenHeight || '0');
    }
  } catch (e) {
    console.warn('Failed to set image width for zoom:', e);
  }

  // Align to top-left inside the scrolling container for predictable scrolling
  if (scrollContainer) {
    scrollContainer.style.justifyContent = 'flex-start';
    scrollContainer.style.alignItems = 'flex-start';
  }

  // apply existing zoom (preserve user's zoom level across updates)
  if (typeof applyZoom === 'function') {
    applyZoom(true); // 스크롤 위치 유지
  }

  // Restore scroll position
  if (scrollContainer) {
    // Force layout update to ensure scrollWidth/Height are correct before restoring
    const forceLayout = scrollContainer.scrollWidth;

    // Attempt synchronous restoration
    if (savedScrollLeft > 0) scrollContainer.scrollLeft = savedScrollLeft;
    if (savedScrollTop > 0) scrollContainer.scrollTop = savedScrollTop;

    // Retry restoration after a short delay to handle any async layout/rendering shifts
    // This fixes the issue where horizontal scroll might drift to the left if the layout wasn't fully ready
    setTimeout(() => {
      if (savedScrollLeft > 0 && Math.abs(scrollContainer.scrollLeft - savedScrollLeft) > 1) {
        scrollContainer.scrollLeft = savedScrollLeft;
      }
      if (savedScrollTop > 0 && Math.abs(scrollContainer.scrollTop - savedScrollTop) > 1) {
        scrollContainer.scrollTop = savedScrollTop;
      }
    }, 10);
  }


  // 마우스 이동 시 좌표 표시 (macOS Retina 호환)
  newImg.addEventListener("mousemove", (e) => {
    const coords = getClickCoordinates(
      e,
      newImg,
      screenWidth,
      screenHeight
    );
    coordsDiv.textContent = `(${coords.x}, ${coords.y})`;

    // devicePixelRatio 정보도 표시 (디버깅용)
    const deviceRatio = window.devicePixelRatio || 1;
    if (deviceRatio > 1) {
      coordsDiv.title = `Device Pixel Ratio: ${deviceRatio}`;
    }
  });

  // 전역 capture phase 디버깅 제거
  // document.addEventListener("click", (e) => {
  //   console.log("GLOBAL CAPTURE: 클릭 감지됨", e.target);
  // }, true);

  // 스크린샷 모드에서는 HTTP API만 사용
  const clickHandler = async (e) => {
    // console.log("클릭 이벤트 발생! timestamp:", Date.now());
    e.preventDefault();
    e.stopPropagation();

    const coords = getClickCoordinates(
      e,
      newImg,
      screenWidth,
      screenHeight
    );
    // console.log(`클릭 좌표: (${coords.x}, ${coords.y})`);

    // 스크린샷 모드에서는 HTTP API 클릭만 사용
    // console.log("HTTP API 클릭 사용");
    await performClick(coords.x, coords.y, "left");

    // 클릭 시 직접 입력 모드 활성화 (키보드 입력을 위해)
    if (typeof enableDirectInputMode === 'function') {
      enableDirectInputMode(coords.x, coords.y);
    }
  };

  // 기존 클릭 핸들러 제거 후 새 핸들러 등록
  newImg.removeEventListener("click", newImg._clickHandler);
  newImg.addEventListener("click", clickHandler, { once: false, passive: false });
  newImg._clickHandler = clickHandler;

  // 스크린샷 모드에서는 HTTP API만 사용 (우클릭)
  const contextHandler = async (e) => {
    // console.log("우클릭 이벤트 발생! timestamp:", Date.now());
    e.preventDefault();
    e.stopPropagation();

    const coords = getClickCoordinates(
      e,
      newImg,
      screenWidth,
      screenHeight
    );

    // 스크린샷 모드에서는 HTTP API 클릭만 사용
    await performClick(coords.x, coords.y, "right");
  };

  newImg.removeEventListener("contextmenu", newImg._contextHandler);
  newImg.addEventListener("contextmenu", contextHandler, { once: false, passive: false });
  newImg._contextHandler = contextHandler;

  // 스크린샷 모드에서는 HTTP API만 사용 (더블클릭)
  const dblclickHandler = async (e) => {
    // console.log("더블클릭 이벤트 발생! timestamp:", Date.now());
    e.preventDefault();
    e.stopPropagation();

    const coords = getClickCoordinates(
      e,
      newImg,
      screenWidth,
      screenHeight
    );

    // 스크린샷 모드에서는 HTTP API 클릭만 사용
    await performClick(coords.x, coords.y, "double");
  };

  newImg.removeEventListener("dblclick", newImg._dblclickHandler);
  newImg.addEventListener("dblclick", dblclickHandler, { once: false, passive: false });
  newImg._dblclickHandler = dblclickHandler;

  // Forward wheel events over the screenshot content area to remote PageUp/PageDown
  // Forward wheel events over the screenshot content area to remote PageUp/PageDown
  if (scrollContainer) {
    // remove previous handler if present
    if (scrollContainer._wheelHandler) {
      scrollContainer.removeEventListener('wheel', scrollContainer._wheelHandler);
      scrollContainer._wheelHandler = null;
    }
    let lastWheelTsContent = 0;
    const contentWheel = (ev) => {
      // Only intercept when wheel happens directly over the content area (not when modifiers present)
      // prevent default so page doesn't scroll while user is interacting with screenshot
      ev.preventDefault();
      const now = Date.now();
      if (now - lastWheelTsContent < 150) return; // throttle ~150ms
      lastWheelTsContent = now;

      if (ev.deltaY < 0) {
        // WebSocket이 연결되어 있으면 WebSocket 키 입력 사용
        if (typeof isConnected !== 'undefined' && isConnected && typeof webSocketPressKey === 'function') {
          webSocketPressKey('pageup');
        } else {
          // 일반 API 키 입력 사용
          if (typeof performKeyPress === 'function') performKeyPress('pageup');
        }
      } else if (ev.deltaY > 0) {
        // WebSocket이 연결되어 있으면 WebSocket 키 입력 사용
        if (typeof isConnected !== 'undefined' && isConnected && typeof webSocketPressKey === 'function') {
          webSocketPressKey('pagedown');
        } else {
          // 일반 API 키 입력 사용
          if (typeof performKeyPress === 'function') performKeyPress('pagedown');
        }
      }
    };
    scrollContainer.addEventListener('wheel', contentWheel, { passive: false });
    scrollContainer._wheelHandler = contentWheel;
  }
}

// 스크린샷 닫기
function closeScreenshot() {
  const container = document.getElementById("screenshotContainer");
  const welcomeMessage = document.getElementById("welcomeMessage");

  container.classList.remove("visible");
  currentScreenshot = null;

  // 환영 메시지 다시 표시
  if (welcomeMessage) {
    welcomeMessage.style.display = "block";
  }
}

// 자동 새로고침 기능 제거됨 - 스크린샷 모드는 수동으로만 작동

// 페이지 초기 위치로 스크롤
function scrollToTop() {
  const content = document.querySelector(".screenshot-content");
  if (content) {
    content.scrollLeft = 0;
    content.scrollTop = 0;
  }
}

// Zoom controls
// Zoom controls
function applyZoom(preserveScroll = false) {
  const img = document.getElementById('screenshotImage');
  const label = document.getElementById('zoomLevelLabel');
  const container = document.querySelector('.screenshot-content');
  if (!img) return;

  // 1. Zoom Level 1 (Default/Fit): Reset to CSS defaults (object-fit: contain)
  if (zoomLevel <= 1.01 && zoomLevel >= 0.99) { // minimal float tolerance
    img.style.width = '';
    img.style.height = '';
    img.style.maxWidth = '';
    img.style.maxHeight = '';
    img.style.transform = '';
  }
  // 2. Zoom Level > 1: Scale relative to the "Fit" size
  else if (container) {
    // Determine screen aspect ratio
    let screenW = 1920, screenH = 1080;
    if (img.dataset.screenWidth) {
      screenW = parseInt(img.dataset.screenWidth, 10);
      screenH = parseInt(img.dataset.screenHeight, 10);
    } else if (img.naturalWidth) {
      screenW = img.naturalWidth;
      screenH = img.naturalHeight;
    }

    // Ensure aspect ratio prevents layout collapse
    if (screenW && screenH) {
      img.style.aspectRatio = `${screenW} / ${screenH}`;
    }

    const imgRatio = screenW / screenH;
    const containerRatio = container.clientWidth / container.clientHeight;

    // Remove constraints
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
    img.style.transform = 'none';

    // Calculate percent based on what side is constraining
    const percent = Math.round(zoomLevel * 100);

    if (imgRatio > containerRatio) {
      // Image is wider than container (constrained by width)
      img.style.width = `${percent}%`;
      img.style.height = 'auto';
    } else {
      // Image is taller than container (constrained by height)
      img.style.height = `${percent}%`;
      img.style.width = 'auto';
    }
  }

  // update label
  if (label) label.textContent = `${Math.round(zoomLevel * 100)}%`;

  // try to center the image in the container after zoom
  if (container && !preserveScroll) {
    // get rendered size
    const rect = img.getBoundingClientRect();
    // center by adjusting scroll
    const targetScrollLeft = Math.max(0, (rect.width - container.clientWidth) / 2);
    const targetScrollTop = Math.max(0, (rect.height - container.clientHeight) / 2);
    container.scrollLeft = targetScrollLeft;
    container.scrollTop = targetScrollTop;
  }
}

function zoomIn() {
  // increase by 20% each step
  zoomLevel = Math.min(zoomLevel * 1.2, 5);
  applyZoom();
}

function zoomOut() {
  // decrease by ~16.7% each step (1/1.2)
  zoomLevel = Math.max(zoomLevel / 1.2, 0.2);
  applyZoom();
}

function resetZoom() {
  zoomLevel = 1;
  applyZoom();
  // reset scroll to top-left
  const container = document.querySelector('.screenshot-content');
  if (container) {
    container.scrollLeft = 0;
    container.scrollTop = 0;
  }
}

/**
 * 화면 강제 재조정 (Refit/Adjust Layout)
 * 전체화면 전환 등으로 인해 레이아웃이 어긋났을 때 호출
 */
function fitToScreen() {
  // 1. 줌 레벨 초기화 및 적용
  resetZoom();

  // 2. 강제 레이아웃 재계산 (Reflow)
  const container = document.querySelector('.screenshot-container');
  if (container) {
    const originalDisplay = container.style.display;
    container.style.display = 'none';
    void container.offsetHeight; // Reflow 트리거
    container.style.display = originalDisplay;
  }

  showToast("화면 레이아웃이 재조정되었습니다.", "info", 2000);
}

// 창 크기 변경 감지 시 자동으로 줌/레이아웃 적용
window.addEventListener('resize', () => {
  if (typeof applyZoom === 'function') {
    applyZoom(true);
  }
});