import os
import io
import base64
import json
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
import dashscope
from dashscope import MultiModalConversation
from duckduckgo_search import DDGS

load_dotenv()

app = Flask(__name__)
CORS(app)
ddgs = DDGS()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

dashscope.api_key = DASHSCOPE_API_KEY
deepseek_client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

CONVERSATION_HISTORY = {}
MAX_HISTORY = 20
FRAME_INTERVAL = 3.0
JPEG_QUALITY = 60
MAX_IMAGE_SIZE = (640, 480)
MAX_SEARCH_RESULTS = 5


def get_time_context() -> str:
    """获取当前时间上下文"""
    now = datetime.now()
    wd = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    return f"当前时间：{now.strftime('%Y年%m月%d日')} {wd[now.weekday()]} {now.strftime('%H:%M')}"


def get_system_prompt(style: str = "default", voice_style: str = "general") -> str:
    """系统提示词：对话风格 + 语音话术统一"""
    t = get_time_context()
    # 语音话术基调
    voice_tones = {
        "general": "用温和亲切的语气回答，说话节奏舒缓自然，语音清晰悦耳。",
        "mature": "用沉稳专业的语气回答，语调平稳有力，语言简练不拖沓，体现可靠和信赖感。",
        "warm": "用温暖治愈的语气回答，语调轻柔有温度，像冬日暖阳般让人感到舒适和被关怀。",
    }
    voice_tone = voice_tones.get(voice_style, voice_tones["general"])
    base = (
        f"{t}\n"
        "你是'视觉精灵'，一个能看到摄像头画面的AI助手，性格温暖幽默，像朋友一样聊天。\n\n"
        "【场景化引导】看到不同内容时，主动给出有趣的话题方向：\n"
        "- 人物：聊聊穿搭、表情、猜测他们在做什么\n"
        "- 食物：讨论烹饪方式、营养搭配、推荐食谱\n"
        "- 书籍/文字：讨论内容、推荐相关读物\n"
        "- 电子产品：分享使用技巧或产品对比\n"
        "- 自然风景：分享感受、推荐类似景点\n"
        "- 宠物/动物：聊聊品种、习性、趣事\n"
        "- 日常物品：猜测用途、分享冷知识\n\n"
        "【情绪感知】当画面中有人物时：\n"
        "- 识别表情/情绪（开心、难过、专注、惊讶、疲惫等）\n"
        "- 根据情绪给出恰当的回应\n\n"
        "【物体识别】当画面中有明确物体时，准确说出名称、用途和背景知识。\n\n"
        "【联网搜索】如有搜索结果，结合搜索内容回答，标注来源如[1]。\n"
    )
    styles = {
        "cute": (
            base + "【回复风格】\n"
            "用超级可爱活泼的语气回复！\n"
            "- 大量使用颜文字和emoji (｡･ω･｡)ﾉ♡ ✨🌸\n"
            "- 语气像二次元萌妹，多用'呢~'、'哦~'、'啦~'、'喵~'\n"
            "- 对看到的事物表现出极大热情和好奇\n"
            "- 回复控制在150字以内，保持轻快节奏"
        ),
        "professional": (
            base + "【回复风格】\n"
            "用专业严谨的语气回复。\n"
            "- 语言正式、逻辑清晰、条理分明\n"
            "- 使用专业术语，必要时分点论述\n"
            "- 提供准确、可靠的信息，避免主观臆断\n"
            "- 回复控制在250字以内，注重信息密度"
        ),
        "concise": (
            base + "【回复风格】\n"
            "用极致简洁的语气回复。\n"
            "- 去掉所有寒暄和修饰，直奔主题\n"
            "- 能用一句话说清绝不用两句话\n"
            "- 像命令行输出一样高效\n"
            "- 回复控制在80字以内"
        ),
        "default": (
            base + "【回复风格】\n"
            f"{voice_tone}\n"
            "- 用自然口语化的中文，适当使用呢、哦、呀、吧等语气词\n"
            "- 对看到的事物表达真实的好奇和感受\n"
            "- 回复简洁有力，控制在200字以内\n"
            "记住：你不仅要回答问题，更要激发用户的好奇心和探索欲！"
        ),
    }
    return styles.get(style, styles["default"])


def get_vision_prompt(mode: str = "general") -> str:
    """根据分析模式生成视觉提示词"""
    prompts = {
        "general": "请详细描述画面中的场景、物体、人物和氛围。",
        "detailed": (
            "请详细分析这张图片：\n"
            "1. 列出画面中所有可辨识的物体，尽可能说出名称、品牌、用途\n"
            "2. 描述场景环境和氛围\n"
            "3. 如果有文字，请识别并解读\n"
            "4. 给出2-3个有趣的话题或问题来引导用户互动"
        ),
        "emotion": (
            "请分析画面中人物的表情和情绪状态：\n"
            "1. 描述每个人物的表情（开心、难过、专注、惊讶、疲惫等）\n"
            "2. 推测他们的情绪状态和可能的心情\n"
            "3. 结合场景，给出善意的互动建议或鼓励的话语"
        ),
        "object": (
            "请识别画面中的物体：\n"
            "1. 逐一列出所有可辨识的物体，说出名称\n"
            "2. 对每个物体，介绍其用途、背景知识或有趣小知识\n"
            "3. 如果是书籍、电子产品、食物等，给出更详细的信息"
        ),
    }
    return prompts.get(mode, prompts["general"])


def web_search(query: str, max_results: int = None) -> str:
    """DuckDuckGo免费搜索"""
    if max_results is None:
        max_results = MAX_SEARCH_RESULTS
    try:
        results = list(ddgs.text(query, max_results=max_results, timelimit='y'))
        if not results:
            return ""
        snippets = []
        for i, r in enumerate(results, 1):
            title = r.get('title', '')
            body = r.get('body', '')
            href = r.get('href', '')
            snippets.append(f"[{i}] {title}\n    {body}\n    来源: {href}")
        return "\n\n".join(snippets)
    except Exception as e:
        logger.warning(f"[Search] 搜索失败: {e}")
        return ""
MAX_SEARCH_RESULTS = 5
SEARCH_TIMEOUT = 8


def web_search(query: str, max_results: int = MAX_SEARCH_RESULTS) -> str:
    """DuckDuckGo免费搜索"""
    try:
        results = list(ddgs.text(query, max_results=max_results, timelimit='y'))
        if not results:
            return ""
        snippets = []
        for i, r in enumerate(results, 1):
            title = r.get('title', '')
            body = r.get('body', '')
            href = r.get('href', '')
            snippets.append(f"[{i}] {title}\n    {body}\n    来源: {href}")
        return "\n\n".join(snippets)
    except Exception as e:
        logger.warning(f"[Search] 搜索失败: {e}")
        return ""


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/vision', methods=['POST'])
def vision_analysis():
    """视觉分析：将摄像头画面发送给Qwen-VL进行理解"""
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': '缺少图片数据'}), 400

        image_b64 = data['image']
        prompt = data.get('prompt', get_vision_prompt('general'))
        session_id = data.get('session_id', 'default')
        mode = data.get('mode', 'general')

        if ',' in image_b64:
            image_b64 = image_b64.split(',', 1)[1]

        messages = [
            {
                "role": "user",
                "content": [
                    {"image": f"data:image/jpeg;base64,{image_b64}"},
                    {"text": prompt}
                ]
            }
        ]

        logger.info(f"[Vision] 发送请求到Qwen-VL, session={session_id}")
        response = MultiModalConversation.call(
            model='qwen-vl-max',
            messages=messages,
            max_tokens=800
        )

        if response.status_code == 200:
            result_text = response.output.choices[0].message.content[0]['text']
            logger.info(f"[Vision] 分析成功, 长度={len(result_text)}")
            return jsonify({'success': True, 'result': result_text})
        else:
            logger.error(f"[Vision] API错误: {response.code} - {response.message}")
            return jsonify({'success': False, 'error': f'视觉分析失败: {response.message}'}), 500

    except Exception as e:
        logger.error(f"[Vision] 异常: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """文本对话：使用DeepSeek进行智能回复"""
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'success': False, 'error': '缺少消息内容'}), 400

        message = data['message']
        session_id = data.get('session_id', 'default')
        vision_context = data.get('vision_context', '')
        enable_search = data.get('enable_search', False)
        chat_style = data.get('style', 'default')
        voice_style = data.get('voice_style', 'general')

        if session_id not in CONVERSATION_HISTORY:
            CONVERSATION_HISTORY[session_id] = []

        history = CONVERSATION_HISTORY[session_id]

        system_prompt = get_system_prompt(chat_style, voice_style)

        messages = [{"role": "system", "content": system_prompt}]

        if vision_context:
            messages.append({
                "role": "system",
                "content": f"[当前摄像头画面分析结果]\n{vision_context}\n请结合以上画面内容回答用户问题。"
            })

        if enable_search and message:
            logger.info(f"[Chat] 联网搜索中...")
            search_ctx = web_search(message)
            if search_ctx:
                messages.append({
                    "role": "system",
                    "content": f"[联网搜索结果]\n{search_ctx}\n请结合以上搜索结果回答，标注来源编号如[1]。"
                })

        for h in history[-MAX_HISTORY:]:
            messages.append(h)

        messages.append({"role": "user", "content": message})

        logger.info(f"[Chat] 发送请求到DeepSeek, session={session_id}")
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            max_tokens=600,
            temperature=0.7,
            stream=False
        )

        reply = response.choices[0].message.content
        logger.info(f"[Chat] 回复成功, 长度={len(reply)}")

        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": reply})
        if len(history) > MAX_HISTORY * 2:
            CONVERSATION_HISTORY[session_id] = history[-(MAX_HISTORY * 2):]

        return jsonify({'success': True, 'reply': reply})

    except Exception as e:
        logger.error(f"[Chat] 异常: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/analyze_and_chat', methods=['POST'])
def analyze_and_chat():
    """组合接口：先视觉分析，再结合用户消息进行对话"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': '缺少请求数据'}), 400

        image_b64 = data.get('image', '')
        message = data.get('message', '请分析这个画面。')
        session_id = data.get('session_id', 'default')
        enable_search = data.get('enable_search', False)
        chat_style = data.get('style', 'default')
        voice_style = data.get('voice_style', 'general')

        vision_context = ""
        if image_b64:
            if ',' in image_b64:
                image_b64 = image_b64.split(',', 1)[1]

            vision_messages = [{
                "role": "user",
                "content": [
                    {"image": f"data:image/jpeg;base64,{image_b64}"},
                    {"text": "请描述画面中的场景、物体和人物（如有），用简洁的中文描述。"}
                ]
            }]

            logger.info(f"[Analyze+Chat] 视觉分析中...")
            vis_response = MultiModalConversation.call(
                model='qwen-vl-max',
                messages=vision_messages,
                max_tokens=500
            )

            if vis_response.status_code == 200:
                vision_context = vis_response.output.choices[0].message.content[0]['text']
                logger.info(f"[Analyze+Chat] 视觉分析完成")

        if session_id not in CONVERSATION_HISTORY:
            CONVERSATION_HISTORY[session_id] = []

        history = CONVERSATION_HISTORY[session_id]

        system_prompt = get_system_prompt(chat_style, voice_style)

        messages = [{"role": "system", "content": system_prompt}]

        if vision_context:
            messages.append({
                "role": "system",
                "content": f"[摄像头画面描述]\n{vision_context}\n请结合画面内容回复用户。"
            })

        search_context = ""
        if enable_search and message:
            logger.info(f"[Analyze+Chat] 联网搜索中...")
            search_context = web_search(message)
            if search_context:
                messages.append({
                    "role": "system",
                    "content": f"[联网搜索结果]\n{search_context}\n请结合搜索结果回答，标注来源编号如[1]。"
                })

        for h in history[-MAX_HISTORY:]:
            messages.append(h)

        user_content = message if message else "你看到了什么？请描述一下当前画面。"
        messages.append({"role": "user", "content": user_content})

        logger.info(f"[Analyze+Chat] 对话生成中...")
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            max_tokens=600,
            temperature=0.7,
            stream=False
        )

        reply = response.choices[0].message.content

        history.append({"role": "user", "content": user_content})
        history.append({"role": "assistant", "content": reply})
        if len(history) > MAX_HISTORY * 2:
            CONVERSATION_HISTORY[session_id] = history[-(MAX_HISTORY * 2):]

        result = {
            'success': True,
            'reply': reply,
            'vision_context': vision_context
        }
        if search_context:
            result['search_context'] = search_context
            result['search_used'] = True
        return jsonify(result)

    except Exception as e:
        logger.error(f"[Analyze+Chat] 异常: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/search', methods=['POST'])
def search():
    """独立联网搜索"""
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({'success': False, 'error': '缺少搜索关键词'}), 400
        query = data['query']
        logger.info(f"[Search] 搜索: {query[:50]}...")
        results = web_search(query)
        if results:
            return jsonify({'success': True, 'results': results, 'query': query})
        return jsonify({'success': False, 'error': '搜索无结果'})
    except Exception as e:
        logger.error(f"[Search] 异常: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/save_screenshot', methods=['POST'])
def save_screenshot():
    """保存截图和对话记录"""
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': '缺少图片数据'}), 400

        image_b64 = data['image']
        session_id = data.get('session_id', 'default')
        conversation = data.get('conversation', '')

        if ',' in image_b64:
            image_b64 = image_b64.split(',', 1)[1]

        save_dir = os.path.join(os.path.dirname(__file__), 'saved_screenshots')
        os.makedirs(save_dir, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        img_filename = f"screenshot_{timestamp}.jpg"
        img_path = os.path.join(save_dir, img_filename)

        with open(img_path, 'wb') as f:
            f.write(base64.b64decode(image_b64))

        if conversation:
            txt_filename = f"conversation_{timestamp}.txt"
            txt_path = os.path.join(save_dir, txt_filename)
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(f"保存时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"会话ID: {session_id}\n")
                f.write("=" * 50 + "\n")
                f.write(conversation)

        logger.info(f"[Save] 截图已保存: {img_filename}")
        return jsonify({'success': True, 'filename': img_filename})

    except Exception as e:
        logger.error(f"[Save] 保存失败: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/reset', methods=['POST'])
def reset_conversation():
    """重置对话历史"""
    data = request.get_json() or {}
    session_id = data.get('session_id', 'default')
    if session_id in CONVERSATION_HISTORY:
        del CONVERSATION_HISTORY[session_id]
    return jsonify({'success': True, 'message': '对话已重置'})


@app.route('/api/config', methods=['GET'])
def get_config():
    """返回前端配置"""
    return jsonify({
        'frame_interval': FRAME_INTERVAL,
        'features': {
            'vision': bool(DASHSCOPE_API_KEY and DASHSCOPE_API_KEY != 'your_dashscope_api_key_here'),
            'chat': bool(DEEPSEEK_API_KEY and DEEPSEEK_API_KEY != 'your_deepseek_api_key_here'),
        }
    })


if __name__ == '__main__':
    logger.info("=" * 50)
    logger.info("AI视觉对话应用启动中...")
    logger.info(f"Qwen-VL: {'已配置' if DASHSCOPE_API_KEY else '未配置'}")
    logger.info(f"DeepSeek: {'已配置' if DEEPSEEK_API_KEY else '未配置'}")
    logger.info(f"搜索引擎: DuckDuckGo (免费)")
    logger.info("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=True)