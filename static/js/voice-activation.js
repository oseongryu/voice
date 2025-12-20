/**
 * Voice Activation Module
 * 연속 음성 인식을 통해 "인식해줘" 트리거 단어를 감지하고 후속 명령을 처리하는 모듈
 */
class VoiceActivation {
  constructor(options = {}) {
    this.triggerPhrase = options.triggerPhrase || '인식해줘';
    this.commandTimeout = options.commandTimeout || 5000; // 5초 후 명령 대기 종료
    this.speechToText = options.speechToText || null;

    // Web Speech API 설정
    this.recognition = null;
    this.isListening = false;
    this.isWaitingForCommand = false;
    this.commandTimer = null;

    // 상태 관리
    this.hasPermission = false;
    this.isSupported = false;

    // 이벤트 콜백
    this.onActivationStart = options.onActivationStart || (() => { });
    this.onActivationStop = options.onActivationStop || (() => { });
    this.onTriggerDetected = options.onTriggerDetected || (() => { });
    this.onCommandReceived = options.onCommandReceived || (() => { });
    this.onCommandTimeout = options.onCommandTimeout || (() => { });
    this.onError = options.onError || (() => { });
    this.onPermissionDenied = options.onPermissionDenied || (() => { });

    this.init();
  }

  /**
   * 음성 인식 초기화
   */
  init() {
    // Web Speech API 지원 확인
    this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

    if (!this.isSupported) {
      this.onError('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    // SpeechRecognition 객체 생성
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // 음성 인식 설정
    this.recognition.continuous = true; // 연속 인식
    this.recognition.interimResults = true; // 중간 결과 포함
    this.recognition.lang = 'ko-KR'; // 한국어
    this.recognition.maxAlternatives = 3; // 더 많은 대안 제공

    // Mac Safari 호환성을 위한 추가 설정
    if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
      this.recognition.continuous = false; // Safari에서는 continuous를 false로
      this.recognition.interimResults = false; // Safari에서는 interim results 비활성화
    }

    this.setupRecognitionEvents();
  }

  /**
   * 음성 인식 이벤트 설정
   */
  setupRecognitionEvents() {
    this.recognition.onstart = () => {
      console.log('음성 활성화: 연속 인식 시작');
    };

    this.recognition.onresult = (event) => {
      this.handleSpeechResult(event);
    };

    this.recognition.onerror = (event) => {
      console.error('음성 인식 오류:', event.error);

      if (event.error === 'not-allowed') {
        this.hasPermission = false;
        this.onPermissionDenied('마이크 권한이 거부되었습니다.');
      } else if (event.error === 'no-speech') {
        // 음성이 감지되지 않음 - 재시작
        if (this.isListening) {
          setTimeout(() => this.restartRecognition(), 100);
        }
      } else {
        this.onError(`음성 인식 오류: ${event.error}`);
      }
    };

    this.recognition.onend = () => {
      console.log('음성 인식 종료됨');
      if (this.isListening) {
        // Mac Safari에서는 자동 재시작하지 않음
        if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
          console.log('Safari 감지: 수동 재시작 필요');
          return;
        }
        // 연속 인식을 위해 재시작
        setTimeout(() => this.restartRecognition(), 500);
      }
    };
  }

  /**
   * 음성 인식 결과 처리
   */
  handleSpeechResult(event) {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      // 여러 대안 중 신뢰도가 높은 것을 선택
      let bestTranscript = '';
      let maxConfidence = 0;

      for (let j = 0; j < Math.min(event.results[i].length, 3); j++) {
        const alternative = event.results[i][j];
        if (alternative.confidence > maxConfidence) {
          maxConfidence = alternative.confidence;
          bestTranscript = alternative.transcript;
        }
      }

      const transcript = (bestTranscript || event.results[i][0].transcript).trim();

      if (event.results[i].isFinal) {
        finalTranscript += transcript;
        console.log('한국어 인식 결과 (final):', transcript, '신뢰도:', maxConfidence);
      } else {
        interimTranscript += transcript;
        console.log('한국어 인식 결과 (interim):', transcript, '신뢰도:', maxConfidence);
      }
    }

    const fullTranscript = (finalTranscript || interimTranscript).toLowerCase();

    // 트리거 단어 감지
    if (!this.isWaitingForCommand && this.containsTriggerPhrase(fullTranscript)) {
      this.handleTriggerDetected();
    }

    // 명령 대기 중일 때 명령 처리
    else if (this.isWaitingForCommand && finalTranscript) {
      this.handleCommand(finalTranscript);
    }
  }

  /**
   * 트리거 단어 포함 여부 확인
   */
  containsTriggerPhrase(text) {
    const normalizedText = text.replace(/\s+/g, '');
    const normalizedTrigger = this.triggerPhrase.replace(/\s+/g, '');

    // 정확한 매칭과 유사한 패턴 모두 확인
    const triggerVariations = [
      '인식해줘',
      '인식해 줘',
      '인식 해줘',
      '인식 해 줘',
      '인식',
      'recognition',
      '시작'
    ];

    return triggerVariations.some(variation => {
      const normalized = variation.replace(/\s+/g, '');
      return normalizedText.includes(normalized);
    });
  }

  /**
   * 트리거 감지 처리
   */
  handleTriggerDetected() {
    console.log('트리거 단어 감지:', this.triggerPhrase);
    this.isWaitingForCommand = true;
    this.onTriggerDetected();

    // 명령 대기 타이머 시작
    this.commandTimer = setTimeout(() => {
      this.handleCommandTimeout();
    }, this.commandTimeout);
  }

  /**
   * 명령 처리
   */
  handleCommand(command) {
    console.log('명령 수신:', command);

    // 타이머 정리
    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }

    this.isWaitingForCommand = false;
    this.onCommandReceived(command);

    // SpeechToText 모듈이 있으면 연동
    if (this.speechToText) {
      this.speechToText.onTranscriptionSuccess(command);
    }
  }

  /**
   * 명령 대기 시간 초과 처리
   */
  handleCommandTimeout() {
    console.log('명령 대기 시간 초과');
    this.isWaitingForCommand = false;
    this.commandTimer = null;
    this.onCommandTimeout();
  }

  /**
   * 음성 인식 재시작
   */
  restartRecognition() {
    if (this.isListening && this.recognition) {
      try {
        this.recognition.start();
      } catch (error) {
        // 이미 시작된 경우 무시
        if (error.name !== 'InvalidStateError') {
          console.error('음성 인식 재시작 오류:', error);
        }
      }
    }
  }

  /**
   * 마이크 권한 확인
   */
  async checkPermission() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 마이크 접근을 지원하지 않습니다.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

      this.hasPermission = true;
      return true;

    } catch (error) {
      this.hasPermission = false;

      if (error.name === 'NotAllowedError') {
        this.onPermissionDenied('마이크 권한이 거부되었습니다.');
      } else {
        this.onError('마이크 권한 확인 오류: ' + error.message);
      }

      return false;
    }
  }

  /**
   * 음성 활성화 시작
   */
  async startActivation() {
    if (!this.isSupported) {
      this.onError('음성 인식이 지원되지 않습니다.');
      return false;
    }

    if (this.isListening) {
      return true;
    }

    // 권한 확인
    if (!this.hasPermission) {
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        return false;
      }
    }

    try {
      this.isListening = true;
      this.isWaitingForCommand = false;

      if (this.commandTimer) {
        clearTimeout(this.commandTimer);
        this.commandTimer = null;
      }

      this.recognition.start();
      this.onActivationStart();

      console.log(`음성 활성화 시작 - 트리거: "${this.triggerPhrase}"`);
      return true;

    } catch (error) {
      this.isListening = false;
      this.onError('음성 활성화 시작 오류: ' + error.message);
      return false;
    }
  }

  /**
   * 음성 활성화 중지
   */
  stopActivation() {
    if (!this.isListening) {
      return true;
    }

    this.isListening = false;
    this.isWaitingForCommand = false;

    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }

    if (this.recognition) {
      this.recognition.stop();
    }

    this.onActivationStop();
    console.log('음성 활성화 중지');
    return true;
  }

  /**
   * 현재 상태 반환
   */
  getState() {
    return {
      isSupported: this.isSupported,
      hasPermission: this.hasPermission,
      isListening: this.isListening,
      isWaitingForCommand: this.isWaitingForCommand,
      triggerPhrase: this.triggerPhrase
    };
  }

  /**
   * SpeechToText 모듈 연동
   */
  setSpeechToText(speechToText) {
    this.speechToText = speechToText;
  }

  /**
   * 리소스 정리
   */
  destroy() {
    this.stopActivation();
    this.recognition = null;
    this.speechToText = null;
  }
}

// ES6 모듈로 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceActivation;
}

// 전역 객체로 등록 (브라우저 환경)
if (typeof window !== 'undefined') {
  window.VoiceActivation = VoiceActivation;
}