/**
 * Screenshot Voice Module
 * 스크린샷 페이지의 음성 히스토리 기능
 * 주의: 이 파일의 함수들은 모달이 열릴 때만 로드됩니다.
 */

// ============== 음성 기능 관련 함수들 ==============

// 전역 변수들
let voiceStt = null;
let voiceHistoryAPI = null;
let voiceServerHistory = [];
let voiceGridApi = null;

// 음성 기능 초기화
function initializeVoiceFeatures() {
  if (!window.SpeechToText || !window.HistoryAPI || !window.agGrid) {
    // 라이브러리들이 로드될 때까지 대기
    setTimeout(initializeVoiceFeatures, 100);
    return;
  }

  initializeVoiceSpeechToText();
  initializeVoiceHistoryAPI();
  initializeVoiceGrid();
  
  // 텍스트 입력 이벤트 리스너
  const voiceTextInput = document.getElementById('voiceTextInput');
  if (voiceTextInput) {
    voiceTextInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        addTextToVoiceHistory();
      }
    });
  }
}

// SpeechToText 초기화
function initializeVoiceSpeechToText() {
  voiceStt = new SpeechToText({
    apiEndpoint: '/transcribe',
    onPermissionGranted: () => {
      updateVoiceStatus('마이크 권한이 허용되었습니다. 이제 음성을 녹음할 수 있습니다.', 'success');
    },
    onPermissionDenied: (error) => {
      updateVoiceStatus(error, 'error');
    },
    onRecordingStart: () => {
      updateVoiceStatus('🎤 녹음 중... 말씀해주세요.', 'recording');
      document.getElementById('voiceRecordBtn').style.display = 'none';
      document.getElementById('voiceStopBtn').style.display = 'inline-block';
    },
    onRecordingStop: () => {
      updateVoiceStatus('🔄 음성을 텍스트로 변환 중...', 'processing');
      document.getElementById('voiceRecordBtn').style.display = 'inline-block';
      document.getElementById('voiceStopBtn').style.display = 'none';
    },
    onTranscriptionStart: () => {
      updateVoiceStatus('🔄 서버에서 음성을 분석 중...', 'processing');
    },
    onTranscriptionSuccess: (text) => {
      updateVoiceStatus(`✅ 변환 완료: "${text}"`, 'success');
      loadVoiceServerHistory();
    },
    onTranscriptionError: (error) => {
      updateVoiceStatus(`❌ 변환 실패: ${error}`, 'error');
    },
    onError: (message, error) => {
      updateVoiceStatus(`❌ 오류: ${message}`, 'error');
      console.error('Speech-to-text error:', error);
    }
  });
}

// HistoryAPI 초기화  
function initializeVoiceHistoryAPI() {
  voiceHistoryAPI = new HistoryAPI({
    onHistoryLoad: (history) => {
      voiceServerHistory = history;
      updateVoiceHistoryCounter();
      if (voiceGridApi) {
        voiceGridApi.setRowData(history);
      }
    },
    onTextAdded: (text) => {
      updateVoiceStatus(`✅ 텍스트가 히스토리에 추가되었습니다: "${text}"`, 'success');
      loadVoiceServerHistory();
    },
    onCommandExecuted: (command, result) => {
      if (result.success) {
        updateVoiceStatus(`✅ 명령이 실행되었습니다: ${result.output || '완료'}`, 'success');
      } else {
        updateVoiceStatus(`❌ 명령 실행 실패: ${result.error}`, 'error');
      }
    },
    onHistoryCleared: () => {
      updateVoiceStatus('✅ 모든 히스토리가 삭제되었습니다.', 'success');
      voiceServerHistory = [];
      updateVoiceHistoryCounter();
      if (voiceGridApi) {
        voiceGridApi.setRowData([]);
      }
    },
    onSelectedDeleted: (result) => {
      updateVoiceStatus(`✅ ${result.deleted_count}개 항목이 삭제되었습니다.`, 'success');
      loadVoiceServerHistory();
    },
    onError: (message, error) => {
      updateVoiceStatus(`❌ ${message}`, 'error');
      console.error('History API error:', error);
    }
  });

  // 초기 히스토리 로드
  loadVoiceServerHistory();
}

// AG Grid 초기화
function initializeVoiceGrid() {
  const columnDefs = [
    {
      headerName: "선택",
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 60,
      pinned: 'left'
    },
    {
      headerName: "텍스트",
      field: "text",
      flex: 1,
      wrapText: true,
      autoHeight: true,
      cellStyle: { 
        fontSize: '0.95rem',
        lineHeight: '1.4',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      },
      cellRenderer: function(params) {
        const txt = params.data.text || '';
        return `<span title="${txt}">${txt}</span>`;
      }
    }
  ];

  const gridOptions = {
    columnDefs: columnDefs,
    rowData: [],
    rowSelection: 'multiple',
    suppressRowClickSelection: false,
    onSelectionChanged: onVoiceSelectionChanged,
    domLayout: 'normal',
    enableCellTextSelection: true,
    ensureDomOrder: true,
    suppressHorizontalScroll: false,
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true
    }
  };

  const voiceGridDiv = document.querySelector('#voiceGridContainer');
  voiceGridDiv.innerHTML = '';
  voiceGridApi = agGrid.createGrid(voiceGridDiv, gridOptions);
}

// 음성 관련 함수들
function updateVoiceStatus(message, type = 'info') {
  const statusDiv = document.getElementById('voiceStatus');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = 'status-display';
    
    if (type === 'error') {
      statusDiv.style.background = '#f8d7da';
      statusDiv.style.borderColor = '#f5c6cb';
      statusDiv.style.color = '#721c24';
    } else if (type === 'success') {
      statusDiv.style.background = '#d4edda';
      statusDiv.style.borderColor = '#c3e6cb';
      statusDiv.style.color = '#155724';
    } else if (type === 'processing') {
      statusDiv.style.background = '#fff3cd';
      statusDiv.style.borderColor = '#ffeaa7';
      statusDiv.style.color = '#856404';
    } else if (type === 'recording') {
      statusDiv.style.background = '#fce4ec';
      statusDiv.style.borderColor = '#f8bbd9';
      statusDiv.style.color = '#880e4f';
    } else {
      statusDiv.style.background = '#e3f2fd';
      statusDiv.style.borderColor = '#bbdefb';
      statusDiv.style.color = '#1565c0';
    }
  }
}

function updateVoiceHistoryCounter() {
  const counter = document.getElementById('voiceHistoryCounter');
  if (counter) {
    counter.textContent = `(총 ${voiceServerHistory.length}개)`;
  }
}

function onVoiceSelectionChanged() {
  const selectedRows = voiceGridApi.getSelectedRows();
  const deleteBtn = document.getElementById('voiceDeleteSelectedBtn');
  const copyBtn = document.getElementById('voiceCopySelectedBtn');
  if (deleteBtn) {
    deleteBtn.style.display = selectedRows.length > 0 ? 'inline-block' : 'none';
  }
  if (copyBtn) {
    copyBtn.style.display = selectedRows.length > 0 ? 'inline-block' : 'none';
  }
}

// 모달: 선택된 항목들을 서버 클립보드로 복사
async function copySelectedToServerClipboard() {
  if (!voiceGridApi) return;

  const selectedRows = voiceGridApi.getSelectedRows();
  if (!selectedRows || selectedRows.length === 0) {
    updateVoiceStatus('서버로 복사할 항목을 선택해주세요.', 'error');
    return;
  }

  try {
    const text = selectedRows.map(r => r.text || '').join('\n');

    const resp = await fetch('/api/copy_to_server_clipboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const result = await resp.json();

    if (resp.ok) {
      if (result.clipboard_copied) {
        updateVoiceStatus(`✅ 서버 클립보드에 복사되었습니다 (${selectedRows.length}개)`, 'success');
      } else {
        updateVoiceStatus('⚠️ 서버에서 클립보드 복사에 실패했습니다.', 'error');
      }
    } else {
      updateVoiceStatus(`❌ 서버 복사 실패: ${result.error || '알 수 없는 오류'}`, 'error');
    }
  } catch (error) {
    console.error('모달 서버 복사 오류:', error);
    updateVoiceStatus('❌ 서버로 복사 중 오류가 발생했습니다.', 'error');
  }
}

// 음성 기능 관련 이벤트 핸들러들
function requestVoiceMicrophonePermission() {
  if (voiceStt) {
    voiceStt.checkPermission();
  }
}

function startVoiceRecording() {
  if (voiceStt) {
    voiceStt.startRecording();
  }
}

// startVoiceCommandRecording removed (feature deprecated)

function stopVoiceRecording() {
  if (voiceStt) {
    voiceStt.stopRecording();
  }
}

function addTextToVoiceHistory() {
  const textInput = document.getElementById('voiceTextInput');
  const text = textInput.value.trim();
  
  if (!text) {
    updateVoiceStatus('텍스트를 입력해주세요.', 'error');
    return;
  }
  
  if (voiceHistoryAPI) {
    voiceHistoryAPI.addTextToHistory(text);
    textInput.value = '';
  }
}

function loadVoiceServerHistory() {
  if (voiceHistoryAPI) {
    voiceHistoryAPI.loadHistory();
  }
}

function selectAllVoiceHistory() {
  if (voiceGridApi) {
    voiceGridApi.selectAll();
  }
}

function deleteSelectedVoiceHistory() {
  if (!voiceGridApi) return;
  
  const selectedRows = voiceGridApi.getSelectedRows();
  if (selectedRows.length === 0) {
    updateVoiceStatus('삭제할 항목을 선택해주세요.', 'error');
    return;
  }
  
  if (confirm(`선택한 ${selectedRows.length}개 항목을 삭제하시겠습니까?`)) {
    const itemIds = selectedRows.map(row => row.id);
    if (voiceHistoryAPI) {
      voiceHistoryAPI.deleteSelectedItems(itemIds);
    }
  }
}

function clearVoiceServerHistory() {
  if (confirm('모든 히스토리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
    if (voiceHistoryAPI) {
      voiceHistoryAPI.clearHistory();
    }
  }
}

function exportVoiceHistory() {
  if (voiceServerHistory.length === 0) {
    updateVoiceStatus('내보낼 히스토리가 없습니다.', 'error');
    return;
  }
  
  if (voiceHistoryAPI) {
    try {
      voiceHistoryAPI.exportHistory(voiceServerHistory);
      updateVoiceStatus('✅ 히스토리가 파일로 내보내졌습니다.', 'success');
    } catch (error) {
      updateVoiceStatus(`❌ 내보내기 실패: ${error.message}`, 'error');
    }
  }
}

function copyVoiceText(text) {
  if (voiceHistoryAPI) {
    voiceHistoryAPI.copyToClipboard(text).then(() => {
      updateVoiceStatus('✅ 텍스트가 클립보드에 복사되었습니다.', 'success');
    }).catch(error => {
      updateVoiceStatus('❌ 클립보드 복사 실패', 'error');
    });
  }
}

function executeVoiceCommand(command) {
  if (confirm(`다음 명령을 실행하시겠습니까?\n\n${command}`)) {
    if (voiceHistoryAPI) {
      voiceHistoryAPI.executeCommand(command);
    }
  }
}

// 모달: 선택된 항목들을 순차적으로 실행합니다
async function executeSelectedVoiceHistory() {
  if (!voiceGridApi) return;

  const selectedRows = voiceGridApi.getSelectedRows();
  if (!selectedRows || selectedRows.length === 0) {
    updateVoiceStatus('실행할 항목을 선택해주세요.', 'error');
    return;
  }

  if (!confirm(`선택된 ${selectedRows.length}개의 항목을 순차적으로 실행하시겠습니까?`)) return;

  try {
    for (const row of selectedRows) {
      const cmd = row.text || '';
      if (!cmd.trim()) continue;
      await voiceHistoryAPI.executeCommand(cmd);
      await new Promise(res => setTimeout(res, 200));
    }
    updateVoiceStatus('선택된 명령 실행을 모두 완료했습니다.', 'success');
    loadVoiceServerHistory();
  } catch (error) {
    console.error('선택 명령 실행 중 오류:', error);
    updateVoiceStatus('명령 실행 중 오류가 발생했습니다: ' + (error.message || error), 'error');
  }
}

// 모달 내 선택된 항목 복사
async function copySelectedVoiceHistory() {
  if (!voiceGridApi) return;

  const selectedRows = voiceGridApi.getSelectedRows();
  if (!selectedRows || selectedRows.length === 0) {
    updateVoiceStatus('복사할 항목을 선택해주세요.', 'error');
    return;
  }

  try {
    // Copy only the text column (second field) for each selected row
    const texts = selectedRows.map(r => r.text || '');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texts.join('\n'));
      updateVoiceStatus(`📋 선택된 ${selectedRows.length}개 항목의 텍스트가 클립보드에 복사되었습니다.`, 'success');
    } else {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = texts.join('\n');
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      updateVoiceStatus(`📋 선택된 ${selectedRows.length}개 항목의 텍스트가 클립보드에 복사되었습니다.`, 'success');
    }
  } catch (error) {
    console.error('음성 모달 선택 복사 오류:', error);
    updateVoiceStatus('❌ 선택 복사 중 오류가 발생했습니다.', 'error');
  }
}