// // i18n 텍스트 헬퍼 함수
// const getText = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);

// 2FA 관련 텍스트 (i18n 지원)
const TFA_TEXT = {
    get title() { return getText('2fa.title', '2단계 인증 (2FA)'); },
    get statusLoadFailed() { return getText('2fa.status_load_failed', '상태 로드 실패'); },
    get info() { return getText('2fa.info', '2FA를 활성화하면 계정 보안이 강화됩니다.'); },
    get startSetup() { return getText('2fa.start_setup', '2FA 설정 시작'); },
    get enabled() { return getText('2fa.enabled', '2FA가 활성화되어 있습니다.'); },
    get backupCodesRemaining() { return getText('2fa.backup_codes_remaining', '남은 백업 코드:'); },
    get disable() { return getText('2fa.disable', '2FA 비활성화'); },
    get setupFailed() { return getText('2fa.setup_failed', '설정 실패'); },
    get errorOccurred() { return getText('2fa.error_occurred', '오류 발생'); },
    get scanQr() { return getText('2fa.scan_qr', '인증 앱(Google Authenticator 등)으로 QR 코드를 스캔하세요:'); },
    get manualEntry() { return getText('2fa.manual_entry', '수동 입력:'); },
    get enterCode() { return getText('2fa.enter_code', '인증 앱의 6자리 코드 입력:'); },
    get confirmActivate() { return getText('2fa.confirm_activate', '확인 및 활성화'); },
    get enter6Digits() { return getText('2fa.enter_6_digits', '6자리 코드를 입력하세요.'); },
    get verificationFailed() { return getText('2fa.verification_failed', '인증 실패'); },
    get backupWarning() { return getText('2fa.backup_warning', '중요:'); },
    get backupSave() { return getText('2fa.backup_save', '다음 백업 코드를 안전한 곳에 저장하세요.'); },
    get savedComplete() { return getText('2fa.saved_complete', '저장했습니다. 완료'); },
    get activated() { return getText('2fa.activated', '2FA가 활성화되었습니다!'); },
    get disablePrompt() { return getText('2fa.disable_prompt', '2FA를 비활성화하려면 비밀번호를 입력하세요:'); },
    get disabled() { return getText('2fa.disabled', '2FA가 비활성화되었습니다.'); },
    get disableFailed() { return getText('2fa.disable_failed', '비활성화 실패'); }
};

let backupCodesData = [];

async function show2FASettingsModal() {
    const modalHTML = `<div class="modal fade" id="modal2FA" tabindex="-1"><div class="modal-dialog"><div class="modal-content"><div class="modal-header" style="padding: 0.5rem 1rem;"><h6 class="modal-title" style="font-size: 0.95rem;">${TFA_TEXT.title}</h6><button type="button" class="btn-close btn-sm" data-bs-dismiss="modal" style="font-size: 0.8rem;"></button></div><div class="modal-body"><div id="2faContent"></div></div></div></div></div>`;
    if (!document.getElementById('modal2FA')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    await load2FAStatus();
    new bootstrap.Modal(document.getElementById('modal2FA')).show();
}

async function load2FAStatus() {
    try {
        const response = await AuthUtils.authenticatedFetch(AppConfig.getLoginUrl('/api/2fa/status'));
        const data = await response.json();
        if (data.enabled) {
            showEnabledView(data.backup_codes_remaining);
        } else {
            showSetupView();
        }
    } catch (e) {
        document.getElementById('2faContent').innerHTML = `<p class="text-danger">${TFA_TEXT.statusLoadFailed}</p>`;
    }
}

function showSetupView() {
    document.getElementById('2faContent').innerHTML = `
        <div class="alert alert-info">${TFA_TEXT.info}</div>
        <button class="btn btn-primary" onclick="start2FASetup()">${TFA_TEXT.startSetup}</button>
    `;
}

function showEnabledView(remaining) {
    document.getElementById('2faContent').innerHTML = `
        <div class="alert alert-success">${TFA_TEXT.enabled}</div>
        <p>${TFA_TEXT.backupCodesRemaining} <strong>${remaining}</strong></p>
        <button class="btn btn-danger" onclick="disable2FA()">${TFA_TEXT.disable}</button>
    `;
}

async function start2FASetup() {
    try {
        const response = await AuthUtils.authenticatedFetch(AppConfig.getLoginUrl('/api/2fa/setup'), { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            backupCodesData = data.backup_codes;
            showQRView(data.qr_code, data.secret);
        } else {
            alert(`${TFA_TEXT.setupFailed}: ${data.message}`);
        }
    } catch (e) {
        alert(TFA_TEXT.errorOccurred);
    }
}

function showQRView(qrCode, secret) {
    document.getElementById('2faContent').innerHTML = `
        <p>${TFA_TEXT.scanQr}</p>
        <div class="text-center mb-3"><img src="${qrCode}" style="max-width:250px"/></div>
        <p class="text-muted small">${TFA_TEXT.manualEntry} <code>${secret}</code></p>
        <div class="mb-3"><label>${TFA_TEXT.enterCode}</label><input type="text" class="form-control text-center" id="verifyTOTP" maxlength="6" placeholder="000000"></div>
        <button class="btn btn-success" onclick="verify2FASetup()">${TFA_TEXT.confirmActivate}</button>
    `;
}

async function verify2FASetup() {
    const code = document.getElementById('verifyTOTP').value;
    if (!code || code.length !== 6) {
        alert(TFA_TEXT.enter6Digits);
        return;
    }
    try {
        const response = await AuthUtils.authenticatedFetch(AppConfig.getLoginUrl('/api/2fa/verify-setup'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totp_code: code })
        });
        const data = await response.json();
        if (data.success) {
            showBackupCodes();
        } else {
            alert(`${TFA_TEXT.verificationFailed}: ${data.message}`);
        }
    } catch (e) {
        alert(TFA_TEXT.errorOccurred);
    }
}

function showBackupCodes() {
    const codesList = backupCodesData.map(code => `<div class="mb-1 font-monospace">${code}</div>`).join('');
    document.getElementById('2faContent').innerHTML = `
        <div class="alert alert-warning"><strong>${TFA_TEXT.backupWarning}</strong> ${TFA_TEXT.backupSave}</div>
        <div class="bg-light p-3 rounded mb-3">${codesList}</div>
        <button class="btn btn-primary" onclick="finishSetup()">${TFA_TEXT.savedComplete}</button>
    `;
}

function finishSetup() {
    bootstrap.Modal.getInstance(document.getElementById('modal2FA')).hide();
    alert(TFA_TEXT.activated);
}

async function disable2FA() {
    const password = prompt(TFA_TEXT.disablePrompt);
    if (!password) return;
    try {
        const response = await AuthUtils.authenticatedFetch(AppConfig.getLoginUrl('/api/2fa/disable'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await response.json();
        if (data.success) {
            alert(TFA_TEXT.disabled);
            await load2FAStatus();
        } else {
            alert(`${TFA_TEXT.disableFailed}: ${data.message}`);
        }
    } catch (e) {
        alert(TFA_TEXT.errorOccurred);
    }
}
