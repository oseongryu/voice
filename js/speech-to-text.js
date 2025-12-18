/**
 * Speech to Text Module
 * 음성을 텍스트로 변환하는 재사용 가능한 모듈
 */
class SpeechToText {
  constructor(options = {}) {
    this.apiEndpoint = options.apiEndpoint || '/transcribe';
    this.language = options.language || 'ko-KR';
    this.audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100,
      ...options.audioConstraints
    };
    
    // 상태 관리
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.hasPermission = false;
    
    // 이벤트 콜백
    this.onPermissionGranted = options.onPermissionGranted || (() => {});
    this.onPermissionDenied = options.onPermissionDenied || (() => {});
    this.onRecordingStart = options.onRecordingStart || (() => {});
    this.onRecordingStop = options.onRecordingStop || (() => {});
    this.onTranscriptionStart = options.onTranscriptionStart || (() => {});
    this.onTranscriptionSuccess = options.onTranscriptionSuccess || (() => {});
    this.onTranscriptionError = options.onTranscriptionError || (() => {});
    this.onError = options.onError || (() => {});
  }

  /**
   * 마이크 권한을 확인하고 요청합니다
   */
  async checkPermission() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 음성 녹음을 지원하지 않습니다.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 권한이 허용되면 스트림을 즉시 중지
      stream.getTracks().forEach(track => track.stop());
      
      this.hasPermission = true;
      this.onPermissionGranted();
      return true;
      
    } catch (error) {
      this.hasPermission = false;
      
      let errorMessage = '마이크 권한 오류가 발생했습니다.';
      if (error.name === 'NotAllowedError') {
        errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '마이크를 찾을 수 없습니다. 마이크가 제대로 연결되어 있는지 확인해주세요.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = '이 브라우저는 음성 녹음을 지원하지 않습니다.';
      }
      
      this.onPermissionDenied(errorMessage);
      return false;
    }
  }

  /**
   * 녹음을 시작합니다
   */
  async startRecording() {
    try {
      if (this.isRecording) {
        throw new Error('이미 녹음 중입니다.');
      }

      if (!this.hasPermission) {
        const hasPermission = await this.checkPermission();
        if (!hasPermission) {
          return false;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: this.audioConstraints
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { 
          type: this.mediaRecorder.mimeType 
        });
        await this.sendAudioToServer(audioBlob);
      };

      this.mediaRecorder.onerror = event => {
        this.onError('녹음 중 오류가 발생했습니다.', event.error);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.onRecordingStart();
      
      return true;

    } catch (error) {
      this.onError('녹음 시작 오류', error);
      return false;
    }
  }

  /**
   * 녹음을 중지합니다
   */
  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      return false;
    }

    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // 스트림 정리
    if (this.mediaRecorder.stream) {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    this.isRecording = false;
    this.onRecordingStop();
    return true;
  }

  /**
   * 서버로 오디오를 전송하고 텍스트 변환을 요청합니다
   */
  async sendAudioToServer(audioBlob) {
    try {
      this.onTranscriptionStart();

      const formData = new FormData();
      const filename = 'recording.' + (audioBlob.type.includes('webm') ? 'webm' : 'wav');
      formData.append('audio', audioBlob, filename);

      // 인증 헤더 생성
      const headers = {};
      if (typeof window.AuthUtils !== 'undefined' && window.AuthUtils.createAuthHeaders) {
        const authHeaders = window.AuthUtils.createAuthHeaders();
        // FormData 사용 시 Content-Type을 자동 설정하므로 Authorization만 추가
        if (authHeaders.Authorization) {
          headers.Authorization = authHeaders.Authorization;
        }
      } else {
        // 폴백: 기존 방식
        const token = localStorage.getItem('authToken');
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        this.onTranscriptionSuccess(data.text);
      } else {
        this.onTranscriptionError(data.error || '변환 중 오류가 발생했습니다.');
      }

    } catch (error) {
      this.onTranscriptionError('서버 통신 오류가 발생했습니다.');
    }
  }

  /**
   * 현재 녹음 상태를 반환합니다
   */
  getRecordingState() {
    return {
      isRecording: this.isRecording,
      hasPermission: this.hasPermission,
      mediaRecorderState: this.mediaRecorder ? this.mediaRecorder.state : 'inactive'
    };
  }

  /**
   * 리소스를 정리합니다
   */
  destroy() {
    if (this.isRecording) {
      this.stopRecording();
    }
    
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

// ES6 모듈로 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpeechToText;
}

// 전역 객체로 등록 (브라우저 환경)
if (typeof window !== 'undefined') {
  window.SpeechToText = SpeechToText;
}
