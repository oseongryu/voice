let backupCodesData = [];

async function show2FASettingsModal() {
    const modalHTML = `<div class="modal fade" id="modal2FA" tabindex="-1"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5>2단계 인증 (2FA)</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div id="2faContent"></div></div></div></div></div>`;
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
        document.getElementById('2faContent').innerHTML = '<p class="text-danger">상태 로드 실패</p>';
    }
}

function showSetupView() {
    document.getElementById('2faContent').innerHTML = `
        <div class="alert alert-info">2FA를 활성화하면 계정 보안이 강화됩니다.</div>
        <button class="btn btn-primary" onclick="start2FASetup()">2FA 설정 시작</button>
    `;
}

function showEnabledView(remaining) {
    document.getElementById('2faContent').innerHTML = `
        <div class="alert alert-success">2FA가 활성화되어 있습니다.</div>
        <p>남은 백업 코드: <strong>${remaining}</strong></p>
        <button class="btn btn-danger" onclick="disable2FA()">2FA 비활성화</button>
    `;
}

async function start2FASetup() {
    try {
        const response = await AuthUtils.authenticatedFetch(AppConfig.getLoginUrl('/api/2fa/setup'), {method: 'POST'});
        const data = await response.json();
        if (data.success) {
            backupCodesData = data.backup_codes;
            showQRView(data.qr_code, data.secret);
        } else {
            alert('설정 실패: ' + data.message);
        }
    } catch (e) {
        alert('오류 발생');
    }
}

function showQRView(qrCode, secret) {
    document.getElementById('2faContent').innerHTML = `
        <p>인증 앱(Google Authenticator 등)으로 QR 코드를 스캔하세요:</p>
        <div class="text-center mb-3"><img src="${qrCode}" style="max-width:250px"/></div>
        <p class="text-muted small">수동 입력: <code>${secret}</code></p>
        <div class="mb-3"><label>인증 앱의 6자리 코드 입력:</label><input type="text" class="form-control text-center" id="verifyTOTP" maxlength="6" placeholder="000000"></div>
        <button class="btn btn-success" onclick="verify2FASetup()">확인 및 활성화</button>
    `;
}

async function verify2FASetup() {
    const code = document.getElementById('verifyTOTP').value;
    if (!code || code.length !== 6) {
        alert('6자리 코드를 입력하세요.');
        return;
    }
    try {
        const response = await AuthUtils.authenticatedFetch(AppConfig.getLoginUrl('/api/2fa/verify-setup'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({totp_code: code})
        });
        const data = await response.json();
        if (data.success) {
            showBackupCodes();
        } else {
            alert('인증 실패: ' + data.message);
        }
    } catch (e) {
        alert('오류 발생');
    }
}

function showBackupCodes() {
    const codesList = backupCodesData.map(code => `<div class="mb-1 font-monospace">${code}</div>`).join('');
    document.getElementById('2faContent').innerHTML = `
        <div class="alert alert-warning"><strong>중요:</strong> 다음 백업 코드를 안전한 곳에 저장하세요.</div>
        <div class="bg-light p-3 rounded mb-3">${codesList}</div>
        <button class="btn btn-primary" onclick="finishSetup()">저장했습니다. 완료</button>
    `;
}

function finishSetup() {
    bootstrap.Modal.getInstance(document.getElementById('modal2FA')).hide();
    alert('2FA가 활성화되었습니다!');
}

async function disable2FA() {
    const password = prompt('2FA를 비활성화하려면 비밀번호를 입력하세요:');
    if (!password) return;
    try {
        const response = await AuthUtils.authenticatedFetch(AppConfig.getLoginUrl('/api/2fa/disable'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({password})
        });
        const data = await response.json();
        if (data.success) {
            alert('2FA가 비활성화되었습니다.');
            await load2FAStatus();
        } else {
            alert('비활성화 실패: ' + data.message);
        }
    } catch (e) {
        alert('오류 발생');
    }
}
