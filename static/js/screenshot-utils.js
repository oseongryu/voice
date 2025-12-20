/**
 * Screenshot Utils Module
 * 디버그, 세션 관리, 원격 연결 등 유틸리티 기능
 */



/**
 * 전체화면 모드 토글
 */
function toggleFullScreen(enable) {
  const doc = document.documentElement;

  // 인자가 없으면 현재 상태의 반대로 토글
  if (enable === undefined) {
    const isFullScreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    enable = !isFullScreen;
  }

  if (enable) {
    if (doc.requestFullscreen) {
      doc.requestFullscreen();
    } else if (doc.webkitRequestFullscreen) { /* Safari */
      doc.webkitRequestFullscreen();
    } else if (doc.msRequestFullscreen) { /* IE11 */
      doc.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { /* Safari */
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE11 */
      document.msExitFullscreen();
    }
  }
}

// Fullscreen change event listener to update the toggle switch state
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', updateFullScreenToggle);
  document.addEventListener('webkitfullscreenchange', updateFullScreenToggle);
  document.addEventListener('mozfullscreenchange', updateFullScreenToggle);
  document.addEventListener('MSFullscreenChange', updateFullScreenToggle);
}

function updateFullScreenToggle() {
  const toggle = document.getElementById('fullScreenToggle');
  if (toggle) {
    const isFullScreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    toggle.checked = !!isFullScreen;
  }
}

// Node.js module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkSessionStatus,
    updateSessionStatusUI,
    toggleFullScreen
  };
}