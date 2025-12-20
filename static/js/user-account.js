// 사용자 계정 관리

// 로그아웃 처리
function handleLogout() {
    if (!confirm('로그아웃 하시겠습니까?')) {
        return;
    }
    
    // 토큰 삭제
    AuthUtils.clearStoredToken();
    
    // 로그인 모달 표시
    showLoginModal();
}

// 현재 사용자 정보 표시
async function displayCurrentUser() {
    const token = AuthUtils.getStoredToken();
    if (!token) {
        return;
    }
    
    try {
        // JWT 토큰에서 사용자 정보 파싱
        const payload = AuthUtils.parseJWTToken(token);
        if (payload && payload.username) {
            const usernameElement = document.getElementById('currentUsername');
            if (usernameElement) {
                usernameElement.textContent = payload.username;
            }
        }
    } catch (error) {
        console.error('사용자 정보 표시 실패:', error);
    }
}

// 페이지 로드 시 사용자 정보 표시
document.addEventListener('DOMContentLoaded', function() {
    const token = AuthUtils.getStoredToken();
    if (token && !AuthUtils.isTokenExpired(token)) {
        displayCurrentUser();
    }
});
