/**
 * Universal Modal Component Loader
 * 모든 modal-* 태그를 자동으로 로드하는 범용 컴포넌트
 */

// 모달 컴포넌트 클래스를 생성하는 팩토리 함수
function createModalComponent() {
    return class extends HTMLElement {
        async connectedCallback() {
            const modalName = this.tagName.toLowerCase();
            try {
                const response = await fetch(`static/components/${modalName}.html`);
                if (!response.ok) {
                    throw new Error(`Failed to load modal: ${response.statusText}`);
                }
                const html = await response.text();
                this.innerHTML = html;

                // 모달 로드 완료 이벤트 발생
                this.dispatchEvent(new CustomEvent('modal-loaded', {
                    bubbles: true,
                    detail: { modalName }
                }));
            } catch (error) {
                console.error(`Error loading ${modalName} component:`, error);
            }
        }
    };
}

// 모든 모달 컴포넌트 등록
const modalNames = [
    'modal-login',
    'modal-server-config',
    'modal-setting',
    'modal-click-recorder',
    'modal-text-input',
    'modal-voice-history',
    'modal-voice-settings'
];

// 이미 등록된 컴포넌트 수 체크
let alreadyRegistered = 0;
modalNames.forEach(name => {
    // 이미 등록된 컴포넌트는 건너뛰기
    if (!customElements.get(name)) {
        // 각 태그마다 새로운 클래스 인스턴스 생성
        customElements.define(name, createModalComponent());
    } else {
        alreadyRegistered++;
    }
});

console.log(`Registered ${modalNames.length - alreadyRegistered} new modal components, ${alreadyRegistered} already registered`);

// 모든 모달 로드 완료 감지
let loadedModals = alreadyRegistered; // 이미 등록된 것들은 로드된 것으로 간주
document.addEventListener('modal-loaded', (e) => {
    loadedModals++;
    if (loadedModals === modalNames.length) {
        // 모든 모달이 로드되면 전역 이벤트 발생
        window.dispatchEvent(new Event('modals-ready'));
        console.log('All modals loaded');
    }
});
