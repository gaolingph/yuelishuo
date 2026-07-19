"""
SM-2 Spaced Repetition Algorithm
Based on the SuperMemo SM-2 algorithm used by Anki and 智牛英语
"""
from datetime import datetime, timedelta
from typing import Tuple


def calculate_next_review(quality: int, ease_factor: float, interval: int, repetitions: int) -> Tuple[float, int, int, datetime]:
    """
    Calculate next review parameters based on SM-2 algorithm.
    
    Args:
        quality: User's recall quality (0-5)
        ease_factor: Current ease factor (default 2.5)
        interval: Current interval in days
        repetitions: Number of successful repetitions
    
    Returns:
        (new_ease_factor, new_interval, new_repetitions, next_review_date)
    """
    if quality < 0:
        quality = 0
    if quality > 5:
        quality = 5

    if quality >= 3:
        # Correct response
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval * ease_factor)

        new_repetitions = repetitions + 1
    else:
        # Incorrect response - reset
        new_repetitions = 0
        new_interval = 1

    # Update ease factor
    new_ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if new_ease_factor < 1.3:
        new_ease_factor = 1.3

    next_review = datetime.utcnow() + timedelta(days=new_interval)

    return round(new_ease_factor, 2), new_interval, new_repetitions, next_review


def get_review_priority(ease_factor: float, interval: int, repetitions: int, next_review: datetime) -> float:
    """
    Calculate priority score for review queue ordering.
    Higher priority = should review sooner.
    """
    now = datetime.utcnow()
    if next_review is None:
        return 9999
    
    overdue_hours = (now - next_review).total_seconds() / 3600
    
    if overdue_hours > 0:
        # Overdue items get higher priority based on how overdue they are
        return overdue_hours * (2.5 / ease_factor)
    else:
        # Future items lower priority
        return -abs(overdue_hours) * 0.1


def get_quality_from_accuracy(is_correct: bool, time_spent: float = None) -> int:
    """
    Convert practice accuracy to SM-2 quality score.
    """
    if is_correct:
        if time_spent and time_spent < 2.0:
            return 5  # Perfect fast recall
        elif time_spent and time_spent < 5.0:
            return 4  # Correct with hesitation
        else:
            return 3  # Correct but difficult
    else:
        return 0  # Complete遗忘
