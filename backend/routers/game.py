from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import List
from datetime import datetime, date, timedelta
import random

from database import get_db
from models import (
    User, Pet, Story, UserStoryProgress, Word, LearningRecord,
    WrongRecord, ParentStudent, Checkin, UserPackProgress, WordPack, PKRecord,
    ReadingPassage, UserReadingProgress
)
from schemas import (
    PetResponse, FeedPetResponse, EarnFoodResponse,
    StoryResponse, StoryListResponse, CompleteStoryResponse,
    BattleWordResponse, BattleResultSubmit, BattleResultResponse,
    DailyReportResponse, GameStatsResponse,
)
from routers.auth import get_current_user, require_role

router = APIRouter(prefix="/api/game", tags=["游戏化"])

student_only = require_role(["student"])

# ==================== Pet System ====================

EXP_PER_LEVEL = 50  # Exp needed per level
FOOD_PER_FEED = 1   # Food consumed per feed
EXP_PER_FEED = 10   # Exp gained per feed


def _get_or_create_pet(user_id: int, db: Session) -> Pet:
    pet = db.query(Pet).filter(Pet.user_id == user_id).first()
    if not pet:
        pet = Pet(
            user_id=user_id,
            name="小乐",
            level=1,
            exp=0,
            food=5,
        )
        db.add(pet)
        db.commit()
        db.refresh(pet)
    return pet


def _level_up(pet: Pet):
    """Check and apply level up. Returns True if leveled up."""
    needed = pet.level * EXP_PER_LEVEL
    if pet.exp >= needed:
        pet.exp -= needed
        pet.level += 1
        return True
    return False


@router.get("/pet", response_model=PetResponse)
def get_pet(db: Session = Depends(get_db), user: User = Depends(student_only)):
    """Get the current user's pet."""
    pet = _get_or_create_pet(user.id, db)
    exp_to_next = pet.level * EXP_PER_LEVEL - pet.exp
    result = PetResponse.model_validate(pet)
    result.exp_to_next = max(0, exp_to_next)
    return result


@router.post("/pet/feed", response_model=FeedPetResponse)
def feed_pet(db: Session = Depends(get_db), user: User = Depends(student_only)):
    """Feed the pet: costs 1 food, gives 10 exp."""
    pet = _get_or_create_pet(user.id, db)
    if pet.food < FOOD_PER_FEED:
        raise HTTPException(status_code=400, detail="食物不足，快去复习单词赚取食物吧！")

    pet.food -= FOOD_PER_FEED
    pet.exp += EXP_PER_FEED
    pet.last_fed = datetime.utcnow()

    leveled_up = _level_up(pet)
    db.commit()
    db.refresh(pet)

    exp_to_next = pet.level * EXP_PER_LEVEL - pet.exp
    result = PetResponse.model_validate(pet)
    result.exp_to_next = max(0, exp_to_next)

    msg = f"🎉 {pet.name}吃得很开心！"
    if leveled_up:
        msg = f"🎉🎉 {pet.name}升级了！当前等级：{pet.level}"

    return FeedPetResponse(pet=result, message=msg, leveled_up=leveled_up)


@router.post("/pet/earn-food", response_model=EarnFoodResponse)
def earn_food(amount: int = 1, db: Session = Depends(get_db), user: User = Depends(student_only)):
    """Earn pet food (called when reviewing words)."""
    if amount < 1 or amount > 10:
        raise HTTPException(status_code=400, detail="单次获取食物数量在1-10之间")

    pet = _get_or_create_pet(user.id, db)
    pet.food += amount
    db.commit()
    db.refresh(pet)

    return EarnFoodResponse(
        food_earned=amount,
        total_food=pet.food,
        message=f"获得{amount}份宠物食物！当前食物：{pet.food}"
    )


# ==================== Story Adventure ====================

@router.get("/stories", response_model=List[StoryListResponse])
def list_stories(level: str = None, db: Session = Depends(get_db), user: User = Depends(student_only)):
    """List available stories, optionally filtered by level."""
    query = db.query(Story)
    if level:
        query = query.filter(Story.level == level)
    stories = query.order_by(Story.level, Story.sort_order).all()

    # Get user's progress
    completed_ids = set()
    stars_map = {}
    progress_records = db.query(UserStoryProgress).filter(
        UserStoryProgress.user_id == user.id
    ).all()
    for p in progress_records:
        completed_ids.add(p.story_id)
        stars_map[p.story_id] = p.stars_earned

    result = []
    for s in stories:
        result.append(StoryListResponse(
            id=s.id,
            level=s.level,
            title=s.title,
            completed=s.id in completed_ids,
            stars_earned=stars_map.get(s.id, 0),
        ))
    return result


@router.get("/stories/{story_id}", response_model=StoryResponse)
def get_story(story_id: int, db: Session = Depends(get_db), user: User = Depends(student_only)):
    """Get a specific story with full content."""
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="故事不存在")

    # Check user progress
    progress = db.query(UserStoryProgress).filter(
        UserStoryProgress.user_id == user.id,
        UserStoryProgress.story_id == story_id
    ).first()

    result = StoryResponse.model_validate(story)
    result.completed = progress is not None
    result.stars_earned = progress.stars_earned if progress else 0
    return result


@router.post("/stories/{story_id}/complete", response_model=CompleteStoryResponse)
def complete_story(story_id: int, correct: bool = False,
                   db: Session = Depends(get_db), user: User = Depends(student_only)):
    """Mark a story as completed. If correct answer, earn stars and add vocabulary."""
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="故事不存在")

    # Check if already completed
    existing = db.query(UserStoryProgress).filter(
        UserStoryProgress.user_id == user.id,
        UserStoryProgress.story_id == story_id
    ).first()

    stars_earned = 0
    words_added = 0

    if correct and not existing:
        # Earn 3 stars for correct answer
        stars_earned = 3

        # Auto-add story vocabulary to learning records
        for vocab_item in (story.vocabulary or []):
            word_text = vocab_item.get("word", "")
            chinese_text = vocab_item.get("chinese", "")
            # Find matching word in system
            word = db.query(Word).filter(
                Word.english == word_text
            ).first()
            if word:
                # Check if already learned
                already = db.query(LearningRecord).filter(
                    LearningRecord.user_id == user.id,
                    LearningRecord.word_id == word.id
                ).first()
                if not already:
                    from services.srs import calculate_next_review
                    _, interval, _, next_review = calculate_next_review(3, 2.5, 0, 0)
                    record = LearningRecord(
                        user_id=user.id,
                        word_id=word.id,
                        ease_factor=2.5,
                        interval=interval,
                        repetitions=0,
                        next_review=next_review,
                        last_quality=3,
                        is_mastered=False
                    )
                    db.add(record)
                    words_added += 1

        # Create progress record
        progress = UserStoryProgress(
            user_id=user.id,
            story_id=story_id,
            stars_earned=stars_earned
        )
        db.add(progress)
    elif correct and existing:
        stars_earned = 1  # Already completed, just small bonus

    db.commit()

    msg = "恭喜完成故事！"
    if words_added > 0:
        msg += f" 已自动添加{words_added}个新词到学习列表。"

    return CompleteStoryResponse(
        story_id=story_id,
        correct=correct,
        stars_earned=stars_earned,
        words_added=words_added,
        message=msg
    )


# ==================== Word Battle (Single-player) ====================

@router.get("/battle/words", response_model=List[BattleWordResponse])
def get_battle_words(count: int = 10, pack_id: int = None,
                     db: Session = Depends(get_db), user: User = Depends(student_only)):
    """Get words for battle mode. Picks from non-mastered words."""
    if count < 5 or count > 30:
        count = 10

    # Get user's packs
    query_packs = db.query(UserPackProgress).filter(
        UserPackProgress.user_id == user.id,
        UserPackProgress.is_unlocked == True
    )
    if pack_id:
        query_packs = query_packs.filter(UserPackProgress.pack_id == pack_id)

    user_packs = query_packs.all()
    pack_ids = [p.pack_id for p in user_packs]

    if not pack_ids:
        raise HTTPException(status_code=400, detail="还没有解锁的词库")

    # Get words the user has learned but not mastered (for review battle)
    # Or pick from unlearned words too for variety
    learning_records = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.word_id.in_(
            db.query(Word.id).filter(Word.pack_id.in_(pack_ids))
        )
    ).all()

    learned_ids = {r.word_id for r in learning_records}
    mastered_ids = {r.word_id for r in learning_records if r.is_mastered}

    # All eligible word IDs (learned but not mastered, plus some new ones for variety)
    eligible_record_ids = list(learned_ids - mastered_ids)

    # If not enough, add some unlearned words
    if len(eligible_record_ids) < count:
        all_word_ids = [w.id for w in db.query(Word.id).filter(
            Word.pack_id.in_(pack_ids)
        ).all()]
        remaining = [wid for wid in all_word_ids if wid not in learned_ids]
        random.shuffle(remaining)
        needed = count - len(eligible_record_ids)
        eligible_record_ids.extend(remaining[:needed])

    # Randomly select words
    random.shuffle(eligible_record_ids)
    selected_ids = eligible_record_ids[:count]

    words = db.query(Word).filter(Word.id.in_(selected_ids)).all()

    # Build questions with options
    result = []
    for word in words:
        # Generate 3 wrong options + 1 correct
        wrong_words = db.query(Word).filter(
            Word.id != word.id,
            Word.pack_id.in_(pack_ids)
        ).order_by(func.random()).limit(3).all()

        options = [w.chinese for w in wrong_words if w.chinese != word.chinese]
        while len(options) < 3:
            options.append("未知")
        options = options[:3]
        options.append(word.chinese)
        random.shuffle(options)

        correct_index = options.index(word.chinese)

        result.append(BattleWordResponse(
            word_id=word.id,
            english=word.english,
            options=options,
            correct_index=correct_index,
        ))

    return result


@router.post("/battle/result", response_model=BattleResultResponse)
def submit_battle_result(data: BattleResultSubmit,
                         db: Session = Depends(get_db), user: User = Depends(student_only)):
    """Submit battle result and earn rewards."""
    # Calculate rewards
    # Stars: 1 per correct answer, bonus at combo >= 5
    accuracy = data.correct_answers / max(data.total_questions, 1)
    stars_earned = data.correct_answers

    # Combo bonus: if max_combo >= 5, bonus stars
    if data.max_combo >= 5:
        combo_bonus = data.max_combo // 5 * 2
        stars_earned += combo_bonus

    # Food: base 1 if pass (>= 60%)
    food_earned = 0
    if accuracy >= 0.6:
        food_earned = 1
    if accuracy >= 0.8:
        food_earned = 2

    # Give food to pet
    pet = _get_or_create_pet(user.id, db)
    pet.food += food_earned

    db.commit()

    msg = f"战斗结束！获得{stars_earned}颗星"
    if food_earned > 0:
        msg += f"，{food_earned}份食物"
    if data.max_combo >= 5:
        msg += f"，最高连击{data.max_combo}！太棒了！"

    return BattleResultResponse(
        stars_earned=stars_earned,
        food_earned=food_earned,
        message=msg
    )


# ==================== Parent Daily Report ====================

@router.get("/parent/daily-report/{student_id}", response_model=DailyReportResponse)
def get_daily_report(student_id: int,
                     db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Generate a natural-language daily report for a parent about their child."""
    # Verify parent access
    if user.role == "parent":
        link = db.query(ParentStudent).filter(
            ParentStudent.parent_id == user.id,
            ParentStudent.student_id == student_id,
        ).first()
        if not link:
            raise HTTPException(status_code=403, detail="无权查看该学生的数据")
    elif user.role not in ("superadmin", "group_admin", "campus_admin"):
        raise HTTPException(status_code=403, detail="权限不足")

    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")

    today = date.today()
    nickname = student.nickname or student.username

    # Stats
    total_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id
    ).count()

    mastered = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        LearningRecord.is_mastered == True
    ).count()

    to_review = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        LearningRecord.next_review <= datetime.utcnow(),
        LearningRecord.is_mastered == False
    ).count()

    today_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        cast(LearningRecord.created_at, Date) == today
    ).count()

    today_reviewed = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        cast(LearningRecord.updated_at, Date) == today,
        LearningRecord.repetitions > 0
    ).count()

    practice_count = db.query(WrongRecord).filter(
        WrongRecord.user_id == student_id,
        cast(WrongRecord.last_wrong_at, Date) == today
    ).count()

    # Streak
    streak = 0
    d = today
    while True:
        c = db.query(Checkin).filter(
            Checkin.user_id == student_id, Checkin.checkin_date == d
        ).first()
        if c:
            streak += 1
            d -= timedelta(days=1)
        else:
            break

    # Accuracy
    avg_quality = db.query(func.avg(LearningRecord.last_quality)).filter(
        LearningRecord.user_id == student_id, LearningRecord.last_quality > 0
    ).scalar() or 0
    accuracy = round(avg_quality / 5 * 100, 1) if avg_quality else 0

    # Pet info
    pet = db.query(Pet).filter(Pet.user_id == student_id).first()
    pet_info = ""
    if pet:
        pet_info = f"宠物{pet.name}等级{pet.level}"

    # Reading stats
    reading_completed = db.query(UserReadingProgress).filter(
        UserReadingProgress.user_id == student_id,
        UserReadingProgress.is_completed == True
    ).count()

    reading_avg_score = db.query(func.avg(UserReadingProgress.score)).filter(
        UserReadingProgress.user_id == student_id,
        UserReadingProgress.is_completed == True
    ).scalar() or 0

    reading_words_covered = db.query(func.sum(ReadingPassage.word_count)).filter(
        ReadingPassage.id.in_(
            db.query(UserReadingProgress.passage_id).filter(
                UserReadingProgress.user_id == student_id,
                UserReadingProgress.is_completed == True
            )
        )
    ).scalar() or 0

    # Generate natural language report
    report_lines = []
    report_lines.append(f"📊 {nickname}的学习日报")

    if today_learned > 0 or today_reviewed > 0:
        report_lines.append(f"今天学习了{today_learned}个新词，复习了{today_reviewed}个词，棒棒哒！")
    else:
        report_lines.append("今天还没有学习记录哦，记得提醒小朋友来学习~")

    if total_learned > 0:
        mastery_rate = round(mastered / max(total_learned, 1) * 100)
        report_lines.append(f"累计学习{total_learned}个单词，已掌握{mastered}个（{mastery_rate}%），待复习{to_review}个。")

    if streak > 0:
        report_lines.append(f"已连续学习{streak}天，继续保持！")
    else:
        report_lines.append("今天开始新的学习周期吧！")

    if accuracy > 0:
        if accuracy >= 80:
            report_lines.append(f"正确率高达{accuracy}%，非常棒！")
        elif accuracy >= 60:
            report_lines.append(f"正确率{accuracy}%，不错，继续加油！")
        else:
            report_lines.append(f"正确率{accuracy}%，需要多加练习哦~")

    if pet_info:
        report_lines.append(f"🐾 {pet_info}")

    if reading_completed > 0:
        report_lines.append(f"📖 完成了{reading_completed}篇词汇阅读，平均得分{round(reading_avg_score, 1)}分，覆盖{reading_words_covered}个词汇。")
    else:
        report_lines.append("📖 还没有进行词汇阅读，学习单词后试试阅读功能吧！")

    # Encouraging closing
    encouragements = [
        "每天进步一点点，积少成多！💪",
        "学习贵在坚持，你已经很棒了！🌟",
        "Keep learning, keep growing! 📚",
        "今天的努力是明天的基石！🏗️",
        "学海无涯，快乐前行！⛵",
    ]
    report_lines.append(random.choice(encouragements))

    return DailyReportResponse(
        date=today.isoformat(),
        nickname=nickname,
        total_learned=total_learned,
        today_learned=today_learned,
        today_reviewed=today_reviewed,
        mastered=mastered,
        to_review=to_review,
        streak_days=streak,
        accuracy=accuracy,
        practice_count=practice_count,
        report_text="\n".join(report_lines),
        reading_passages_completed=reading_completed,
        reading_average_score=round(float(reading_avg_score), 1),
        reading_words_covered=int(reading_words_covered),
    )


# ==================== Game Stats ====================

@router.get("/stats", response_model=GameStatsResponse)
def get_game_stats(db: Session = Depends(get_db), user: User = Depends(student_only)):
    """Get comprehensive game statistics for the student dashboard."""
    pet = _get_or_create_pet(user.id, db)

    # Story completions
    stories_completed = db.query(UserStoryProgress).filter(
        UserStoryProgress.user_id == user.id
    ).count()

    total_stars = db.query(func.coalesce(func.sum(UserStoryProgress.stars_earned), 0)).filter(
        UserStoryProgress.user_id == user.id
    ).scalar()

    # PK battles fought
    battles_fought = db.query(PKRecord).filter(
        PKRecord.user_id == user.id
    ).count()

    # Learning stats
    total_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id
    ).count()

    today_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        cast(LearningRecord.created_at, Date) == date.today()
    ).count()

    # Streak
    streak = 0
    d = date.today()
    while True:
        c = db.query(Checkin).filter(
            Checkin.user_id == user.id, Checkin.checkin_date == d
        ).first()
        if c:
            streak += 1
            d -= timedelta(days=1)
        else:
            break

    return GameStatsResponse(
        pet_level=pet.level,
        pet_name=pet.name,
        pet_food=pet.food,
        pet_exp=pet.exp,
        stories_completed=stories_completed,
        total_stars=total_stars or 0,
        battles_fought=battles_fought,
        total_learned=total_learned,
        streak_days=streak,
        today_learned=today_learned,
    )
