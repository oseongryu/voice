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
  TOKEN_KEY: 'authToken',  // 통합 토큰 (로그인+API 인증 정보 포함)
  TOKEN_REFRESH_MARGIN: 5 * 60 * 1000, // 5분 전에 갱신
  // LOGIN_URL: '/login',  // Deprecated - login via modal now
  MAIN_URL: '/',
  VERIFY_URL: '/api/verify',
  LOGIN_API_URL: '/api/auth/login',
  SECOND_FACTOR_URL: '/api/auth/second-factor',
  // LOGOUT_API_URL: '/api/auth/logout'  // No logout API - client-side only
};

/**
 * 통합 인증 토큰 가져오기
 * @returns {string|null} 저장된 인증 토큰 또는 null
 */
function getToken() {
  try {
    return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
  } catch (error) {
    console.error('토큰 가져오기 실패:', error);
    return null;
  }
}

/**
 * 통합 인증 토큰 저장
 * @param {string} token - 저장할 토큰
 * @returns {boolean} 저장 성공 여부
 */
function setToken(token) {
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
 * 토큰에서 인증 레벨 추출
 * @param {string} token - JWT 토큰
 * @returns {number} 인증 레벨 (1 or 2)
 */
function getAuthLevel(token = null) {
  const tokenToCheck = token || getToken();
  if (!tokenToCheck) return 0;

  const payload = parseJWTToken(tokenToCheck);
  return payload ? (payload.auth_level || 1) : 0;
}

/**
 * API 인증 완료 여부 확인
 * @param {string} token - JWT 토큰
 * @returns {boolean} API 인증 완료 여부
 */
function isApiAuthenticated(token = null) {
  const tokenToCheck = token || getToken();
  if (!tokenToCheck) return false;

  const payload = parseJWTToken(tokenToCheck);
  return payload ? (payload.api_authenticated || false) : false;
}

/**
 * API 인증 필요 여부 확인
 * @returns {boolean} API 인증 필요 여부
 */
function requiresSecondAuth() {
  const authLevel = getAuthLevel();
  const apiAuth = isApiAuthenticated();

  // auth_level=1이거나 api_authenticated=false이면 API 인증 필요
  return authLevel < 2 || !apiAuth;
}

// ========== 하위 호환성 함수 ==========

/**
 * 로그인 토큰 가져오기 (하위 호환성)
 * @deprecated Use getToken() instead
 */
function getLoginToken() {
  return getToken();
}

/**
 * 로그인 토큰 저장 (하위 호환성)
 * @deprecated Use setToken() instead
 */
function setLoginToken(token) {
  return setToken(token);
}

/**
 * API 토큰 가져오기 (하위 호환성 - 통합 토큰 반환)
 * @deprecated Use getToken() instead
 */
function getApiToken(serverUrl) {
  console.warn('getApiToken() is deprecated. Use getToken() instead.');
  return getToken();
}

/**
 * API 토큰 저장 (하위 호환성 - 무시됨)
 * @deprecated No longer needed with unified token
 */
function setApiToken(serverUrl, token) {
  console.warn('setApiToken() is deprecated and does nothing. Token is unified.');
  return true;
}

/**
 * 모든 API 토큰 가져오기 (하위 호환성)
 * @deprecated No longer needed with unified token
 */
function getAllApiTokens() {
  console.warn('getAllApiTokens() is deprecated. Use getToken() instead.');
  return {};
}

/**
 * 현재 저장된 토큰 가져오기 (하위 호환성)
 * @deprecated Use getToken() instead
 */
function getStoredToken() {
  return getToken();
}

/**
 * 토큰 저장 (하위 호환성)
 * @deprecated Use setToken() instead
 */
function setStoredToken(token) {
  return setToken(token);
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
 * 로그인 토큰 삭제 (하위 호환성)
 */
function clearLoginToken() {
  clearStoredToken();
}

/**
 * API 토큰 삭제 (하위 호환성 - 통합 토큰 삭제)
 */
function clearApiToken(serverUrl) {
  console.warn('clearApiToken() is deprecated. Use clearStoredToken() instead.');
  clearStoredToken();
}

/**
 * 모든 API 토큰 삭제 (하위 호환성)
 */
function clearAllApiTokens() {
  console.warn('clearAllApiTokens() is deprecated. Use clearStoredToken() instead.');
  clearStoredToken();
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
function createAuthHeaders(baseHeaders = {}, useApiToken = false, serverUrl = null) {
  const headers = { ...baseHeaders };

  // 통합 토큰 사용
  const token = getToken();

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
  const tokenToVerify = token || getToken();

  if (!tokenToVerify) {
    return { valid: false, error: '토큰이 없습니다' };
  }

  // 클라이언트 측에서 먼저 만료 확인
  if (isTokenExpired(tokenToVerify)) {
    return { valid: false, error: '토큰이 만료되었습니다' };
  }

  try {
    const verifyUrl = (typeof AppConfig !== 'undefined' && AppConfig.getLoginUrl)
      ? AppConfig.getLoginUrl(AUTH_CONFIG.VERIFY_URL)
      : AUTH_CONFIG.VERIFY_URL;

    const response = await fetch(verifyUrl, {
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
async function performLogin(username, password, totpCode = null, backupCode = null) {
  if (!username || !password) {
    return { success: false, error: '사용자명과 비밀번호를 입력해주세요' };
  }

  try {
    const loginUrl = (typeof AppConfig !== 'undefined' && AppConfig.getLoginUrl)
      ? AppConfig.getLoginUrl(AUTH_CONFIG.LOGIN_API_URL)
      : AUTH_CONFIG.LOGIN_API_URL;

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        totp_code: totpCode,
        backup_code: backupCode
      })
    });

    const result = await response.json();

    // 2FA 필요 응답 처리
    if (result.require_2fa) {
      return {
        success: false,
        require_2fa: true,
        error: result.message || '2FA 코드를 입력하세요'
      };
    }

    if (response.ok && result.success && result.token) {
      setToken(result.token);
      scheduleTokenRefresh(result.token);
      return {
        success: true,
        token: result.token,
        user: result.user,
        auth_level: result.auth_level || 1,
        require_second_auth: result.require_second_auth || false
      };
    } else {
      return {
        success: false,
        error: result.message || '로그인에 실패했습니다',
        require_2fa: result.require_2fa || false
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
 * API 인증 수행
 * @param {string} apiUsername - API 사용자명
 * @param {string} apiPassword - API 비밀번호
 * @returns {Promise<Object>} API 인증 결과
 */
async function performSecondFactorAuth(apiUsername, apiPassword) {
  if (!apiUsername || !apiPassword) {
    return { success: false, error: 'API 사용자명과 비밀번호를 입력해주세요' };
  }

  try {
    const currentToken = getToken();
    if (!currentToken) {
      return { success: false, error: '로그인이 필요합니다. 먼저 로그인하세요.' };
    }

    // 이미 API 인증 완료된 경우
    if (!requiresSecondAuth()) {
      return { success: false, error: '이미 API 인증이 완료되었습니다.' };
    }

    const secondFactorUrl = (typeof AppConfig !== 'undefined' && AppConfig.getApiUrl)
      ? AppConfig.getApiUrl(AUTH_CONFIG.SECOND_FACTOR_URL)
      : AUTH_CONFIG.SECOND_FACTOR_URL;

    const response = await fetch(secondFactorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({
        api_username: apiUsername,
        api_password: apiPassword
      })
    });

    const result = await response.json();

    if (response.ok && result.success && result.token) {
      // 새로운 auth_level=2 토큰 저장
      setToken(result.token);
      scheduleTokenRefresh(result.token);

      console.log('API 인증 성공:', result);

      return {
        success: true,
        token: result.token,
        user: result.user,
        auth_level: result.auth_level || 2,
        api_authenticated: true
      };
    } else {
      return {
        success: false,
        error: result.message || 'API 인증에 실패했습니다'
      };
    }
  } catch (error) {
    console.error('API 인증 요청 실패:', error);
    return {
      success: false,
      error: '서버 연결에 실패했습니다'
    };
  }
}

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

    // 로컬 토큰 삭제 (서버 로그아웃 API 없음)

    // 로컬 토큰 삭제
    clearStoredToken();

    // 로그인 모달 표시 (리다이렉트 대신)
    if (redirectToLogin && typeof window !== 'undefined') {
      // 항상 로그인 모달 표시
      if (typeof showLoginModal === 'function') {
        // 약간의 지연 후 모달 표시 (DOM 준비 대기)
        setTimeout(() => {
          showLoginModal();
        }, 100);
      } else {
        console.error('showLoginModal 함수를 찾을 수 없습니다');
      }
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
 * 401 오류 처리 (로그인 모달 표시)
 * @param {Response} response - HTTP 응답 객체
 * @param {string} context - 오류 발생 컨텍스트
 */
function handle401Error(response = null, context = '') {
  console.warn(`401 인증 오류 발생${context ? ` (${context})` : ''}:`, response);

  // 이미 로그아웃 중이거나 로그인 모달이 표시 중이면 무시
  if (isLogoutInProgress) {
    return;
  }

  // 로그인 요청 자체의 401은 무시 (잘못된 자격증명)
  if (context && context.includes('/api/auth/login')) {
    console.log('로그인 요청 실패 - 토큰 삭제하지 않음');
    return;
  }

  // 토큰 삭제 (토큰이 만료되었거나 유효하지 않음)
  // 하지만 API 서버 401은 loginToken을 삭제하지 않음
  const url = context ? context.replace('global fetch ', '') : '';
  const isApiServerRequest = url.startsWith('http') &&
    typeof AppConfig !== 'undefined' &&
    url.startsWith(AppConfig.getApiServerUrl());

  if (isApiServerRequest) {
    // API 서버 401 - API 토큰만 삭제
    console.log('API 서버 인증 실패 - API 토큰만 삭제');
    if (typeof AppConfig !== 'undefined') {
      const apiServerUrl = AppConfig.getApiServerUrl();
      if (typeof window.AuthUtils !== 'undefined' && window.AuthUtils.clearApiToken) {
        window.AuthUtils.clearApiToken(apiServerUrl);
      }
    }
  } else {
    // 로그인 서버 401 - 로그인 토큰 삭제
    console.log('로그인 서버 인증 실패 - 로그인 토큰 삭제');
    clearLoginToken();
  }

  // 토스트 메시지 표시 (있다면)
  if (typeof showToast === 'function') {
    if (isApiServerRequest) {
      showToast('🔐 API 서버 연결이 만료되었습니다.', 'warning', 3000);
    } else {
      showToast('🔐 세션이 만료되었습니다. 다시 로그인해주세요.', 'warning', 3000);
    }
  }

  // 로그인 모달 표시 (로그인 서버만)
  if (!isApiServerRequest) {
    if (typeof showLoginModal === 'function') {
      showLoginModal();
    } else {
      console.error('showLoginModal 함수를 찾을 수 없습니다');
    }
  }
}

/**
 * fetch 요청을 인증 처리와 함께 실행
 * @param {string} url - 요청 URL
 * @param {Object} options - fetch 옵션
 * @returns {Promise<Response>} HTTP 응답
 */
async function authenticatedFetch(url, options = {}) {
  // 통합 토큰 사용
  const token = getToken();

  // 헤더에 인증 토큰 추가
  const headers = { ...options.headers || {} };
  if (token && !isTokenExpired(token)) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = { ...options, headers };

  try {
    const response = await fetch(url, fetchOptions);

    // 401 오류 처리
    if (response.status === 401) {
      handle401Error(response, `fetch ${url}`);
      // 401 응답을 그대로 반환 (호출자가 처리하도록)
    }

    // 403 오류 처리 (API 인증 필요)
    if (response.status === 403) {
      const result = await response.clone().json().catch(() => ({}));
      if (result.require_second_auth) {
        console.warn('API 사용을 위해 API 인증이 필요합니다');
        if (typeof showToast === 'function') {
          showToast('🔐 API 사용을 위해 API 인증이 필요합니다', 'warning', 5000);
        }
        // API 인증 모달 표시
        if (typeof showServerConfigModal === 'function') {
          showServerConfigModal();
        }
      }
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
  const token = getToken();
  if (!token) return false;

  const timeToExpiry = getTokenTimeToExpiry(token);

  // 갱신이 필요한지 확인
  if (timeToExpiry > AUTH_CONFIG.TOKEN_REFRESH_MARGIN) {
    return true; // 갱신 불필요
  }

  try {
    // 서버에 토큰 갱신 요청 (구현되어 있다면)
    const refreshUrl = (typeof AppConfig !== 'undefined' && AppConfig.getApiUrl)
      ? AppConfig.getApiUrl('/api/refresh')
      : '/api/refresh';

    const response = await authenticatedFetch(refreshUrl, {
      method: 'POST'
    });

    if (response.ok) {
      const result = await response.json();
      if (result.token) {
        setToken(result.token);
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
      const token = getToken();

      if (!token) {
        console.log('인증 토큰이 없음');
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
  // 모든 페이지에서 인증 확인 (로그인 모달로 처리)
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
    // 자동으로 인증 헤더 추가
    let [url, options = {}] = args;

    // 통합 토큰 사용
    const token = getToken();

    // 인증 헤더 추가
    if (token && !isTokenExpired(token)) {
      options.headers = options.headers || {};
      if (typeof options.headers.append === 'function') {
        // Headers 객체인 경우
        if (!options.headers.has('Authorization')) {
          options.headers.append('Authorization', `Bearer ${token}`);
        }
      } else {
        // 일반 객체인 경우
        if (!options.headers['Authorization']) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    }

    // 원본 fetch 호출
    return originalFetch.call(this, url, options)
      .then(response => {
        // 401 오류 처리 (인증 실패)
        if (response.status === 401 && !isLogoutInProgress) {
          // 로그인 요청 자체의 401은 무시 (잘못된 자격증명 - 호출자가 처리)
          const isLoginRequest = url.includes('/api/auth/login');

          if (!isLoginRequest) {
            // 로그인 모달 표시
            handle401Error(response, `global fetch ${url}`);
          }
        }

        // 403 오류 처리 (API 인증 필요)
        if (response.status === 403 && !isLogoutInProgress) {
          const isLoginRequest = url.includes('/api/auth/login');

          if (!isLoginRequest) {
            // 응답을 클론하여 JSON 파싱 시도
            response.clone().json().then(result => {
              if (result.require_second_auth) {
                console.warn('API 사용을 위해 API 인증이 필요합니다');
                if (typeof showToast === 'function') {
                  showToast('🔐 API 사용을 위해 API 인증이 필요합니다', 'warning', 5000);
                }
                // API 인증 모달 표시
                if (typeof showServerConfigModal === 'function') {
                  setTimeout(() => showServerConfigModal(), 500);
                }
              }
            }).catch(() => {
              // JSON 파싱 실패 무시
            });
          }
        }

        return response;
      });
  };

  window._authFetchWrapperInstalled = true;
  console.log('전역 fetch 래퍼 설치 완료 (자동 인증 활성화)');
}

// 전역 스코프에 함수들 노출
if (typeof window !== 'undefined') {
  window.AuthUtils = {
    // 통합 토큰 관리
    getToken,
    setToken,
    clearStoredToken,
    getAuthLevel,
    isApiAuthenticated,
    requiresSecondAuth,

    // 하위 호환성 함수
    getLoginToken,
    setLoginToken,
    clearLoginToken,
    getApiToken,
    setApiToken,
    clearApiToken,
    getAllApiTokens,
    clearAllApiTokens,
    getStoredToken,
    setStoredToken,

    // 토큰 유틸리티
    parseJWTToken,
    isTokenExpired,
    getTokenTimeToExpiry,

    // 인증 처리
    verifyToken,
    performLogin,
    performSecondFactorAuth,
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