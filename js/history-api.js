/**
 * History API Module
 * 히스토리 관련 API 호출 및 데이터 관리를 담당하는 모듈
 */
class HistoryAPI {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultLimit = options.defaultLimit || 20;
    
    // 이벤트 콜백
    this.onHistoryLoad = options.onHistoryLoad || (() => {});
    this.onHistoryLoadError = options.onHistoryLoadError || (() => {});
    this.onTextAdded = options.onTextAdded || (() => {});
    this.onTextAddError = options.onTextAddError || (() => {});
    this.onCommandExecuted = options.onCommandExecuted || (() => {});
    this.onCommandExecuteError = options.onCommandExecuteError || (() => {});
    this.onHistoryCleared = options.onHistoryCleared || (() => {});
    this.onHistoryClearError = options.onHistoryClearError || (() => {});
    this.onSelectedDeleted = options.onSelectedDeleted || (() => {});
    this.onSelectedDeleteError = options.onSelectedDeleteError || (() => {});
    this.onError = options.onError || (() => {});
  }

  /**
   * 인증 헤더 생성 (공통 모듈 사용)
   */
  createAuthHeaders(baseHeaders = {}) {
    if (typeof window.AuthUtils !== 'undefined' && window.AuthUtils.createAuthHeaders) {
      return window.AuthUtils.createAuthHeaders(baseHeaders);
    }

    // 폴백: 기존 방식
    const headers = { ...baseHeaders };
    const token = localStorage.getItem('authToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * 서버에서 히스토리를 로드합니다
   */
  async loadHistory(limit = this.defaultLimit) {
    try {
      const response = await fetch(`${this.baseUrl}/api/history?limit=${limit}`, {
        headers: this.createAuthHeaders()
      });
      const data = await response.json();

      if (response.ok) {
        this.onHistoryLoad(data.history || []);
        return data.history || [];
      } else {
        this.onHistoryLoadError(data.error || '히스토리 로딩 실패');
        throw new Error(data.error || '히스토리 로딩 실패');
      }
    } catch (error) {
      this.onHistoryLoadError('히스토리 로딩 중 오류가 발생했습니다.');
      this.onError('히스토리 로딩 오류', error);
      throw error;
    }
  }

  /**
   * 텍스트를 히스토리에 추가합니다
   */
  async addTextToHistory(text) {
    if (!text || !text.trim()) {
      const error = '텍스트를 입력해주세요.';
      this.onTextAddError(error);
      throw new Error(error);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/add_text_to_history`, {
        method: 'POST',
        headers: this.createAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ text: text.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        this.onTextAdded(text.trim(), data);
        return data;
      } else {
        this.onTextAddError(data.error || '텍스트 추가 실패');
        throw new Error(data.error || '텍스트 추가 실패');
      }
    } catch (error) {
      this.onTextAddError('텍스트 추가 중 오류가 발생했습니다.');
      this.onError('텍스트 추가 오류', error);
      throw error;
    }
  }

  /**
   * 히스토리에서 명령을 실행합니다
   */
  async executeCommand(command) {
    if (!command || !command.trim()) {
      const error = '실행할 명령이 없습니다.';
      this.onCommandExecuteError(error);
      throw new Error(error);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/execute_command`, {
        method: 'POST',
        headers: this.createAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ command: command.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        this.onCommandExecuted(command.trim(), data);
        return data;
      } else {
        this.onCommandExecuteError(data.error || '명령 실행 실패');
        throw new Error(data.error || '명령 실행 실패');
      }
    } catch (error) {
      this.onCommandExecuteError('명령 실행 중 오류가 발생했습니다.');
      this.onError('명령 실행 오류', error);
      throw error;
    }
  }

  /**
   * 선택된 히스토리 항목들을 삭제합니다
   */
  async deleteSelectedItems(itemIds) {
    if (!itemIds || itemIds.length === 0) {
      const error = '삭제할 항목이 선택되지 않았습니다.';
      this.onSelectedDeleteError(error);
      throw new Error(error);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/history/delete_selected`, {
        method: 'DELETE',
        headers: this.createAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ item_ids: itemIds }),
      });

      const data = await response.json();

      if (response.ok) {
        this.onSelectedDeleted(data);
        return data;
      } else {
        this.onSelectedDeleteError(data.error || '선택 삭제 실패');
        throw new Error(data.error || '선택 삭제 실패');
      }
    } catch (error) {
      this.onSelectedDeleteError('선택 삭제 중 오류가 발생했습니다.');
      this.onError('선택 삭제 오류', error);
      throw error;
    }
  }

  /**
   * 서버의 모든 히스토리를 삭제합니다
   */
  async clearHistory() {
    try {
      const response = await fetch(`${this.baseUrl}/api/history/clear`, {
        method: 'DELETE',
        headers: this.createAuthHeaders()
      });

      const data = await response.json();

      if (response.ok) {
        this.onHistoryCleared(data);
        return data;
      } else {
        this.onHistoryClearError(data.error || '히스토리 삭제 실패');
        throw new Error(data.error || '히스토리 삭제 실패');
      }
    } catch (error) {
      this.onHistoryClearError('히스토리 삭제 중 오류가 발생했습니다.');
      this.onError('히스토리 삭제 오류', error);
      throw error;
    }
  }

  /**
   * 히스토리를 텍스트 파일로 내보냅니다
   */
  exportHistory(history) {
    if (!history || history.length === 0) {
      throw new Error('내보낼 히스토리가 없습니다.');
    }

    let exportText = '음성 변환 & 텍스트 입력 히스토리\n';
    exportText += '='.repeat(40) + '\n';
    exportText += `생성일시: ${new Date().toLocaleString('ko-KR')}\n`;
    exportText += `총 항목 수: ${history.length}개\n\n`;

    history.forEach((item, index) => {
      const timestamp = new Date(item.timestamp).toLocaleString('ko-KR');
      const status = item.success ? '[성공]' : '[실패]';
      const source = item.action === '텍스트 입력' ? '[텍스트입력]' : '[음성변환]';
      
      exportText += `${index + 1}. ${source} ${status} [${timestamp}]\n`;
      exportText += `   ${item.text}\n\n`;
    });

    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-text-history-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
  }

  /**
   * 텍스트를 클립보드에 복사합니다
   */
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // 클립보드 API가 안 되면 fallback
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      }
    } catch (error) {
      this.onError('클립보드 복사 오류', error);
      throw error;
    }
  }
}

// ES6 모듈로 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryAPI;
}

// 전역 객체로 등록 (브라우저 환경)
if (typeof window !== 'undefined') {
  window.HistoryAPI = HistoryAPI;
}
