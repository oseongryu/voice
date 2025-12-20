/**
 * Coordinate Utils Module
 * 좌표 처리 공통 유틸리티 함수들
 * - 클릭 좌표 계산
 * - 좌표 변환 및 스케일링
 * - 시각적 표시 기능
 */

/**
 * 클릭 좌표 계산 함수 (중앙 정렬 offset 보정 포함)
 * @param {Event} event - 클릭 이벤트 객체
 * @param {HTMLImageElement} img - 스크린샷 이미지 요소
 * @param {number} screenWidth - 원본 화면 너비
 * @param {number} screenHeight - 원본 화면 높이
 * @returns {Object} 계산된 좌표 {x, y}
 */
function calculateClickCoordinates(event, img, screenWidth, screenHeight) {
  const rect = img.getBoundingClientRect();

  // 브라우저의 devicePixelRatio 고려
  const deviceRatio = window.devicePixelRatio || 1;

  // 이미지의 원본 크기 (aspect ratio 계산용)
  const originalWidth = screenWidth;
  const originalHeight = screenHeight;
  const originalAspectRatio = originalWidth / originalHeight;

  // 이미지 컨테이너 크기
  const containerWidth = rect.width;
  const containerHeight = rect.height;
  const containerAspectRatio = containerWidth / containerHeight;

  // 실제 이미지가 렌더링되는 크기 계산 (object-fit: contain 고려)
  let actualImageWidth, actualImageHeight, offsetX, offsetY;

  if (originalAspectRatio > containerAspectRatio) {
    // 이미지가 가로로 더 넓음 - 가로에 맞춤, 세로 중앙 정렬
    actualImageWidth = containerWidth;
    actualImageHeight = containerWidth / originalAspectRatio;
    offsetX = 0;
    // 이미지가 위쪽에서 렌더링되도록 변경했으므로 vertical offset을 0으로 고정
    offsetY = 0;
  } else {
    // 이미지가 세로로 더 높음 - 세로에 맞춤, 가로 중앙 정렬
    actualImageWidth = containerHeight * originalAspectRatio;
    actualImageHeight = containerHeight;
    offsetX = (containerWidth - actualImageWidth) / 2;
    offsetY = 0;
  }

  // 클릭한 위치 (컨테이너 기준)
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;

  // 실제 이미지 영역 내에서의 좌표로 변환
  const imageClickX = clickX - offsetX;
  const imageClickY = clickY - offsetY;

  // 이미지 영역 밖 클릭 체크
  if (
    imageClickX < 0 ||
    imageClickX > actualImageWidth ||
    imageClickY < 0 ||
    imageClickY > actualImageHeight
  ) {
    // 이미지 영역 내로 제한
    const boundedImageClickX = Math.max(
      0,
      Math.min(imageClickX, actualImageWidth)
    );
    const boundedImageClickY = Math.max(
      0,
      Math.min(imageClickY, actualImageHeight)
    );

    // 원본 화면 좌표로 변환
    const scaleX = originalWidth / actualImageWidth;
    const scaleY = originalHeight / actualImageHeight;

    return {
      x: Math.round(boundedImageClickX * scaleX),
      y: Math.round(boundedImageClickY * scaleY),
    };
  }

  // 원본 화면 좌표로 변환
  const scaleX = originalWidth / actualImageWidth;
  const scaleY = originalHeight / actualImageHeight;

  const x = Math.round(imageClickX * scaleX);
  const y = Math.round(imageClickY * scaleY);

  return { x, y };
}

/**
 * 서버 좌표를 화면 표시 좌표로 변환
 * @param {number} serverX - 서버 X 좌표
 * @param {number} serverY - 서버 Y 좌표
 * @param {HTMLImageElement} img - 스크린샷 이미지 요소
 * @param {number} originalWidth - 원본 화면 너비
 * @param {number} originalHeight - 원본 화면 높이
 * @returns {Object} 화면 표시 좌표 {x, y}
 */
function convertServerToDisplayCoordinates(serverX, serverY, img, originalWidth, originalHeight) {
  if (!img) {
    console.error("convertServerToDisplayCoordinates: 이미지 요소가 없습니다");
    return { x: 0, y: 0 };
  }

  const rect = img.getBoundingClientRect();
  const originalAspectRatio = originalWidth / originalHeight;

  // 컨테이너 크기
  const containerWidth = rect.width;
  const containerHeight = rect.height;
  const containerAspectRatio = containerWidth / containerHeight;

  // 실제 이미지 렌더링 크기와 offset 계산
  let actualImageWidth, actualImageHeight, offsetX, offsetY;

  if (originalAspectRatio > containerAspectRatio) {
    actualImageWidth = containerWidth;
    actualImageHeight = containerWidth / originalAspectRatio;
    offsetX = 0;
    offsetY = 0;
  } else {
    actualImageWidth = containerHeight * originalAspectRatio;
    actualImageHeight = containerHeight;
    offsetX = (containerWidth - actualImageWidth) / 2;
    offsetY = 0;
  }

  // 서버 좌표를 이미지 좌표로 변환
  const scaleX = actualImageWidth / originalWidth;
  const scaleY = actualImageHeight / originalHeight;
  const imageX = serverX * scaleX;
  const imageY = serverY * scaleY;

  // offset을 고려한 최종 표시 위치
  const displayX = imageX + offsetX;
  const displayY = imageY + offsetY;

  return { x: displayX, y: displayY };
}

/**
 * 좌표 스케일링 함수 (녹화 재생 시 사용)
 * @param {number} x - 원본 X 좌표
 * @param {number} y - 원본 Y 좌표
 * @param {number} refWidth - 참조 화면 너비
 * @param {number} refHeight - 참조 화면 높이
 * @param {number} currentWidth - 현재 화면 너비
 * @param {number} currentHeight - 현재 화면 높이
 * @returns {Object} 스케일된 좌표 {x, y}
 */
function scaleCoordinates(x, y, refWidth, refHeight, currentWidth, currentHeight) {
  if (!refWidth || !refHeight || !currentWidth || !currentHeight) {
    return { x: x || 0, y: y || 0 };
  }

  const scaleX = currentWidth / refWidth;
  const scaleY = currentHeight / refHeight;

  return {
    x: Math.round((x || 0) * scaleX),
    y: Math.round((y || 0) * scaleY)
  };
}

/**
 * 클릭 위치 시각적 표시 함수
 * @param {number} x - 서버 X 좌표
 * @param {number} y - 서버 Y 좌표
 * @param {HTMLImageElement} img - 스크린샷 이미지 요소
 * @param {HTMLElement} container - 컨테이너 요소 (기본값: .screenshot-content)
 * @param {Object} currentScreenshot - 현재 스크린샷 정보
 * @param {Object} options - 표시 옵션
 */
function showClickIndicatorAtPosition(x, y, img, container, currentScreenshot, options = {}) {
  // console.log(`showClickIndicatorAtPosition 호출됨: x=${x}, y=${y}`);

  if (!img) {
    console.error("showClickIndicatorAtPosition: 이미지 요소를 찾을 수 없습니다");
    return;
  }

  if (!container) {
    container = document.querySelector(".screenshot-content");
    if (!container) {
      console.error("showClickIndicatorAtPosition: 컨테이너를 찾을 수 없습니다");
      return;
    }
  }

  if (!currentScreenshot) {
    console.warn("showClickIndicatorAtPosition: currentScreenshot이 없습니다");
    return;
  }

  // 서버 좌표를 화면 표시 좌표로 변환
  const displayCoords = convertServerToDisplayCoordinates(
    x, y, img,
    currentScreenshot.screen_width,
    currentScreenshot.screen_height
  );

  // console.log(`계산된 표시 위치: displayX=${displayCoords.x}, displayY=${displayCoords.y}`);

  // 클릭 표시기 생성
  const indicator = document.createElement("div");
  indicator.className = "click-indicator";
  indicator.style.left = `${displayCoords.x - 10}px`;
  indicator.style.top = `${displayCoords.y - 10}px`;
  indicator.style.position = "absolute";
  indicator.style.zIndex = "1000";
  indicator.style.pointerEvents = "none";

  // 스타일 설정 (옵션으로 커스터마이징 가능)
  const defaultStyle = {
    width: "20px",
    height: "20px",
    border: "3px solid #ff4757",
    borderRadius: "50%",
    background: "rgba(255, 71, 87, 0.3)",
    duration: 600
  };

  const style = { ...defaultStyle, ...options };

  indicator.style.width = style.width;
  indicator.style.height = style.height;
  indicator.style.border = style.border;
  indicator.style.borderRadius = style.borderRadius;
  indicator.style.background = style.background;

  container.style.position = "relative";
  container.appendChild(indicator);
  // console.log("showClickIndicatorAtPosition: indicator 추가됨", indicator);

  // 애니메이션 완료 후 제거
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
      // console.log("showClickIndicatorAtPosition: indicator 제거됨");
    }
  }, style.duration);
}

/**
 * 좌표 유효성 검사
 * @param {number} x - X 좌표
 * @param {number} y - Y 좌표
 * @param {number} maxWidth - 최대 너비
 * @param {number} maxHeight - 최대 높이
 * @returns {Object} 유효성 검사 결과 {isValid, clampedX, clampedY}
 */
function validateAndClampCoordinates(x, y, maxWidth, maxHeight) {
  const numX = Number(x) || 0;
  const numY = Number(y) || 0;

  const clampedX = Math.max(0, Math.min(numX, maxWidth - 1));
  const clampedY = Math.max(0, Math.min(numY, maxHeight - 1));

  const isValid = numX >= 0 && numX < maxWidth && numY >= 0 && numY < maxHeight;

  return {
    isValid,
    clampedX,
    clampedY,
    originalX: numX,
    originalY: numY
  };
}

/**
 * 좌표 변환 디버그 정보 출력
 * @param {Object} params - 디버그 정보 매개변수
 */
function debugCoordinateTransformation(params) {
  if (!window.COORDINATE_DEBUG_ENABLED) return;

  console.log("좌표 변환 디버그 정보:", {
    deviceRatio: params.deviceRatio || window.devicePixelRatio,
    originalSize: `${params.originalWidth}x${params.originalHeight}`,
    containerSize: `${params.containerWidth?.toFixed(1)}x${params.containerHeight?.toFixed(1)}`,
    actualImageSize: `${params.actualImageWidth?.toFixed(1)}x${params.actualImageHeight?.toFixed(1)}`,
    offset: `${params.offsetX?.toFixed(1)}, ${params.offsetY?.toFixed(1)}`,
    containerClick: `${params.clickX?.toFixed(1)}, ${params.clickY?.toFixed(1)}`,
    imageClick: `${params.imageClickX?.toFixed(1)}, ${params.imageClickY?.toFixed(1)}`,
    scale: `${params.scaleX?.toFixed(3)}, ${params.scaleY?.toFixed(3)}`,
    finalCoords: `${params.finalX}, ${params.finalY}`,
  });
}

// 전역 스코프에 함수들 노출 (하위 호환성을 위해)
if (typeof window !== 'undefined') {
  window.CoordinateUtils = {
    calculateClickCoordinates,
    convertServerToDisplayCoordinates,
    scaleCoordinates,
    showClickIndicatorAtPosition,
    validateAndClampCoordinates,
    debugCoordinateTransformation
  };

  // 기존 함수명 호환성 유지
  window.getClickCoordinates = calculateClickCoordinates;
  window.showClickIndicator = function (x, y) {
    const img = document.getElementById("screenshotImage");
    const container = document.querySelector(".screenshot-content");
    showClickIndicatorAtPosition(x, y, img, container, window.currentScreenshot);
  };
}