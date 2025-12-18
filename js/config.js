/**
 * API Configuration for GitHub Pages Deployment
 * 서버 URL 설정 및 API 기본 경로 관리
 */

// 서버 설정
const AppConfig = {
  // 기본 서버 URL (localStorage에서 불러오거나 기본값 사용)
  get SERVER_URL() {
    return localStorage.getItem('serverUrl') || 'http://localhost:8000';
  },

  set SERVER_URL(url) {
    localStorage.setItem('serverUrl', url);
  },

  // 서버 URL 가져오기 (trailing slash 제거)
  getServerUrl() {
    return this.SERVER_URL.replace(/\/$/, '');
  },

  // API 엔드포인트 생성
  getApiUrl(endpoint) {
    // endpoint가 /로 시작하지 않으면 추가
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.getServerUrl()}${path}`;
  },

  // 서버 URL 설정
  setServerUrl(url) {
    if (!url) {
      console.error('Server URL cannot be empty');
      return false;
    }

    try {
      // URL 유효성 검사
      new URL(url);
      this.SERVER_URL = url.replace(/\/$/, '');
      console.log('Server URL updated:', this.SERVER_URL);
      return true;
    } catch (e) {
      console.error('Invalid URL:', url);
      return false;
    }
  },

  // 서버 연결 테스트
  async testConnection() {
    try {
      const response = await fetch(this.getApiUrl('/api/settings'), {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
};

// 전역에서 사용 가능하도록 설정
window.AppConfig = AppConfig;

// 페이지 로드 시 저장된 서버 URL 표시
document.addEventListener('DOMContentLoaded', () => {
  const savedUrl = AppConfig.getServerUrl();
  console.log('Loaded server URL from localStorage:', savedUrl);

  // 서버 URL이 설정되지 않은 경우 설정 모달 표시
  if (!localStorage.getItem('serverUrl')) {
    console.log('No server URL configured. Please set it in the Server Settings modal.');
  }
});
