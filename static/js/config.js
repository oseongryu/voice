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

  // ===== API 서버 관리 (N개 동적 지원) =====

  // 저장된 서버 목록 가져오기
  getApiServers() {
    try {
      const data = localStorage.getItem('apiServers');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse apiServers:', e);
      return [];
    }
  },

  // 서버 목록 저장
  setApiServers(servers) {
    localStorage.setItem('apiServers', JSON.stringify(servers));
  },

  // 서버 추가
  addApiServer(name = null) {
    const servers = this.getApiServers();
    const newId = servers.length > 0 ? Math.max(...servers.map(s => s.id)) + 1 : 1;
    const newServer = {
      id: newId,
      name: name || `API 서버 ${newId}`,
      url: '',
      token: null
    };
    servers.push(newServer);
    this.setApiServers(servers);
    console.log('API 서버 추가됨:', newServer);
    return newServer;
  },

  // 서버 삭제
  removeApiServer(serverId) {
    let servers = this.getApiServers();
    servers = servers.filter(s => s.id !== serverId);
    this.setApiServers(servers);

    // 삭제된 서버가 활성 서버였다면 첫 번째 서버로 변경
    if (this.getActiveApiServer() === serverId && servers.length > 0) {
      this.setActiveApiServer(servers[0].id);
    }
    console.log('API 서버 삭제됨:', serverId);
    return true;
  },

  // 특정 서버 가져오기
  getApiServerById(serverId) {
    const servers = this.getApiServers();
    return servers.find(s => s.id === serverId) || null;
  },

  // 서버 정보 업데이트
  updateApiServer(serverId, updates) {
    const servers = this.getApiServers();
    const index = servers.findIndex(s => s.id === serverId);
    if (index >= 0) {
      servers[index] = { ...servers[index], ...updates };
      this.setApiServers(servers);
      console.log('API 서버 업데이트:', servers[index]);
      return true;
    }
    return false;
  },

  // 서버 URL 설정
  setApiServerUrl(serverId, url) {
    if (!url) return false;
    try {
      new URL(url);
      return this.updateApiServer(serverId, { url: url.replace(/\/$/, '') });
    } catch (e) {
      console.error('Invalid API server URL:', url);
      return false;
    }
  },

  // 서버 토큰 설정
  setApiServerToken(serverId, token) {
    return this.updateApiServer(serverId, { token });
  },

  // 서버 토큰 가져오기
  getApiServerToken(serverId) {
    const server = this.getApiServerById(serverId);
    return server ? server.token : null;
  },

  // 현재 활성화된 API 서버 ID
  getActiveApiServer() {
    const id = parseInt(localStorage.getItem('activeApiServer') || '0', 10);
    const servers = this.getApiServers();
    // 유효한 ID인지 확인
    if (servers.some(s => s.id === id)) {
      return id;
    }
    // 없으면 첫 번째 서버 반환
    return servers.length > 0 ? servers[0].id : 0;
  },

  setActiveApiServer(serverId) {
    localStorage.setItem('activeApiServer', serverId.toString());
    console.log('Active API server changed to:', serverId);
    return true;
  },

  // 활성 서버의 토큰 가져오기
  getActiveApiServerToken() {
    return this.getApiServerToken(this.getActiveApiServer());
  },

  // 활성 서버의 토큰 설정
  setActiveApiServerToken(token) {
    return this.setApiServerToken(this.getActiveApiServer(), token);
  },

  // 현재 활성 API 서버 URL 가져오기
  get API_SERVER_URL() {
    const server = this.getApiServerById(this.getActiveApiServer());
    return server ? server.url : 'https://127.0.0.1:8000';
  },

  set API_SERVER_URL(url) {
    this.setApiServerUrl(this.getActiveApiServer(), url);
  },

  getApiServerUrl() {
    return this.API_SERVER_URL.replace(/\/$/, '');
  },

  // 하위 호환성: 활성 서버 URL 설정
  setApiServerUrlCompat(url) {
    if (!url) {
      console.error('API server URL cannot be empty');
      return false;
    }
    try {
      new URL(url);
      const activeId = this.getActiveApiServer();
      if (activeId) {
        this.updateApiServer(activeId, { url: url.replace(/\/$/, '') });
      }
      console.log('API server URL updated:', url);
      return true;
    } catch (e) {
      console.error('Invalid API server URL:', url);
      return false;
    }
  },

  // 초기화: 서버가 없으면 기본 서버 1개 생성
  initApiServers() {
    const servers = this.getApiServers();
    if (servers.length === 0) {
      this.addApiServer('API 서버 1');
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
