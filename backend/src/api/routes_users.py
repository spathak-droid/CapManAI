"""Educator student roster, feedback, CSV export, and activity feed routes."""

import csv
import io
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import (
    ActivityFeedItem,
    EducatorFeedbackOut,
    EducatorFeedbackRequest,
    ProbeExchangeOut,
    PeerReviewSummary,
    StudentPeerReviewData,
    StudentResponseEntry,
    StudentRosterEntry,
)
from src.auth.dependencies import require_role
from src.db.database import get_db
from src.db.models import (
    EducatorFeedback,
    Grade,
    PeerReview,
    PeerReviewAssignment,
    ProbeQuestion,
    Response,
    Scenario,
    SkillScore,
    User,
    XPLog,
)
from src.mtss.classifier import classify_tier

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/educator/students")
async def get_educator_students(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[StudentRosterEntry]:
    """List all students with aggregated stats for the educator roster."""
    # Get all students
    result = await db.execute(
        select(User).where(User.role == "student")
    )
    students = result.scalars().all()

    roster: list[StudentRosterEntry] = []
    for student in students:
        # Get response count
        resp_count_result = await db.execute(
            select(func.count()).select_from(Response).where(
                Response.user_id == student.id
            )
        )
        response_count = int(resp_count_result.scalar_one() or 0)

        # Get skill scores for tier calculation
        skill_result = await db.execute(
            select(SkillScore).where(SkillScore.user_id == student.id)
        )
        skill_rows = skill_result.scalars().all()
        scores = [row.score for row in skill_rows]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        overall_tier = classify_tier(avg_score).value

        roster.append(
            StudentRosterEntry(
                id=student.id,
                username=student.username,
                name=student.name,
                xp_total=student.xp_total or 0,
                level=student.level or 1,
                overall_tier=overall_tier,
                avg_skill_score=round(avg_score, 1),
                response_count=response_count,
            )
        )
    return roster


@router.get("/api/educator/students/{user_id}/responses")
async def get_student_responses(
    user_id: int,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[StudentResponseEntry]:
    """Get a student's recent responses with grades and educator feedback."""
    result = await db.execute(
        select(Response)
        .where(Response.user_id == user_id)
        .order_by(Response.created_at.desc())
        .limit(20)
    )
    responses = result.scalars().all()

    entries: list[StudentResponseEntry] = []
    for resp in responses:
        # Get scenario
        scenario = await db.get(Scenario, resp.scenario_id)
        situation = (scenario.situation[:200] + "...") if scenario and len(scenario.situation) > 200 else (scenario.situation if scenario else "")

        # Get grade
        grade_result = await db.execute(
            select(Grade).where(Grade.response_id == resp.id)
        )
        grade = grade_result.scalar_one_or_none()

        # Get educator feedback
        fb_result = await db.execute(
            select(EducatorFeedback).where(
                EducatorFeedback.response_id == resp.id
            ).order_by(EducatorFeedback.created_at.desc()).limit(1)
        )
        feedback = fb_result.scalar_one_or_none()

        # Get probe exchanges
        probe_result = await db.execute(
            select(ProbeQuestion)
            .where(ProbeQuestion.response_id == resp.id)
            .order_by(ProbeQuestion.created_at)
        )
        probes = probe_result.scalars().all()

        entries.append(
            StudentResponseEntry(
                response_id=resp.id,
                scenario_situation=situation,
                answer_text=resp.answer_text,
                probe_exchanges=[
                    ProbeExchangeOut(question=p.question_text, answer=p.answer_text)
                    for p in probes
                ],
                overall_score=grade.overall_score if grade else None,
                technical_accuracy=grade.technical_accuracy if grade else None,
                risk_awareness=grade.risk_awareness if grade else None,
                strategy_fit=grade.strategy_fit if grade else None,
                reasoning_clarity=grade.reasoning_clarity if grade else None,
                grade_feedback=grade.feedback_text if grade else None,
                educator_feedback=feedback.feedback_text if feedback else None,
                educator_feedback_id=feedback.id if feedback else None,
                created_at=resp.created_at.isoformat(),
            )
        )
    return entries


@router.get("/api/educator/students/{user_id}/peer-reviews")
async def get_student_peer_reviews(
    user_id: int,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> StudentPeerReviewData:
    """Get peer review activity for a student (reviews given and received)."""
    # Reviews given by this student
    given_query = (
        select(PeerReview, PeerReviewAssignment)
        .join(PeerReviewAssignment, PeerReview.assignment_id == PeerReviewAssignment.id)
        .where(PeerReviewAssignment.reviewer_id == user_id)
    )
    given_result = await db.execute(given_query)
    given_rows = given_result.all()

    reviews_given: list[PeerReviewSummary] = []
    for review, assignment in given_rows:
        reviewee = await db.get(User, assignment.reviewee_id)
        reviews_given.append(PeerReviewSummary(
            review_id=review.id,
            assignment_id=review.assignment_id,
            peer_name=reviewee.name or reviewee.username if reviewee else "Unknown",
            technical_accuracy=review.technical_accuracy,
            risk_awareness=review.risk_awareness,
            strategy_fit=review.strategy_fit,
            reasoning_clarity=review.reasoning_clarity,
            overall_score=review.overall_score,
            feedback_text=review.feedback_text,
            helpfulness_rating=review.helpfulness_rating,
            created_at=review.created_at.isoformat() if review.created_at else "",
        ))

    # Reviews received by this student
    received_query = (
        select(PeerReview, PeerReviewAssignment)
        .join(PeerReviewAssignment, PeerReview.assignment_id == PeerReviewAssignment.id)
        .where(PeerReviewAssignment.reviewee_id == user_id)
    )
    received_result = await db.execute(received_query)
    received_rows = received_result.all()

    reviews_received: list[PeerReviewSummary] = []
    for review, assignment in received_rows:
        reviewer = await db.get(User, assignment.reviewer_id)
        reviews_received.append(PeerReviewSummary(
            review_id=review.id,
            assignment_id=review.assignment_id,
            peer_name=reviewer.name or reviewer.username if reviewer else "Unknown",
            technical_accuracy=review.technical_accuracy,
            risk_awareness=review.risk_awareness,
            strategy_fit=review.strategy_fit,
            reasoning_clarity=review.reasoning_clarity,
            overall_score=review.overall_score,
            feedback_text=review.feedback_text,
            helpfulness_rating=review.helpfulness_rating,
            created_at=review.created_at.isoformat() if review.created_at else "",
        ))

    avg_given = sum(r.overall_score for r in reviews_given) / len(reviews_given) if reviews_given else 0.0
    avg_received = sum(r.overall_score for r in reviews_received) / len(reviews_received) if reviews_received else 0.0

    return StudentPeerReviewData(
        reviews_given=reviews_given,
        reviews_received=reviews_received,
        avg_score_given=round(avg_given, 2),
        avg_score_received=round(avg_received, 2),
    )


@router.post("/api/educator/feedback")
async def submit_educator_feedback(
    req: EducatorFeedbackRequest,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> EducatorFeedbackOut:
    """Submit educator feedback on a student response."""
    # Verify response exists
    response = await db.get(Response, req.response_id)
    if response is None:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Response not found",
        )

    feedback = EducatorFeedback(
        educator_id=_user.id,
        response_id=req.response_id,
        feedback_text=req.feedback_text,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    return EducatorFeedbackOut(
        id=feedback.id,
        educator_id=feedback.educator_id,
        response_id=feedback.response_id,
        feedback_text=feedback.feedback_text,
        created_at=feedback.created_at.isoformat(),
    )


@router.get("/api/educator/students/{user_id}/feedback")
async def get_student_feedback(
    user_id: int,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[EducatorFeedbackOut]:
    """Get all educator feedback for a student's responses."""
    # Get all response IDs for this student
    resp_result = await db.execute(
        select(Response.id).where(Response.user_id == user_id)
    )
    response_ids = [row[0] for row in resp_result.all()]

    if not response_ids:
        return []

    fb_result = await db.execute(
        select(EducatorFeedback)
        .where(EducatorFeedback.response_id.in_(response_ids))
        .order_by(EducatorFeedback.created_at.desc())
    )
    feedbacks = fb_result.scalars().all()

    return [
        EducatorFeedbackOut(
            id=fb.id,
            educator_id=fb.educator_id,
            response_id=fb.response_id,
            feedback_text=fb.feedback_text,
            created_at=fb.created_at.isoformat(),
        )
        for fb in feedbacks
    ]


@router.get("/api/educator/export/csv")
async def export_educator_csv(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Export student performance data as CSV for MTSS documentation."""
    # Query all students with their skill scores
    result = await db.execute(
        select(User).where(User.role == "student")
    )
    students = result.scalars().all()

    # Build skill score lookup: {user_id: {skill_id: score}}
    skill_result = await db.execute(select(SkillScore))
    all_skills = skill_result.scalars().all()
    skill_map: dict[int, dict[str, float]] = {}
    for ss in all_skills:
        skill_map.setdefault(ss.user_id, {})[ss.skill_id] = round(ss.score, 1)

    # Count responses per user
    response_counts_result = await db.execute(
        select(Response.user_id, func.count(Response.id))
        .group_by(Response.user_id)
    )
    response_counts: dict[int, int] = {
        row[0]: row[1] for row in response_counts_result.all()
    }

    csv_columns = [
        "name", "username", "level", "xp_total", "overall_tier",
        "avg_score", "price_action", "options_chain", "strike_select",
        "risk_mgmt", "position_size", "regime_id", "vol_assess",
        "trade_mgmt", "response_count",
    ]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(csv_columns)

    for student in students:
        skills = skill_map.get(student.id, {})
        scores = list(skills.values())
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        overall_tier = classify_tier(avg_score).value

        writer.writerow([
            student.name or student.username,
            student.username,
            student.level,
            student.xp_total,
            overall_tier,
            avg_score,
            skills.get("price_action", 0.0),
            skills.get("options_chain", 0.0),
            skills.get("strike_select", 0.0),
            skills.get("risk_mgmt", 0.0),
            skills.get("position_size", 0.0),
            skills.get("regime_id", 0.0),
            skills.get("vol_assess", 0.0),
            skills.get("trade_mgmt", 0.0),
            response_counts.get(student.id, 0),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=student_export.csv"},
    )


@router.get("/api/educator/activity-feed")
async def get_activity_feed(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityFeedItem]:
    """Recent class activity feed (last 50 items).

    Aggregates recent scenario responses, level-ups (XP logs), and new registrations.
    """
    items: list[ActivityFeedItem] = []

    # 1. Recent scenario responses
    resp_result = await db.execute(
        select(Response)
        .order_by(Response.created_at.desc())
        .limit(20)
    )
    responses = resp_result.scalars().all()
    for resp in responses:
        user = await db.get(User, resp.user_id)
        scenario = await db.get(Scenario, resp.scenario_id)
        if user:
            items.append(
                ActivityFeedItem(
                    event_type="scenario_response",
                    user_id=user.id,
                    username=user.username,
                    description=f"{user.username} completed a scenario"
                    + (f" on {scenario.skill_target}" if scenario else ""),
                    timestamp=resp.created_at.isoformat(),
                    metadata={
                        "response_id": resp.id,
                        "scenario_id": resp.scenario_id,
                    },
                )
            )

    # 2. Recent XP logs (level-ups / achievements)
    xp_result = await db.execute(
        select(XPLog)
        .order_by(XPLog.created_at.desc())
        .limit(20)
    )
    xp_logs = xp_result.scalars().all()
    for xp_log in xp_logs:
        user = await db.get(User, xp_log.user_id)
        if user:
            items.append(
                ActivityFeedItem(
                    event_type="xp_earned",
                    user_id=user.id,
                    username=user.username,
                    description=f"{user.username} earned {xp_log.amount} XP from {xp_log.source}",
                    timestamp=xp_log.created_at.isoformat(),
                    metadata={
                        "amount": xp_log.amount,
                        "source": xp_log.source,
                    },
                )
            )

    # 3. Recent registrations
    new_users_result = await db.execute(
        select(User)
        .where(User.role == "student")
        .order_by(User.created_at.desc())
        .limit(10)
    )
    new_users = new_users_result.scalars().all()
    for u in new_users:
        items.append(
            ActivityFeedItem(
                event_type="new_registration",
                user_id=u.id,
                username=u.username,
                description=f"{u.username} joined the class",
                timestamp=u.created_at.isoformat(),
                metadata={},
            )
        )

    # Sort all items by timestamp descending, take top 50
    items.sort(key=lambda x: x.timestamp, reverse=True)
    return items[:50]
