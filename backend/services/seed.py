import json
import os
from typing import List
from sqlalchemy.orm import Session

from models import WordPack, Word, Achievement, Story, ReadingPassage

PACKS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "word_packs")

WORD_PACK_DEFINITIONS = [
    # ── 外研社小学 ─────────────────────────────────────
    {
        "id": 12,
        "name": "外研3起基础",
        "description": "外研社新版3年级起点 3-4年级词汇",
        "level": "primary_waiyan_basic",
        "icon": "🌟",
        "order": 1,
        "filename": "primary_waiyan_basic.json",
    },
    {
        "id": 13,
        "name": "外研3起进阶",
        "description": "外研社新版3年级起点 5-6年级词汇",
        "level": "primary_waiyan_advanced",
        "icon": "💫",
        "order": 2,
        "filename": "primary_waiyan_advanced.json",
    },
    # ── 外研社初中 ─────────────────────────────────────
    {
        "id": 14,
        "name": "外研初中基础",
        "description": "外研社新标准初中英语 7年级（初一）词汇",
        "level": "junior_waiyan_basic",
        "icon": "📖",
        "order": 3,
        "filename": "junior_waiyan_basic.json",
    },
    {
        "id": 15,
        "name": "外研初中进阶",
        "description": "外研社新标准初中英语 8-9年级（初二初三）词汇",
        "level": "junior_waiyan_advanced",
        "icon": "📗",
        "order": 4,
        "filename": "junior_waiyan_advanced.json",
    },
    # ── 外研社高中 ─────────────────────────────────────
    {
        "id": 16,
        "name": "外研高中基础",
        "description": "外研社新标准高中英语 必修（高一高二）词汇",
        "level": "senior_waiyan_basic",
        "icon": "📘",
        "order": 5,
        "filename": "senior_waiyan_basic.json",
    },
    {
        "id": 17,
        "name": "外研高中进阶",
        "description": "外研社新标准高中英语 选修+高考（高三）词汇",
        "level": "senior_waiyan_advanced",
        "icon": "📙",
        "order": 6,
        "filename": "senior_waiyan_advanced.json",
    },
]

ACHIEVEMENT_DEFINITIONS = [
    {
        "id": "first_study",
        "name": "初次学习",
        "description": "完成第一次学习",
        "icon": "🌟",
        "condition_type": "first_study",
        "condition_value": 1,
    },
    {
        "id": "study_7_days",
        "name": "坚持7天",
        "description": "连续学习7天",
        "icon": "🔥",
        "condition_type": "streak",
        "condition_value": 7,
    },
    {
        "id": "study_30_days",
        "name": "坚持30天",
        "description": "连续学习30天",
        "icon": "💪",
        "condition_type": "streak",
        "condition_value": 30,
    },
    {
        "id": "learn_100",
        "name": "百词新人",
        "description": "累计学习100个单词",
        "icon": "📖",
        "condition_type": "learn_count",
        "condition_value": 100,
    },
    {
        "id": "learn_500",
        "name": "词汇达人",
        "description": "累计学习500个单词",
        "icon": "📚",
        "condition_type": "learn_count",
        "condition_value": 500,
    },
    {
        "id": "learn_1000",
        "name": "词汇大师",
        "description": "累计学习1000个单词",
        "icon": "🏆",
        "condition_type": "learn_count",
        "condition_value": 1000,
    },
    {
        "id": "master_50",
        "name": "初露锋芒",
        "description": "掌握50个单词",
        "icon": "⭐",
        "condition_type": "master_count",
        "condition_value": 50,
    },
    {
        "id": "master_200",
        "name": "炉火纯青",
        "description": "掌握200个单词",
        "icon": "🌈",
        "condition_type": "master_count",
        "condition_value": 200,
    },
    {
        "id": "review_100",
        "name": "复习达人",
        "description": "累计复习100次",
        "icon": "🔄",
        "condition_type": "review_count",
        "condition_value": 100,
    },
    {
        "id": "perfect_pk",
        "name": "PK冠军",
        "description": "赢得一次PK对战",
        "icon": "⚔️",
        "condition_type": "pk_win",
        "condition_value": 1,
    },
    {
        "id": "first_checkin",
        "name": "初次签到",
        "description": "完成第一次签到",
        "icon": "✅",
        "condition_type": "checkin_count",
        "condition_value": 1,
    },
    {
        "id": "no_wrong",
        "name": "完美无错",
        "description": "连续10个词回答正确",
        "icon": "💎",
        "condition_type": "perfect_streak",
        "condition_value": 10,
    },
]


def load_words_from_json(filename: str) -> List[dict]:
    filepath = os.path.join(PACKS_DIR, filename)
    if not os.path.exists(filepath):
        print(f"  Warning: {filepath} not found, skipping.")
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


def seed_word_packs(db: Session):
    """Seed word packs and words into database — per-pack idempotent."""
    seeded_count = 0
    for pack_def in WORD_PACK_DEFINITIONS:
        existing = db.query(WordPack).filter(WordPack.id == pack_def["id"]).first()
        if existing:
            print(f"  Pack '{pack_def['name']}' already exists, skipping.")
            continue

        words_data = load_words_from_json(pack_def["filename"])
        if not words_data:
            print(f"  Skipping pack '{pack_def['name']}' — no words loaded.")
            continue

        # Derive pack_type from level — "basic" or "advanced"
        pack_type = "basic" if "basic" in pack_def["level"] else "advanced"

        pack = WordPack(
            id=pack_def["id"],
            name=pack_def["name"],
            description=pack_def["description"],
            level=pack_def["level"],
            pack_type=pack_type,
            sort_order=pack_def["order"],
            word_count=len(words_data),
        )
        db.add(pack)
        db.flush()

        for i, w in enumerate(words_data):
            word = Word(
                pack_id=pack.id,
                english=w["english"],
                chinese=w["chinese"],
                phonetic=w.get("phonetic", ""),
                example_en=w.get("example_en", ""),
                example_cn=w.get("example_cn", ""),
                sort_order=i + 1,
            )
            db.add(word)

        print(f"  Seeded pack '{pack_def['name']}': {len(words_data)} words")
        seeded_count += 1

    db.commit()
    if seeded_count > 0:
        print(f"  Total: {seeded_count} new packs seeded.")
    else:
        print("  All packs already exist.")


def seed_achievements(db: Session):
    """Seed achievement definitions into database."""
    existing = db.query(Achievement).count()
    if existing > 0:
        print(f"  Achievements already exist ({existing}), skipping seed.")
        return

    for ach_def in ACHIEVEMENT_DEFINITIONS:
        achievement = Achievement(
            id=ach_def["id"],
            name=ach_def["name"],
            description=ach_def["description"],
            icon=ach_def["icon"],
            condition_type=ach_def["condition_type"],
            condition_value=ach_def["condition_value"],
        )
        db.add(achievement)

    db.commit()
    print(f"  Seeded {len(ACHIEVEMENT_DEFINITIONS)} achievements.")


STORY_DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "stories.json")


def seed_stories(db: Session):
    """Seed graded reading stories."""
    existing = db.query(Story).count()
    if existing > 0:
        print(f"  Stories already exist ({existing}), skipping seed.")
        return

    if not os.path.exists(STORY_DATA_FILE):
        print(f"  Warning: {STORY_DATA_FILE} not found, skipping story seed.")
        return

    with open(STORY_DATA_FILE, "r", encoding="utf-8") as f:
        stories_data = json.load(f)

    for s in stories_data:
        story = Story(
            id=s["id"],
            level=s["level"],
            title=s["title"],
            text=s["text"],
            vocabulary=s.get("vocabulary", []),
            question=s.get("question"),
            sort_order=s.get("sort_order", 0),
        )
        db.add(story)

    db.commit()
    print(f"  Seeded {len(stories_data)} stories.")


READINGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "readings")


def seed_reading_passages(db: Session):
    """Seed reading passages from JSON files — per-passage idempotent."""
    if not os.path.exists(READINGS_DIR):
        print(f"  Warning: {READINGS_DIR} not found, skipping reading passages seed.")
        return

    json_files = sorted([f for f in os.listdir(READINGS_DIR) if f.endswith(".json")])
    if not json_files:
        print("  No reading passage JSON files found, skipping.")
        return

    total_seeded = 0
    for filename in json_files:
        filepath = os.path.join(READINGS_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            passages = json.load(f)

        for p in passages:
            existing = db.query(ReadingPassage).filter(ReadingPassage.id == p["id"]).first()
            if existing:
                continue

            passage = ReadingPassage(
                id=p["id"],
                pack_id=p["pack_id"],
                level=p["level"],
                title=p["title"],
                text=p["text"],
                vocabulary=p.get("vocabulary", []),
                questions=p.get("questions", []),
                word_count=p.get("word_count", 0),
                sort_order=p.get("sort_order", 0),
            )
            db.add(passage)
            total_seeded += 1

    if total_seeded > 0:
        db.commit()
        print(f"  Seeded {total_seeded} new reading passages from {len(json_files)} file(s).")
    else:
        print("  All reading passages already exist.")


def run_seed(db: Session):
    """Run all seed operations."""
    print("Seeding database...")
    seed_word_packs(db)
    seed_achievements(db)
    seed_stories(db)
    seed_reading_passages(db)
    print("Seeding complete.")
