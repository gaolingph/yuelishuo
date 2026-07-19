"""Context builder — assembles user learning data into structured context for AI prompts.

Fetches from the database: user info, learning stats, capability scores,
wrong words, pack progress, vocab test history, and achievement data.
"""

from datetime import datetime, date
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from models import (
    User, LearningRecord, WrongRecord, CapabilityRecord,
    UserPackProgress, VocabTestRecord, Checkin, UserAchievement,
    Pet, ParentStudent,
)

# ──────────────────────────────────────────────────────────────────────
#  Core context data structure
# ──────────────────────────────────────────────────────────────────────


class UserLearningContext:
    """Holds all relearned user data for AI prompt injection."""

    def __init__(self, user: User, db: Session):
        self.user = user
        self.db = db

        # Stats
        self.total_learned: int = 0
        self.total_mastered: int = 0
        self.today_learned: int = 0
        self.streak_days: int = 0
        self.to_review: int = 0
        self.accuracy: float = 0.0

        # Capabilities
        self.capabilities: dict[str, float] = {}

        # Wrong words (recent)
        self.recent_wrong: list[dict] = []

        # Progress
        self.current_level: str = ""
        self.pack_progress: list[dict] = []

        # Vocab test
        self.latest_vocab_test: Optional[dict] = None

        # Achievements
        self.achievements: list[str] = []

        # Pet (gamification)
        self.pet: Optional[dict] = None

        # Parent context
        self.linked_children: list[dict] = []

        self._collect()

    def _collect(self):
        """Collect all user data from the database."""
        self._collect_stats()
        self._collect_capabilities()
        self._collect_wrong_words()
        self._collect_pack_progress()
        self._collect_vocab_test()
        self._collect_achievements()
        self._collect_pet()

    # ── Stats ────────────────────────────────────────────────────────
    def _collect_stats(self):
        user_id = self.user.id

        # Total learned (distinct words studied)
        self.total_learned = (
            self.db.query(func.count(LearningRecord.id.distinct()))
            .filter(LearningRecord.user_id == user_id)
            .scalar() or 0
        )

        # Total mastered
        self.total_mastered = (
            self.db.query(func.count(LearningRecord.id))
            .filter(LearningRecord.user_id == user_id, LearningRecord.is_mastered.is_(True))
            .scalar() or 0
        )

        # Today learned
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        self.today_learned = (
            self.db.query(func.count(LearningRecord.id))
            .filter(
                LearningRecord.user_id == user_id,
                LearningRecord.created_at >= today_start,
            )
            .scalar() or 0
        )

        # Streak days
        self.streak_days = self._compute_streak(user_id)

        # To review (words where next_review <= now and not mastered)
        now = datetime.utcnow()
        self.to_review = (
            self.db.query(func.count(LearningRecord.id))
            .filter(
                LearningRecord.user_id == user_id,
                LearningRecord.is_mastered.is_(False),
                LearningRecord.next_review <= now,
            )
            .scalar() or 0
        )

        # Accuracy (from learning records' last_quality)
        records = (
            self.db.query(LearningRecord.last_quality)
            .filter(LearningRecord.user_id == user_id)
            .all()
        )
        if records:
            total = len(records)
            # quality >= 3 counts as correct
            correct = sum(1 for r in records if r.last_quality >= 3)
            self.accuracy = round(correct / total * 100, 1)

    def _compute_streak(self, user_id: int) -> int:
        """Compute consecutive check-in days up to today."""
        checkins = (
            self.db.query(Checkin.checkin_date)
            .filter(Checkin.user_id == user_id)
            .order_by(Checkin.checkin_date.desc())
            .all()
        )
        if not checkins:
            return 0

        checkin_dates = {c.checkin_date for c in checkins}
        streak = 0
        today = date.today()
        for i in range(365):
            day = today.isoformat() if i == 0 else (today.isoformat())
            from datetime import timedelta
            check_date = today - timedelta(days=i)
            if check_date in checkin_dates:
                streak += 1
            else:
                break
        return streak

    # ── Capabilities (6 dimensions) ──────────────────────────────────
    def _collect_capabilities(self):
        records = (
            self.db.query(CapabilityRecord)
            .filter(CapabilityRecord.user_id == self.user.id)
            .all()
        )
        for r in records:
            self.capabilities[r.dimension] = round(r.score, 1)

        # Ensure all 6 dimensions exist
        dims = ["listening", "discrimination", "writing", "reading", "speaking", "usage"]
        for d in dims:
            if d not in self.capabilities:
                self.capabilities[d] = 0.0

    # ── Wrong words ──────────────────────────────────────────────────
    def _collect_wrong_words(self):
        import json

        records = (
            self.db.query(WrongRecord)
            .filter(WrongRecord.user_id == self.user.id)
            .order_by(WrongRecord.last_wrong_at.desc())
            .limit(10)
            .all()
        )
        for r in records:
            word = r.word
            self.recent_wrong.append({
                "english": word.english,
                "chinese": word.chinese,
                "practice_type": r.practice_type,
                "wrong_count": r.wrong_count,
            })

    # ── Pack progress ────────────────────────────────────────────────
    def _collect_pack_progress(self):
        progress = (
            self.db.query(UserPackProgress)
            .filter(UserPackProgress.user_id == self.user.id)
            .all()
        )
        for p in progress:
            pack = p.pack
            self.pack_progress.append({
                "pack_name": pack.name,
                "level": pack.level,
                "total": p.total_words,
                "learned": p.learned_words,
                "mastered": p.mastered_words,
            })

            # Determine current level (highest pack that has progress)
            if p.learned_words > 0:
                self.current_level = pack.level

        if not self.current_level:
            self.current_level = "未开始"

    # ── Vocab test ───────────────────────────────────────────────────
    def _collect_vocab_test(self):
        latest = (
            self.db.query(VocabTestRecord)
            .filter(VocabTestRecord.user_id == self.user.id)
            .order_by(VocabTestRecord.created_at.desc())
            .first()
        )
        if latest:
            self.latest_vocab_test = {
                "score": latest.score,
                "total": latest.total_questions,
                "level": latest.level,
                "estimated_vocab": latest.estimated_vocab,
            }

    # ── Achievements ─────────────────────────────────────────────────
    def _collect_achievements(self):
        earned = (
            self.db.query(UserAchievement)
            .filter(UserAchievement.user_id == self.user.id)
            .all()
        )
        self.achievements = [a.achievement_name for a in earned]

    # ── Pet ──────────────────────────────────────────────────────────
    def _collect_pet(self):
        pet = self.db.query(Pet).filter(Pet.user_id == self.user.id).first()
        if pet:
            self.pet = {
                "name": pet.name,
                "level": pet.level,
                "food": pet.food,
            }

    # ── Serialisation ────────────────────────────────────────────────
    def to_dict(self) -> dict:
        """Flat dictionary for prompt injection."""
        return {
            "nickname": self.user.nickname or self.user.username,
            "role": self.user.role,
            "level": self.current_level,
            "total_learned": self.total_learned,
            "total_mastered": self.total_mastered,
            "today_learned": self.today_learned,
            "streak_days": self.streak_days,
            "to_review": self.to_review,
            "accuracy": self.accuracy,
            "capabilities_text": self._format_capabilities(),
            "recent_wrong_text": self._format_wrong_words(),
            "student_count": 360,  # placeholder — could be dynamic
        }

    def _format_capabilities(self) -> str:
        dim_names = {
            "listening": "听力",
            "discrimination": "辨析",
            "writing": "拼写",
            "reading": "阅读",
            "speaking": "口语",
            "usage": "运用",
        }
        parts = []
        for key, label in dim_names.items():
            score = self.capabilities.get(key, 0)
            parts.append(f"{label}: {score}分")
        return "；".join(parts)

    def _format_wrong_words(self) -> str:
        if not self.recent_wrong:
            return "暂无错误记录"
        return "、".join(
            f"{w['english']}({w['chinese']})——{w['practice_type']}题型"
            for w in self.recent_wrong[:5]
        )


# ──────────────────────────────────────────────────────────────────────
#  Convenience functions
# ──────────────────────────────────────────────────────────────────────


def build_context(user: User, db: Session) -> UserLearningContext:
    """Build full learning context for a user."""
    return UserLearningContext(user, db)


def build_context_dict(user: User, db: Session) -> dict:
    """Build context and return as flat dict (convenience for prompt filling)."""
    return UserLearningContext(user, db).to_dict()


def get_student_count(db: Session) -> int:
    """Get total number of student accounts."""
    return db.query(func.count(User.id)).filter(User.role == "student").scalar() or 0
