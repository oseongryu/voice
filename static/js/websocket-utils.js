/**
 * WebSocket 유틸리티 함수들
 * UI 조작 및 설정 관련 기능
 */

// 웹소켓 설정 패널 토글
function toggleWSSettings() {
    const panel = document.getElementById("wsSettingsPanel");
    if (panel) {
        panel.style.display = panel.style.display === "none" ? "block" : "none";
    }
}

// 웹소켓 설정 적용
function applyWSSettings() {
    const intervalInput = document.getElementById("streamingInterval");
    const qualityInput = document.getElementById("streamingQuality");

    if (intervalInput) {
        streamingInterval = parseFloat(intervalInput.value) || 1.0;
    }
    if (qualityInput) {
        streamingQuality = parseInt(qualityInput.value) || 80;
    }

    showToast(`⚙️ 설정 적용: 간격 ${streamingInterval}초, 품질 ${streamingQuality}%`, "success");
    toggleWSSettings();
}

// 웹소켓 설정 패널 표시
function showWSSettings() {
    const panel = document.getElementById("wsSettingsPanel");
    if (panel) {
        panel.style.display = "block";
    }
}

// 웹소켓 설정 패널 숨기기
function hideWSSettings() {
    const panel = document.getElementById("wsSettingsPanel");
    if (panel) {
        panel.style.display = "none";
    }
}

// 웹소켓 상태 표시 업데이트
function updateWSStatusDisplay() {
    // 상태 표시 요소가 있다면 업데이트
    const statusElement = document.getElementById("wsStatus");
    if (statusElement) {
        if (isConnected) {
            statusElement.textContent = isStreaming ? "🟢 스트리밍 중" : "🟡 연결됨";
            statusElement.className = "ws-status connected";
        } else {
            statusElement.textContent = "🔴 연결 해제";
            statusElement.className = "ws-status disconnected";
        }
    }
}

// 스트리밍 통계 표시
function displayStreamingStats(stats) {
    const statsElement = document.getElementById("streamingStats");
    if (statsElement && stats) {
        statsElement.innerHTML = `
            <div class="stats-row">
                <span>성공: ${stats.success_count}</span>
                <span>오류: ${stats.error_count}</span>
            </div>
        `;
    }
}

// 키보드 단축키 설정
function setupWebSocketKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+조합으로 웹소켓 기능 실행
        if (e.ctrlKey && e.shiftKey) {
            switch (e.key) {
                case 'C': // Ctrl+Shift+C: 웹소켓 연결
                    e.preventDefault();
                    connectWebSocket();
                    break;
                case 'D': // Ctrl+Shift+D: 웹소켓 연결 해제
                    e.preventDefault();
                    disconnectWebSocket();
                    break;
                case 'S': // Ctrl+Shift+S: 스크린샷 요청
                    e.preventDefault();
                    requestWebSocketScreenshot();
                    break;
                case 'T': // Ctrl+Shift+T: 스트리밍 토글
                    e.preventDefault();
                    if (isStreaming) {
                        stopWebSocketStreaming();
                    } else {
                        startWebSocketStreaming();
                    }
                    break;
                case 'G': // Ctrl+Shift+G: 설정 패널 토글
                    e.preventDefault();
                    toggleWSSettings();
                    break;
            }
        }
    });
}

// 웹소켓 연결 품질 측정
function measureWebSocketLatency() {
    if (!isConnected) {
        return Promise.reject(new Error("웹소켓이 연결되지 않았습니다"));
    }

    return new Promise((resolve, reject) => {
        const startTime = performance.now();

        const timeoutId = setTimeout(() => {
            socket.off('pong', pongHandler);
            reject(new Error("Ping 타임아웃"));
        }, 5000);

        const pongHandler = () => {
            clearTimeout(timeoutId);
            socket.off('pong', pongHandler);
            const latency = performance.now() - startTime;
            resolve(latency);
        };

        socket.once('pong', pongHandler);
        socket.emit('ping');
    });
}

// 연결 품질 테스트
async function testWebSocketQuality() {
    try {
        showToast("🏓 연결 품질 테스트 중...", "info");

        const latencies = [];
        for (let i = 0; i < 3; i++) {
            const latency = await measureWebSocketLatency();
            latencies.push(latency);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 간격
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        const minLatency = Math.min(...latencies);

        const qualityMessage = avgLatency < 50 ? "우수" : avgLatency < 100 ? "좋음" : avgLatency < 200 ? "보통" : "느림";

        showToast(`📊 연결 품질: ${qualityMessage} (평균: ${avgLatency.toFixed(1)}ms)`, "success");

        return {
            average: avgLatency,
            min: minLatency,
            max: maxLatency,
            quality: qualityMessage
        };

    } catch (error) {
        showToast(`❌ 연결 품질 테스트 실패: ${error.message}`, "error");
        return null;
    }
}

// 자동 재연결 설정
function setupAutoReconnect() {
    if (socket) {
        socket.on('disconnect', (reason) => {
            if (reason === 'io server disconnect') {
                // 서버에서 연결을 끊은 경우 자동 재연결 시도
                setTimeout(() => {
                    if (!isConnected) {
                        showToast("🔄 자동 재연결 시도 중...", "info");
                        socket.connect();
                    }
                }, 3000);
            }
        });
    }
}

// 페이지 언로드 시 정리
function setupWebSocketCleanup() {
    window.addEventListener('beforeunload', () => {
        if (socket && isConnected) {
            // 스트리밍 중이면 중지
            if (isStreaming) {
                socket.emit('stop_screenshot_streaming');
            }
            // 연결 해제
            socket.disconnect();
        }
    });
}

// 웹소켓 디버그 정보 표시
function showWebSocketDebugInfo() {
    if (!socket) {
        showToast("❌ 웹소켓이 초기화되지 않았습니다", "error");
        return;
    }

    const debugInfo = {
        connected: isConnected,
        streaming: isStreaming,
        sessionId: socket.id,
        transport: socket.io.engine.transport.name,
        readyState: socket.connected,
        reconnectAttempts: reconnectAttempts
    };

    console.log("WebSocket Debug Info:", debugInfo);

    const infoText = Object.entries(debugInfo)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

    alert(`WebSocket Debug Info:\n\n${infoText}`);
}

// 초기화 함수들을 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    setupWebSocketKeyboardShortcuts();
    setupAutoReconnect();
    setupWebSocketCleanup();

    // console.log("WebSocket 유틸리티 로드됨");
});