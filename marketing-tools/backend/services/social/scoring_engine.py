"""
线索评分引擎

对采集到的社交媒体内容进行自动评分，
判断是否值得转为正式线索 (Lead)。

评分维度（每项 0-25 分，总分 0-100）:
    1. 关键词匹配度 — 内容命中咨询行业核心关键词的数量和密度
    2. 意图强度 — "求推荐""哪家好""多少钱"等购买意图信号
    3. 决策角色 — "我家孩子""家长"等身份关键词
    4. 联系方式可用性 — 是否公开了微信/电话/私信入口

配置:
    SCORE_THRESHOLD: 自动转为线索的阈值（默认 60）
"""
import re
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# ─── 评分关键词库（咨询行业，可扩展）───

# 行业核心关键词（命中越多分越高）
INDUSTRY_KEYWORDS = [
    "咨询", "培训", "辅导", "教育", "补习", "课程", "学习",
    "留学", "英语", "数学", "编程", "美术", "音乐", "舞蹈",
    "升学", "中高考", "考研", "考证", "技能", "兴趣班",
]

# 购买意图信号
INTENT_SIGNALS = [
    "求推荐", "推荐一下", "哪家好", "怎么样", "靠谱吗",
    "多少钱", "价格", "收费", "费用", "贵不贵",
    "怎么样", "好不好", "有效果吗", "值得吗",
    "有没有", "哪里有", "怎么选", "怎么报名",
    "想给孩子", "想给娃", "想找", "想学",
]

# 决策角色关键词
DECISION_ROLE_KEYWORDS = [
    "我家孩子", "我家娃", "孩子", "娃", "儿子", "女儿",
    "小朋友", "宝宝", "学生", "家长", "父母",
    "我弟弟", "我妹妹", "亲戚家",
]

# 联系方式线索
CONTACT_PATTERNS = [
    r"微信[：:]?\s*[\w_-]+",
    r"手机[：:]?\s*\d{11}",
    r"电话[：:]?\s*\d{3,4}-?\d{7,8}",
    r"私信", r"私聊", r"私我", r"加我",
    r"V[：:]?\s*[\w]+",
    r"qq[：:]?\s*\d{5,12}",
]


class ScoringEngine:
    """线索评分引擎"""

    # 默认评分阈值
    DEFAULT_THRESHOLD = 60

    def __init__(self, threshold: int = None):
        self.threshold = threshold or self.DEFAULT_THRESHOLD

    def score_post(self, content: str, title: str = "") -> dict:
        """
        对帖子内容进行综合评分

        参数:
            content: 帖子正文
            title: 帖子标题

        返回:
            {
                "total_score": int,         # 总分 0-100
                "keyword_score": int,        # 关键词匹配度
                "intent_score": int,         # 意图强度
                "role_score": int,           # 决策角色
                "contact_score": int,        # 联系方式
                "should_convert": bool,      # 是否达到转换阈值
                "matched_keywords": [...],   # 命中的关键词
                "matched_intents": [...],    # 命中的意图信号
                "matched_roles": [...],      # 命中的角色词
                "matched_contacts": [...],   # 发现的联系方式
            }
        """
        text = f"{title} {content}".lower()

        # 各维度评分
        keyword_score = self._score_keywords(text)
        intent_score = self._score_intent(text)
        role_score = self._score_role(text)
        contact_score = self._score_contact(text)

        total = keyword_score + intent_score + role_score + contact_score

        return {
            "total_score": total,
            "keyword_score": keyword_score,
            "intent_score": intent_score,
            "role_score": role_score,
            "contact_score": contact_score,
            "should_convert": total >= self.threshold,
            "matched_keywords": self._find_matches(text, INDUSTRY_KEYWORDS),
            "matched_intents": self._find_matches(text, INTENT_SIGNALS),
            "matched_roles": self._find_matches(text, DECISION_ROLE_KEYWORDS),
            "matched_contacts": self._find_contacts(content),
        }

    def _score_keywords(self, text: str) -> int:
        """关键词匹配度评分 (0-25)"""
        matches = sum(1 for kw in INDUSTRY_KEYWORDS if kw in text)
        if matches >= 5:
            return 25
        elif matches >= 3:
            return 20
        elif matches >= 2:
            return 15
        elif matches >= 1:
            return 10
        return 0

    def _score_intent(self, text: str) -> int:
        """意图强度评分 (0-25)"""
        matches = sum(1 for signal in INTENT_SIGNALS if signal in text)
        if matches >= 3:
            return 25
        elif matches >= 2:
            return 20
        elif matches >= 1:
            return 15
        return 0

    def _score_role(self, text: str) -> int:
        """决策角色评分 (0-25)"""
        matches = sum(1 for role in DECISION_ROLE_KEYWORDS if role in text)
        if matches >= 2:
            return 25
        elif matches >= 1:
            return 20
        return 0

    def _score_contact(self, text: str) -> int:
        """联系方式可用性评分 (0-25)"""
        contacts = self._find_contacts(text)
        if len(contacts) >= 2:
            return 25
        elif len(contacts) >= 1:
            return 15
        return 0

    def _find_matches(self, text: str, keywords: List[str]) -> List[str]:
        """找出文本中命中的关键词"""
        return [kw for kw in keywords if kw in text]

    def _find_contacts(self, text: str) -> List[str]:
        """找出文本中的联系方式"""
        matched = []
        for pattern in CONTACT_PATTERNS:
            found = re.findall(pattern, text, re.IGNORECASE)
            matched.extend(found)
        return matched


# 便捷函数
def score_post(content: str, title: str = "", threshold: int = None) -> dict:
    """对单条帖子内容评分"""
    engine = ScoringEngine(threshold)
    return engine.score_post(content, title)


def batch_score(posts: List[dict]) -> List[dict]:
    """
    批量评分并筛选可转换的帖子

    输入: [{"title": ..., "content": ..., ...}, ...]
    返回: 原列表每项增加 score 字段
    """
    engine = ScoringEngine()
    for post in posts:
        score_result = engine.score_post(
            content=post.get("content", ""),
            title=post.get("title", ""),
        )
        post["score"] = score_result
    return posts
