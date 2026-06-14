# AI视觉精灵

> 基于 Web 的 AI 多模态视觉对话助手 — 让 AI 通过摄像头"看见"你的世界，用语音与你自然交流。

Demo视频链接：[点击播放](https://www.bilibili.com/video/BV1vAJw6mEmp/?share_source=copy_web&vd_source=fccec885f3b756fef76ad94e71e4a3f1)

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 实时视觉理解 | 摄像头画面实时传送给 Qwen-VL-Max 进行场景分析 |
| 智能对话 | DeepSeek-Chat 结合画面内容进行多轮自然对话 |
| 语音输入 | 浏览器内置 Web Speech API，无需打字 |
| 语音朗读 | AI 回复自动朗读（TTS），支持打字机效果逐字显示 |
| 三种音色 | 通用款（柔和亲切）/ 成熟款（沉稳专业）/ 温暖款（温柔治愈，默认） |
| 联网搜索 | DuckDuckGo 免费搜索，AI 可结合实时网络信息回答 |
| 自动分析 | 可配置间隔（2/3/5/10秒）自动分析画面变化 |
| 拍照保存 | 一键截图并保存对话记录到本地 |
| 界面定制 | 深色/浅色主题、字体大小、对话风格（默认/可爱/专业/简洁） |
| 多语言 | 语音识别支持中文、英语、日语 |

---

## 快速开始

### 环境要求

- **Python** 3.9+
- **现代浏览器**（Chrome / Edge 推荐，需支持 WebRTC 和 Web Speech API）

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置 API 密钥

在项目根目录创建 `.env` 文件：

```env
# Qwen (通义千问) API配置 - 用于视觉理解
DASHSCOPE_API_KEY=你的通义千问API密钥

# DeepSeek API配置 - 用于对话生成
DEEPSEEK_API_KEY=你的DeepSeek API密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

> **获取密钥：**
> - 通义千问：https://dashscope.aliyun.com/ （需开通"多模态模型"服务）
> - DeepSeek：https://platform.deepseek.com/

### 3. 启动应用

```bash
python app.py
```

浏览器访问 **http://localhost:5000** 即可使用。

---

## 使用指南

### 基本操作

1. 启动后顶部导航栏自动检测 AI 连接状态（绿色=已连接，红色=未连接）
2. 点击"开启摄像头"按钮，授权浏览器访问摄像头
3. 点击"分析当前画面"，AI 将描述摄像头中的内容
4. 在聊天框输入问题（或点击麦克风语音输入），AI 结合画面内容回复
5. AI 回复通过打字机效果逐字显示，同时自动朗读
6. 可开启"自动分析"，AI 每隔几秒自动感知画面变化

### 快捷操作

| 操作 | 方式 |
|------|------|
| 停止朗读 | 点击音量按钮 / 点击麦克风 / 发送新消息 / 说"别读了" |
| 恢复朗读 | 说"继续读" |
| 切换音色 | 右上角齿轮 → AI语音音色 |
| 切换风格 | 右上角齿轮 → 对话风格 |
| 联网搜索 | 点击输入框左侧地球图标 |
| 保存截图 | 点击相机图标 |

---

## 第三方依赖

### Python 后端

| 包名 | 用途 | 许可证 |
|------|------|--------|
| [Flask](https://flask.palletsprojects.com/) | Web 框架，路由与模板渲染 | BSD-3-Clause |
| [Flask-CORS](https://flask-cors.readthedocs.io/) | 跨域资源共享 | MIT |
| [python-dotenv](https://github.com/theskumar/python-dotenv) | 加载 `.env` 环境变量 | BSD-3-Clause |
| [openai](https://github.com/openai/openai-python) | DeepSeek API 兼容调用 | Apache-2.0 |
| [dashscope](https://pypi.org/project/dashscope/) | 阿里云通义千问视觉模型 SDK | Apache-2.0 |
| [duckduckgo-search](https://github.com/deedy5/duckduckgo_search) | DuckDuckGo 免费搜索 | MIT |

### 外部 AI 服务

| 服务 | 模型 | 用途 |
|------|------|------|
| 阿里云 DashScope | Qwen-VL-Max | 摄像头画面视觉理解 |
| DeepSeek | DeepSeek-Chat | 结合画面内容的智能对话 |
| DuckDuckGo | 搜索引擎 | 免费联网搜索 |

### 浏览器内置 API（零成本）

| API | 用途 |
|-----|------|
| `getUserMedia` | 摄像头与麦克风 |
| `SpeechRecognition` | 语音识别（ASR） |
| `SpeechSynthesis` | 语音合成（TTS） |
| `Canvas` | 视频帧截图 |

---

## 音色与风格

### 音色

| 值 | 名称 | 说明 |
|----|------|------|
| `warm`（默认） | 温暖款 | 温柔治愈，像冬日暖阳 |
| `general` | 通用款 | 柔和亲切，自然舒缓 |
| `mature` | 成熟款 | 沉稳专业，语调平稳 |

### 对话风格

| 值 | 名称 | 说明 |
|----|------|------|
| `default` | 默认 | 温暖自然，口语化表达 |
| `cute` | 可爱 | 活泼萌系，颜文字风格 |
| `professional` | 专业 | 严谨正式，分点论述 |
| `concise` | 简洁 | 极致精简，直奔主题 |

---

## 项目结构

```
AI视觉工具/
├── app.py                  # Flask 后端主程序
├── requirements.txt        # Python 依赖清单
├── .env                    # API 密钥配置（需自行创建）
├── DESIGN_DOC.md           # 详细设计文档（开发者阅读）
├── README.MD               # 本文件
├── templates/
│   └── index.html          # 前端页面模板
├── static/
│   ├── css/
│   │   └── style.css       # 样式表
│   └── js/
│       └── app.js          # 前端主逻辑
└── saved_screenshots/      # 截图保存目录（自动创建）
```

---

## 常见问题

**Q: 摄像头无法开启？**
A: 确保浏览器已授权摄像头权限，且使用 HTTPS 或 localhost 访问。

**Q: 语音朗读没有声音？**
A: 检查浏览器是否支持 Speech Synthesis API（Chrome/Edge 均支持），确认系统音量未静音。可点击音量按钮切换开关状态。

**Q: 搜索没有结果？**
A: DuckDuckGo 在某些网络环境下可能受限，可检查网络连接或尝试更换关键词。搜索内置超时和重试机制。

**Q: AI 连接状态显示红色？**
A: 检查 `.env` 文件中 API 密钥是否正确配置，确保密钥有效且对应服务已开通。点击 AI 状态按钮可重新检测。

**Q: 如何切换音色？**
A: 点击右上角齿轮图标进入设置面板，在"AI语音音色"下拉菜单中选择。温暖款为默认音色。

---

## 了解更多

- 完整技术架构、设计决策、成本控制策略 → 参见 [DESIGN_DOC.md](DESIGN_DOC.md)
- 用户故事与实现记录 → 参见 [DESIGN_DOC.md](DESIGN_DOC.md)

---

## 许可证

MIT License