from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, date
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    nickname = Column(String(50), default="")
    avatar = Column(String(200), default="")
    phone = Column(String(20), unique=True, index=True, nullable=True)
    role = Column(String(20), default="student")  # group_admin | campus_admin | coach | student | parent
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pack_progress = relationship("UserPackProgress", back_populates="user", cascade="all, delete-orphan")
    learning_records = relationship("LearningRecord", back_populates="user", cascade="all, delete-orphan")
    checkins = relationship("Checkin", back_populates="user", cascade="all, delete-orphan")
    achievements = relationship("UserAchievement", back_populates="user", cascade="all, delete-orphan")
    wrong_records = relationship("WrongRecord", back_populates="user", cascade="all, delete-orphan")


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    contact_info = Column(String(200), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    campuses = relationship("Campus", back_populates="group", cascade="all, delete-orphan")


class Campus(Base):
    __tablename__ = "campuses"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    name = Column(String(100), nullable=False)
    address = Column(String(200), default="")
    contact_info = Column(String(200), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="campuses")


class ParentStudent(Base):
    __tablename__ = "parent_students"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    relationship = Column(String(50), default="")  # 父亲/母亲/监护人等
    created_at = Column(DateTime, default=datetime.utcnow)


class WordPack(Base):
    __tablename__ = "word_packs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    level = Column(String(50), nullable=False)  # e.g. "小学", "初中", "高中"
    pack_type = Column(String(20), nullable=False)  # "basic" or "advanced"
    description = Column(String(500), default="")
    word_count = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    is_free = Column(Boolean, default=True)

    words = relationship("Word", back_populates="pack", cascade="all, delete-orphan")
    user_progress = relationship("UserPackProgress", back_populates="pack", cascade="all, delete-orphan")


class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True)
    pack_id = Column(Integer, ForeignKey("word_packs.id"), nullable=False)
    english = Column(String(100), nullable=False, index=True)
    chinese = Column(String(200), nullable=False)
    phonetic = Column(String(100), default="")
    example_en = Column(String(500), default="")
    example_cn = Column(String(500), default="")
    sort_order = Column(Integer, default=0)

    pack = relationship("WordPack", back_populates="words")
    learning_records = relationship("LearningRecord", back_populates="word", cascade="all, delete-orphan")
    wrong_records = relationship("WrongRecord", back_populates="word", cascade="all, delete-orphan")


class UserPackProgress(Base):
    __tablename__ = "user_pack_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pack_id = Column(Integer, ForeignKey("word_packs.id"), nullable=False)
    is_unlocked = Column(Boolean, default=False)
    total_words = Column(Integer, default=0)
    learned_words = Column(Integer, default=0)
    mastered_words = Column(Integer, default=0)
    last_study_date = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="pack_progress")
    pack = relationship("WordPack", back_populates="user_progress")


class LearningRecord(Base):
    __tablename__ = "learning_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    ease_factor = Column(Float, default=2.5)  # SM-2 ease factor
    interval = Column(Integer, default=0)  # days
    repetitions = Column(Integer, default=0)
    next_review = Column(DateTime, nullable=True)
    last_quality = Column(Integer, default=0)  # 0-5 score
    is_mastered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="learning_records")
    word = relationship("Word", back_populates="learning_records")


class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    checkin_date = Column(Date, nullable=False, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="checkins")


class Achievement(Base):
    """Master achievement definitions table."""
    __tablename__ = "achievements"

    id = Column(String(50), primary_key=True)  # e.g. "first_study"
    name = Column(String(100), nullable=False)
    description = Column(String(200), default="")
    icon = Column(String(20), default="🏆")
    condition_type = Column(String(50), nullable=False)
    condition_value = Column(Integer, default=0)


class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    achievement_key = Column(String(50), nullable=False)
    achievement_name = Column(String(100), nullable=False)
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="achievements")


class CapabilityRecord(Base):
    """六维能力追踪：听、辨、写、读、说、用"""
    __tablename__ = "capability_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dimension = Column(String(20), nullable=False)  # listening, discrimination, writing, reading, speaking, usage
    total_attempts = Column(Integer, default=0)
    correct_attempts = Column(Integer, default=0)
    score = Column(Float, default=0.0)  # 0-100 percentage
    last_practice_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="capability_records")


class WrongRecord(Base):
    __tablename__ = "wrong_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    practice_type = Column(String(20), nullable=False)  # "choice", "spelling", "listening", "chinese_to_english", "speaking"
    wrong_count = Column(Integer, default=1)
    last_wrong_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="wrong_records")
    word = relationship("Word", back_populates="wrong_records")


class PKRecord(Base):
    __tablename__ = "pk_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    opponent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    score = Column(Integer, default=0)
    opponent_score = Column(Integer, default=0)
    is_win = Column(Boolean, nullable=True)
    played_at = Column(DateTime, default=datetime.utcnow)


class Pet(Base):
    """Student's virtual pet for gamification."""
    __tablename__ = "pets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(50), default="小乐")
    level = Column(Integer, default=1)
    exp = Column(Integer, default=0)
    food = Column(Integer, default=5)
    last_fed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Story(Base):
    """Graded reading story for story adventure mode."""
    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(10), nullable=False, index=True)  # "L1", "L2", "L3"
    title = Column(String(200), nullable=False)
    text = Column(String(5000), nullable=False)
    vocabulary = Column(JSON, default=list)  # list of {word, chinese, phonetic}
    question = Column(JSON, nullable=True)  # {question, options: [], correct_index: int}
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserStoryProgress(Base):
    """Tracks which stories a user has completed."""
    __tablename__ = "user_story_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    story_id = Column(Integer, ForeignKey("stories.id"), nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)
    stars_earned = Column(Integer, default=0)


class ReadingPassage(Base):
    """Reading passages generated based on learned vocabulary."""
    __tablename__ = "reading_passages"

    id = Column(Integer, primary_key=True, index=True)
    pack_id = Column(Integer, ForeignKey("word_packs.id"), nullable=False, index=True)
    level = Column(String(10), nullable=False, index=True)  # "basic", "advanced"
    title = Column(String(200), nullable=False)
    text = Column(String(5000), nullable=False)
    vocabulary = Column(JSON, default=list)  # list of {word, chinese, phonetic}
    questions = Column(JSON, default=list)   # list of {question, options: [], correct_index: int}
    word_count = Column(Integer, default=0)   # how many target vocab words in this passage
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    pack = relationship("WordPack", backref="reading_passages")


class UserReadingProgress(Base):
    """Tracks which passages a user has read and quiz results."""
    __tablename__ = "user_reading_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    passage_id = Column(Integer, ForeignKey("reading_passages.id"), nullable=False)
    is_completed = Column(Boolean, default=False)
    questions_correct = Column(Integer, default=0)
    questions_total = Column(Integer, default=0)
    score = Column(Integer, default=0)  # percentage score 0-100
    read_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", backref="reading_progress")
    passage = relationship("ReadingPassage", backref="user_progress")


class VocabTestRecord(Base):
    """Records vocabulary assessment test results."""
    __tablename__ = "vocab_test_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Integer, nullable=False)  # correct count (0-15)
    total_questions = Column(Integer, default=15)
    level = Column(String(20), nullable=False)  # beginner, elementary, intermediate, advanced, proficient
    estimated_vocab = Column(Integer, default=0)
    details = Column(JSON, default=dict)  # per-question breakdown
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="vocab_test_records")


class MemoryScan(Base):
    """记忆扫描结果 — 自动将pack中的单词分为三区：绿(已掌握)/黄(模糊)/红(不会)
    
    基于 learning_records (SM-2) 和 wrong_records 自动归类。
    """
    __tablename__ = "memory_scans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pack_id = Column(Integer, ForeignKey("word_packs.id"), nullable=False)
    total_words = Column(Integer, default=0)
    zone_green = Column(JSON, default=list)   # [word_id, ...] 已掌握
    zone_yellow = Column(JSON, default=list)  # [word_id, ...] 模糊
    zone_red = Column(JSON, default=list)     # [word_id, ...] 不会
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="memory_scans")
    pack = relationship("WordPack", backref="memory_scans")
