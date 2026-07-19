from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from database import get_db
from models import User, LearningRecord, Word, WordPack
from schemas import (
    GardenResponse, GardenSummaryResponse, GardenPlantResponse, GardenPackInfo
)
from routers.auth import get_current_user

router = APIRouter(prefix="/api/garden", tags=["花园"])

# Deterministic plant-type emojis derived from word_id
PLANT_EMOJIS = ["🌸", "🌺", "🌷", "🌹", "🌼", "🌻", "💐", "🌿", "🍀", "🌲"]

# Grid constants for layout
COLS = 6
CELL_W = 110  # virtual pixel width per cell
CELL_H = 110  # virtual pixel height per cell


def _calc_stage(repetitions: int, interval: int, is_mastered: bool) -> int:
    """Map SM-2 learning progress to a 0-4 garden growth stage."""
    if is_mastered and interval >= 21:
        return 4  # bloomed — fully mastered (deep roots)
    elif is_mastered:
        return 3  # flowering — mastered
    elif repetitions >= 2:
        return 2  # growing — decent repetition count
    elif repetitions >= 1:
        return 1  # sprout — first review done
    else:
        return 0  # seed — just planted


@router.get("", response_model=GardenResponse)
def get_garden(
    pack_id: Optional[int] = Query(None, description="Filter by word pack id"),
    stage: Optional[int] = Query(None, ge=0, le=4, description="Filter by growth stage 0-4"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return garden visualisation data derived from the user's learning records.

    Every learned word becomes a virtual plant whose growth stage mirrors the
    SM-2 progress tracked in learning_records.  Position is deterministic so
    the garden layout stays consistent between page loads.
    """
    # Eagerly load word + pack relationships
    records = (
        db.query(LearningRecord)
        .options(joinedload(LearningRecord.word).joinedload(Word.pack))
        .filter(LearningRecord.user_id == user.id)
        .order_by(LearningRecord.created_at.desc())
        .all()
    )

    if not records:
        return GardenResponse(
            summary=GardenSummaryResponse(
                total_plants=0, seed_count=0, sprout_count=0,
                growing_count=0, flowering_count=0, bloomed_count=0,
                mastery_rate=0.0,
            ),
            plants=[],
            packs=[],
        )

    plants = []
    pack_map: dict[int, dict] = {}
    stage_counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}

    for idx, record in enumerate(records):
        word = record.word
        pack = word.pack

        plant_stage = _calc_stage(record.repetitions, record.interval, record.is_mastered)
        stage_counts[plant_stage] += 1

        # Track pack info (always, before filtering)
        if pack.id not in pack_map:
            pack_map[pack.id] = {"pack_id": pack.id, "pack_name": pack.name, "count": 0}
        pack_map[pack.id]["count"] += 1

        # Apply optional filters (only affects the list, not the summary)
        if pack_id is not None and pack.id != pack_id:
            continue
        if stage is not None and plant_stage != stage:
            continue

        # Deterministic visual properties
        plant_type = PLANT_EMOJIS[word.id % len(PLANT_EMOJIS)]

        # Grid position (deterministic via index)
        col = idx % COLS
        row = idx // COLS
        # Add a small pseudo-random offset (±8px) for a natural look
        offset_x = (word.id * 7 + 3) % 17 - 8
        offset_y = (word.id * 13 + 7) % 13 - 6

        plants.append(GardenPlantResponse(
            word_id=word.id,
            english=word.english,
            chinese=word.chinese,
            phonetic=word.phonetic,
            pack_id=pack.id,
            pack_name=pack.name,
            stage=plant_stage,
            plant_type=plant_type,
            x=col * CELL_W + CELL_W // 2 + offset_x,
            y=row * CELL_H + CELL_H // 2 + offset_y,
            interval=record.interval,
            repetitions=record.repetitions,
            is_mastered=record.is_mastered,
            last_reviewed=record.updated_at,
            created_at=record.created_at,
        ))

    total = len(records)
    mastered_total = stage_counts[3] + stage_counts[4]
    mastery_rate = round(mastered_total / max(total, 1) * 100, 1)

    return GardenResponse(
        summary=GardenSummaryResponse(
            total_plants=total,
            seed_count=stage_counts[0],
            sprout_count=stage_counts[1],
            growing_count=stage_counts[2],
            flowering_count=stage_counts[3],
            bloomed_count=stage_counts[4],
            mastery_rate=mastery_rate,
        ),
        plants=plants,
        packs=[GardenPackInfo(**v) for v in pack_map.values()],
    )
