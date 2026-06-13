/* ========================================
   AI视觉精灵 - 前端主逻辑
   ======================================== */

// ===== 全局状态 =====
const state = {
    cameraActive: false,
    micActive: false,
    autoAnalyze: false,
    isRecording: false,
    isProcessing: false,
    searchEnabled: false,
    sessionId: 'session_' + Date.now(),
    stream: null,
    frameInterval: 3000,
    speechLang: 'zh-CN',
    voiceStyle: 'general',
    recognition: null,
    lastVisionContext: '',
    chatStyle: 'default',
    ttsEnabled: true,
    ttsSpeaking: false,
    ttsPausedByUser: false,
    ttsQueue: [],
    ttsCurrentUtterance: null,
};

// ===== DOM元素 =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    video: $('#videoElement'),
    canvas: $('#canvasElement'),
    cameraOverlay: $('#cameraOverlay'),
    frameIndicator: $('#frameIndicator'),
    btnToggleCamera: $('#btnToggleCamera'),
    btnAnalyzeFrame: $('#btnAnalyzeFrame'),
    btnSwitchCamera: $('#btnSwitchCamera'),
    btnScreenshot: $('#btnScreenshot'),
    btnRecognizeObject: $('#btnRecognizeObject'),
    btnDetectEmotion: $('#btnDetectEmotion'),
    btnSaveScreenshot: $('#btnSaveScreenshot'),
    btnAutoAnalyze: $('#btnAutoAnalyze'),
    visionResult: $('#visionResult'),
    visionResultContent: $('#visionResultContent'),
    chatMessages: $('#chatMessages'),
    chatInput: $('#chatInput'),
    btnSend: $('#btnSend'),
    btnMic: $('#btnMic'),
    voiceIndicator: $('#voiceIndicator'),
    statusCamera: $('#statusCamera'),
    statusMic: $('#statusMic'),
    statusAI: $('#statusAI'),
    settingsOverlay: $('#settingsOverlay'),
    btnSettings: $('#btnSettings'),
    btnCloseSettings: $('#btnCloseSettings'),
    btnReset: $('#btnReset'),
    settingInterval: $('#settingInterval'),
    settingLang: $('#settingLang'),
    settingVoiceStyle: $('#settingVoiceStyle'),
    btnSearchWeb: $('#btnSearchWeb'),
    btnTtsToggle: $('#btnTtsToggle'),
    settingTts: $('#settingTts'),
    toastContainer: $('#toastContainer'),
};

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkAIConfig();
    createParticles();
    updateSendButton();
    initSettings();
});

function initEventListeners() {
    dom.btnToggleCamera.addEventListener('click', toggleCamera);
    dom.statusAI.addEventListener('click', () => {
        showToast('正在重新检测AI连接...', 'info');
        checkAIConfig();
    });
    dom.btnAnalyzeFrame.addEventListener('click', () => analyzeCurrentFrame());
    dom.btnSwitchCamera.addEventListener('click', switchCamera);
    dom.btnScreenshot.addEventListener('click', takeScreenshot);
    dom.btnRecognizeObject.addEventListener('click', recognizeObject);
    dom.btnDetectEmotion.addEventListener('click', detectEmotion);
    dom.btnSaveScreenshot.addEventListener('click', saveScreenshotToDisk);
    dom.btnAutoAnalyze.addEventListener('click', toggleAutoAnalyze);
    dom.btnSearchWeb.addEventListener('click', toggleSearch);
    if (dom.btnTtsToggle) dom.btnTtsToggle.addEventListener('click', toggleTtsManual);
    if (dom.settingTts) {
        dom.settingTts.addEventListener('change', (e) => {
            state.ttsEnabled = e.target.checked;
            updateTtsButton();
            if (!state.ttsEnabled) stopTts();
            saveSetting('ttsEnabled', e.target.checked);
            showToast(e.target.checked ? 'AI语音朗读已开启' : 'AI语音朗读已关闭', 'info');
        });
    }
    if (dom.settingVoiceStyle) {
        dom.settingVoiceStyle.addEventListener('change', (e) => {
            state.voiceStyle = e.target.value;
            saveSetting('voiceStyle', e.target.value);
        });
    }
    dom.btnSend.addEventListener('click', sendMessage);
    dom.btnMic.addEventListener('click', toggleVoiceInput);
    dom.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    dom.chatInput.addEventListener('input', updateSendButton);
    dom.btnSettings.addEventListener('click', () => dom.settingsOverlay.classList.add('visible'));
    dom.btnCloseSettings.addEventListener('click', () => dom.settingsOverlay.classList.remove('visible'));
    dom.settingsOverlay.addEventListener('click', (e) => {
        if (e.target === dom.settingsOverlay) dom.settingsOverlay.classList.remove('visible');
    });
    dom.btnReset.addEventListener('click', resetConversation);
    dom.settingInterval.addEventListener('change', (e) => {
        const val = parseInt(e.target.value) * 1000;
        state.frameInterval = val;
        if (state.autoAnalyze && val > 0) restartAutoAnalyze();
        else if (val === 0) stopAutoAnalyze();
        saveSetting('frameInterval', parseInt(e.target.value));
    });
    dom.settingLang.addEventListener('change', (e) => {
        state.speechLang = e.target.value;
        saveSetting('speechLang', e.target.value);
    });
    dom.settingTheme.addEventListener('change', (e) => {
        applyTheme(e.target.value);
        saveSetting('theme', e.target.value);
    });
    dom.settingFontSize.addEventListener('change', (e) => {
        applyFontSize(e.target.value);
        saveSetting('fontSize', e.target.value);
    });
    dom.settingBubble.addEventListener('change', (e) => {
        applyBubble(e.target.value);
        saveSetting('bubble', e.target.value);
    });
    dom.settingChatStyle.addEventListener('change', (e) => {
        state.chatStyle = e.target.value;
        saveSetting('chatStyle', e.target.value);
        const txt = e.target.options[e.target.selectedIndex].text;
        showToast('对话风格已切换: ' + txt, 'info');
    });

    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const msg = btn.dataset.msg;
            if (msg) {
                dom.chatInput.value = msg;
                sendMessage();
            }
        });
    });
}

// ===== 粒子背景 =====
function createParticles() {
    const bg = $('#particlesBg');
    const count = 30;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 3 + 1}px;
            height: ${Math.random() * 3 + 1}px;
            background: rgba(162, 155, 254, ${Math.random() * 0.5 + 0.1});
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: float ${Math.random() * 10 + 10}s linear infinite;
            animation-delay: ${Math.random() * 10}s;
        `;
        bg.appendChild(particle);
    }
}

// ===== 摄像头 =====
async function toggleCamera() {
    if (state.cameraActive) {
        stopCamera();
    } else {
        await startCamera();
    }
}

async function startCamera() {
    try {
        state.stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: false,
        });
        dom.video.srcObject = state.stream;
        state.cameraActive = true;
        dom.cameraOverlay.classList.add('hidden');
        dom.btnToggleCamera.innerHTML = '<svg class="svg-icon" style="font-size:13px"><use href="#icon-video-slash"/></svg><span>关闭摄像头</span>';
    dom.btnToggleCamera.classList.add('active');
    dom.btnToggleCamera.classList.add('pulse-once');
    setTimeout(() => dom.btnToggleCamera.classList.remove('pulse-once'), 600);
    dom.btnAnalyzeFrame.disabled = false;
    dom.btnRecognizeObject.disabled = false;
    dom.btnDetectEmotion.disabled = false;
    dom.btnSaveScreenshot.disabled = false;
    dom.statusCamera.classList.add('active');
        showToast('摄像头已开启', 'success');
    } catch (err) {
        showToast('无法访问摄像头: ' + err.message, 'error');
    }
}

function stopCamera() {
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
    }
    state.cameraActive = false;
    state.stream = null;
    dom.video.srcObject = null;
    dom.cameraOverlay.classList.remove('hidden');
    dom.btnToggleCamera.innerHTML = '<svg class="svg-icon" style="font-size:13px"><use href="#icon-video"/></svg><span>开启摄像头</span>';
    dom.btnToggleCamera.classList.remove('active');
    dom.btnAnalyzeFrame.disabled = true;
    dom.btnRecognizeObject.disabled = true;
    dom.btnDetectEmotion.disabled = true;
    dom.btnSaveScreenshot.disabled = true;
    dom.statusCamera.classList.remove('active');
    stopAutoAnalyze();
}

async function switchCamera() {
    if (!state.cameraActive) return;
    stopCamera();
    // 切换前后摄像头通过重新请求
    await startCamera();
}

// ===== 画面分析 =====
function captureFrame() {
    if (!state.cameraActive) return null;
    const video = dom.video;
    const canvas = dom.canvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
}

async function analyzeCurrentFrame(prompt) {
    if (!state.cameraActive || state.isProcessing) return;

    const imageData = captureFrame();
    if (!imageData) {
        showToast('请先开启摄像头', 'error');
        return;
    }

    state.isProcessing = true;
    dom.frameIndicator.classList.add('visible');
    dom.visionResult.style.display = 'none';

    try {
        const response = await fetch('/api/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: imageData,
                prompt: prompt || '请详细描述这张图片中的场景和内容。',
                session_id: state.sessionId,
            }),
        });

        const data = await response.json();
        if (data.success) {
            state.lastVisionContext = data.result;
            dom.visionResult.style.display = 'block';
            dom.visionResultContent.textContent = data.result;
            showToast('画面分析完成', 'success');
        } else {
            showToast('分析失败: ' + (data.error || '未知错误'), 'error');
        }
    } catch (err) {
        showToast('网络错误: ' + err.message, 'error');
    } finally {
        state.isProcessing = false;
        dom.frameIndicator.classList.remove('visible');
    }
}

function takeScreenshot() {
    const imageData = captureFrame();
    if (!imageData) {
        showToast('请先开启摄像头', 'error');
        return;
    }
    analyzeCurrentFrame('请详细描述这张截图中的内容，包括场景、物体、人物、氛围等。');
}

async function recognizeObject() {
    if (!state.cameraActive) return;
    await analyzeCurrentFrame(
        '请逐一识别画面中的所有物体，说出名称、品牌、用途，并介绍有趣的背景知识。'
    );
}

async function detectEmotion() {
    if (!state.cameraActive) return;
    await analyzeCurrentFrame(
        '请分析画面中人物的表情和情绪状态，推测他们的心情，给出温暖的互动建议。'
    );
}

async function saveScreenshotToDisk() {
    if (!state.cameraActive) {
        showToast('请先开启摄像头', 'error');
        return;
    }
    const imageData = captureFrame();
    if (!imageData) return;

    const conversation = [];
    dom.chatMessages.querySelectorAll('.message').forEach(msg => {
        const role = msg.classList.contains('user') ? '用户' : 'AI助手';
        const text = msg.querySelector('.message-bubble')?.textContent || '';
        const time = msg.querySelector('.message-time')?.textContent || '';
        if (text) conversation.push(`[${time}] ${role}: ${text}`);
    });

    try {
        const response = await fetch('/api/save_screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: imageData,
                session_id: state.sessionId,
                conversation: conversation.join('\n'),
            }),
        });
        const data = await response.json();
        if (data.success) {
            showToast('截图和对话已保存到 saved_screenshots 目录', 'success');
        } else {
            showToast('保存失败: ' + (data.error || '未知错误'), 'error');
        }
    } catch (err) {
        showToast('保存失败: ' + err.message, 'error');
    }
}

// ===== 自动分析 =====
let autoAnalyzeTimer = null;

function toggleAutoAnalyze() {
    if (state.autoAnalyze) {
        stopAutoAnalyze();
    } else {
        startAutoAnalyze();
    }
}

function startAutoAnalyze() {
    if (!state.cameraActive) {
        showToast('请先开启摄像头', 'error');
        return;
    }
    state.autoAnalyze = true;
    dom.btnAutoAnalyze.innerHTML = '<svg class="svg-icon" style="font-size:12px"><use href="#icon-magic"/></svg> 停止分析';
    dom.btnAutoAnalyze.style.background = 'rgba(108,92,231,0.2)';
    dom.btnAutoAnalyze.style.borderColor = 'var(--accent-primary)';
    dom.btnAutoAnalyze.style.color = 'var(--accent-secondary)';
    scheduleAutoAnalyze();
    showToast('自动视觉分析已开启', 'info');
}

function stopAutoAnalyze() {
    state.autoAnalyze = false;
    dom.btnAutoAnalyze.innerHTML = '<svg class="svg-icon" style="font-size:12px"><use href="#icon-magic"/></svg> 自动分析';
    dom.btnAutoAnalyze.style.background = '';
    dom.btnAutoAnalyze.style.borderColor = '';
    dom.btnAutoAnalyze.style.color = '';
    if (autoAnalyzeTimer) {
        clearTimeout(autoAnalyzeTimer);
        autoAnalyzeTimer = null;
    }
}

function restartAutoAnalyze() {
    if (autoAnalyzeTimer) clearTimeout(autoAnalyzeTimer);
    if (state.autoAnalyze) scheduleAutoAnalyze();
}

function scheduleAutoAnalyze() {
    if (!state.autoAnalyze || state.isProcessing) return;
    autoAnalyzeTimer = setTimeout(async () => {
        await analyzeCurrentFrame('简要描述当前画面（50字以内）。');
        scheduleAutoAnalyze();
    }, state.frameInterval);
}

function pauseAutoAnalyze() {
    if (autoAnalyzeTimer) { clearTimeout(autoAnalyzeTimer); autoAnalyzeTimer = null; }
}

function resumeAutoAnalyze() {
    if (state.autoAnalyze && !autoAnalyzeTimer) scheduleAutoAnalyze();
}

// ===== 对话 =====
async function sendMessage() {
    const message = dom.chatInput.value.trim();
    if (!message || state.isProcessing) return;

    var ttsCmd = checkTtsCommand(message);
    if (ttsCmd) { dom.chatInput.value = ''; updateSendButton(); return; }

    dom.chatInput.value = '';
    updateSendButton();

    // 隐藏欢迎消息
    const welcome = dom.chatMessages.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    // 添加用户消息
    addMessage('user', message);
    const typingEl = showTyping();

    // 如果有摄像头画面，进行组合分析
    const imageData = state.cameraActive ? captureFrame() : null;

    state.isProcessing = true;
    pauseAutoAnalyze();

    try {
        let response;
        if (imageData) {
            response = await fetch('/api/analyze_and_chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageData,
                    message: message,
                    session_id: state.sessionId,
                    enable_search: state.searchEnabled,
                    style: state.chatStyle,
                    voice_style: state.voiceStyle,
                }),
            });
        } else {
            response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    session_id: state.sessionId,
                    vision_context: state.lastVisionContext,
                    enable_search: state.searchEnabled,
                    style: state.chatStyle,
                    voice_style: state.voiceStyle,
                }),
            });
        }

        const data = await response.json();
        removeTyping(typingEl);

        if (data.success) {
            typewriterMessage('assistant', data.reply);
            if (data.vision_context) {
                state.lastVisionContext = data.vision_context;
                dom.visionResult.style.display = 'block';
                dom.visionResultContent.textContent = data.vision_context;
            }
            if (data.search_used) {
                showToast('已结合联网搜索结果回答', 'info');
            }
        } else {
            addMessage('assistant', '抱歉，我遇到了一些问题：' + (data.error || '未知错误'));
        }
    } catch (err) {
        removeTyping(typingEl);
        addMessage('assistant', '网络连接出现问题，请检查后重试。');
    } finally {
        state.isProcessing = false;
        resumeAutoAnalyze();
    }
}

function addMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = role === 'user'
        ? '<svg class="svg-icon" style="font-size:14px"><use href="#icon-user"/></svg>'
        : '<svg class="svg-icon" style="font-size:14px"><use href="#icon-robot"/></svg>';

    const content = document.createElement('div');
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    content.appendChild(bubble);
    content.appendChild(time);
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);

    dom.chatMessages.appendChild(msgDiv);
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    return msgDiv;
}

function typewriterMessage(role, text) {
    const msgDiv = addMessage(role, '');
    const bubble = msgDiv.querySelector('.message-bubble');
    bubble.classList.add('typing-cursor');

    let i = 0;
    const speed = 30 + Math.random() * 20;
    let buf = '';         // 当前累积句子
    let lastRead = 0;     // 上次已朗读到的位置

    function type() {
        if (i < text.length) {
            const chunk = Math.random() < 0.08 ? text.substring(i, i + 2) : text[i];
            bubble.textContent += chunk;
            buf += chunk;
            i += chunk.length;
            dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;

            // 遇到句末标点且缓冲区够长：送入朗读队列
            if ('。！？.!?；;'.includes(buf[buf.length-1]) && buf.length >= 5) {
                if (state.ttsEnabled && !state.ttsPausedByUser) {
                    speakStreamingText(buf);
                }
                buf = '';
                lastRead = i;
            }

            const delay = ',.?!;:，。？！；：'.includes(text[i - 1]) ? 200 : speed;
            setTimeout(type, delay);
        } else {
            bubble.classList.remove('typing-cursor');
            bubble._typewriterDone = true;
            // 剩余文本朗读
            const rest = text.slice(lastRead).trim();
            if (rest && state.ttsEnabled && !state.ttsPausedByUser) speakStreamingText(rest);
        }
    }

    type();
    return msgDiv;
}

function showTyping() {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.innerHTML = `
        <div class="message-avatar" style="background:var(--gradient-1);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;color:white;">
                <svg class="svg-icon" style="font-size:14px"><use href="#icon-robot"/></svg>
            </div>
        <div class="message-bubble" style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:12px 12px 12px 4px;padding:10px 16px;">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    dom.chatMessages.appendChild(el);
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    return el;
}

function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

async function resetConversation() {
    try {
        await fetch('/api/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: state.sessionId }),
        });
        dom.chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon"><svg class="svg-icon filled" style="font-size:28px"><use href="#icon-robot"/></svg></div>
                <h3>对话已重置</h3>
                <p>有什么我可以帮助你的？</p>
                <div class="quick-actions">
                    <button class="quick-btn" data-msg="你看到了什么？"><svg class="svg-icon" style="font-size:12px"><use href="#icon-eye"/></svg> 你看到了什么？</button>
                    <button class="quick-btn" data-msg="描述一下画面中的场景"><svg class="svg-icon" style="font-size:12px"><use href="#icon-image"/></svg> 描述场景</button>
                    <button class="quick-btn" data-msg="画面中有什么有趣的地方？"><svg class="svg-icon" style="font-size:12px"><use href="#icon-lightbulb"/></svg> 有什么有趣的？</button>
                </div>
            </div>`;
        // 重新绑定快捷按钮
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const msg = btn.dataset.msg;
                if (msg) { dom.chatInput.value = msg; sendMessage(); }
            });
        });
        state.lastVisionContext = '';
        dom.visionResult.style.display = 'none';
        showToast('对话已重置', 'info');
    } catch (err) {
        showToast('重置失败', 'error');
    }
}

// ===== 联网搜索 =====
function toggleSearch() {
    state.searchEnabled = !state.searchEnabled;
    const btn = dom.btnSearchWeb;
    if (state.searchEnabled) {
        btn.classList.add('active');
        btn.title = '已开启联网搜索';
        showToast('联网搜索已开启 - AI将结合实时网络信息回答', 'info');
    } else {
        btn.classList.remove('active');
        btn.title = '联网搜索';
        showToast('联网搜索已关闭', 'info');
    }
}

// ===== 语音输入 =====
function toggleVoiceInput() {
    if (state.isRecording) {
        stopVoiceInput();
    } else {
        startVoiceInput();
    }
}

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('您的浏览器不支持语音识别，请使用Chrome浏览器', 'error');
        return;
    }

    state.recognition = new SpeechRecognition();
    state.recognition.lang = state.speechLang;
    state.recognition.interimResults = true;
    state.recognition.continuous = false;
    state.recognition.maxAlternatives = 1;

    state.recognition.onstart = () => {
        state.isRecording = true;
        dom.btnMic.classList.add('recording');
        dom.voiceIndicator.classList.add('active');
        dom.chatInput.placeholder = '正在聆听...';
    };

    state.recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        dom.chatInput.value = transcript;
        updateSendButton();
    };

    state.recognition.onend = () => {
        state.isRecording = false;
        dom.btnMic.classList.remove('recording');
        dom.voiceIndicator.classList.remove('active');
        dom.chatInput.placeholder = '输入消息，或点击麦克风语音输入...';
        if (dom.chatInput.value.trim()) {
            sendMessage();
        }
    };

    state.recognition.onerror = (event) => {
        state.isRecording = false;
        dom.btnMic.classList.remove('recording');
        dom.voiceIndicator.classList.remove('active');
        dom.chatInput.placeholder = '输入消息，或点击麦克风语音输入...';
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            showToast('语音识别错误: ' + event.error, 'error');
        }
    };

    state.recognition.start();
    state.micActive = true;
    dom.statusMic.classList.add('active');
}

function stopVoiceInput() {
    if (state.recognition) {
        state.recognition.abort();
    }
    state.isRecording = false;
    state.micActive = false;
    dom.btnMic.classList.remove('recording');
    dom.voiceIndicator.classList.remove('active');
    dom.statusMic.classList.remove('active');
}

// ===== TTS语音合成 =====

function updateTtsButton() {
    if (!dom.btnTtsToggle) return;
    var icon = dom.btnTtsToggle.querySelector('use');
    if (icon) icon.setAttribute('href', (state.ttsEnabled && !state.ttsPausedByUser) ? '#icon-volume-up' : '#icon-volume-mute');
    dom.btnTtsToggle.classList.toggle('active', state.ttsEnabled && !state.ttsPausedByUser);
    dom.btnTtsToggle.classList.toggle('muted', !state.ttsEnabled || state.ttsPausedByUser);
}

function toggleTtsManual() {
    if (state.ttsSpeaking) {
        stopTts(); state.ttsPausedByUser = true; showToast('已停止朗读', 'info');
    } else if (state.ttsPausedByUser) {
        state.ttsPausedByUser = false; showToast('继续朗读中', 'info');
    } else {
        state.ttsEnabled = !state.ttsEnabled;
        if (dom.settingTts) dom.settingTts.checked = state.ttsEnabled;
        saveSetting('ttsEnabled', state.ttsEnabled);
        showToast(state.ttsEnabled ? 'AI语音朗读已开启' : 'AI语音朗读已关闭', 'info');
    }
    updateTtsButton();
}

function stopTts() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    state.ttsQueue = []; state.ttsCurrentUtterance = null; state.ttsSpeaking = false;
    updateTtsButton();
}

function checkTtsCommand(msg) {
    var stopP = ['停','别读了','停止朗读','不要读了','别说话','暂停朗读','安静'];
    var contP = ['继续读','继续朗读','接着读'];
    for (var a = 0; a < stopP.length; a++) if (msg.indexOf(stopP[a]) !== -1) {
        stopTts(); state.ttsPausedByUser = true; updateTtsButton();
        addMessage('user', msg);
        addMessage('assistant', '好的，已停止朗读，仅展示文字。说"继续读"或点音量按钮恢复。');
        return 'stop';
    }
    for (var b = 0; b < contP.length; b++) if (msg.indexOf(contP[b]) !== -1) {
        state.ttsPausedByUser = false; updateTtsButton();
        addMessage('user', msg);
        addMessage('assistant', '好的，我继续朗读。');
        return 'continue';
    }
    return null;
}

function speakNextInQueue() {
    if (state.ttsQueue.length === 0) { state.ttsSpeaking = false; updateTtsButton(); return; }
    if (!state.ttsEnabled || state.ttsPausedByUser) { state.ttsSpeaking = false; return; }
    speakSingleSentence(state.ttsQueue.shift());
}

function speakSingleSentence(text) {
    if (!window.speechSynthesis || !text) { setTimeout(speakNextInQueue, 50); return; }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.volume = 0.9;
    var styles = { general:{rate:0.90,pitch:1.02}, lively:{rate:1.08,pitch:1.12}, gentle:{rate:0.92,pitch:1.08} };
    var vs = styles[state.voiceStyle] || styles.general;
    u.rate = vs.rate; u.pitch = vs.pitch;
    var voices = speechSynthesis.getVoices();
    var zh = voices.filter(function(v){return v.lang.indexOf('zh')===0});
    if (zh.length) {
        var female = zh.find(function(v){return /female|woman|girl|女士|女|Tingting|Xiaoxiao|Yaoyao/i.test(v.name)});
        if (female) u.voice = female;
        else { var s = zh.find(function(v){return /Xiaoxiao|晓晓|Xiaoyi|小艺|Yaoyao|瑶瑶|Xiaotong|晓彤/i.test(v.name)}); u.voice = s || zh[0]; }
    }
    u.onend = function(){ state.ttsCurrentUtterance = null; setTimeout(speakNextInQueue, 100); };
    u.onerror = function(){ state.ttsCurrentUtterance = null; setTimeout(speakNextInQueue, 100); };
    state.ttsCurrentUtterance = u; state.ttsSpeaking = true;
    updateTtsButton(); speechSynthesis.speak(u);
}

function speakText(text) {
    if (!text || !state.ttsEnabled || state.ttsPausedByUser) return;
    var parts = text.match(/[^。！？.!?；;\n]{1,60}[。！？.!?；;]?|[^。！？.!?；;\n]{1,60}/g) || [text];
    var sentences = parts.map(function(s){return s.trim()}).filter(Boolean);
    if (!sentences.length) return;
    if (!state.ttsSpeaking && state.ttsQueue.length === 0) {
        state.ttsQueue = sentences.slice(1); speakSingleSentence(sentences[0]);
    } else { state.ttsQueue.push.apply(state.ttsQueue, sentences); }
}

function speakStreamingText(text) {
    if (!text || !state.ttsEnabled || state.ttsPausedByUser) return;
    state.ttsQueue.push(text.trim());
    if (!state.ttsSpeaking) speakNextInQueue();
}

// 预加载语音列表
if (window.speechSynthesis) {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

// ===== UI工具 =====
function updateSendButton() {
    const hasText = dom.chatInput.value.trim().length > 0;
    dom.btnSend.disabled = !hasText || state.isProcessing;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '<svg class="svg-icon" style="font-size:13px"><use href="#icon-check-circle"/></svg>', error: '<svg class="svg-icon" style="font-size:13px"><use href="#icon-exclamation-circle"/></svg>', info: '<svg class="svg-icon" style="font-size:13px"><use href="#icon-info-circle"/></svg>' };
    toast.innerHTML = `${icons[type] || icons.info} ${message}`;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function checkAIConfig() {
    const el = dom.statusAI;
    el.classList.add('checking');
    el.querySelector('span').textContent = '检测中...';
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        if (data.features.vision || data.features.chat) {
            el.classList.remove('checking', 'disconnected');
            el.classList.add('connected');
            el.querySelector('span').textContent = 'AI已连接';
            el.title = 'AI已连接 - 点击重新检测';
        } else {
            setAIDisconnected(el);
            showToast('请先配置API密钥(.env文件)', 'error');
        }
    } catch (err) {
        setAIDisconnected(el);
    }
}

function setAIDisconnected(el) {
    el.classList.remove('checking', 'connected');
    el.classList.add('disconnected');
    el.querySelector('span').textContent = 'AI未连接';
    el.title = 'AI未连接 - 请配置API密钥后点击重试';
}

// ===== 设置持久化 =====
function applyTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-dark');
    if (theme === 'light') document.body.classList.add('theme-light');
}

function applyFontSize(size) {
    document.body.classList.remove('font-small', 'font-large');
    if (size !== 'medium') document.body.classList.add('font-' + size);
}

function applyBubble(bubble) {
    document.body.classList.remove('bubble-rounded', 'bubble-square');
    if (bubble === 'square') document.body.classList.add('bubble-square');
}

function loadSetting(key, defaultVal) {
    try { return localStorage.getItem('ai_vision_' + key) || defaultVal; }
    catch (e) { return defaultVal; }
}

function saveSetting(key, value) {
    try { localStorage.setItem('ai_vision_' + key, value); }
    catch (e) {}
}

function initSettings() {
    const theme = loadSetting('theme', 'dark');
    const fontSize = loadSetting('fontSize', 'medium');
    const bubble = loadSetting('bubble', 'rounded');
    const chatStyle = loadSetting('chatStyle', 'default');
    const voiceStyle = loadSetting('voiceStyle', 'general');
    const frameInterval = loadSetting('frameInterval', 3);
    const speechLang = loadSetting('speechLang', 'zh-CN');
    const ttsEnabled = loadSetting('ttsEnabled', 'true');

    applyTheme(theme);
    applyFontSize(fontSize);
    applyBubble(bubble);
    state.chatStyle = chatStyle;
    state.voiceStyle = voiceStyle;
    state.frameInterval = parseInt(frameInterval) * 1000;
    state.speechLang = speechLang;
    state.ttsEnabled = ttsEnabled === 'true' || ttsEnabled === true;

    if (dom.settingTheme) dom.settingTheme.value = theme;
    if (dom.settingFontSize) dom.settingFontSize.value = fontSize;
    if (dom.settingBubble) dom.settingBubble.value = bubble;
    if (dom.settingChatStyle) dom.settingChatStyle.value = chatStyle;
    if (dom.settingVoiceStyle) dom.settingVoiceStyle.value = voiceStyle;
    if (dom.settingInterval) dom.settingInterval.value = frameInterval;
    if (dom.settingLang) dom.settingLang.value = speechLang;
    if (dom.settingTts) dom.settingTts.checked = state.ttsEnabled;
    updateTtsButton();
}