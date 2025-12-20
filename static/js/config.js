/**
 * API Configuration for GitHub Pages Deployment
 * 로그인 서버와 API 서버를 분리하여 관리
 */

// 서버 설정
const AppConfig = {
  // ===== 로그인 서버 URL =====
  get LOGIN_SERVER_URL() {
    return localStorage.getItem('loginServerUrl') || 'https://127.0.0.1:8000';
  },

  set LOGIN_SERVER_URL(url) {
    localStorage.setItem('loginServerUrl', url);
  },

  getLoginServerUrl() {
    return this.LOGIN_SERVER_URL.replace(/\/$/, '');
  },

  setLoginServerUrl(url) {
    if (!url) {
      console.error('Login server URL cannot be empty');
      return false;
    }

    try {
      new URL(url);
      this.LOGIN_SERVER_URL = url.replace(/\/$/, '');
      console.log('Login server URL updated:', this.LOGIN_SERVER_URL);
      return true;
    } catch (e) {
      console.error('Invalid login server URL:', url);
      return false;
    }
  },

  // ===== API 서버 URL =====
  get API_SERVER_URL() {
    return localStorage.getItem('apiServerUrl') || 'https://127.0.0.1:8000';
  },

  set API_SERVER_URL(url) {
    localStorage.setItem('apiServerUrl', url);
  },

  getApiServerUrl() {
    return this.API_SERVER_URL.replace(/\/$/, '');
  },

  setApiServerUrl(url) {
    if (!url) {
      console.error('API server URL cannot be empty');
      return false;
    }

    try {
      new URL(url);
      this.API_SERVER_URL = url.replace(/\/$/, '');
      console.log('API server URL updated:', this.API_SERVER_URL);
      return true;
    } catch (e) {
      console.error('Invalid API server URL:', url);
      return false;
    }
  },

  // ===== 로그인 엔드포인트 생성 (인증, 2FA 등) =====
  getLoginUrl(endpoint) {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.getLoginServerUrl()}${path}`;
  },

  // ===== API 엔드포인트 생성 (스크린샷, 음성 인식 등) =====
  getApiUrl(endpoint) {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.getApiServerUrl()}${path}`;
  },

  // ===== 하위 호환성을 위한 기존 메서드 (deprecated) =====
  // 기존 코드가 getServerUrl()을 호출하는 경우 API 서버 URL 반환
  get SERVER_URL() {
    return this.API_SERVER_URL;
  },

  set SERVER_URL(url) {
    this.API_SERVER_URL = url;
  },

  getServerUrl() {
    console.warn('getServerUrl() is deprecated. Use getApiServerUrl() or getLoginServerUrl()');
    return this.getApiServerUrl();
  },

  setServerUrl(url) {
    console.warn('setServerUrl() is deprecated. Use setApiServerUrl() or setLoginServerUrl()');
    return this.setApiServerUrl(url);
  },

  // ===== 서버 연결 테스트 =====
  async testApiConnection() {
    try {
      const response = await fetch(this.getApiUrl('/api/settings'), {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  },

  async testLoginConnection() {
    try {
      const response = await fetch(this.getLoginUrl('/api/settings'), {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.error('Login connection test failed:', error);
      return false;
    }
  }
};

// 전역에서 사용 가능하도록 설정
window.AppConfig = AppConfig;

// 페이지 로드 시 저장된 서버 URL 표시
document.addEventListener('DOMContentLoaded', () => {
  const loginUrl = AppConfig.getLoginServerUrl();
  const apiUrl = AppConfig.getApiServerUrl();

  console.log('Loaded login server URL:', loginUrl);
  console.log('Loaded API server URL:', apiUrl);

  if (!localStorage.getItem('loginServerUrl')) {
    console.log('No login server URL configured.');
  }

  if (!localStorage.getItem('apiServerUrl')) {
    console.log('No API server URL configured.');
  }
});
