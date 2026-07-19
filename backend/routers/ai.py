"""AI Agent router — all AI-powered endpoints for 乐说邦英语.

Endpoints:
  POST /api/ai/chat           — Full AI assistant chat
  GET  /api/ai/chat/stream    — SSE streaming chat
  POST /api/ai/quick-chat     — Lightweight chat (floating widget)
  POST /api/ai/enhance-report — Enhance vocab test report
  POST /api/ai/parent-report  — Generate parent daily report
  POST /api/ai/smart-review   — Smart review recommendations
  POST /api/ai/coach-tip      — Coach teaching tip
  POST /api/ai/marketing      — Marketing content generator
  POST /api/ai/speaking-eval  — Speaking evaluation
  POST /api/ai/digital-board  — Digital Board discussion
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, VocabTestRecord
from routers.auth import get_current_user, require_role
from services.ai.client import llm_client
from services.ai.prompts import get_system_prompt
from services.ai.context_builder import build_context_dict, get_student_count

router = APIRouter(prefix="/api/ai", tags=["AI助手"])

# ──────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[list[dict]] = []


class EnhanceReportRequest(BaseModel):
    score: int
    total: int = 15
    vocab_level: str
    estimated_vocab: int


class ParentReportRequest(BaseModel):
    child_id: int
    date: Optional[str] = None


class SmartReviewRequest(BaseModel):
    wrong_words: Optional[list[str]] = []
    due_words: Optional[list[str]] = []


class CoachTipRequest(BaseModel):
    child_id: int


class MarketingRequest(BaseModel):
    user_request: str


class SpeakingEvalRequest(BaseModel):
    target_text: str
    student_response: str


class DigitalBoardRequest(BaseModel):
    topic: str
    role: str = "all"  # "user", "creative", "skeptic", "connector", "all"


# ──────────────────────────────────────────────────────────────────────
# 1. Full AI Assistant Chat (standard)
# ──────────────────────────────────────────────────────────────────────


@router.post("/chat")
async def ai_chat(
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full AI learning assistant — answers with complete user context."""
    ctx = build_context_dict(user, db)
    ctx["student_count"] = get_student_count(db)

    system_prompt = get_system_prompt("assistant", **ctx)
    messages = [{"role": "system", "content": system_prompt}]

    # Append conversation history (last 10 turns)
    for turn in req.conversation_history[-10:]:
        messages.append(turn)

    messages.append({"role": "user", "content": req.message})

    reply = await llm_client.chat(messages)
    return {"reply": reply}


# ──────────────────────────────────────────────────────────────────────
# 2. SSE Streaming Chat
# ──────────────────────────────────────────────────────────────────────


@router.get("/chat/stream")
async def ai_chat_stream(
    message: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Streaming AI chat via Server-Sent Events."""
    ctx = build_context_dict(user, db)
    ctx["student_count"] = get_student_count(db)

    system_prompt = get_system_prompt("assistant", **ctx)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message},
    ]

    async def event_stream():
        async for chunk in llm_client.chat_stream(messages):
            if chunk:
                yield f"data: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ──────────────────────────────────────────────────────────────────────
# 3. Quick Chat (lightweight, for floating widget)
# ──────────────────────────────────────────────────────────────────────


@router.post("/quick-chat")
async def quick_chat(
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lightweight chat — less context, faster response for floating widget."""
    ctx = build_context_dict(user, db)
    system_prompt = get_system_prompt("quick_chat", nickname=ctx["nickname"], level=ctx["level"])

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": req.message},
    ]
    reply = await llm_client.chat(messages, temperature=0.5, max_tokens=512)
    return {"reply": reply}


# ──────────────────────────────────────────────────────────────────────
# 4. Enhance Vocab Test Report
# ──────────────────────────────────────────────────────────────────────


@router.post("/enhance-report")
async def enhance_vocab_report(
    req: EnhanceReportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate an enhanced, persuasive vocab test report."""
    ctx = build_context_dict(user, db)
    percentage = round(req.score / req.total * 100, 1)

    system_prompt = get_system_prompt(
        "vocab_test",
        nickname=ctx["nickname"],
        level=ctx["level"],
        score=req.score,
        total=req.total,
        percentage=percentage,
        vocab_level=req.vocab_level,
        estimated_vocab=req.estimated_vocab,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请为学生 {ctx['nickname']} 生成词汇测试报告。"},
    ]

    result = await llm_client.chat_structured(messages, {})
    return {
        "summary": result.get("summary", ""),
        "strengths": result.get("strengths", []),
        "weaknesses": result.get("weaknesses", []),
        "recommendation": result.get("recommendation", ""),
        "grade": result.get("grade", "C"),
        "appeal": result.get("appeal", ""),
        "next_level": result.get("next_level", ""),
    }


# ──────────────────────────────────────────────────────────────────────
# 5. Parent Daily Report
# ──────────────────────────────────────────────────────────────────────


@router.post("/parent-report")
async def parent_daily_report(
    req: ParentReportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a warm, informative daily report for parents."""
    from datetime import date, datetime

    from models import LearningRecord, WrongRecord, CapabilityRecord, Checkin
    from sqlalchemy import func

    today = req.date or date.today().isoformat()
    report_date = date.fromisoformat(today)

    # Get child info
    child = db.query(User).filter(User.id == req.child_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="学生不存在")

    # Compute child stats
    today_start = datetime.combine(report_date, datetime.min.time())
    today_end = datetime.combine(report_date, datetime.max.time())

    today_learned = (
        db.query(func.count(LearningRecord.id))
        .filter(
            LearningRecord.user_id == child.id,
            LearningRecord.created_at.between(today_start, today_end),
        )
        .scalar() or 0
    )

    total_learned = (
        db.query(func.count(LearningRecord.id.distinct()))
        .filter(LearningRecord.user_id == child.id)
        .scalar() or 0
    )

    mastered = (
        db.query(func.count(LearningRecord.id))
        .filter(LearningRecord.user_id == child.id, LearningRecord.is_mastered.is_(True))
        .scalar() or 0
    )

    to_review = (
        db.query(func.count(LearningRecord.id))
        .filter(
            LearningRecord.user_id == child.id,
            LearningRecord.is_mastered.is_(False),
            LearningRecord.next_review <= datetime.utcnow(),
        )
        .scalar() or 0
    )

    # Streak
    checkin_dates = {
        c.checkin_date
        for c in db.query(Checkin).filter(Checkin.user_id == child.id).all()
    }
    streak = 0
    from datetime import timedelta
    for i in range(365):
        d = report_date - timedelta(days=i)
        if d in checkin_dates:
            streak += 1
        else:
            break

    # Accuracy
    records = (
        db.query(LearningRecord.last_quality)
        .filter(LearningRecord.user_id == child.id)
        .all()
    )
    if records:
        correct = sum(1 for r in records if r.last_quality >= 3)
        accuracy = round(correct / len(records) * 100, 1)
    else:
        accuracy = 0.0

    capabilities = {}
    for cap in db.query(CapabilityRecord).filter(CapabilityRecord.user_id == child.id).all():
        capabilities[cap.dimension] = round(cap.score, 1)

    dim_names = {
        "listening": "听力", "discrimination": "辨析", "writing": "拼写",
        "reading": "阅读", "speaking": "口语", "usage": "运用",
    }
    caps_parts = []
    for key, label in dim_names.items():
        caps_parts.append(f"{label}: {capabilities.get(key, 0)}分")
    caps_text = "；".join(caps_parts)

    system_prompt = get_system_prompt(
        "parent_report",
        nickname=child.nickname or child.username,
        date=today,
        today_learned=today_learned,
        total_learned=total_learned,
        mastered=mastered,
        to_review=to_review,
        streak_days=streak,
        accuracy=accuracy,
        capabilities_text=caps_text,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请生成{child.nickname or child.username}的今日成长报告。"},
    ]

    result = await llm_client.chat_structured(messages, {})

    return {
        "child_name": child.nickname or child.username,
        "date": today,
        "stats": {
            "today_learned": today_learned,
            "total_learned": total_learned,
            "mastered": mastered,
            "to_review": to_review,
            "streak_days": streak,
            "accuracy": accuracy,
        },
        "greeting": result.get("greeting", ""),
        "progress_summary": result.get("progress_summary", ""),
        "teacher_tip": result.get("teacher_tip", ""),
        "encouragement": result.get("encouragement", ""),
        "next_milestone": result.get("next_milestone", ""),
    }


# ──────────────────────────────────────────────────────────────────────
# 6. Smart Review Recommendation
# ──────────────────────────────────────────────────────────────────────


@router.post("/smart-review")
async def smart_review(
    req: SmartReviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get AI-powered review recommendations based on user's weak areas."""
    ctx = build_context_dict(user, db)

    # Find weakest capability
    dim_names_cn = {
        "listening": "听力", "discrimination": "辨析", "writing": "拼写",
        "reading": "阅读", "speaking": "口语", "usage": "运用",
    }
    sorted_caps = sorted(ctx["capabilities"].items(), key=lambda x: x[1])
    weakest = dim_names_cn.get(sorted_caps[0][0], sorted_caps[0][0]) if sorted_caps else "未知"

    wrong_text = "、".join(req.wrong_words) if req.wrong_words else "暂无"
    due_text = "、".join(req.due_words) if req.due_words else "暂无"

    system_prompt = get_system_prompt(
        "smart_review",
        wrong_words_text=wrong_text,
        due_words_text=due_text,
        capability_weakness=weakest,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"为{ctx['nickname']}推荐今日复习计划。"},
    ]

    result = await llm_client.chat_structured(messages, {})
    return {
        "focus_area": result.get("focus_area", "writing"),
        "count": result.get("count", 10),
        "reason": result.get("reason", ""),
        "tip": result.get("tip", ""),
    }


# ──────────────────────────────────────────────────────────────────────
# 7. Coach Tip
# ──────────────────────────────────────────────────────────────────────


@router.post("/coach-tip")
async def coach_tip(
    req: CoachTipRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a teaching tip for coaches based on student data."""
    from models import LearningRecord, Word as WordModel
    from datetime import datetime

    child = db.query(User).filter(User.id == req.child_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="学生不存在")

    ctx = build_context_dict(child, db)

    # Recent performance
    recent = (
        db.query(LearningRecord)
        .filter(LearningRecord.user_id == child.id)
        .order_by(LearningRecord.updated_at.desc())
        .limit(5)
        .all()
    )
    perf_parts = []
    for r in recent:
        word = db.query(WordModel).filter(WordModel.id == r.word_id).first()
        if word:
            perf_parts.append(f"{word.english}(质量:{r.last_quality}/5)")
    recent_perf = "；".join(perf_parts[:5]) if perf_parts else "暂无学习记录"

    system_prompt = get_system_prompt(
        "coach_tip",
        nickname=ctx["nickname"],
        role=ctx["role"],
        capabilities_text=ctx["capabilities_text"],
        recent_performance=recent_perf,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请为教练提供关于{ctx['nickname']}的教学提示。"},
    ]

    result = await llm_client.chat_structured(messages, {})
    return {
        "tip": result.get("tip", ""),
        "focus": result.get("focus", ""),
        "action": result.get("action", ""),
    }


# ──────────────────────────────────────────────────────────────────────
# 8. Marketing Content Generator
# ──────────────────────────────────────────────────────────────────────


@router.post("/marketing")
async def marketing_content(
    req: MarketingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate marketing copy for the brand."""
    ctx = build_context_dict(user, db)
    student_count = get_student_count(db)

    system_prompt = get_system_prompt(
        "marketing",
        student_count=student_count,
        user_request=req.user_request,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": req.user_request},
    ]

    result = await llm_client.chat_structured(messages, {})
    return {
        "title": result.get("title", ""),
        "body": result.get("body", ""),
        "cta": result.get("cta", ""),
        "style": result.get("style", ""),
        "target": result.get("target", ""),
    }


# ──────────────────────────────────────────────────────────────────────
# 9. Speaking Evaluation
# ──────────────────────────────────────────────────────────────────────


@router.post("/speaking-eval")
async def speaking_evaluation(
    req: SpeakingEvalRequest,
    user: User = Depends(get_current_user),
):
    """Evaluate student's spoken English response."""
    system_prompt = get_system_prompt(
        "speaking",
        target_text=req.target_text,
        student_response=req.student_response,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",
         "content": f"请评估学生对「{req.target_text}」的发音/回答表现。"},
    ]

    result = await llm_client.chat_structured(messages, {})
    return {
        "score": result.get("score", 5),
        "accuracy": result.get("accuracy", ""),
        "feedback": result.get("feedback", ""),
        "encouragement": result.get("encouragement", ""),
        "correct_pronunciation": result.get("correct_pronunciation", ""),
    }


# ──────────────────────────────────────────────────────────────────────
# 10. Digital Board Discussion
# ──────────────────────────────────────────────────────────────────────


@router.post("/digital-board")
async def digital_board(
    req: DigitalBoardRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Convene a Digital Board meeting with 4 AI advisor roles."""
    role_prompt_keys = {
        "user": "digital_board_user",
        "creative": "digital_board_creative",
        "skeptic": "digital_board_skeptic",
        "connector": "digital_board_connector",
    }

    if req.role != "all" and req.role not in role_prompt_keys:
        raise HTTPException(status_code=400, detail="角色无效，可选: user/creative/skeptic/connector/all")

    roles_to_run = role_prompt_keys.keys() if req.role == "all" else [req.role]

    ctx = build_context_dict(user, db)
    results = {}

    for role_key in roles_to_run:
        prompt_key = role_prompt_keys[role_key]
        system_prompt = get_system_prompt(prompt_key, topic=req.topic)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",
             "content": f"关于议题「{req.topic}」，请发表你的看法。"},
        ]

        reply = await llm_client.chat(messages, temperature=0.8, max_tokens=512)
        results[role_key] = reply

    return {
        "topic": req.topic,
        "discussion": results,
    }


# ──────────────────────────────────────────────────────────────────────
# 11. Get AI Usage Stats (for admin)
# ──────────────────────────────────────────────────────────────────────


@router.get("/stats")
async def ai_stats(
    user: User = Depends(require_role(["admin", "group_admin"])),
    db: Session = Depends(get_db),
):
    """Get AI feature usage statistics (placeholder)."""
    return {
        "total_students": get_student_count(db),
        "ai_features_enabled": True,
        "provider": "DeepSeek Chat V2",
    }
