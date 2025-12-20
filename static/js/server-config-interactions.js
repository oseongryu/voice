/**
 * Server Config Modal - Interaction Logic
 * Handles server configuration, login, and logout functionality
 */

window.showServerConfigModal = function () {
    const modalEl = document.getElementById('serverConfigModal');
    if (!modalEl) {
        console.error('Server config modal element not found');
        return;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    // 모달이 표시될 때 인증 상태 업데이트
    const updateAuthStatus = () => {
        const statusBadge = document.getElementById('authLevelBadge');
        const usernameInput = document.getElementById('serverUsername');
        const passwordInput = document.getElementById('serverPassword');
        const apiUrlInput = document.getElementById('apiServerUrl');

        if (typeof window.AuthUtils !== 'undefined') {
            const authLevel = window.AuthUtils.getAuthLevel();
            const apiAuth = window.AuthUtils.isApiAuthenticated();

            console.log('현재 인증 상태 - auth_level:', authLevel, 'api_authenticated:', apiAuth);

            if (statusBadge) {
                if (authLevel >= 2 && apiAuth) {
                    statusBadge.className = 'badge bg-success';
                    statusBadge.textContent = 'API 인증 완료 (API 사용 가능)';
                } else {
                    statusBadge.className = 'badge bg-warning';
                    statusBadge.textContent = '로그인 완료 (API 미인증)';
                }
            }
        }

        // API URL 미리 채우기 (localStorage에서 가져오기)
        if (apiUrlInput && typeof AppConfig !== 'undefined') {
            const savedApiUrl = AppConfig.getApiServerUrl();
            if (savedApiUrl) {
                apiUrlInput.value = savedApiUrl;
            }
        }

        // 비밀번호 필드 초기화
        if (passwordInput) {
            passwordInput.value = '';
        }
    };

    // shown.bs.modal 이벤트 리스너 등록 (한 번만)
    if (!modalEl.hasAttribute('data-listener-attached')) {
        modalEl.addEventListener('shown.bs.modal', updateAuthStatus);
        modalEl.setAttribute('data-listener-attached', 'true');
    }

    // 즉시 한 번 로드 (모달 표시 전에도)
    updateAuthStatus();

    modal.show();
}

window.saveServerConfig = async function () {
    const apiUrlInput = document.getElementById('apiServerUrl');
    const usernameInput = document.getElementById('serverUsername');
    const passwordInput = document.getElementById('serverPassword');
    const statusDiv = document.getElementById('serverStatus');
    const apiUrl = apiUrlInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // API URL 검증
    if (!apiUrl) {
        statusDiv.className = 'alert alert-danger';
        statusDiv.textContent = 'API 서버 URL을 입력하세요';
        statusDiv.style.display = 'block';
        return;
    }

    // API URL 유효성 검사 및 저장
    if (typeof AppConfig !== 'undefined') {
        if (!AppConfig.setApiServerUrl(apiUrl)) {
            statusDiv.className = 'alert alert-danger';
            statusDiv.textContent = '올바른 URL 형식이 아닙니다. (예: https://127.0.0.1:8000)';
            statusDiv.style.display = 'block';
            return;
        }
    } else {
        statusDiv.className = 'alert alert-danger';
        statusDiv.textContent = 'AppConfig가 로드되지 않았습니다.';
        statusDiv.style.display = 'block';
        return;
    }

    if (!username || !password) {
        statusDiv.className = 'alert alert-danger';
        statusDiv.textContent = 'API 사용자명과 비밀번호를 입력하세요';
        statusDiv.style.display = 'block';
        return;
    }

    // API 인증 시도
    statusDiv.className = 'alert alert-info';
    statusDiv.textContent = 'API 인증 진행 중...';
    statusDiv.style.display = 'block';

    try {
        // window.AuthUtils.performSecondFactorAuth 호출
        if (typeof window.AuthUtils === 'undefined' || !window.AuthUtils.performSecondFactorAuth) {
            statusDiv.className = 'alert alert-danger';
            statusDiv.textContent = '인증 시스템을 찾을 수 없습니다.';
            return;
        }

        const result = await window.AuthUtils.performSecondFactorAuth(username, password);

        if (result.success) {
            statusDiv.className = 'alert alert-success';
            statusDiv.textContent = `✓ API 인증 성공! API 사용이 활성화되었습니다.`;

            // 인증 상태 배지 업데이트
            const statusBadge = document.getElementById('authLevelBadge');
            if (statusBadge) {
                statusBadge.className = 'badge bg-success';
                statusBadge.textContent = 'API 인증 완료 (API 사용 가능)';
            }

            // Clear password field for security
            passwordInput.value = '';

            // 저장 확인 로그
            console.log('API 인증 완료 - auth_level:', result.auth_level);

            // Auto close after 2 seconds
            setTimeout(() => {
                const modalEl = document.getElementById('serverConfigModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }, 2000);
        } else {
            statusDiv.className = 'alert alert-danger';
            statusDiv.textContent = `❌ API 인증 실패: ${result.error || '알 수 없는 오류'}`;
        }
    } catch (error) {
        console.error('API 인증 오류:', error);
        statusDiv.className = 'alert alert-danger';
        statusDiv.textContent = `❌ API 인증 오류: ${error.message}`;
    }
}

window.resetApiAuthentication = async function () {
    if (!confirm('API 인증을 해제하시겠습니까?\n\n로그인 상태는 유지되며, API 기능만 사용할 수 없게 됩니다.')) {
        return;
    }

    try {
        // 현재 토큰 가져오기
        const currentToken = window.AuthUtils.getToken();
        if (!currentToken) {
            alert('인증 정보를 찾을 수 없습니다.');
            return;
        }

        // 백엔드에 API 인증 해제 요청
        const resetUrl = (typeof AppConfig !== 'undefined' && AppConfig.getApiUrl)
            ? AppConfig.getApiUrl('/api/auth/reset-api-auth')
            : '/api/auth/reset-api-auth';

        const response = await fetch(resetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok && result.success && result.token) {
            // auth_level=1 토큰으로 교체
            window.AuthUtils.setToken(result.token);

            // 모달 닫기
            const modalEl = document.getElementById('serverConfigModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            // 페이지 새로고침
            alert('API 인증이 해제되었습니다.');
            window.location.reload();
        } else {
            alert('API 인증 해제 실패: ' + (result.message || '알 수 없는 오류'));
        }
    } catch (error) {
        console.error('API 인증 해제 오류:', error);
        alert('API 인증 해제 중 오류가 발생했습니다: ' + error.message);
    }
}

window.resetServerConfigAndLogout = function () {
    if (!confirm('정말로 로그아웃하시겠습니까?\n\n모든 인증 정보가 삭제되고 로그인 페이지로 이동합니다.')) {
        return;
    }

    try {
        // 로그아웃 처리
        if (typeof window.AuthUtils !== 'undefined' && window.AuthUtils.performLogout) {
            window.AuthUtils.performLogout(true);
        } else {
            // 수동으로 토큰 삭제 및 리다이렉트
            localStorage.clear();
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('로그아웃 오류:', error);
        alert('로그아웃 중 오류가 발생했습니다: ' + error.message);
    }
}

// Note: Server URL configuration is now handled in the login modal
// The server config modal is only for API server connection
// Auto-popup disabled since main login modal now includes server URL input
document.addEventListener('DOMContentLoaded', () => {
    // Auto-popup disabled - users configure server URL during login
    console.log('Server config modal ready (manual open only)');
});
