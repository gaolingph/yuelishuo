from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


# Auth
class UserRegister(BaseModel):
    username: str
    password: str
    nickname: Optional[str] = ""
    phone: Optional[str] = None


class UserLogin(BaseModel):
    username: str  # 用户名或手机号
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    nickname: str
    avatar: str
    phone: Optional[str] = None
    role: str = "student"
    group_id: Optional[int] = None
    campus_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Word Packs
class WordPackResponse(BaseModel):
    id: int
    name: str
    level: str
    pack_type: str
    description: str
    word_count: int
    sort_order: int
    is_free: bool
    is_unlocked: bool = False
    progress: Optional[dict] = None

    class Config:
        from_attributes = True


class WordResponse(BaseModel):
    id: int
    pack_id: int
    english: str
    chinese: str
    phonetic: str
    example_en: str
    example_cn: str

    class Config:
        from_attributes = True


# Learning
class StudyAction(BaseModel):
    word_id: int
    action: str = "study"  # "study" or "review"


class ReviewAction(BaseModel):
    word_id: int
    quality: int  # 0-5 SM-2 quality score


class BatchStudyAction(BaseModel):
    word_ids: List[int]


class LearningRecordResponse(BaseModel):
    id: int
    word: WordResponse
    ease_factor: float
    interval: int
    repetitions: int
    next_review: Optional[datetime]
    last_quality: int
    is_mastered: bool

    class Config:
        from_attributes = True


# Practice
class ChoiceQuestion(BaseModel):
    id: int
    word_id: int
    english: str
    options: List[str]
    correct_index: int


class PracticeAnswer(BaseModel):
    word_id: int
    practice_type: str
    answer: str
    is_correct: bool


class SpellingQuestion(BaseModel):
    id: int
    word_id: int
    chinese: str
    phonetic: str
    word_length: int


class ListeningQuestion(BaseModel):
    id: int
    word_id: int
    english: str
    options: List[str]
    correct_index: int


class SpeakingQuestion(BaseModel):
    id: int
    word_id: int
    english: str
    chinese: str
    phonetic: str


class UsageQuestion(BaseModel):
    id: int
    word_id: int
    english: str
    chinese: str
    phonetic: str
    example_sentence: str  # 参考例句


# Stats
class StatsOverview(BaseModel):
    total_learned: int = 0
    total_mastered: int = 0
    total_review: int = 0
    today_learned: int = 0
    today_review: int = 0
    streak_days: int = 0
    total_days: int = 0
    pack_count: int = 0
    accuracy: float = 0.0


class DayStats(BaseModel):
    date: str
    count: int


class WrongWordResponse(BaseModel):
    id: int
    word: WordResponse
    wrong_count: int
    practice_type: str
    last_wrong_at: datetime

    class Config:
        from_attributes = True


# PK
class PKStart(BaseModel):
    pack_id: int


class PKAnswer(BaseModel):
    pk_id: int
    word_id: int
    answer: str
    time_spent: float


# Achievement
class AchievementResponse(BaseModel):
    key: str
    name: str
    earned_at: Optional[datetime] = None
    is_earned: bool = False

    class Config:
        from_attributes = True


# Profile
class ProfileUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar: Optional[str] = None


class DashboardResponse(BaseModel):
    stats: StatsOverview
    today_review_words: List[WordResponse] = []
    achievements: List[AchievementResponse] = []
    recent_wrong: List[WrongWordResponse] = []


# ==================== Admin ====================
class GroupCreate(BaseModel):
    name: str
    contact_info: Optional[str] = ""


class GroupResponse(BaseModel):
    id: int
    name: str
    contact_info: str
    created_at: datetime
    campus_count: int = 0

    class Config:
        from_attributes = True


class CampusCreate(BaseModel):
    group_id: int
    name: str
    address: Optional[str] = ""
    contact_info: Optional[str] = ""


class CampusResponse(BaseModel):
    id: int
    group_id: int
    name: str
    address: str
    contact_info: str
    created_at: datetime
    student_count: int = 0

    class Config:
        from_attributes = True


class AdminUserCreate(BaseModel):
    username: str
    password: str
    nickname: Optional[str] = ""
    phone: Optional[str] = None
    role: str = "student"  # group_admin | campus_admin | coach | student | parent
    group_id: Optional[int] = None
    campus_id: Optional[int] = None


class AdminUserUpdate(BaseModel):
    nickname: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    group_id: Optional[int] = None
    campus_id: Optional[int] = None
    password: Optional[str] = None


class ParentStudentCreate(BaseModel):
    parent_id: int
    student_id: int
    relationship: Optional[str] = ""


class ParentStudentResponse(BaseModel):
    id: int
    parent_id: int
    student_id: int
    relationship: str
    created_at: datetime
    student_name: str = ""
    parent_name: str = ""

    class Config:
        from_attributes = True


# ==================== Parent ====================
class ChildStatsResponse(BaseModel):
    user_id: int
    username: str
    nickname: str
    total_learned: int = 0
    total_mastered: int = 0
    to_review: int = 0
    today_learned: int = 0
    today_review: int = 0
    streak_days: int = 0
    total_days: int = 0
    accuracy: float = 0.0


# ==================== Game / Gamification ====================

class PetResponse(BaseModel):
    id: int
    user_id: int
    name: str
    level: int
    exp: int
    food: int
    last_fed: Optional[datetime] = None
    exp_to_next: int = 0

    class Config:
        from_attributes = True


class FeedPetResponse(BaseModel):
    pet: PetResponse
    message: str
    leveled_up: bool = False


class EarnFoodResponse(BaseModel):
    food_earned: int
    total_food: int
    message: str


class StoryResponse(BaseModel):
    id: int
    level: str
    title: str
    text: str
    vocabulary: list
    question: Optional[dict] = None
    completed: bool = False
    stars_earned: int = 0

    class Config:
        from_attributes = True


class StoryListResponse(BaseModel):
    id: int
    level: str
    title: str
    completed: bool = False
    stars_earned: int = 0


class CompleteStoryResponse(BaseModel):
    story_id: int
    correct: bool
    stars_earned: int
    words_added: int
    message: str


class BattleWordResponse(BaseModel):
    word_id: int
    english: str
    options: List[str]
    correct_index: int


class BattleResultSubmit(BaseModel):
    score: int
    total_questions: int
    correct_answers: int
    max_combo: int


class BattleResultResponse(BaseModel):
    stars_earned: int
    food_earned: int
    message: str


class DailyReportResponse(BaseModel):
    date: str
    nickname: str
    total_learned: int
    today_learned: int
    today_reviewed: int
    mastered: int
    to_review: int
    streak_days: int
    accuracy: float
    practice_count: int
    report_text: str
    # Reading stats
    reading_passages_completed: int = 0
    reading_average_score: float = 0.0
    reading_words_covered: int = 0


# ==================== Admin Story CRUD ====================
class StoryCreate(BaseModel):
    level: str
    title: str
    text: str
    vocabulary: list = []
    question: Optional[dict] = None
    sort_order: int = 0


class StoryUpdate(BaseModel):
    level: Optional[str] = None
    title: Optional[str] = None
    text: Optional[str] = None
    vocabulary: Optional[list] = None
    question: Optional[dict] = None
    sort_order: Optional[int] = None


class StoryAdminResponse(BaseModel):
    id: int
    level: str
    title: str
    text: str
    vocabulary: list
    question: Optional[dict] = None
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== AI Reading Generation ====================
class ReadingGenerateRequest(BaseModel):
    """Request to AI-generate a reading passage based on target vocabulary."""
    word_ids: List[int]
    pack_id: int


class ReadingGenerateResponse(BaseModel):
    """AI-generated reading passage with vocabulary and comprehension questions."""
    id: int  # passage ID in the database
    title: str
    text: str
    vocabulary: List[dict]
    questions: List[dict]
    word_count: int
    pack_id: int
    level: str
    is_generated: bool = True


# ==================== Reading ====================
class ReadingPassageResponse(BaseModel):
    id: int
    pack_id: int
    level: str
    title: str
    text: str
    vocabulary: list
    questions: list
    word_count: int
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReadingPassageListItem(BaseModel):
    id: int
    pack_id: int
    level: str
    title: str
    word_count: int
    progress: Optional[dict] = None  # {is_completed, score, questions_correct, questions_total}

    class Config:
        from_attributes = True


class ReadingCompleteRequest(BaseModel):
    passage_id: int
    answers: List[int]  # list of selected answer indices, one per question


class ReadingCompleteResponse(BaseModel):
    passage_id: int
    is_completed: bool
    correct_count: int
    total_questions: int
    score: int
    message: str


class ReadingProgressResponse(BaseModel):
    total_passages: int = 0
    completed_passages: int = 0
    average_score: float = 0.0
    total_words_covered: int = 0
    passages: List[ReadingPassageListItem] = []


# ==================== Game Stats ====================
class GameStatsResponse(BaseModel):
    pet_level: int
    pet_name: str
    pet_food: int
    pet_exp: int
    stories_completed: int
    total_stars: int
    battles_fought: int
    total_learned: int
    streak_days: int
    today_learned: int


# ==================== Memory Scan (智牛复刻: 单词三区分类) ====================
class MemoryScanWordItem(BaseModel):
    """单个单词在记忆扫描中的分类结果."""
    word_id: int
    english: str
    chinese: str
    phonetic: str = ""
    zone: str  # "green" | "yellow" | "red"


class MemoryScanResultResponse(BaseModel):
    """记忆扫描结果 — 单词地图(绿/黄/红三区)."""
    id: int
    pack_id: int
    pack_name: str = ""
    total_words: int
    green_count: int = 0
    yellow_count: int = 0
    red_count: int = 0
    green_words: List[MemoryScanWordItem] = []
    yellow_words: List[MemoryScanWordItem] = []
    red_words: List[MemoryScanWordItem] = []
    scan_date: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== Garden ====================
class GardenPlantResponse(BaseModel):
    word_id: int
    english: str
    chinese: str
    phonetic: str = ""
    pack_id: int
    pack_name: str
    stage: int  # 0=seed, 1=sprout, 2=growing, 3=flowering, 4=bloomed
    plant_type: str  # flower/plant emoji
    x: int
    y: int
    interval: int = 0
    repetitions: int = 0
    is_mastered: bool = False
    last_reviewed: Optional[datetime] = None
    created_at: Optional[datetime] = None


class GardenSummaryResponse(BaseModel):
    total_plants: int
    seed_count: int
    sprout_count: int
    growing_count: int
    flowering_count: int
    bloomed_count: int
    mastery_rate: float  # percentage 0-100


class GardenPackInfo(BaseModel):
    pack_id: int
    pack_name: str
    count: int


class GardenResponse(BaseModel):
    summary: GardenSummaryResponse
    plants: List[GardenPlantResponse]
    packs: List[GardenPackInfo]
