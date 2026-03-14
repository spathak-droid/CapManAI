"""WebSocket event types for real-time communication."""

from enum import Enum


class EventType(str, Enum):
    """Event types sent over WebSocket connections."""

    LEADERBOARD_UPDATE = "leaderboard_update"
    CHALLENGE_MATCHED = "challenge_matched"
    CHALLENGE_STARTED = "challenge_started"
    OPPONENT_SUBMITTED = "opponent_submitted"
    CHALLENGE_GRADED = "challenge_graded"
    PEER_REVIEW_ASSIGNED = "peer_review_assigned"
    XP_EARNED = "xp_earned"
    LEVEL_UP = "level_up"


def create_event(event_type: EventType, data: dict[str, object]) -> dict[str, object]:
    """Create a structured WebSocket event message."""
    return {
        "type": event_type.value,
        "data": data,
    }
