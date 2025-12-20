/**
 * Mouse Mode Module
 * 마우스 이동 모드 관리 - 트랙패드 방식 (상대적 이동)
 */

// 마우스 모드 상태
let mouseModeActive = false;
let mouseMovePending = false;
let lastMouseMoveTime = 0;
const MOUSE_MOVE_THROTTLE = 50; // 50ms 쓰로틀링 (더 반응성 좋게)

// 마우스 커서 표시 요소
let mouseCursorIndicator = null;
let cursorPosition = { x: 0, y: 0 }; // 스크린 좌표

// 드래그 추적
let isDragging = false;
let lastDragPosition = { x: 0, y: 0 };
let dragStartPosition = { x: 0, y: 0 };

// 민감도 설정
const MOUSE_SENSITIVITY = 1.0; // 마우스 이동 민감도

/**
 * 마우스 모드 토글
 */
function toggleMouseMode() {
    mouseModeActive = !mouseModeActive;

    const btn = document.getElementById('mouseModeBtn');
    const btnWs = document.getElementById('mouseModeBtnWs');

    if (mouseModeActive) {
        // 마우스 모드 활성화
        if (btn) {
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-success');
        }
        if (btnWs) {
            btnWs.classList.remove('btn-outline-secondary');
            btnWs.classList.add('btn-success');
        }

        // 마우스 커서 표시 생성 (화면 중앙에)
        createMouseCursorIndicator();

        // 이벤트 리스너 추가
        attachMouseModeListeners();

        showToast('🖱️ 마우스 모드 활성화 (화면을 드래그하여 마우스 이동, 탭하여 클릭)', 'success', 3000);

        // 다른 모드 비활성화
        if (window.directInputMode && typeof disableDirectInputMode === 'function') {
            disableDirectInputMode();
        }
    } else {
        // 마우스 모드 비활성화
        if (btn) {
            btn.classList.remove('btn-success');
            btn.classList.add('btn-outline-secondary');
        }
        if (btnWs) {
            btnWs.classList.remove('btn-success');
            btnWs.classList.add('btn-outline-secondary');
        }

        // 마우스 커서 표시 제거
        removeMouseCursorIndicator();

        // 이벤트 리스너 제거
        detachMouseModeListeners();

        showToast('마우스 모드 비활성화', 'info', 1500);
    }
}

/**
 * 마우스 커서 표시 생성
 */
function createMouseCursorIndicator() {
    if (mouseCursorIndicator) {
        removeMouseCursorIndicator();
    }

    const img = document.getElementById('screenshotImage');
    if (!img) return;

    // 화면 중앙 좌표 계산
    const rect = img.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // 스크린 좌표로 변환
    if (currentScreenshot) {
        cursorPosition.x = Math.floor((centerX / rect.width) * currentScreenshot.screen_width);
        cursorPosition.y = Math.floor((centerY / rect.height) * currentScreenshot.screen_height);
    }

    mouseCursorIndicator = document.createElement('div');
    mouseCursorIndicator.id = 'mouseCursorIndicator';
    mouseCursorIndicator.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z" fill="white" stroke="black" stroke-width="1.5"/>
    </svg>
  `;
    mouseCursorIndicator.style.cssText = `
    position: absolute;
    left: ${centerX}px;
    top: ${centerY}px;
    width: 24px;
    height: 24px;
    pointer-events: none;
    z-index: 1000;
    transform: translate(-2px, -2px);
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    user-select: none;
    transition: left 0.05s ease-out, top 0.05s ease-out;
  `;

    const container = document.querySelector('.screenshot-content');
    if (container) {
        container.appendChild(mouseCursorIndicator);
    }

    // 초기 위치로 서버 마우스 이동
    sendMousePositionToServer(cursorPosition.x, cursorPosition.y);
}

/**
 * 마우스 커서 표시 제거
 */
function removeMouseCursorIndicator() {
    if (mouseCursorIndicator) {
        mouseCursorIndicator.remove();
        mouseCursorIndicator = null;
    }
}

/**
 * 마우스/터치 다운 이벤트 핸들러
 */
function handleMouseDown(event) {
    if (!mouseModeActive) return;

    const img = document.getElementById('screenshotImage');
    if (!img) return;

    // 이벤트 타입에 따라 좌표 가져오기
    let clientX, clientY;
    if (event.type === 'touchstart') {
        if (event.touches.length === 0) return;

        // 두 손가락 터치 감지 (우클릭으로 처리)
        if (event.touches.length === 2) {
            event.preventDefault();
            // 두 손가락의 중간 지점 계산
            clientX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            clientY = (event.touches[0].clientY + event.touches[1].clientY) / 2;

            // 우클릭 플래그 설정
            dragStartPosition = { x: clientX, y: clientY, isTwoFinger: true };
            lastDragPosition = { x: clientX, y: clientY };
            isDragging = false; // 두 손가락은 드래그 안 함
            return;
        }

        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }

    isDragging = true;
    dragStartPosition = { x: clientX, y: clientY, isTwoFinger: false };
    lastDragPosition = { x: clientX, y: clientY };
}

/**
 * 마우스/터치 이동 이벤트 핸들러 (상대적 이동)
 */
function handleMouseMove(event) {
    if (!mouseModeActive || !isDragging) return;

    event.preventDefault();
    event.stopPropagation();

    const img = document.getElementById('screenshotImage');
    if (!img || !currentScreenshot || !mouseCursorIndicator) return;

    // 이벤트 타입에 따라 좌표 가져오기
    let clientX, clientY;
    if (event.type === 'touchmove') {
        if (event.touches.length === 0) return;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }

    // 상대적 이동량 계산
    const deltaX = clientX - lastDragPosition.x;
    const deltaY = clientY - lastDragPosition.y;

    lastDragPosition = { x: clientX, y: clientY };

    // 이동량이 너무 작으면 무시
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
    }

    const rect = img.getBoundingClientRect();

    // 현재 커서의 화면 좌표
    const currentLeft = parseFloat(mouseCursorIndicator.style.left) || 0;
    const currentTop = parseFloat(mouseCursorIndicator.style.top) || 0;

    // 새로운 화면 좌표 (민감도 적용)
    let newLeft = currentLeft + (deltaX * MOUSE_SENSITIVITY);
    let newTop = currentTop + (deltaY * MOUSE_SENSITIVITY);

    // 이미지 영역 내로 제한
    newLeft = Math.max(0, Math.min(newLeft, rect.width));
    newTop = Math.max(0, Math.min(newTop, rect.height));

    // 커서 위치 업데이트
    mouseCursorIndicator.style.left = newLeft + 'px';
    mouseCursorIndicator.style.top = newTop + 'px';

    // 스크린 좌표로 변환
    cursorPosition.x = Math.floor((newLeft / rect.width) * currentScreenshot.screen_width);
    cursorPosition.y = Math.floor((newTop / rect.height) * currentScreenshot.screen_height);

    // 쓰로틀링 적용하여 서버로 전송
    throttledSendMousePosition(cursorPosition.x, cursorPosition.y);
}

/**
 * 마우스/터치 업 이벤트 핸들러
 */
function handleMouseUp(event) {
    if (!mouseModeActive) return;

    if (isDragging) {
        // 드래그 종료
        const dragDistance = Math.sqrt(
            Math.pow(event.clientX - dragStartPosition.x, 2) +
            Math.pow(event.clientY - dragStartPosition.y, 2)
        );

        // 드래그 거리가 짧으면 클릭으로 간주 (5픽셀 이하)
        if (dragDistance < 5) {
            // 현재 마우스 커서 위치에서 클릭 발생
            performClickAtCursor(event);
        }

        isDragging = false;
    }
}

/**
 * 터치 업 이벤트 핸들러
 */
function handleTouchEnd(event) {
    if (!mouseModeActive) return;

    // 두 손가락 터치였다면 우클릭으로 처리
    if (dragStartPosition.isTwoFinger) {
        event.preventDefault();

        // 현재 커서 위치에서 우클릭 발생
        const rightClickEvent = { button: 2, which: 3 };
        performClickAtCursor(rightClickEvent);

        dragStartPosition = { x: 0, y: 0, isTwoFinger: false };
        return;
    }

    if (isDragging) {
        event.preventDefault();

        // 터치 시작 위치와 비교
        const touch = event.changedTouches[0];
        const dragDistance = Math.sqrt(
            Math.pow(touch.clientX - dragStartPosition.x, 2) +
            Math.pow(touch.clientY - dragStartPosition.y, 2)
        );

        // 드래그 거리가 짧으면 탭으로 간주 (10픽셀 이하)
        if (dragDistance < 10) {
            // 현재 마우스 커서 위치에서 클릭 발생
            performClickAtCursor(event);
        }

        isDragging = false;
    }
}

/**
 * 현재 커서 위치에서 클릭 수행
 */
async function performClickAtCursor(event) {
    // 우클릭 감지
    let clickType = 'left';
    if (event.button === 2 || event.which === 3) {
        clickType = 'right';
    }

    // 성공 처리 헬퍼 함수
    const handleClickSuccess = (type) => {
        // 시각적 피드백
        showClickFeedback();

        const clickTypeText = type === 'right' ? '우클릭' : '클릭';
        showToast(`✅ ${clickTypeText} (${cursorPosition.x}, ${cursorPosition.y})`, 'success', 1000);

        // 클릭 후 자동으로 새 스크린샷 촬영 (1초 후)
        setTimeout(() => {
            showToast('🔄 화면 업데이트 중...', 'info', 1500);

            // 현재 커서 위치 저장
            const savedCursorPos = { ...cursorPosition };

            // 스크린샷 촬영
            if (typeof takeNewScreenshot === 'function') {
                takeNewScreenshot().then(() => {
                    // 스크린샷 업데이트 후 커서 위치 복원
                    restoreCursorPosition(savedCursorPos);
                }).catch(() => {
                    // 에러 발생 시에도 커서 위치 복원 시도
                    restoreCursorPosition(savedCursorPos);
                });
            }
        }, 1000);
    };

    // WebSocket 연결 확인 및 사용
    if (typeof isConnected !== 'undefined' && isConnected && typeof socket !== 'undefined') {
        try {
            socket.emit('click_screen', {
                x: cursorPosition.x,
                y: cursorPosition.y,
                click_type: clickType
            });

            // WebSocket은 즉시 성공으로 가정
            handleClickSuccess(clickType);
            return;
        } catch (e) {
            console.warn('WebSocket 클릭 실패, HTTP로 전환:', e);
            // 실패 시 HTTP로 폴백
        }
    }

    // 서버로 클릭 요청 (HTTP)
    try {
        const headers = {
            'Content-Type': 'application/json',
        };

        // 인증 헤더 추가
        if (typeof window.AuthUtils !== 'undefined' && window.AuthUtils.createAuthHeaders) {
            Object.assign(headers, window.AuthUtils.createAuthHeaders());
        } else {
            const token = localStorage.getItem('authToken');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const response = await fetch(AppConfig.getApiUrl('/api/click_position'), {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                x: cursorPosition.x,
                y: cursorPosition.y,
                click_type: clickType,
            }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
            handleClickSuccess(clickType);
        } else {
            showToast(`❌ 클릭 실패: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('클릭 오류:', error);
        showToast(`❌ 클릭 오류: ${error.message}`, 'error');
    }
}

/**
 * 스크린샷 업데이트 후 커서 위치 복원
 */
function restoreCursorPosition(savedPos) {
    if (!mouseModeActive || !mouseCursorIndicator) return;

    // 약간의 지연 후 복원 (스크린샷 로딩 대기)
    setTimeout(() => {
        if (!mouseModeActive || !mouseCursorIndicator) return;

        const img = document.getElementById('screenshotImage');
        if (!img || !currentScreenshot) return;

        const rect = img.getBoundingClientRect();

        // 저장된 스크린 좌표를 화면 좌표로 변환
        const newLeft = (savedPos.x / currentScreenshot.screen_width) * rect.width;
        const newTop = (savedPos.y / currentScreenshot.screen_height) * rect.height;

        // 커서 위치 업데이트
        mouseCursorIndicator.style.left = newLeft + 'px';
        mouseCursorIndicator.style.top = newTop + 'px';

        // 스크린 좌표 복원
        cursorPosition.x = savedPos.x;
        cursorPosition.y = savedPos.y;

        // 서버 마우스도 해당 위치로 이동
        sendMousePositionToServer(cursorPosition.x, cursorPosition.y);

        // 마우스 모드 이벤트 리스너 재연결
        // (스크린샷 업데이트 시 이미지가 교체되면서 이벤트 리스너가 사라지므로)
        detachMouseModeListeners();
        attachMouseModeListeners();
    }, 500);
}


/**
 * 클릭 시각적 피드백
 */
function showClickFeedback() {
    if (!mouseCursorIndicator) return;

    // 커서에 애니메이션 효과
    mouseCursorIndicator.style.transform = 'translate(-2px, -2px) scale(0.8)';
    setTimeout(() => {
        if (mouseCursorIndicator) {
            mouseCursorIndicator.style.transform = 'translate(-2px, -2px) scale(1)';
        }
    }, 100);
}

/**
 * 쓰로틀링이 적용된 마우스 위치 전송
 */
function throttledSendMousePosition(x, y) {
    const now = Date.now();

    if (now - lastMouseMoveTime < MOUSE_MOVE_THROTTLE) {
        return;
    }

    if (mouseMovePending) {
        return;
    }

    lastMouseMoveTime = now;
    sendMousePositionToServer(x, y);
}

/**
 * 서버로 마우스 위치 전송
 */
async function sendMousePositionToServer(x, y) {
    if (mouseMovePending) return;

    mouseMovePending = true;

    try {
        const headers = {
            'Content-Type': 'application/json',
        };

        // 인증 헤더 추가
        if (typeof window.AuthUtils !== 'undefined' && window.AuthUtils.createAuthHeaders) {
            Object.assign(headers, window.AuthUtils.createAuthHeaders());
        } else {
            const token = localStorage.getItem('authToken');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        const response = await fetch(AppConfig.getApiUrl('/api/move_mouse'), {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ x, y }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            console.error('마우스 이동 실패:', result.message);
        }
    } catch (error) {
        console.error('마우스 이동 오류:', error);
    } finally {
        mouseMovePending = false;
    }
}

/**
 * 마우스 모드 이벤트 리스너 추가
 */
function attachMouseModeListeners() {
    const img = document.getElementById('screenshotImage');
    if (!img) return;

    // 마우스 이벤트
    img.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // 터치 이벤트
    img.addEventListener('touchstart', handleMouseDown, { passive: false });
    document.addEventListener('touchmove', handleMouseMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // 우클릭 방지 (마우스 모드에서는 우클릭도 처리)
    img.addEventListener('contextmenu', (e) => {
        if (mouseModeActive) {
            e.preventDefault();
        }
    });
}

/**
 * 마우스 모드 이벤트 리스너 제거
 */
function detachMouseModeListeners() {
    const img = document.getElementById('screenshotImage');
    if (!img) return;

    img.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    img.removeEventListener('touchstart', handleMouseDown);
    document.removeEventListener('touchmove', handleMouseMove);
    document.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchcancel', handleTouchEnd);
}

/**
 * 페이지 언로드 시 정리
 */
window.addEventListener('beforeunload', () => {
    if (mouseModeActive) {
        detachMouseModeListeners();
        removeMouseCursorIndicator();
    }
});

// 전역 함수로 노출
window.toggleMouseMode = toggleMouseMode;
window.mouseModeActive = () => mouseModeActive;
