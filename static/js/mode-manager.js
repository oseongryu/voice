/**
 * 모드 관리자
 * 스크린샷 모드와 웹소켓 모드 전환 관리
 */

// 현재 모드 상태
let currentMode = 'screenshot'; // 'screenshot' 또는 'websocket'

// 모드 전환 중복 방지 플래그
let isSwitchingMode = false;

// 모드 전환 함수들
function switchToScreenshotMode() {
    if (isSwitchingMode) return;

    if (currentMode === 'screenshot') {
        showToast("📸 이미 스크린샷 모드입니다", "info");
        return; // 이미 스크린샷 모드
    }

    isSwitchingMode = true;
    setTimeout(() => { isSwitchingMode = false; }, 500);

    currentMode = 'screenshot';

    // 웹소켓 연결 해제 (연결되어 있다면)
    if (typeof isConnected !== 'undefined' && isConnected) {
        console.log("WebSocket 연결 해제 중...");
        if (typeof disconnectWebSocket === 'function') {
            disconnectWebSocket();
        }
    }

    // 스트리밍 중지
    if (typeof isStreaming !== 'undefined' && isStreaming) {
        console.log("WebSocket 스트리밍 중지 중...");
        if (typeof stopWebSocketStreaming === 'function') {
            stopWebSocketStreaming();
        }
    }

    showToast("📸 스크린샷 모드로 전환되었습니다", "success");
    console.log("모드 전환: 스크린샷 모드");
}

function switchToWebSocketMode() {
    if (isSwitchingMode) return;

    if (currentMode === 'websocket') {
        showToast("📡 이미 웹소켓 모드입니다", "info");
        return; // 이미 웹소켓 모드
    }

    isSwitchingMode = true;
    setTimeout(() => { isSwitchingMode = false; }, 500);

    currentMode = 'websocket';

    // 웹소켓 모드로 전환 시 스크린샷 촬영
    if (typeof takeNewScreenshot === 'function') {
        console.log("웹소켓 모드 전환 - 스크린샷 촬영 시작");
        takeNewScreenshot();
    }

    showToast("📡 웹소켓 모드로 전환되었습니다", "success");

    // 웹소켓 연결 안내 메시지
    setTimeout(() => {
        showToast("🔌 웹소켓 연결 버튼을 클릭하여 시작하세요", "info");
    }, 1500);

    console.log("모드 전환: 웹소켓 모드");
}


// 현재 모드 확인 함수
function getCurrentMode() {
    return currentMode;
}

// 모드별 기능 제한
function isScreenshotModeActive() {
    return currentMode === 'screenshot';
}

function isWebSocketModeActive() {
    return currentMode === 'websocket';
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 초기 모드를 스크린샷으로 강제 설정
    currentMode = 'screenshot';

    // WebSocket 연결 해제 (혹시 연결되어 있다면)
    if (typeof isConnected !== 'undefined' && isConnected) {
        if (typeof disconnectWebSocket === 'function') {
            disconnectWebSocket();
        }
    }

    // WebSocket 팝업 사용하지 않음 (메인 화면 사용)


    // console.log("모드 관리자 초기화 완료 - 기본 모드: 스크린샷");
});