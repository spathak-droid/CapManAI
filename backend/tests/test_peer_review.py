"""Tests for the peer review system."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.db.models import (
    PeerReview,
    PeerReviewAssignment,
    User,
)
from src.peer_review.service import REVIEW_XP


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_assignment(
    assignment_id: int = 1,
    reviewer_id: int = 10,
    reviewee_id: int = 20,
    response_id: int = 100,
    status: str = "assigned",
) -> PeerReviewAssignment:
    """Create a PeerReviewAssignment-like mock."""
    obj = MagicMock(spec=PeerReviewAssignment)
    obj.id = assignment_id
    obj.reviewer_id = reviewer_id
    obj.reviewee_id = reviewee_id
    obj.response_id = response_id
    obj.status = status
    obj.due_at = None
    obj.created_at = datetime.now(timezone.utc)
    return obj


def _make_review(
    review_id: int = 1,
    assignment_id: int = 1,
    overall_score: float = 3.5,
    helpfulness_rating: int | None = None,
) -> PeerReview:
    """Create a PeerReview-like mock."""
    obj = MagicMock(spec=PeerReview)
    obj.id = review_id
    obj.assignment_id = assignment_id
    obj.technical_accuracy = 3.5
    obj.risk_awareness = 3.5
    obj.strategy_fit = 3.5
    obj.reasoning_clarity = 3.5
    obj.overall_score = overall_score
    obj.feedback_text = "Good analysis with room for improvement."
    obj.helpfulness_rating = helpfulness_rating
    obj.created_at = datetime.now(timezone.utc)
    return obj


def _make_user(user_id: int = 10, xp_total: int = 100) -> User:
    """Create a User-like mock."""
    obj = MagicMock(spec=User)
    obj.id = user_id
    obj.xp_total = xp_total
    obj.level = 1
    obj.role = "student"
    return obj


def _mock_db() -> MagicMock:
    """Create a mock async DB session."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.get = AsyncMock(return_value=None)
    return db


def _make_scalars_result(values: list[object]) -> MagicMock:
    """Create a mock that returns values from .scalars().all()."""
    result = MagicMock()
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = values
    result.scalars.return_value = scalars_mock
    return result


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestAssignmentCreation:
    """Tests for peer review assignment creation."""

    @pytest.mark.asyncio
    async def test_assign_reviewers_creates_assignments(self) -> None:
        """assign_reviewers creates the expected number of assignments."""
        from src.peer_review.assigner import assign_reviewers

        db = _mock_db()
        user1 = _make_user(user_id=2)
        user2 = _make_user(user_id=3)

        db.execute = AsyncMock(return_value=_make_scalars_result([user1, user2]))

        assignments = await assign_reviewers(db, response_id=100, reviewee_id=1, count=2)

        assert len(assignments) == 2
        db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_assign_reviewers_no_eligible(self) -> None:
        """assign_reviewers returns empty when no eligible reviewers exist."""
        from src.peer_review.assigner import assign_reviewers

        db = _mock_db()
        db.execute = AsyncMock(return_value=_make_scalars_result([]))

        assignments = await assign_reviewers(db, response_id=100, reviewee_id=1, count=2)

        assert len(assignments) == 0


class TestReviewSubmission:
    """Tests for submitting peer reviews."""

    @pytest.mark.asyncio
    @patch("src.peer_review.service.manager")
    async def test_submit_review_saves_and_awards_xp(self, mock_manager: MagicMock) -> None:
        """submit_review saves the review, awards XP, and sends websocket event."""
        from src.peer_review.service import submit_review

        db = _mock_db()
        assignment = _make_assignment(assignment_id=1, reviewer_id=10, reviewee_id=20)
        reviewer = _make_user(user_id=10, xp_total=100)

        db.get = AsyncMock(side_effect=lambda model, pk: {
            (PeerReviewAssignment, 1): assignment,
            (User, 10): reviewer,
        }.get((model, pk)))

        mock_manager.send_to_user = AsyncMock()

        review = await submit_review(
            db,
            assignment_id=1,
            reviewer_id=10,
            scores={
                "technical_accuracy": 4.0,
                "risk_awareness": 3.5,
                "strategy_fit": 4.5,
                "reasoning_clarity": 3.0,
            },
            feedback="Great work on risk analysis.",
        )

        assert isinstance(review, PeerReview)
        assert assignment.status == "submitted"
        assert reviewer.xp_total == 100 + REVIEW_XP
        mock_manager.send_to_user.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_submit_review_wrong_reviewer(self) -> None:
        """submit_review raises if reviewer doesn't match assignment."""
        from src.peer_review.service import submit_review

        db = _mock_db()
        assignment = _make_assignment(assignment_id=1, reviewer_id=10)
        db.get = AsyncMock(return_value=assignment)

        with pytest.raises(ValueError, match="Not your assignment"):
            await submit_review(
                db,
                assignment_id=1,
                reviewer_id=999,
                scores={
                    "technical_accuracy": 3.0,
                    "risk_awareness": 3.0,
                    "strategy_fit": 3.0,
                    "reasoning_clarity": 3.0,
                },
                feedback="Some feedback text here.",
            )

    @pytest.mark.asyncio
    async def test_submit_review_already_submitted(self) -> None:
        """submit_review raises if already submitted."""
        from src.peer_review.service import submit_review

        db = _mock_db()
        assignment = _make_assignment(assignment_id=1, reviewer_id=10, status="submitted")
        db.get = AsyncMock(return_value=assignment)

        with pytest.raises(ValueError, match="already submitted"):
            await submit_review(
                db,
                assignment_id=1,
                reviewer_id=10,
                scores={
                    "technical_accuracy": 3.0,
                    "risk_awareness": 3.0,
                    "strategy_fit": 3.0,
                    "reasoning_clarity": 3.0,
                },
                feedback="Some feedback text here.",
            )


class TestXPAward:
    """Tests for XP awarding on review."""

    def test_review_xp_is_15(self) -> None:
        """REVIEW_XP constant is 15."""
        assert REVIEW_XP == 15


class TestHelpfulnessRating:
    """Tests for rating review helpfulness."""

    @pytest.mark.asyncio
    async def test_rate_helpfulness_success(self) -> None:
        """Reviewee can rate helpfulness of a review."""
        from src.peer_review.service import rate_helpfulness

        db = _mock_db()
        review = _make_review(review_id=1, assignment_id=1)
        assignment = _make_assignment(assignment_id=1, reviewee_id=20)

        db.get = AsyncMock(side_effect=lambda model, pk: {
            (PeerReview, 1): review,
            (PeerReviewAssignment, 1): assignment,
        }.get((model, pk)))

        result = await rate_helpfulness(db, review_id=1, reviewee_id=20, rating=5)

        assert result.helpfulness_rating == 5

    @pytest.mark.asyncio
    async def test_rate_helpfulness_wrong_user(self) -> None:
        """Non-reviewee cannot rate helpfulness."""
        from src.peer_review.service import rate_helpfulness

        db = _mock_db()
        review = _make_review(review_id=1, assignment_id=1)
        assignment = _make_assignment(assignment_id=1, reviewee_id=20)

        db.get = AsyncMock(side_effect=lambda model, pk: {
            (PeerReview, 1): review,
            (PeerReviewAssignment, 1): assignment,
        }.get((model, pk)))

        with pytest.raises(ValueError, match="Not authorized"):
            await rate_helpfulness(db, review_id=1, reviewee_id=999, rating=3)


class TestEligibleReviewerFiltering:
    """Tests for eligible reviewer selection."""

    @pytest.mark.asyncio
    async def test_excludes_self_from_eligible(self) -> None:
        """get_eligible_reviewers excludes the reviewee from the list."""
        from src.peer_review.assigner import get_eligible_reviewers

        db = _mock_db()
        user1 = _make_user(user_id=2)
        user2 = _make_user(user_id=3)
        db.execute = AsyncMock(return_value=_make_scalars_result([user1, user2]))

        eligible = await get_eligible_reviewers(db, reviewee_id=1)

        # The DB query already excludes self; verify returned users
        assert all(u.id != 1 for u in eligible)
        assert len(eligible) == 2


class TestPeerReviewModels:
    """Tests for model table structure."""

    def test_assignment_table_columns(self) -> None:
        """PeerReviewAssignment has the expected columns."""
        table = PeerReviewAssignment.__table__
        assert "reviewer_id" in table.columns
        assert "reviewee_id" in table.columns
        assert "response_id" in table.columns
        assert "status" in table.columns
        assert "due_at" in table.columns

    def test_review_table_columns(self) -> None:
        """PeerReview has the expected columns."""
        table = PeerReview.__table__
        assert "assignment_id" in table.columns
        assert "technical_accuracy" in table.columns
        assert "risk_awareness" in table.columns
        assert "strategy_fit" in table.columns
        assert "reasoning_clarity" in table.columns
        assert "overall_score" in table.columns
        assert "feedback_text" in table.columns
        assert "helpfulness_rating" in table.columns
