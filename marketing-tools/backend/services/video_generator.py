"""
抖音短视频自动生成服务

功能：
1. 从词库数据生成短视频内容文案
2. TTS 语音合成（使用 edge-tts，免费自然中文发音）
3. 图片/文字帧生成（Pillow）
4. 视频合成（moviepy）

依赖安装:
    pip install edge-tts moviepy Pillow

输出: 1080×1920 竖屏 MP4（抖音标准格式）
"""
import os
import json
import random
import tempfile
from pathlib import Path
from typing import Optional, List, Dict
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import textwrap


# ─── 配置 ───
OUTPUT_DIR = Path(__file__).parent.parent.parent / "output" / "videos"
TEMP_DIR = Path(tempfile.gettempdir()) / "marketing_tools_video"

# 确保目录存在
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# 颜色主题
THEMES = {
    "english": {
        "bg_color": (26, 35, 126),        # 深蓝
        "title_color": (255, 215, 0),      # 金色
        "text_color": (255, 255, 255),     # 白色
        "accent_color": (100, 181, 246),   # 浅蓝
    },
    "math": {
        "bg_color": (27, 94, 32),
        "title_color": (255, 235, 59),
        "text_color": (255, 255, 255),
        "accent_color": (129, 199, 132),
    },
    "chinese": {
        "bg_color": (123, 31, 162),
        "title_color": (255, 215, 0),
        "text_color": (255, 255, 255),
        "accent_color": (206, 147, 216),
    },
}


class VideoContentGenerator:
    """视频内容文案生成器"""

    def __init__(self, word_data: Optional[Dict] = None):
        """
        参数:
            word_data: 词库数据，格式同现有系统的 JSON 词库
                       { "word": "...", "meaning": "...", "example": "..." }
        """
        self.word_data = word_data

    def generate_word_memory_script(self, word: str, meaning: str,
                                     memory_trick: Optional[str] = None,
                                     example: Optional[str] = None) -> List[Dict[str, str]]:
        """
        生成单词速记类视频脚本（多条 scene）

        返回格式:
        [
            {"type": "title", "text": "1秒记住这个单词！", "duration": 2},
            {"type": "word", "text": "apple", "subtitle": "苹果", "duration": 4},
            {"type": "memory", "text": "联想：a(一个) + pp(片) + le(了) → 一片苹果", "duration": 5},
            ...
        ]
        """
        scenes = [
            {"type": "title", "text": "🔥 1秒记住这个单词！", "duration": 2.0},
            {"type": "word_display", "text": word.upper(), "subtitle": meaning, "duration": 3.5},
        ]

        if memory_trick:
            scenes.append({
                "type": "memory_trick",
                "text": f"💡 记忆技巧\n{memory_trick}",
                "duration": 5.0,
            })

        if example:
            scenes.append({
                "type": "example",
                "text": f"📖 例句\n{example}",
                "duration": 4.0,
            })

        scenes.append({
            "type": "ending",
            "text": "关注我，每天一个速记技巧！\n❤️ 点赞 + 收藏",
            "duration": 3.0,
        })

        return scenes

    def generate_quiz_script(self, word: str, meaning: str,
                              wrong_choices: List[str]) -> List[Dict[str, str]]:
        """生成趣味测试类视频脚本"""
        choices = wrong_choices + [meaning]
        random.shuffle(choices)

        scenes = [
            {"type": "title", "text": "🤔 考考你！这个单词是什么意思？", "duration": 2.5},
            {"type": "question", "text": word.upper(), "duration": 3.0},
        ]

        for i, choice in enumerate(choices):
            scenes.append({
                "type": "option",
                "text": f"{'ABCD'[i]}. {choice}",
                "duration": 2.0,
            })

        scenes.append({
            "type": "answer",
            "text": f"✅ 正确答案：{meaning}\n你答对了吗？",
            "duration": 3.5,
        })
        scenes.append({
            "type": "ending",
            "text": "关注我，每天进步一点点！",
            "duration": 2.0,
        })

        return scenes


class VideoRenderer:
    """视频渲染器（图片帧 → 视频合成）"""

    def __init__(self, width: int = 1080, height: int = 1920):
        self.width = width
        self.height = height
        # 尝试加载中文字体
        self.font_path = self._find_chinese_font()

    def _find_chinese_font(self) -> str:
        """寻找系统中可用的中文字体"""
        possible_paths = [
            "C:\\Windows\\Fonts\\msyh.ttc",         # 微软雅黑
            "C:\\Windows\\Fonts\\simhei.ttf",        # 黑体
            "C:\\Windows\\Fonts\\simsun.ttc",        # 宋体
            "C:\\Windows\\Fonts\\STSONG.TTF",        # 华文宋体
            "/System/Library/Fonts/PingFang.ttc",    # macOS
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttf",  # Linux
        ]
        for path in possible_paths:
            if os.path.exists(path):
                return path
        # 如果都不存在，返回 None（Pillow 默认字体）
        return None

    def _load_font(self, size: int) -> ImageFont:
        """加载字体"""
        try:
            if self.font_path:
                return ImageFont.truetype(self.font_path, size)
        except Exception:
            pass
        return ImageFont.load_default()

    def create_scene_image(self, scene: Dict[str, str],
                            theme: str = "english") -> Image.Image:
        """
        根据场景描述创建一帧图片

        场景类型:
            - title: 标题页
            - word_display: 单词展示
            - memory_trick: 记忆技巧
            - example: 例句
            - question: 问题
            - option: 选项
            - answer: 答案
            - ending: 结尾
        """
        colors = THEMES.get(theme, THEMES["english"])
        img = Image.new("RGB", (self.width, self.height), colors["bg_color"])
        draw = ImageDraw.Draw(img)

        scene_type = scene.get("type", "text")
        text = scene.get("text", "")
        subtitle = scene.get("subtitle", "")

        if scene_type == "title":
            self._render_title(draw, text, colors)
        elif scene_type == "word_display":
            self._render_word_display(draw, text, subtitle, colors)
        elif scene_type == "memory_trick":
            self._render_multi_line(draw, text, colors, is_highlight=True)
        elif scene_type == "example":
            self._render_multi_line(draw, text, colors)
        elif scene_type in ("question", "answer"):
            self._render_multi_line(draw, text, colors, is_highlight=(scene_type == "answer"))
        elif scene_type == "option":
            self._render_multi_line(draw, text, colors)
        elif scene_type == "ending":
            self._render_ending(draw, text, colors)
        else:
            self._render_multi_line(draw, text, colors)

        # 添加水印
        self._add_watermark(draw)

        return img

    def _render_title(self, draw: ImageDraw, text: str, colors: dict):
        """渲染标题页"""
        font_large = self._load_font(80)
        font_small = self._load_font(40)

        # 居中
        bbox = draw.textbbox((0, 0), text, font=font_large)
        x = (self.width - (bbox[2] - bbox[0])) // 2
        y = self.height // 3
        draw.text((x, y), text, fill=colors["title_color"], font=font_large)

        # 副标题
        subtitle = "K12英语单词速记"
        bbox2 = draw.textbbox((0, 0), subtitle, font=font_small)
        x2 = (self.width - (bbox2[2] - bbox2[0])) // 2
        draw.text((x2, y + 120), subtitle, fill=colors["accent_color"], font=font_small)

    def _render_word_display(self, draw: ImageDraw, word: str,
                               meaning: str, colors: dict):
        """渲染单词展示"""
        font_word = self._load_font(160)
        font_meaning = self._load_font(60)

        # 单词（大号居中）
        bbox = draw.textbbox((0, 0), word, font=font_word)
        x = (self.width - (bbox[2] - bbox[0])) // 2
        y = self.height // 3
        draw.text((x, y), word, fill=colors["title_color"], font=font_word)

        # 释义
        if meaning:
            bbox2 = draw.textbbox((0, 0), meaning, font=font_meaning)
            x2 = (self.width - (bbox2[2] - bbox2[0])) // 2
            draw.text((x2, y + 200), meaning, fill=colors["text_color"], font=font_meaning)

    def _render_multi_line(self, draw: ImageDraw, text: str,
                            colors: dict, is_highlight: bool = False):
        """渲染多行文本"""
        font = self._load_font(50)
        text_color = colors["title_color"] if is_highlight else colors["text_color"]

        # 自动换行
        lines = text.split("\n")
        line_height = 70
        total_height = len(lines) * line_height
        start_y = (self.height - total_height) // 2

        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font)
            x = (self.width - (bbox[2] - bbox[0])) // 2
            draw.text((x, start_y + i * line_height), line,
                      fill=text_color, font=font)

    def _render_ending(self, draw: ImageDraw, text: str, colors: dict):
        """渲染结尾页"""
        font = self._load_font(50)
        lines = text.split("\n")
        line_height = 80
        total_height = len(lines) * line_height
        start_y = (self.height - total_height) // 2

        for i, line in enumerate(lines):
            color = colors["title_color"] if "关注" in line else colors["text_color"]
            bbox = draw.textbbox((0, 0), line, font=font)
            x = (self.width - (bbox[2] - bbox[0])) // 2
            draw.text((x, start_y + i * line_height), line, fill=color, font=font)

    def _add_watermark(self, draw: ImageDraw):
        """添加水印"""
        font = self._load_font(30)
        watermark = "英语单词速记"
        bbox = draw.textbbox((0, 0), watermark, font=font)
        x = self.width - (bbox[2] - bbox[0]) - 30
        y = self.height - 60
        draw.text((x, y), watermark, fill=(200, 200, 200, 128), font=font)

    def render_scenes_to_frames(self, scenes: List[Dict[str, str]],
                                 theme: str = "english",
                                 output_prefix: str = "video") -> tuple:
        """
        将场景列表渲染为帧图片列表

        返回: (帧图片路径列表, 每帧时长列表)
        """
        frame_paths = []
        durations = []

        for i, scene in enumerate(scenes):
            img = self.create_scene_image(scene, theme)
            frame_path = os.path.join(TEMP_DIR, f"{output_prefix}_frame_{i:04d}.png")
            img.save(frame_path)
            frame_paths.append(frame_path)
            durations.append(scene.get("duration", 3.0))

        return frame_paths, durations


class VideoAssembler:
    """视频合成器（图片帧 → 视频 + 语音）"""

    def __init__(self, fps: float = 24):
        self.fps = fps

    async def assemble(self, frame_paths: List[str], durations: List[float],
                        audio_path: Optional[str] = None,
                        output_path: Optional[str] = None,
                        bgm_path: Optional[str] = None) -> str:
        """
        合成视频

        参数:
            frame_paths: 帧图片路径列表
            durations: 每帧显示时长（秒）
            audio_path: 配音音频路径（可选）
            output_path: 输出视频路径

        返回: 输出视频路径
        """
        try:
            from moviepy.editor import ImageClip, AudioClip, CompositeAudioClip, concatenate_videoclips

            if output_path is None:
                output_path = str(OUTPUT_DIR / f"video_{int(time.time())}.mp4")

            # 创建图片剪辑
            clips = []
            for path, dur in zip(frame_paths, durations):
                clip = ImageClip(path, duration=dur)
                clips.append(clip)

            # 拼接
            video = concatenate_videoclips(clips, method="compose")

            # 添加配音
            if audio_path and os.path.exists(audio_path):
                from moviepy.editor import AudioFileClip
                audio = AudioFileClip(audio_path)
                video = video.set_audio(audio)

            # 添加背景音乐（可选）
            # ...

            # 输出
            video.write_videofile(
                output_path,
                fps=self.fps,
                codec="libx264",
                audio_codec="aac",
                threads=2,
                verbose=False,
                logger=None,
            )

            # 清理
            for clip in clips:
                clip.close()
            video.close()

            return output_path

        except ImportError:
            print("moviepy 未安装，请执行: pip install moviepy")
            raise


# ─── 便捷的一键生成函数 ───

async def generate_word_video(
    word: str,
    meaning: str,
    memory_trick: Optional[str] = None,
    example: Optional[str] = None,
    theme: str = "english",
    word_data_path: Optional[str] = None,
) -> Dict:
    """
    一键生成单词速记短视频

    示例:
        result = await generate_word_video(
            word="apple",
            meaning="苹果",
            memory_trick="a(一个) + pp(片) + le(了) → 一片苹果",
            example="I eat an apple every day.",
        )
        print(f"视频已生成: {result['video_path']}")
    """
    import time

    content_gen = VideoContentGenerator()
    renderer = VideoRenderer()
    assembler = VideoAssembler()

    # 1. 生成脚本
    scenes = content_gen.generate_word_memory_script(
        word=word,
        meaning=meaning,
        memory_trick=memory_trick,
        example=example,
    )

    # 2. 渲染帧图片
    prefix = f"{word}_{int(time.time())}"
    frame_paths, durations = renderer.render_scenes_to_frames(
        scenes, theme=theme, output_prefix=prefix
    )

    # 3. 语音合成（使用 edge-tts）
    audio_path = None
    try:
        script_text = ""
        for scene in scenes:
            t = scene.get("text", "")
            if scene.get("subtitle"):
                t += "， " + scene.get("subtitle", "")
            script_text += t + "。 "

        audio_path = await text_to_speech(script_text, prefix=prefix)
    except Exception as e:
        print(f"语音合成失败（不影响视频生成）: {e}")

    # 4. 合成视频
    output_path = str(OUTPUT_DIR / f"{word}_{int(time.time())}.mp4")
    try:
        result_path = await assembler.assemble(
            frame_paths, durations,
            audio_path=audio_path,
            output_path=output_path,
        )
    except Exception as e:
        print(f"视频合成失败: {e}")
        # 即使合成失败，至少返回帧图片路径
        result_path = None

    # 5. 清理中间文件
    for fp in frame_paths:
        try:
            os.remove(fp)
        except Exception:
            pass

    return {
        "word": word,
        "meaning": meaning,
        "scene_count": len(scenes),
        "duration_seconds": sum(durations),
        "video_path": result_path or "合成失败",
        "audio_path": audio_path,
    }


async def text_to_speech(text: str, voice: str = "zh-CN-XiaoxiaoNeural",
                          prefix: str = "tts") -> Optional[str]:
    """
    使用 edge-tts 进行语音合成

    参数:
        text: 要朗读的文本
        voice: 发音人
               zh-CN-XiaoxiaoNeural - 晓晓（女，自然）
               zh-CN-YunxiNeural - 云希（男）
               zh-CN-XiaoyiNeural - 晓伊（女）

    返回: 音频文件路径
    """
    try:
        import edge_tts

        output_path = os.path.join(TEMP_DIR, f"{prefix}_audio.mp3")

        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)

        return output_path
    except ImportError:
        print("edge-tts 未安装，请执行: pip install edge-tts")
        return None
    except Exception as e:
        print(f"TTS 出错: {e}")
        return None


def batch_generate_from_word_pack(pack_path: str, count: int = 10) -> List[Dict]:
    """
    从词库文件批量生成视频

    参数:
        pack_path: 词库 JSON 文件路径
        count: 生成数量

    返回: 生成结果列表
    """
    import asyncio

    with open(pack_path, "r", encoding="utf-8") as f:
        word_pack = json.load(f)

    words = word_pack.get("words", word_pack.get("data", []))
    selected = random.sample(words, min(count, len(words)))

    results = []
    for word_data in selected:
        result = asyncio.run(generate_word_video(
            word=word_data.get("word", ""),
            meaning=word_data.get("meaning", ""),
            memory_trick=word_data.get("memory_trick", word_data.get("note")),
            example=word_data.get("example"),
            theme="english",
        ))
        results.append(result)

    return results


if __name__ == "__main__":
    print("🎬 抖音短视频生成工具")
    print("=" * 40)
    print(f"输出目录: {OUTPUT_DIR}")
    print()
    print("使用示例:")
    print("  from services.video_generator import generate_word_video")
    print("  import asyncio")
    print("  result = asyncio.run(generate_word_video(")
    print('      word="apple",')
    print('      meaning="苹果",')
    print('      memory_trick="a(一个)+pp(片)+le(了)→一片苹果",')
    print("  ))")
    print(f"  print(result)")
