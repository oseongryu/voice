/**
 * Authentication Utils Module
 * 인증 관련 공통 유틸리티 함수들
 * - 토큰 관리
 * - 자동 로그인 처리
 * - 401 오류 처리
 * - 인증 상태 관리
 */

// 인증 상태 관리 변수들
let isAuthCheckInProgress = false;
let authCheckPromise = null;
let isLogoutInProgress = false;
let tokenRefreshTimeout = null;

// 상수 정의
const AUTH_CONFIG = {
  TOKEN_KEY: 'authToken',
  TOKEN_REFRESH_MARGIN: 5 * 60 * 1000, // 5분 전에 갱신
  LOGIN_URL: '/login',
  MAIN_URL: '/',
  VERIFY_URL: '/api/verify',
  LOGIN_API_URL: '/api/login',
  LOGOUT_API_URL: '/api/logout'
};

/**
 * 현재 저장된 토큰 가져오기
 * @returns {string|null} 저장된 토큰 또는 null
 */
function getStoredToken() {
  try {
    return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
  } catch (error) {
    console.error('토큰 가져오기 실패:', error);
    return null;
  }
}

/**
 * 토큰 저장
 * @param {string} token - 저장할 토큰
 * @returns {boolean} 저장 성공 여부
 */
function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
      return true;
    } else {
      localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
      return true;
    }
  } catch (error) {
    console.error('토큰 저장 실패:', error);
    return false;
  }
}

/**
 * 토큰 삭제
 */
function clearStoredToken() {
  try {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
  } catch (error) {
    console.error('토큰 삭제 실패:', error);
  }
}

/**
 * JWT 토큰 파싱 (만료 시간 확인용)
 * @param {string} token - JWT 토큰
 * @returns {Object|null} 파싱된 토큰 정보
 */
function parseJWTToken(token) {
  try {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('JWT 토큰 파싱 실패:', error);
    return null;
  }
}

/**
 * 토큰 만료 확인
 * @param {string} token - 확인할 토큰
 * @returns {boolean} 만료 여부
 */
function isTokenExpired(token) {
  const payload = parseJWTToken(token);
  if (!payload || !payload.exp) return true;

  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp <= currentTime;
}

/**
 * 토큰 만료까지 남은 시간 (밀리초)
 * @param {string} token - 확인할 토큰
 * @returns {number} 남은 시간 (밀리초), 만료되었으면 0
 */
function getTokenTimeToExpiry(token) {
  const payload = parseJWTToken(token);
  if (!payload || !payload.exp) return 0;

  const currentTime = Math.floor(Date.now() / 1000);
  const remainingSeconds = payload.exp - currentTime;
  return Math.max(0, remainingSeconds * 1000);
}

/**
 * 인증 헤더 생성
 * @param {Object} baseHeaders - 기본 헤더 객체
 * @returns {Object} 인증 헤더가 포함된 헤더 객체
 */
function createAuthHeaders(baseHeaders = {}) {
  const headers = { ...baseHeaders };
  const token = getStoredToken();

  if (token && !isTokenExpired(token)) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * 토큰 유효성 검증 (서버에서 확인)
 * @param {string} token - 검증할 토큰 (기본값: 저장된 토큰)
 * @returns {Promise<Object>} 검증 결과 {valid: boolean, user?: Object, error?: string}
 */
async function verifyToken(token = null) {
  const tokenToVerify = token || getStoredToken();

  if (!tokenToVerify) {
    return { valid: false, error: '토큰이 없습니다' };
  }

  // 클라이언트 측에서 먼저 만료 확인
  if (isTokenExpired(tokenToVerify)) {
    return { valid: false, error: '토큰이 만료되었습니다' };
  }

  try {
    const response = await fetch(AUTH_CONFIG.VERIFY_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenToVerify}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();
      return { valid: true, user: result.user };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return { valid: false, error: errorData.message || '토큰 검증 실패' };
    }
  } catch (error) {
    console.error('토큰 검증 요청 실패:', error);
    return { valid: false, error: '서버 연결 실패' };
  }
}

/**
 * 로그인 수행
 * @param {string} username - 사용자명
 * @param {string} password - 비밀번호
 * @returns {Promise<Object>} 로그인 결과 {success: boolean, token?: string, user?: Object, error?: string}
 */
async function performLogin(username, password) {
  if (!username || !password) {
    return { success: false, error: '사용자명과 비밀번호를 입력해주세요' };
  }

  try {
    const response = await fetch(AUTH_CONFIG.LOGIN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (response.ok && result.success && result.token) {
      // 토큰 저장
      setStoredToken(result.token);

      // 자동 갱신 스케줄링
      scheduleTokenRefresh(result.token);

      return {
        success: true,
        token: result.token,
        user: result.user
      };
    } else {
      return {
        success: false,
        error: result.message || '로그인에 실패했습니다'
      };
    }
  } catch (error) {
    console.error('로그인 요청 실패:', error);
    return {
      success: false,
      error: '서버 연결에 실패했습니다'
    };
  }
}

/**
 * 로그아웃 수행
 * @param {boolean} redirectToLogin - 로그인 페이지로 리다이렉트 여부
 * @returns {Promise<boolean>} 로그아웃 성공 여부
 */
async function performLogout(redirectToLogin = true) {
  if (isLogoutInProgress) {
    return false;
  }

  isLogoutInProgress = true;

  try {
    // 토큰 갱신 스케줄 취소
    if (tokenRefreshTimeout) {
      clearTimeout(tokenRefreshTimeout);
      tokenRefreshTimeout = null;
    }

    // 서버에 로그아웃 요청 (선택사항)
    const token = getStoredToken();
    if (token) {
      try {
        await fetch(AUTH_CONFIG.LOGOUT_API_URL, {
          method: 'POST',
          headers: createAuthHeaders({ 'Content-Type': 'application/json' })
        });
      } catch (error) {
        console.warn('서버 로그아웃 요청 실패 (무시):', error);
      }
    }

    // 로컬 토큰 삭제
    clearStoredToken();

    // 리다이렉트
    if (redirectToLogin && typeof window !== 'undefined') {
      window.location.href = AUTH_CONFIG.LOGIN_URL;
    }

    return true;
  } catch (error) {
    console.error('로그아웃 실패:', error);
    return false;
  } finally {
    isLogoutInProgress = false;
  }
}

/**
 * 401 오류 처리 (자동 로그아웃)
 * @param {Response} response - HTTP 응답 객체
 * @param {string} context - 오류 발생 컨텍스트
 */
function handle401Error(response = null, context = '') {
  console.warn(`401 인증 오류 발생${context ? ` (${context})` : ''}:`, response);

  // 이미 로그아웃 중이면 무시
  if (isLogoutInProgress) {
    return;
  }

  // 토스트 메시지 표시 (있다면)
  if (typeof showToast === 'function') {
    showToast('🔐 세션이 만료되었습니다. 다시 로그인해주세요.', 'warning', 3000);
  }

  // 자동 로그아웃
  performLogout(true);
}

/**
 * fetch 요청을 인증 처리와 함께 실행
 * @param {string} url - 요청 URL
 * @param {Object} options - fetch 옵션
 * @returns {Promise<Response>} HTTP 응답
 */
async function authenticatedFetch(url, options = {}) {
  // 헤더에 인증 토큰 추가
  const headers = createAuthHeaders(options.headers || {});
  const fetchOptions = { ...options, headers };

  try {
    const response = await fetch(url, fetchOptions);

    // 401 오류 처리
    if (response.status === 401) {
      handle401Error(response, `fetch ${url}`);
      // 401 응답을 그대로 반환 (호출자가 처리하도록)
    }

    return response;
  } catch (error) {
    console.error(`인증된 fetch 요청 실패 (${url}):`, error);
    throw error;
  }
}

/**
 * 토큰 자동 갱신 스케줄링
 * @param {string} token - 현재 토큰
 */
function scheduleTokenRefresh(token) {
  if (tokenRefreshTimeout) {
    clearTimeout(tokenRefreshTimeout);
  }

  const timeToExpiry = getTokenTimeToExpiry(token);
  const refreshTime = timeToExpiry - AUTH_CONFIG.TOKEN_REFRESH_MARGIN;

  if (refreshTime > 0) {
    tokenRefreshTimeout = setTimeout(async () => {
      console.log('토큰 자동 갱신 시도...');
      await refreshTokenIfNeeded();
    }, refreshTime);

    // console.log(`토큰 자동 갱신이 ${Math.floor(refreshTime / 1000)}초 후에 예약되었습니다`);
  } else {
    console.warn('토큰이 곧 만료되거나 이미 만료되었습니다');
  }
}

/**
 * 필요시 토큰 갱신
 * @returns {Promise<boolean>} 갱신 성공 여부
 */
async function refreshTokenIfNeeded() {
  const token = getStoredToken();
  if (!token) return false;

  const timeToExpiry = getTokenTimeToExpiry(token);

  // 갱신이 필요한지 확인
  if (timeToExpiry > AUTH_CONFIG.TOKEN_REFRESH_MARGIN) {
    return true; // 갱신 불필요
  }

  try {
    // 서버에 토큰 갱신 요청 (구현되어 있다면)
    const response = await authenticatedFetch('/api/refresh', {
      method: 'POST'
    });

    if (response.ok) {
      const result = await response.json();
      if (result.token) {
        setStoredToken(result.token);
        scheduleTokenRefresh(result.token);
        console.log('토큰 갱신 성공');
        return true;
      }
    }
  } catch (error) {
    console.error('토큰 갱신 실패:', error);
  }

  // 갱신 실패 시 재검증
  const verification = await verifyToken();
  if (!verification.valid) {
    console.warn('토큰 갱신 실패, 로그아웃 처리');
    performLogout(true);
    return false;
  }

  return true;
}

/**
 * 인증 상태 확인 및 초기화
 * @param {boolean} redirectIfInvalid - 인증 실패 시 리다이렉트 여부
 * @returns {Promise<Object>} 인증 결과 {authenticated: boolean, user?: Object}
 */
async function initializeAuth(redirectIfInvalid = true) {
  // 이미 인증 확인 중이면 기다림
  if (isAuthCheckInProgress && authCheckPromise) {
    return await authCheckPromise;
  }

  isAuthCheckInProgress = true;
  authCheckPromise = (async () => {
    try {
      const token = getStoredToken();

      if (!token) {
        console.log('토큰이 없음');
        if (redirectIfInvalid) {
          performLogout(true);
        }
        return { authenticated: false };
      }

      // 토큰 검증
      const verification = await verifyToken(token);

      if (verification.valid) {
        // console.log('인증 성공:', verification.user);

        // 자동 갱신 스케줄링
        scheduleTokenRefresh(token);

        return { authenticated: true, user: verification.user };
      } else {
        console.log('토큰 검증 실패:', verification.error);
        if (redirectIfInvalid) {
          performLogout(true);
        }
        return { authenticated: false, error: verification.error };
      }
    } catch (error) {
      console.error('인증 초기화 오류:', error);
      if (redirectIfInvalid) {
        performLogout(true);
      }
      return { authenticated: false, error: error.message };
    } finally {
      isAuthCheckInProgress = false;
      authCheckPromise = null;
    }
  })();

  return await authCheckPromise;
}

/**
 * 페이지 로드 시 인증 확인
 */
async function checkAuthOnPageLoad() {
  // 로그인 페이지에서는 확인하지 않음
  if (window.location.pathname === AUTH_CONFIG.LOGIN_URL) {
    return;
  }

  return await initializeAuth(true);
}

/**
 * 전역 fetch 래퍼 설정 (401 자동 처리)
 */
function setupGlobalFetchWrapper() {
  if (typeof window === 'undefined' || window._authFetchWrapperInstalled) {
    return;
  }

  const originalFetch = window.fetch;

  window.fetch = function (...args) {
    // authenticatedFetch 사용을 권장하지만, 기존 코드 호환성을 위해 유지
    return originalFetch.apply(this, args)
      .then(response => {
        if (response.status === 401 && !isLogoutInProgress) {
          handle401Error(response, `global fetch ${args[0]}`);
        }
        return response;
      });
  };

  window._authFetchWrapperInstalled = true;
  // console.log('전역 fetch 래퍼 설치 완료');
}

// 전역 스코프에 함수들 노출
if (typeof window !== 'undefined') {
  window.AuthUtils = {
    // 토큰 관리
    getStoredToken,
    setStoredToken,
    clearStoredToken,
    parseJWTToken,
    isTokenExpired,
    getTokenTimeToExpiry,

    // 인증 처리
    verifyToken,
    performLogin,
    performLogout,
    handle401Error,
    createAuthHeaders,
    authenticatedFetch,

    // 자동 갱신
    scheduleTokenRefresh,
    refreshTokenIfNeeded,

    // 초기화
    initializeAuth,
    checkAuthOnPageLoad,
    setupGlobalFetchWrapper,

    // 설정
    AUTH_CONFIG
  };

  // 기존 함수명 호환성 유지
  window.logout = function () {
    return performLogout(true);
  };

  window.handle401Error = handle401Error;

  // 전역 fetch 래퍼 자동 설치
  setupGlobalFetchWrapper();
}