/**
 * 토스트 알림 설정 (Toast Notification Settings)
 * 원하는 알림만 표시되도록 설정할 수 있습니다.
 */
window.TOAST_SETTINGS = {
  // 전체 토스트 시스템 활성화 여부 (Master Switch)
  ENABLED: true,

  // 알림 카테고리별 표시 여부 설정
  // show: true (표시), show: false (숨김)
  CATEGORIES: {
    // 클릭 및 좌표 관련 알림
    'CLICK': {
      keywords: ['클릭', '좌표', 'Click', 'Coordinate', '터치'],
      show: false
    },
    // 스크린샷 촬영 관련 알림
    'SCREENSHOT': {
      keywords: ['스크린샷', '촬영', 'Screenshot', '캡처'],
      show: false
    },
    // 웹소켓 및 스트리밍 상태 알림
    'WEBSOCKET': {
      keywords: ['웹소켓', 'WebSocket', '스트리밍', '연결', 'Ping'],
      show: false
    },
    // 음성 인식 관련 알림
    'VOICE': {
      keywords: ['음성', '인식', '명령', 'Voice', '트리거'],
      show: true
    },
    // 모드 전환 알림
    'MODE': {
      keywords: ['모드', 'Mode'],
      show: false
    },
    // 텍스트/키 입력 알림
    'INPUT': {
      keywords: ['입력', '타이핑', '키', 'Input', 'Type'],
      show: false
    },
    // 오류 및 경고
    'ERROR': {
      keywords: ['오류', '실패', '경고', 'Error', 'Fail', 'Warning'],
      show: false
    }
  },

  // 분류되지 않은 기타 알림 표시 여부
  SHOW_UNCATEGORIZED: false
};
