// 로그인 모달 관리
let loginModalInstance = null;
let currentLoginUsername = '';
let currentLoginPassword = '';

// 로그인 모달 표시
function showLoginModal() {
    const modalEl = document.getElementById('loginModal');
    if (!modalEl) {
        console.error('Login modal not found');
        return;
    }

    // 모달 초기화
    resetLoginModal();

    // 서버 URL 미리 채우기 (localStorage에서 가져오기)
    const serverUrlInput = document.getElementById('loginServerUrl');
    if (serverUrlInput && typeof AppConfig !== 'undefined') {
        const savedUrl = AppConfig.getLoginServerUrl();
        if (savedUrl) {
            serverUrlInput.value = savedUrl;
        }
    }

    // 모달 인스턴스 생성 및 표시
    if (!loginModalInstance) {
        loginModalInstance = new bootstrap.Modal(modalEl);
    }
    loginModalInstance.show();

    // 서버 URL이 없으면 URL 입력에 포커스, 있으면 사용자명에 포커스
    setTimeout(() => {
        if (serverUrlInput && !serverUrlInput.value) {
            serverUrlInput.focus();
        } else {
            document.getElementById('loginUsername').focus();
        }
    }, 500);
}

// 로그인 모달 초기화
function resetLoginModal() {
    document.getElementById('loginStage1').style.display = 'block';
    document.getElementById('loginStage2').style.display = 'none';
    document.getElementById('loginStage3').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
    // Note: loginServerUrl은 초기화하지 않음 (사용자가 입력한 URL 유지)
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginTotpCode').value = '';
    document.getElementById('loginBackupCode').value = '';
    currentLoginUsername = '';
    currentLoginPassword = '';
}

// Stage 1: Username/Password 로그인
async function handleModalLogin() {
    const serverUrl = document.getElementById('loginServerUrl').value.trim();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    // 서버 URL 검증
    if (!serverUrl) {
        showLoginError('API 서버 URL을 입력하세요.');
        return;
    }

    // 서버 URL 유효성 검사 및 저장
    if (typeof AppConfig !== 'undefined') {
        if (!AppConfig.setLoginServerUrl(serverUrl)) {
            showLoginError('올바른 URL 형식이 아닙니다. (예: https://127.0.0.1:8000)');
            return;
        }
    } else {
        showLoginError('AppConfig가 로드되지 않았습니다.');
        return;
    }

    // 사용자 인증 정보 검증
    if (!username || !password) {
        showLoginError('사용자명과 비밀번호를 입력하세요.');
        return;
    }

    currentLoginUsername = username;
    currentLoginPassword = password;

    try {
        const result = await AuthUtils.performLogin(username, password);

        if (result.success) {
            // 로그인 성공 - 모달 닫기
            loginModalInstance.hide();
            resetLoginModal();
            // 페이지 새로고침하여 메인 화면 로드
            window.location.reload();
        } else if (result.require_2fa) {
            // 2FA 필요 - Stage 2로 전환
            document.getElementById('loginStage1').style.display = 'none';
            document.getElementById('loginStage2').style.display = 'block';
            document.getElementById('loginTotpCode').focus();
        } else {
            showLoginError(result.error || '로그인 실패');
        }
    } catch (error) {
        showLoginError('서버 연결 실패: ' + error.message);
    }
}

// Stage 2: TOTP 코드 로그인
async function handleModalTOTPLogin() {
    const totpCode = document.getElementById('loginTotpCode').value;

    if (!totpCode || totpCode.length !== 6) {
        showLoginError('6자리 인증 코드를 입력하세요.');
        return;
    }

    try {
        const loginUrl = AppConfig.getLoginUrl('/api/auth/login');
        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentLoginUsername,
                password: currentLoginPassword,
                totp_code: totpCode
            })
        });

        const result = await response.json();

        if (result.success && result.token) {
            AuthUtils.setStoredToken(result.token);
            loginModalInstance.hide();
            resetLoginModal();
            window.location.reload();
        } else {
            showLoginError(result.message || '인증 실패');
            document.getElementById('loginTotpCode').value = '';
            document.getElementById('loginTotpCode').focus();
        }
    } catch (error) {
        showLoginError('서버 연결 실패');
    }
}

// Stage 3: 백업 코드 로그인
async function handleModalBackupLogin() {
    const backupCode = document.getElementById('loginBackupCode').value.trim().toUpperCase();

    if (!backupCode) {
        showLoginError('백업 코드를 입력하세요.');
        return;
    }

    try {
        const loginUrl = AppConfig.getLoginUrl('/api/auth/login');
        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentLoginUsername,
                password: currentLoginPassword,
                backup_code: backupCode
            })
        });

        const result = await response.json();

        if (result.success && result.token) {
            AuthUtils.setStoredToken(result.token);
            loginModalInstance.hide();
            resetLoginModal();
            if (result.backup_code_used) {
                alert('백업 코드가 사용되었습니다. 남은 코드를 확인하세요.');
            }
            window.location.reload();
        } else {
            showLoginError(result.message || '백업 코드 인증 실패');
            document.getElementById('loginBackupCode').value = '';
            document.getElementById('loginBackupCode').focus();
        }
    } catch (error) {
        showLoginError('서버 연결 실패');
    }
}

// 백업 코드 입력으로 전환
function showModalBackupCode() {
    document.getElementById('loginStage2').style.display = 'none';
    document.getElementById('loginStage3').style.display = 'block';
    document.getElementById('loginBackupCode').focus();
}

// TOTP 코드 입력으로 돌아가기
function backToModalTOTP() {
    document.getElementById('loginStage3').style.display = 'none';
    document.getElementById('loginStage2').style.display = 'block';
    document.getElementById('loginTotpCode').focus();
}

// 에러 메시지 표시
function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Enter 키 지원
document.addEventListener('DOMContentLoaded', function () {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                const stage1 = document.getElementById('loginStage1');
                const stage2 = document.getElementById('loginStage2');
                const stage3 = document.getElementById('loginStage3');

                if (stage1.style.display !== 'none') {
                    handleModalLogin();
                } else if (stage2.style.display !== 'none') {
                    handleModalTOTPLogin();
                } else if (stage3.style.display !== 'none') {
                    handleModalBackupLogin();
                }
            }
        });
    }
});
