"""Tests for automatic peer review assignment after grading."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.db.models import (
    SkillScore,
    User,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_skill_score(
    user_id: int,
    skill_id: str = "price_action",
    score: float = 60.0,
    attempts: int = 3,
) -> SkillScore:
    obj = MagicMock(spec=SkillScore)
    obj.user_id = user_id
    obj.skill_id = skill_id
    obj.score = score
    obj.attempts = attempts
    return obj


def _make_user(user_id: int, role: str = "student") -> User:
    obj = MagicMock(spec=User)
    obj.id = user_id
    obj.role = role
    return obj


def _mock_db() -> MagicMock:
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.get = AsyncMock(return_value=None)
    return db


def _scalars_result(values: list[object]) -> MagicMock:
    result = MagicMock()
    scalars = MagicMock()
    scalars.all.return_value = values
    result.scalars.return_value = scalars
    # Also support scalar_one_or_none (for the user's own score lookup)
    result.scalar_one_or_none.return_value = values[0] if values else None
    return result


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestAutoAssignPeerReviews:
    """Tests for auto_assign_peer_reviews service function."""

    @pytest.mark.asyncio
    @patch("src.peer_review.service.manager")
    async def test_creates_assignment_for_eligible_reviewer(
        self, mock_manager: MagicMock
    ) -> None:
        """Grading creates a peer review assignment when eligible reviewers exist."""
        from src.peer_review.service import auto_assign_peer_reviews

        db = _mock_db()
        mock_manager.send_to_user = AsyncMock()

        # User's own skill score
        user_score = _make_skill_score(user_id=1, score=60.0)
        # Candidate reviewer
        candidate = _make_skill_score(user_id=2, score=55.0)

        # First execute call: user's own skill score
        # Second execute call: candidate query
        db.execute = AsyncMock(
            side_effect=[
                _scalars_result([user_score]),
                _scalars_result([candidate]),
            ]
        )

        assignments = await auto_assign_peer_reviews(
            db,
            response_id=100,
            user_id=1,
            skill_target="price_action",
            num_reviewers=1,
        )

        assert len(assignments) == 1
        assert assignments[0].reviewer_id == 2
        assert assignments[0].reviewee_id == 1
        assert assignments[0].response_id == 100
        assert assignments[0].status == "pending"
        db.flush.assert_awaited_once()
        mock_manager.send_to_user.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("src.peer_review.service.manager")
    async def test_excludes_current_user(self, mock_manager: MagicMock) -> None:
        """The current user should never be assigned as their own reviewer."""
        from src.peer_review.service import auto_assign_peer_reviews

        db = _mock_db()
        mock_manager.send_to_user = AsyncMock()

        user_score = _make_skill_score(user_id=1, score=60.0)
        # Only candidate is user_id=2 (user_id=1 is excluded by the query)
        candidate = _make_skill_score(user_id=2, score=60.0)

        db.execute = AsyncMock(
            side_effect=[
                _scalars_result([user_score]),
                _scalars_result([candidate]),
            ]
        )

        assignments = await auto_assign_peer_reviews(
            db,
            response_id=100,
            user_id=1,
            skill_target="price_action",
        )

        # Verify no assignment has reviewer_id == user_id
        for a in assignments:
            assert a.reviewer_id != 1

    @pytest.mark.asyncio
    @patch("src.peer_review.service.manager")
    async def test_no_assignment_when_no_eligible_reviewers(
        self, mock_manager: MagicMock
    ) -> None:
        """Returns empty list when no eligible reviewers exist."""
        from src.peer_review.service import auto_assign_peer_reviews

        db = _mock_db()
        mock_manager.send_to_user = AsyncMock()

        db.execute = AsyncMock(
            side_effect=[
                _scalars_result([]),  # no user score
                _scalars_result([]),  # no candidates
            ]
        )

        assignments = await auto_assign_peer_reviews(
            db,
            response_id=100,
            user_id=1,
            skill_target="price_action",
        )

        assert assignments == []
        db.flush.assert_not_awaited()
        mock_manager.send_to_user.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("src.peer_review.service.manager")
    async def test_prefers_similar_skill_level(
        self, mock_manager: MagicMock
    ) -> None:
        """When multiple candidates exist, prefers those within skill proximity."""
        from src.peer_review.service import auto_assign_peer_reviews

        db = _mock_db()
        mock_manager.send_to_user = AsyncMock()

        user_score = _make_skill_score(user_id=1, score=60.0)
        # Close candidate (within 20 pts)
        close_candidate = _make_skill_score(user_id=2, score=55.0)
        # Far candidate (outside 20 pts)
        far_candidate = _make_skill_score(user_id=3, score=10.0)

        db.execute = AsyncMock(
            side_effect=[
                _scalars_result([user_score]),
                _scalars_result([far_candidate, close_candidate]),
            ]
        )

        assignments = await auto_assign_peer_reviews(
            db,
            response_id=100,
            user_id=1,
            skill_target="price_action",
            num_reviewers=1,
        )

        assert len(assignments) == 1
        # Should pick the closer candidate
        assert assignments[0].reviewer_id == 2

    @pytest.mark.asyncio
    @patch("src.peer_review.service.manager")
    async def test_widens_search_when_not_enough_close(
        self, mock_manager: MagicMock
    ) -> None:
        """Falls back to all candidates when not enough are within proximity."""
        from src.peer_review.service import auto_assign_peer_reviews

        db = _mock_db()
        mock_manager.send_to_user = AsyncMock()

        user_score = _make_skill_score(user_id=1, score=60.0)
        # Only far candidates available
        far1 = _make_skill_score(user_id=2, score=10.0)
        far2 = _make_skill_score(user_id=3, score=95.0)

        db.execute = AsyncMock(
            side_effect=[
                _scalars_result([user_score]),
                _scalars_result([far1, far2]),
            ]
        )

        assignments = await auto_assign_peer_reviews(
            db,
            response_id=100,
            user_id=1,
            skill_target="price_action",
            num_reviewers=2,
        )

        # Should still assign even though no one is close
        assert len(assignments) == 2
