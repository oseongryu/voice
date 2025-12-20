/**
 * Server Config Modal - Interaction Logic
 * Handles server configuration with dynamic N-server support
 */

// 서버 선택 드롭다운 갱신
function refreshServerSelect() {
    const apiServerSelect = document.getElementById('apiServerSelect');
    if (!apiServerSelect || typeof AppConfig === 'undefined') return;

    const servers = AppConfig.getApiServers();
    const activeServerId = AppConfig.getActiveApiServer();

    apiServerSelect.innerHTML = '';
    servers.forEach(server => {
        const option = document.createElement('option');
        option.value = server.id;
        option.textContent = server.name || `서버 ${server.id}`;
        if (server.id === activeServerId) {
            option.selected = true;
        }
        apiServerSelect.appendChild(option);
    });
}

// 서버 상태 목록 갱신
function refreshServerStatusList() {
    const serverStatusList = document.getElementById('serverStatusList');
    const serverCount = document.getElementById('serverCount');
    if (!serverStatusList || typeof AppConfig === 'undefined') return;

    const servers = AppConfig.getApiServers();
    const activeServerId = AppConfig.getActiveApiServer();

    if (serverCount) {
        serverCount.textContent = `${servers.length}개`;
    }

    serverStatusList.innerHTML = '';
    servers.forEach(server => {
        // 토큰 상태 확인
        let isAuthenticated = false;
        if (server.token && typeof window.AuthUtils !== 'undefined') {
            const payload = window.AuthUtils.parseJWTToken(server.token);
            const isExpired = payload && payload.exp ? (payload.exp * 1000 < Date.now()) : true;
            isAuthenticated = !isExpired && payload && payload.api_authenticated;
        }

        const isActive = server.id === activeServerId;
        const card = document.createElement('div');
        card.className = `card p-2 mb-1 ${isActive ? 'border-primary' : ''}`;
        card.style.cursor = 'pointer';

        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="server-info" style="flex: 1;">
                    <small class="${isActive ? 'fw-bold' : 'text-muted'}">${server.name || `서버 ${server.id}`}</small>
                    ${isActive ? '<span class="badge bg-primary ms-1">활성</span>' : ''}
                </div>
                <div class="d-flex align-items-center gap-1">
                    ${isAuthenticated ? `<button class="btn btn-outline-warning btn-sm py-0 px-1 reset-auth-btn" data-server-id="${server.id}" title="인증 해제"><i class="bi bi-shield-x"></i></button>` : ''}
                    <span class="badge ${isAuthenticated ? 'bg-success' : 'bg-secondary'}">
                        ${isAuthenticated ? '인증됨' : '미인증'}
                    </span>
                </div>
            </div>
            <small class="text-muted text-truncate" style="max-width: 280px;">${server.url || '(URL 미설정)'}</small>
        `;

        // 서버 정보 클릭 시 선택
        const serverInfo = card.querySelector('.server-info');
        if (serverInfo) {
            serverInfo.onclick = (e) => {
                document.getElementById('apiServerSelect').value = server.id;
                onApiServerSelectionChange();
            };
        }

        // 인증 해제 버튼 클릭
        const resetBtn = card.querySelector('.reset-auth-btn');
        if (resetBtn) {
            resetBtn.onclick = (e) => {
                e.stopPropagation();
                resetServerAuthentication(server.id);
            };
        }

        serverStatusList.appendChild(card);
    });
}

// UI 전체 갱신
function refreshUI() {
    const apiUrlInput = document.getElementById('apiServerUrl');
    const apiAuthForm = document.getElementById('apiAuthForm');
    const apiAuthComplete = document.getElementById('apiAuthComplete');
    const statusBadge = document.getElementById('authLevelBadge');
    const activeServerBadge = document.getElementById('activeServerBadge');
    const passwordInput = document.getElementById('serverPassword');

    refreshServerSelect();
    refreshServerStatusList();

    if (typeof AppConfig === 'undefined') return;

    const activeServerId = AppConfig.getActiveApiServer();
    const server = AppConfig.getApiServerById(activeServerId);

    // URL 채우기
    if (apiUrlInput && server) {
        apiUrlInput.value = server.url || '';
    }

    // 현재 서버 인증 상태 확인
    let isAuthenticated = false;
    if (server && server.token && typeof window.AuthUtils !== 'undefined') {
        const payload = window.AuthUtils.parseJWTToken(server.token);
        const isExpired = payload && payload.exp ? (payload.exp * 1000 < Date.now()) : true;
        isAuthenticated = !isExpired && payload && payload.api_authenticated;
    }

    // 폼 표시/숨김
    if (apiAuthForm && apiAuthComplete) {
        if (isAuthenticated) {
            apiAuthForm.style.display = 'none';
            apiAuthComplete.style.display = 'block';
            if (apiUrlInput) {
                apiUrlInput.readOnly = true;
                apiUrlInput.classList.add('bg-light');
            }
        } else {
            apiAuthForm.style.display = 'block';
            apiAuthComplete.style.display = 'none';
            if (apiUrlInput) {
                apiUrlInput.readOnly = false;
                apiUrlInput.classList.remove('bg-light');
            }
        }
    }

    // 상태 배지 업데이트
    if (typeof window.AuthUtils !== 'undefined') {
        const authLevel = window.AuthUtils.getAuthLevel();
        const apiAuth = window.AuthUtils.isApiAuthenticated();

        if (statusBadge) {
            if (authLevel >= 2 && apiAuth) {
                statusBadge.className = 'badge bg-success';
                statusBadge.textContent = 'API 인증 완료';
                if (activeServerBadge && server) {
                    activeServerBadge.style.display = 'inline';
                    activeServerBadge.textContent = server.name || `서버 ${server.id}`;
                }
            } else {
                statusBadge.className = 'badge bg-warning';
                statusBadge.textContent = '로그인 완료 (API 미인증)';
                if (activeServerBadge) {
                    activeServerBadge.style.display = 'none';
                }
            }
        }
    }

    // 비밀번호 필드 초기화
    if (passwordInput) {
        passwordInput.value = '';
    }
}

window.showServerConfigModal = function () {
    const modalEl = document.getElementById('serverConfigModal');
    if (!modalEl) {
        console.error('Server config modal element not found');
        return;
    }

    // 서버 초기화
    if (typeof AppConfig !== 'undefined') {
        AppConfig.initApiServers();
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // shown.bs.modal 이벤트 리스너 등록 (한 번만)
    if (!modalEl.hasAttribute('data-listener-attached')) {
        modalEl.addEventListener('shown.bs.modal', refreshUI);
        modalEl.setAttribute('data-listener-attached', 'true');
    }

    refreshUI();
    modal.show();
}

// 서버 추가
window.addNewApiServer = function () {
    if (typeof AppConfig === 'undefined') return;

    const newServer = AppConfig.addApiServer();
    AppConfig.setActiveApiServer(newServer.id);
    refreshUI();

    // URL 입력 필드에 포커스
    const apiUrlInput = document.getElementById('apiServerUrl');
    if (apiUrlInput) {
        apiUrlInput.focus();
    }
}

// 현재 서버 삭제
window.removeCurrentApiServer = function () {
    if (typeof AppConfig === 'undefined') return;

    const servers = AppConfig.getApiServers();
    if (servers.length <= 1) {
        alert('최소 1개의 서버는 유지해야 합니다.');
        return;
    }

    const activeServerId = AppConfig.getActiveApiServer();
    const server = AppConfig.getApiServerById(activeServerId);
    const serverName = server ? (server.name || `서버 ${server.id}`) : '현재 서버';

    if (!confirm(`"${serverName}"을(를) 삭제하시겠습니까?`)) {
        return;
    }

    AppConfig.removeApiServer(activeServerId);
    refreshUI();
}

// API 서버 선택 변경 시 호출
window.onApiServerSelectionChange = function () {
    const apiServerSelect = document.getElementById('apiServerSelect');
    const apiUrlInput = document.getElementById('apiServerUrl');
    const statusDiv = document.getElementById('serverStatus');

    if (!apiServerSelect || typeof AppConfig === 'undefined') return;

    const selectedServerId = parseInt(apiServerSelect.value, 10);
    const server = AppConfig.getApiServerById(selectedServerId);

    if (!server) return;

    // 토큰 상태 확인
    let isAuthenticated = false;
    if (server.token && typeof window.AuthUtils !== 'undefined') {
        const payload = window.AuthUtils.parseJWTToken(server.token);
        const isExpired = payload && payload.exp ? (payload.exp * 1000 < Date.now()) : true;
        isAuthenticated = !isExpired && payload && payload.api_authenticated;
    }

    if (isAuthenticated) {
        // 활성 서버 전환 및 토큰 교체
        AppConfig.setActiveApiServer(selectedServerId);
        window.AuthUtils.setToken(server.token);
        console.log(`${server.name || '서버 ' + server.id}로 전환 완료 (인증됨)`);
    } else {
        // 미인증 서버 - 기본 로그인 토큰으로 교체 (API 호출 방지)
        AppConfig.setActiveApiServer(selectedServerId);

        // 기본 로그인 토큰으로 교체
        const baseLoginToken = localStorage.getItem('baseLoginToken');
        if (baseLoginToken) {
            window.AuthUtils.setToken(baseLoginToken);
            console.log(`${server.name || '서버 ' + server.id}로 전환 (미인증 - 기본 토큰 사용)`);
        }

        if (statusDiv) {
            statusDiv.className = 'alert alert-info';
            statusDiv.innerHTML = `<i class="bi bi-info-circle"></i> 이 서버는 인증이 필요합니다.`;
            statusDiv.style.display = 'block';
        }
    }

    refreshUI();
}

window.saveServerConfig = async function () {
    const apiServerSelect = document.getElementById('apiServerSelect');
    const apiUrlInput = document.getElementById('apiServerUrl');
    const usernameInput = document.getElementById('serverUsername');
    const passwordInput = document.getElementById('serverPassword');
    const statusDiv = document.getElementById('serverStatus');

    const selectedServerId = apiServerSelect ? parseInt(apiServerSelect.value, 10) : 0;
    const apiUrl = apiUrlInput ? apiUrlInput.value.trim() : '';
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    // API URL 검증
    if (!apiUrl) {
        if (statusDiv) {
            statusDiv.className = 'alert alert-danger';
            statusDiv.textContent = 'API 서버 URL을 입력하세요';
            statusDiv.style.display = 'block';
        }
        return;
    }

    // URL 유효성 검사 및 저장
    if (typeof AppConfig !== 'undefined') {
        AppConfig.setActiveApiServer(selectedServerId);
        if (!AppConfig.setApiServerUrl(selectedServerId, apiUrl)) {
            if (statusDiv) {
                statusDiv.className = 'alert alert-danger';
                statusDiv.textContent = '올바른 URL 형식이 아닙니다. (예: https://127.0.0.1:8000)';
                statusDiv.style.display = 'block';
            }
            return;
        }
    }

    if (!username || !password) {
        if (statusDiv) {
            statusDiv.className = 'alert alert-danger';
            statusDiv.textContent = 'API 사용자명과 비밀번호를 입력하세요';
            statusDiv.style.display = 'block';
        }
        return;
    }

    // API 인증 시도
    if (statusDiv) {
        statusDiv.className = 'alert alert-info';
        statusDiv.textContent = '인증 진행 중...';
        statusDiv.style.display = 'block';
    }

    try {
        if (typeof window.AuthUtils === 'undefined' || !window.AuthUtils.performSecondFactorAuth) {
            if (statusDiv) {
                statusDiv.className = 'alert alert-danger';
                statusDiv.textContent = '인증 시스템을 찾을 수 없습니다.';
            }
            return;
        }

        const forceReauth = true;
        const result = await window.AuthUtils.performSecondFactorAuth(username, password, forceReauth);

        if (result.success) {
            // 서버 토큰 저장
            if (typeof AppConfig !== 'undefined') {
                AppConfig.setApiServerToken(selectedServerId, result.token);
            }

            if (statusDiv) {
                statusDiv.className = 'alert alert-success';
                statusDiv.textContent = '✓ 인증 성공!';
                statusDiv.style.display = 'block';
            }

            if (passwordInput) passwordInput.value = '';

            refreshUI();

            // 2초 후 모달 닫기
            setTimeout(() => {
                const modalEl = document.getElementById('serverConfigModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }, 2000);
        } else {
            if (statusDiv) {
                statusDiv.className = 'alert alert-danger';
                statusDiv.textContent = `❌ 인증 실패: ${result.error || '알 수 없는 오류'}`;
            }
        }
    } catch (error) {
        console.error('API 인증 오류:', error);
        if (statusDiv) {
            statusDiv.className = 'alert alert-danger';
            statusDiv.textContent = `❌ 인증 오류: ${error.message}`;
        }
    }
}

// 특정 서버의 인증 해제
async function resetServerAuthentication(serverId) {
    const server = AppConfig.getApiServerById(serverId);
    const serverName = server ? (server.name || `서버 ${server.id}`) : '서버';

    if (!confirm(`"${serverName}"의 인증을 해제하시겠습니까?`)) {
        return;
    }

    try {
        // 해당 서버의 토큰으로 해제 요청
        const serverToken = server ? server.token : null;
        const currentToken = window.AuthUtils.getToken();
        const tokenToUse = serverToken || currentToken;

        if (!tokenToUse) {
            alert('인증 정보를 찾을 수 없습니다.');
            return;
        }

        const resetUrl = (typeof AppConfig !== 'undefined' && AppConfig.getApiUrl)
            ? AppConfig.getApiUrl('/api/auth/reset-api-auth')
            : '/api/auth/reset-api-auth';

        const response = await fetch(resetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenToUse}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // 해당 서버 토큰 삭제
            AppConfig.setApiServerToken(serverId, null);

            // 현재 활성 서버면 기본 로그인 토큰으로 교체 (API 호출 방지)
            if (serverId === AppConfig.getActiveApiServer()) {
                const baseLoginToken = localStorage.getItem('baseLoginToken');
                if (baseLoginToken) {
                    window.AuthUtils.setToken(baseLoginToken);
                } else if (result.token) {
                    window.AuthUtils.setToken(result.token);
                }
            }

            refreshUI();
            console.log(`${serverName} 인증 해제 완료`);
        } else {
            // 서버 요청 실패해도 로컬 토큰은 삭제
            AppConfig.setApiServerToken(serverId, null);

            // 현재 활성 서버면 기본 토큰으로 교체
            if (serverId === AppConfig.getActiveApiServer()) {
                const baseLoginToken = localStorage.getItem('baseLoginToken');
                if (baseLoginToken) {
                    window.AuthUtils.setToken(baseLoginToken);
                }
            }

            refreshUI();
            console.log(`${serverName} 로컬 토큰 삭제`);
        }
    } catch (error) {
        console.error('API 인증 해제 오류:', error);
        // 네트워크 오류 시에도 로컬 토큰 삭제
        AppConfig.setApiServerToken(serverId, null);
        refreshUI();
    }
}

window.resetApiAuthentication = async function () {
    const activeServerId = AppConfig.getActiveApiServer();
    await resetServerAuthentication(activeServerId);
}
