var currentSpeakerId = 'user123';
let messageCount = 0;
let allMessages = [];
let shouldAutoScroll = true;
let userScrolled = false;
let isVoiceRecognitionActive = false;
const socket = io();

// Marked.jsの設定
marked.setOptions({
    breaks: true,
    gfm: true
});

// 接続状態の管理
socket.on('connect', () => {
    document.getElementById('statusIndicator').classList.add('connected');
    document.getElementById('statusText').textContent = '接続済み';
});

socket.on('disconnect', () => {
    document.getElementById('statusIndicator').classList.remove('connected');
    document.getElementById('statusText').textContent = '切断されました';
});

// MQTTメッセージの受信
socket.on('mqtt-message', (data) => {
    messageCount++;
    document.getElementById('messageCount').textContent = messageCount;
    
    // プッシュ通知を表示
    showNotification(`新しいメッセージを受信: ${data.speaker_id || 'Unknown'}`);
    
    // メッセージを配列に追加
    allMessages.unshift(data);
    
    // 最大1000件まで保持
    if (allMessages.length > 1000) {
        allMessages = allMessages.slice(0, 1000);
    }
    
    // チャット表示を更新
    updateChat();
    
    // フィルターオプションを更新
    updateFilterOptions();
});

// 送信成功/エラーの処理
socket.on('mqtt-send-success', (data) => {
    // showNotification(`メッセージ送信成功: ${data.topic}`, 'success');
    document.getElementById('sendChatBtn').disabled = false;
    document.getElementById('sendCustomBtn').disabled = false;
});

socket.on('mqtt-send-error', (data) => {
    showNotification(`送信エラー: ${data.error}`, 'error');
    document.getElementById('sendChatBtn').disabled = false;
    document.getElementById('sendCustomBtn').disabled = false;
});

window.addEventListener('DOMContentLoaded', () => {
    // let SpeechRecognition = SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('chatMessage').value = transcript;
        
        // 音声認識が有効な場合のみ自動送信
        if (isVoiceRecognitionActive) {
            sendChatMessage();
        }
    }
    
    recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
            showNotification(`音声認識エラー: ${event.error}`, 'error');
        }
    }
    
    recognition.onend = () => {
        // 音声認識が有効な場合のみ再開
        if (isVoiceRecognitionActive) {
            recognition.start();
        }
    }
    
    function toggleVoiceRecognition() {
        const voiceBtn = document.getElementById('voiceBtn');
        
        if (isVoiceRecognitionActive) {
            // 音声認識を停止
            recognition.stop();
            isVoiceRecognitionActive = false;
            voiceBtn.classList.remove('recording');
            voiceBtn.innerHTML = `
                <svg class="voice-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
                音声認識
            `;
            showNotification('音声認識を停止しました', 'success');
        } else {
            // 音声認識を開始
            try {
                recognition.start();
                isVoiceRecognitionActive = true;
                voiceBtn.classList.add('recording');
                voiceBtn.innerHTML = `
                    <svg class="voice-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                    停止
                `;
                showNotification('音声認識を開始しました', 'success');
            } catch (error) {
                showNotification('音声認識の開始に失敗しました', 'error');
            }
        }
    }
});

function setSpeakerId() {
    const speakerId = document.getElementById('chatSpeakerId').value.trim();
    const previousTopic = document.getElementById('chatTopic').value.trim();
    const newTopic = previousTopic.replace(previousTopic.split('/')[4], speakerId);
    document.getElementById('chatTopic').value = newTopic;
}

function sendChatMessage() {
    const topic = document.getElementById('chatTopic').value.trim();
    const message = document.getElementById('chatMessage').value.trim();
    const qos = parseInt(document.getElementById('chatQos').value);
    const speakerId = document.getElementById('chatSpeakerId').value.trim();
    
    if (!topic || !message) {
        showNotification('トピックとメッセージは必須です', 'error');
        return;
    }
    
    currentSpeakerId = speakerId;
    
    // 送信ボタンを無効化
    document.getElementById('sendChatBtn').disabled = true;
    
    // チャット形式のペイロードを作成
    const payload = JSON.stringify({
        speaker_id: speakerId,
        message: message,
        timestamp: new Date().toISOString(),
        type: 'chat'
    });
    
    // メッセージを送信
    socket.emit('send-mqtt-message', {
        topic: topic,
        payload: message,
        qos: qos
    });
    
    // メッセージフィールドをクリア
    document.getElementById('chatMessage').value = '';
    
    // 自分のメッセージを送信した場合は自動スクロールを無効にする
    // （送信したメッセージが受信されてから自動スクロールされる）
    shouldAutoScroll = false;
}

function sendCustomMessage() {
    const topic = document.getElementById('sendTopic').value.trim();
    const payload = document.getElementById('sendPayload').value.trim();
    const qos = parseInt(document.getElementById('sendQos').value);
    
    if (!topic || !payload) {
        showNotification('トピックとペイロードは必須です', 'error');
        return;
    }
    
    // 送信ボタンを無効化
    document.getElementById('sendCustomBtn').disabled = true;
    
    // メッセージを送信
    socket.emit('send-mqtt-message', {
        topic: topic,
        payload: payload,
        qos: qos
    });
}

function setQuickTopic(topic) {
    const speakerId = document.getElementById('chatSpeakerId').value.trim();
    document.getElementById('chatTopic').value = `a2a/mikoto/user/${speakerId}/${topic}`;
}

function updateChat() {
    const container = document.getElementById('chatContainer');
    
    if (allMessages.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>メッセージを待機中...</h3>
                <p>MQTTメッセージが受信されると、ここに表示されます。</p>
            </div>
        `;
        return;
    }
    
    const filteredMessages = filterMessagesData();
    
    let chatHTML = '';
    
    filteredMessages.forEach((data, index) => {
        const timestamp = new Date(data.timestamp).toLocaleString('ja-JP');
        const isOwnMessage = data.speaker_id === currentSpeakerId;
        const isSystemMessage = data.role === 'system' || data.status === 'system';
        
        // メッセージ内容を解析
        let messageContent = data.payload;
        let messageType = 'text';
        
        try {
            const parsed = JSON.parse(data.payload);
            if (parsed.message) {
                messageContent = parsed.message;
                messageType = parsed.type || 'chat';
            }
        } catch (e) {
            // JSONでない場合はそのまま表示
        }
        
        // MarkdownをHTMLに変換
        let formattedContent = messageContent;
        try {
            formattedContent = marked.parse(messageContent);
        } catch (e) {
            // Markdown解析に失敗した場合はそのまま表示
            formattedContent = escapeHtml(messageContent);
        }
        
        const messageClass = isOwnMessage ? 'own-message' : (isSystemMessage ? 'system-message' : '');
        const isNewMessage = index === 0;
        
        chatHTML += `
            <div class="chat-message ${isNewMessage ? 'new-message' : ''}">
                <div class="topic-badge">${escapeHtml(data.topic)}</div>
                <div class="message-bubble ${messageClass}">
                    <div class="message-content">${formattedContent}</div>
                    <div class="message-meta">
                        <div class="message-info">
                            <span class="message-timestamp">${timestamp}</span>
                            <span>ID: ${escapeHtml(data.speaker_id || 'N/A')}</span>
                            <span>ロール: ${escapeHtml(data.role || 'N/A')}</span>
                            <span>ステータス: ${escapeHtml(data.status || 'N/A')}</span>
                            <span>フェーズ: ${escapeHtml(data.phase || 'N/A')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = chatHTML;
    
    // 自動スクロールの条件をチェック
    if (shouldAutoScroll && !userScrolled) {
        // 最新メッセージまでスクロール
        container.scrollTop = container.scrollHeight;
    }
}

function filterMessagesData() {
    const agentFilter = document.getElementById('agentFilter').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    return allMessages.filter(data => {
        const agentMatch = !agentFilter || (data.speaker_id && data.speaker_id.toLowerCase().includes(agentFilter));
        const roleMatch = !roleFilter || data.role === roleFilter;
        const statusMatch = !statusFilter || data.status === statusFilter;
        
        return agentMatch && roleMatch && statusMatch;
    });
}

function filterMessages() {
    updateChat();
}

function updateFilterOptions() {
    const roles = [...new Set(allMessages.map(m => m.role).filter(Boolean))];
    const statuses = [...new Set(allMessages.map(m => m.status).filter(Boolean))];
    
    const roleSelect = document.getElementById('roleFilter');
    const statusSelect = document.getElementById('statusFilter');
    
    // ロールフィルターを更新
    const currentRole = roleSelect.value;
    roleSelect.innerHTML = '<option value="">すべて</option>';
    roles.forEach(role => {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role;
        if (role === currentRole) option.selected = true;
        roleSelect.appendChild(option);
    });
    
    // ステータスフィルターを更新
    const currentStatus = statusSelect.value;
    statusSelect.innerHTML = '<option value="">すべて</option>';
    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        if (status === currentStatus) option.selected = true;
        statusSelect.appendChild(option);
    });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 3秒後に削除
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function clearMessages() {
    allMessages = [];
    messageCount = 0;
    document.getElementById('messageCount').textContent = '0';
    shouldAutoScroll = true;
    userScrolled = false;
    updateChat();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Enterキーでメッセージ送信
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('chatMessage').addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    document.getElementById('sendPayload').addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            sendCustomMessage();
        }
    });
    
    // チャットコンテナのスクロールイベントを監視
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.addEventListener('scroll', function() {
        const { scrollTop, scrollHeight, clientHeight } = this;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10pxの余裕
        
        // ユーザーが手動でスクロールした場合
        if (!isAtBottom) {
            userScrolled = true;
        } else {
            // 最下部にいる場合は自動スクロールを有効にする
            userScrolled = false;
        }
    });
});
