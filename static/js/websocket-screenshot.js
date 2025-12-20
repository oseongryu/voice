/**
 * WebSocket 기반 화면인식 모듈
 * 실시간 스크린샷 스트리밍과 원격 제어 기능
 * 개선된 재연결 로직 포함 (지수 백오프, 스트리밍 상태 복원)
 */

// 전역 변수
let socket = null;
let isConnected = false;
let isStreaming = false;
let streamingInterval = 0.3;
let streamingQuality = 80;
let reconnectAttempts = 0;
let maxReconnectAttempts = 10; // 최대 재연결 시도 횟수 증가
let currentScreenshotData = null;
// 재연결 관리 변수
let reconnectTimer = null;
let manualDisconnect = false; // 사용자가 수동으로 연결 해제했는지 여부
let savedStreamingState = {
    wasStreaming: false,
    interval: 0.3,
    quality: 80
}; // 재연결 시 복원할 스트리밍 상태

// 클릭 큐잉 시스템
let clickQueue = [];
let isProcessingClick = false;
let lastClickTime = 0;
const CLICK_DEBOUNCE_MS = 10; // 50ms -> 10ms (최소한의 디바운싱 유지)

// 지수 백오프 계산 함수
function getReconnectDelay() {
    // 2^reconnectAttempts * 1000ms, 최대 30초
    const delay = Math.min(Math.pow(2, reconnectAttempts) * 1000, 30000);
    return delay;
}

// 스트리밍 상태 저장
function saveStreamingState() {
    savedStreamingState = {
        wasStreaming: isStreaming,
        interval: streamingInterval,
        quality: streamingQuality
    };
    console.log("스트리밍 상태 저장됨:", savedStreamingState);
}

// 스트리밍 상태 복원
function restoreStreamingState() {
    if (savedStreamingState.wasStreaming && isConnected) {
        console.log("저장된 스트리밍 상태 복원 중...", savedStreamingState);
        setTimeout(() => {
            socket.emit('start_screenshot_streaming', {
                interval: savedStreamingState.interval,
                quality: savedStreamingState.quality
            });
        }, 1000); // 연결 안정화 후 스트리밍 재시작
    }
}

// WebSocket 연결 초기화
function initializeWebSocket() {
    console.log("initializeWebSocket 함수 시작");


    try {
        // 서버 URL 가져오기
        const serverUrl = AppConfig.getServerUrl();
        console.log("WebSocket 연결 시도:", serverUrl);

        // Socket.IO 클라이언트 연결
        socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            timeout: 20000,
            reconnection: true, // 자동 재연결 활성화
            reconnectionDelay: 1000, // 초기 지연 1초
            reconnectionDelayMax: 10000, // 최대 지연 10초
            reconnectionAttempts: maxReconnectAttempts,
            randomizationFactor: 0.5 // 재연결 지연 랜덤화
        });

        setupWebSocketEventHandlers();

        showToast("🔌 웹소켓 연결을 시도하는 중...", "info");

    } catch (error) {
        console.error("WebSocket 초기화 오류:", error);
        showToast(`❌ 웹소켓 초기화 실패: ${error.message}`, "error");
    }
}

// WebSocket 이벤트 핸들러 설정
function setupWebSocketEventHandlers() {

    // 연결 성공
    socket.on('connect', () => {
        console.log("WebSocket 연결 성공");
        isConnected = true;
        reconnectAttempts = 0;
        manualDisconnect = false;

        showToast("✅ 웹소켓 연결 성공", "success");

        // WebSocket 버튼 업데이트 (새로운 토글 버튼 지원)
        if (typeof updateWebSocketToggleButton === 'function') {
            updateWebSocketToggleButton();
        } else {
            updateWebSocketButtons(true);
        }

        if (typeof updateWSStatusDisplay === 'function') {
            updateWSStatusDisplay();
        }

        // 연결 시 자동으로 스트리밍 시작 (사용자 요청 사항)
        if (!manualDisconnect) {
            console.log("연결 성공 후 자동 스트리밍 시작");
            setTimeout(() => {
                startWebSocketStreaming();
            }, 500);
        }
    });

    // 연결 해제
    socket.on('disconnect', (reason) => {
        console.log("WebSocket 연결 해제, 사유:", reason);

        // 스트리밍 상태 저장
        if (isStreaming) {
            saveStreamingState();
        }

        isConnected = false;
        isStreaming = false;

        showToast(`⚡ 웹소켓 연결 해제: ${reason}`, "warning");

        // WebSocket 버튼 비활성화
        updateWebSocketButtons(false);
        if (typeof updateWSStatusDisplay === 'function') {
            updateWSStatusDisplay();
        }

        // 자동 재연결 처리
        if (!manualDisconnect && reason === "io server disconnect") {
            // 서버에서 연결을 끊은 경우 수동으로 재연결 필요
            showToast("⚠️ 서버에서 연결이 끊어졌습니다. 다시 연결해주세요.", "warning");
        }
    });

    // 재연결 시도
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`재연결 시도 #${attemptNumber}`);
        showToast(`🔄 재연결 시도 중... (${attemptNumber}/${maxReconnectAttempts})`, "info");
    });

    // 재연결 성공
    socket.on('reconnect', (attemptNumber) => {
        console.log(`재연결 성공 (${attemptNumber}번째 시도)`);
        showToast(`✅ 재연결 성공!`, "success");
        reconnectAttempts = 0;
    });

    // 재연결 실패
    socket.on('reconnect_failed', () => {
        console.error("모든 재연결 시도 실패");
        showToast("❌ 재연결 실패. 수동으로 다시 연결해주세요.", "error");
        updateWebSocketButtons(false);
    });

    // 연결 설정 확인
    socket.on('connection_established', (data) => {
        console.log("연결 설정됨:", data);
        showToast(`🎯 웹소켓 세션 ID: ${data.session_id}`, "info");
    });

    // 스크린샷 업데이트 (스트리밍)
    let lastFrameSequence = 0;
    let lastRenderTime = 0;
    const MIN_RENDER_INTERVAL = 100; // 최소 렌더링 간격 (ms) - 10fps 제한
    let pendingFrame = null;  // 대기 중인 프레임
    let renderTimeout = null;

    socket.on('screenshot_update', (data) => {
        if (data.success) {
            const sequence = data.sequence || 0;

            // 순서가 뒤바뀐 프레임 무시 (시퀀스 기준)
            if (sequence > 0 && sequence <= lastFrameSequence) {
                // console.log(`오래된 프레임 무시: seq ${sequence} <= ${lastFrameSequence}`);
                return;
            }

            const now = Date.now();
            const timeSinceLastRender = now - lastRenderTime;

            // 렌더링 제한: 너무 빠르게 들어오는 프레임은 최신 것만 유지
            if (timeSinceLastRender < MIN_RENDER_INTERVAL) {
                // 대기 중인 프레임을 최신 것으로 교체
                pendingFrame = { data, sequence };

                // 렌더 타이머가 없으면 설정
                if (!renderTimeout) {
                    renderTimeout = setTimeout(() => {
                        renderTimeout = null;
                        if (pendingFrame) {
                            renderFrame(pendingFrame.data, pendingFrame.sequence);
                            pendingFrame = null;
                        }
                    }, MIN_RENDER_INTERVAL - timeSinceLastRender);
                }
                return;
            }

            // 즉시 렌더링
            renderFrame(data, sequence);
        }
    });

    function renderFrame(data, sequence) {
        lastFrameSequence = sequence;
        lastRenderTime = Date.now();
        currentScreenshotData = data;
        // HTTP API 방식과 호환성을 위해 currentScreenshot도 설정
        currentScreenshot = data;
        displayWebSocketScreenshot(
            data.image_base64,
            data.screen_width,
            data.screen_height,
            data.method
        );
    }

    // 스크린샷 오류
    socket.on('screenshot_error', (data) => {
        console.error("스크린샷 오류:", data.message);
        showToast(`❌ 스크린샷 오류: ${data.message}`, "error");
    });

    // 스트리밍 시작됨
    socket.on('streaming_started', (data) => {
        if (data.success) {
            isStreaming = true;
            console.log("스트리밍 시작됨:", data);
            showToast(`▶️ 화면 스트리밍 시작 (${data.interval}초 간격)`, "success");
            updateStreamingButtons(true);
            if (typeof updateWSStatusDisplay === 'function') {
                updateWSStatusDisplay();
            }

            // 현재 스트리밍 상태 저장
            saveStreamingState();
        } else {
            showToast(`❌ 스트리밍 시작 실패: ${data.error}`, "error");
        }
    });

    // 스트리밍 중지됨
    socket.on('streaming_stopped', (data) => {
        if (data.success) {
            isStreaming = false;
            console.log("스트리밍 중지됨:", data);
            const stats = data.statistics;
            showToast(`⏹️ 스트리밍 중지 (성공: ${stats.success_count}, 오류: ${stats.error_count})`, "info");
            updateStreamingButtons(false);
            if (typeof updateWSStatusDisplay === 'function') {
                updateWSStatusDisplay();
            }

            // 수동 중지 시 저장된 상태 초기화
            savedStreamingState.wasStreaming = false;
        }
    });

    // 클릭 결과
    socket.on('click_result', (data) => {
        const status = data.success ? "✅" : "❌";
        // 클릭 결과 수신
        showToast(`${status} 클릭 결과: ${data.message}`, data.success ? "success" : "error");

        // 클릭 성공 시 자동으로 새 스크린샷 요청 (스트리밍 중이 아닐 때만)
        if (data.success && !isStreaming) {
            setTimeout(() => {
                requestWebSocketScreenshot();
            }, 1000);
        }

        // 클릭 처리 완료 후 큐에 남은 클릭 처리
        setTimeout(() => {
            if (clickQueue.length > 0) {
                processClickQueue();
            }
        }, 200);
    });

    // 마우스 이동 결과
    socket.on('mouse_moved', (data) => {
        // 마우스 이동은 너무 자주 발생하므로 토스트 표시 안함
        // console.log("마우스 이동:", data);
    });

    // API 호출로 인한 연결 해제 신호
    socket.on('api_call_disconnect', (data) => {
        console.log("API 호출로 인한 연결 해제:", data);
        showToast(`⚡ ${data.reason}으로 인한 일시적 연결 해제`, "warning");

        // 스트리밍 상태 저장
        if (isStreaming) {
            saveStreamingState();
        }

        // 강제 연결 해제
        if (socket && socket.connected) {
            socket.disconnect();
        }
    });

    // API 호출 완료 후 재연결 신호
    socket.on('api_call_reconnect', (data) => {
        console.log("API 호출 완료, 재연결 신호:", data);
        showToast(`🔄 ${data.reason} - 재연결 중...`, "info");

        // 잠시 후 재연결 시도
        setTimeout(() => {
            if (!socket || !socket.connected) {
                reconnectWebSocket();
            }
        }, 1000);
    });

    // 텍스트 타이핑 결과
    socket.on('text_typed', (data) => {
        const status = data.success ? "✅" : "❌";
        // 텍스트 타이핑 결과 수신
        showToast(`${status} 텍스트 타이핑: ${data.message}`, data.success ? "success" : "error");

        // 타이핑 성공 시 자동으로 새 스크린샷 요청 (스트리밍 중이 아닐 때만)
        if (data.success && !isStreaming) {
            setTimeout(() => {
                requestWebSocketScreenshot();
            }, 1000);
        }
    });

    // 키 입력 결과
    socket.on('key_pressed', (data) => {
        const status = data.success ? "✅" : "❌";
        // 키 입력 결과 수신
        showToast(`${status} 키 입력: ${data.message}`, data.success ? "success" : "error");

        // 키 입력 성공 시 자동으로 새 스크린샷 요청 (스트리밍 중이 아닐 때만)
        if (data.success && !isStreaming) {
            setTimeout(() => {
                requestWebSocketScreenshot();
            }, 500);
        }
    });

    // 일반 오류
    socket.on('error', (data) => {
        console.error("WebSocket 오류:", data);
        showToast(`❌ ${data.message}`, "error");
    });

    // Pong 응답
    socket.on('pong', (data) => {
        console.log("Pong 수신:", data);
    });

    // 연결 오류
    socket.on('connect_error', (error) => {
        reconnectAttempts++;
        console.error("WebSocket 연결 오류:", error);
        showToast(`❌ 웹소켓 연결 오류 (시도 ${reconnectAttempts}/${maxReconnectAttempts})`, "error");

        if (reconnectAttempts >= maxReconnectAttempts) {
            showToast("❌ 웹소켓 연결 재시도 횟수 초과. 수동으로 다시 연결해주세요.", "error");
        }
    });
}

// WebSocket 화면인식: 메인 스크린샷 컨테이너 사용
function displayWebSocketScreenshot(imageBase64, screenWidth, screenHeight, method) {
    // 메인 스크린샷 이미지 요소 사용
    const mainImg = document.getElementById("screenshotImage");
    if (!mainImg) {
        console.error("메인 스크린샷 이미지 요소를 찾을 수 없습니다");
        return;
    }

    // 이미지 표시
    mainImg.src = `data:image/png;base64,${imageBase64}`;

    // 화면 정보 저장
    mainImg.dataset.screenWidth = String(screenWidth || '0');
    mainImg.dataset.screenHeight = String(screenHeight || '0');

    // WebSocket 전용 클릭 이벤트 설정
    setupWebSocketImageClickEvents(mainImg, screenWidth, screenHeight);
}


// WebSocket 전용 이미지 클릭 이벤트 설정
function setupWebSocketImageClickEvents(mainImg, screenWidth, screenHeight) {
    // 웹소켓 모드에서는 기존 클릭 이벤트를 WebSocket 클릭으로 대체
    // 기존 이벤트 리스너 제거
    const newImg = mainImg.cloneNode(true);
    mainImg.parentNode.replaceChild(newImg, mainImg);

    // 좌표 표시 요소 찾기
    const coordsDiv = document.getElementById("coordinates");

    // 마우스 이동 핸들러 (좌표 표시)
    const wsMouseMoveHandler = (e) => {
        const coords = calculateWebSocketClickCoordinates(e, newImg, screenWidth, screenHeight);
        if (coordsDiv) {
            coordsDiv.textContent = `(${coords.x}, ${coords.y})`;
        }
    };

    // WebSocket 전용 클릭 핸들러
    const wsClickHandler = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 좌표 계산 (메인 이미지용)
        const coords = calculateWebSocketClickCoordinates(e, newImg, screenWidth, screenHeight);
        // console.log(`WebSocket 클릭 좌표: (${coords.x}, ${coords.y})`);

        // WebSocket을 통한 클릭 실행
        if (isConnected && typeof webSocketClick === 'function') {
            await webSocketClick(coords.x, coords.y, "left");
        } else {
            showToast("❌ WebSocket이 연결되지 않았습니다", "error");
        }
    };

    // WebSocket 전용 우클릭 핸들러
    const wsContextHandler = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const coords = calculateWebSocketClickCoordinates(e, newImg, screenWidth, screenHeight);

        if (isConnected && typeof webSocketClick === 'function') {
            await webSocketClick(coords.x, coords.y, "right");
        } else {
            showToast("❌ WebSocket이 연결되지 않았습니다", "error");
        }
    };

    // WebSocket 전용 더블클릭 핸들러
    const wsDoubleClickHandler = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const coords = calculateWebSocketClickCoordinates(e, newImg, screenWidth, screenHeight);

        if (isConnected && typeof webSocketClick === 'function') {
            await webSocketClick(coords.x, coords.y, "double");
        } else {
            showToast("❌ WebSocket이 연결되지 않았습니다", "error");
        }
    };

    // 이벤트 리스너 등록
    newImg.addEventListener("mousemove", wsMouseMoveHandler);
    newImg.addEventListener("click", wsClickHandler);
    newImg.addEventListener("contextmenu", wsContextHandler);
    newImg.addEventListener("dblclick", wsDoubleClickHandler);
}

// WebSocket 전용 클릭 좌표 계산 (공통 모듈 사용)
function calculateWebSocketClickCoordinates(event, wsImg, screenWidth, screenHeight) {
    return calculateClickCoordinates(event, wsImg, screenWidth, screenHeight);
}

// WebSocket 마우스 이벤트 설정 (기존 코드 - 호환성 유지)
function setupWebSocketMouseEvents(img, screenWidth, screenHeight, coordsDiv) {

    // 마우스 이동 시 좌표 표시
    img.addEventListener("mousemove", (e) => {
        const coords = getClickCoordinates(e, img, screenWidth, screenHeight);
        coordsDiv.textContent = `(${coords.x}, ${coords.y})`;

        // WebSocket을 통한 마우스 이동 (옵션)
        // 너무 자주 발생하므로 throttle 필요
        // throttledMouseMove(coords.x, coords.y);
    });

    // 클릭 이벤트 (WebSocket)
    img.addEventListener("click", async (e) => {
        e.preventDefault();
        const coords = getClickCoordinates(e, img, screenWidth, screenHeight);
        await webSocketClick(coords.x, coords.y, "left");
    });

    // 우클릭 이벤트 (WebSocket)
    img.addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        const coords = getClickCoordinates(e, img, screenWidth, screenHeight);
        await webSocketClick(coords.x, coords.y, "right");
    });

    // 더블클릭 이벤트 (WebSocket)
    img.addEventListener("dblclick", async (e) => {
        e.preventDefault();
        const coords = getClickCoordinates(e, img, screenWidth, screenHeight);
        await webSocketClick(coords.x, coords.y, "double");
    });
}

// WebSocket 기능 함수들

// 단일 스크린샷 요청
function requestWebSocketScreenshot() {
    if (!isConnected) {
        showToast("❌ 웹소켓이 연결되지 않았습니다", "error");
        return;
    }

    socket.emit('get_single_screenshot');
    showToast("📸 스크린샷 요청 중...", "info");
}

// 스트리밍 시작
function startWebSocketStreaming() {
    if (!isConnected) {
        showToast("❌ 웹소켓이 연결되지 않았습니다", "error");
        return;
    }

    if (isStreaming) {
        showToast("⚠️ 이미 스트리밍 중입니다", "warning");
        return;
    }

    // UI에서 설정값 가져오기
    const intervalInput = document.getElementById("streamingInterval");
    const qualityInput = document.getElementById("streamingQuality");

    if (intervalInput) streamingInterval = parseFloat(intervalInput.value) || 1.0;
    if (qualityInput) streamingQuality = parseInt(qualityInput.value) || 80;

    socket.emit('start_screenshot_streaming', {
        interval: streamingInterval,
        quality: streamingQuality
    });

    showToast("▶️ 스트리밍 시작 요청 중...", "info");
}

// 스트리밍 중지
function stopWebSocketStreaming() {
    if (!isConnected) {
        showToast("❌ 웹소켓이 연결되지 않았습니다", "error");
        return;
    }

    if (!isStreaming) {
        showToast("⚠️ 스트리밍 중이 아닙니다", "warning");
        return;
    }

    socket.emit('stop_screenshot_streaming');
    showToast("⏹️ 스트리밍 중지 요청 중...", "info");
}

// 클릭 큐 처리 함수
async function processClickQueue() {
    if (isProcessingClick || clickQueue.length === 0) {
        return;
    }

    isProcessingClick = true;
    const clickData = clickQueue.shift();

    try {
        // console.log("큐에서 클릭 처리 중:", clickData);

        // 클릭 위치에 시각적 표시
        if (typeof showClickIndicator === 'function') {
            showClickIndicator(clickData.x, clickData.y);
        }

        const clickTypeText =
            clickData.clickType === "right"
                ? "우클릭"
                : clickData.clickType === "double"
                    ? "더블클릭"
                    : "클릭";

        showToast(
            `🖱️ 화면 위치 (${clickData.x}, ${clickData.y})를 ${clickTypeText}합니다... (WebSocket)`,
            "info",
            2000
        );

        socket.emit('click_screen', {
            x: clickData.x,
            y: clickData.y,
            click_type: clickData.clickType
        });

        // 클릭 간격 조절 (너무 빠른 연속 클릭 방지)
        // 지연 시간 대폭 감소 (100ms -> 10ms)
        await new Promise(resolve => setTimeout(resolve, 10));

    } catch (error) {
        console.error("클릭 처리 오류:", error);
    } finally {
        isProcessingClick = false;
        // 큐에 남은 클릭이 있으면 계속 처리
        if (clickQueue.length > 0) {
            setTimeout(processClickQueue, 50);
        }
    }
}

// WebSocket 클릭 (큐잉 + 디바운싱 버전)
async function webSocketClick(x, y, clickType) {
    if (!isConnected) {
        showToast("❌ 웹소켓이 연결되지 않았습니다", "error");
        return;
    }

    const currentTime = Date.now();

    // 디바운싱: 너무 빠른 연속 클릭 방지
    if (currentTime - lastClickTime < CLICK_DEBOUNCE_MS) {
        // console.log(`클릭 디바운싱: ${currentTime - lastClickTime}ms < ${CLICK_DEBOUNCE_MS}ms, 클릭 무시`);
        return;
    }

    lastClickTime = currentTime;

    // 클릭을 큐에 추가
    clickQueue.push({ x, y, clickType, timestamp: currentTime });
    // console.log(`클릭이 큐에 추가됨: (${x}, ${y}) ${clickType}, 큐 길이: ${clickQueue.length}`);

    // 큐 처리 시작
    processClickQueue();
}

// WebSocket 텍스트 타이핑
function webSocketTypeText(text) {
    if (!isConnected) {
        showToast("❌ 웹소켓이 연결되지 않았습니다", "error");
        return;
    }

    socket.emit('type_text', { text: text });
    // WebSocket 텍스트 타이핑 전송
}

// WebSocket 키 입력
function webSocketPressKey(key) {
    if (!isConnected) {
        showToast("❌ 웹소켓이 연결되지 않았습니다", "error");
        return;
    }

    socket.emit('press_key', { key: key });
    // WebSocket 키 입력 전송
}

// WebSocket 키 조합 입력
function webSocketPressKeyCombination(keys) {
    if (!isConnected) {
        showToast("❌ 웹소켓이 연결되지 않았습니다", "error");
        return;
    }

    socket.emit('press_key_combination', { keys: keys });
    // WebSocket 키 조합 입력 전송
}

// 연결 상태 확인
function pingWebSocket() {
    if (!isConnected) {
        showToast("❌ 웹소켓이 연결되지 않았습니다", "error");
        return;
    }

    socket.emit('ping');
    showToast("🏓 Ping 전송", "info");
}

// UI 업데이트 함수 (통합됨)
function updateWebSocketToggleButton() {
    const btn = document.getElementById("wsToggleBtn");
    const statusDiv = document.getElementById("wsStatusIndicator");

    if (!btn) return;

    if (isConnected) {
        // 연결됨 -> "연결 종료" 상태
        btn.innerHTML = '<i class="bi bi-stop-circle-fill"></i> 종료';
        // 위험(종료) 색상, 작은 버튼
        btn.className = "btn btn-danger btn-sm";

        if (statusDiv) {
            if (isStreaming) {
                statusDiv.innerHTML = '<span class="text-success">● 스트리밍 중</span>';
            } else {
                statusDiv.innerHTML = '<span class="text-primary">● 연결됨 (대기)</span>';
            }
        }
    } else {
        // 연결 안됨 -> "라이브" 상태
        btn.innerHTML = '<i class="bi bi-plug"></i> 라이브';
        // 기본 아웃라인 스타일, 작은 버튼 (다른 네비게이션 버튼과 통일)
        btn.className = "btn btn-outline-secondary btn-sm";

        if (statusDiv) {
            statusDiv.innerHTML = '<span class="text-muted">○ 연결되지 않음</span>';
        }
    }
}

// 기존 함수들 호환성 유지 (내부적으로 새 함수 호출)
function updateWebSocketButtons(connected) {
    updateWebSocketToggleButton();
}

function updateStreamingButtons(streaming) {
    updateWebSocketToggleButton();
}

// WebSocket 연결 토글 (버튼 클릭 핸들러)
function toggleWebSocketConnection() {
    if (isConnected) {
        // 연결되어 있으면 해제
        disconnectWebSocket();
    } else {
        // 연결되어 있지 않으면 연결
        connectWebSocket();
    }
}

// WebSocket 연결/해제 함수
function connectWebSocket() {
    if (socket && isConnected) {
        showToast("⚠️ 이미 연결되어 있습니다", "warning");
        return;
    }

    manualDisconnect = false;
    reconnectAttempts = 0;
    initializeWebSocket();
}

function disconnectWebSocket() {
    if (!socket || !isConnected) {
        showToast("⚠️ 연결되어 있지 않습니다", "warning");
        return;
    }

    // 수동 연결 해제 플래그 설정
    manualDisconnect = true;

    // 저장된 스트리밍 상태 초기화
    savedStreamingState.wasStreaming = false;

    // 재연결 타이머 취소
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    socket.disconnect();
    showToast("🔌 웹소켓 연결 해제", "info");
}

function reconnectWebSocket() {
    console.log("WebSocket 재연결 시도 (레거시 함수 호출)...");

    // 기존 연결이 있으면 정리
    if (socket) {
        try {
            socket.removeAllListeners();
            socket.disconnect();
        } catch (e) {
            console.error("소켓 정리 중 오류:", e);
        }
        socket = null;
    }

    // 수동 재연결이므로 플래그 false
    manualDisconnect = false;

    // 상태 초기화
    isConnected = false;
    // isStreaming은 저장된 상태로 복원되므로 초기화하지 않음

    // 재연결 시도
    setTimeout(() => {
        initializeWebSocket();
    }, 500);
}

// Throttle 함수 (마우스 이동용)
function throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    return function (...args) {
        const currentTime = Date.now();

        if (currentTime - lastExecTime > delay) {
            func.apply(this, args);
            lastExecTime = currentTime;
        } else {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
                lastExecTime = Date.now();
            }, delay - (currentTime - lastExecTime));
        }
    };
}

// Throttled 마우스 이동 (필요시 사용)
const throttledMouseMove = throttle((x, y) => {
    if (isConnected) {
        socket.emit('move_mouse', { x: x, y: y });
    }
}, 100); // 100ms throttle

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    // console.log("WebSocket 화면인식 모듈 로드됨 (개선된 재연결 로직 포함)");

    // 초기 버튼 상태 설정
    updateWebSocketButtons(false);
    updateStreamingButtons(false);

    // 자동 웹소켓 연결 비활성화 (수동 연결만 허용)
    // setTimeout(() => {
    //     console.log("자동 웹소켓 연결 시도 중...");
    //     initializeWebSocket();
    // }, 1000); // 1초 후에 연결 시도
});