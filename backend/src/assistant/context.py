"""Student context builder for educator AI analysis."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import Grade, PeerReview, PeerReviewAssignment, Response, SkillScore, User, UserChunkProgress, UserStreak
from src.lessons.service import CHUNKS, MODULES, ORDERED_MODULE_IDS
from src.mtss.classifier import classify_tier


async def fetch_student_analysis_context(db: AsyncSession, student_id: int) -> dict:
    """Query all relevant data for a student to build AI context."""
    student = await db.get(User, student_id)
    if not student:
        return {}

    # Skill scores
    skill_result = await db.execute(
        select(SkillScore).where(SkillScore.user_id == student_id)
    )
    skills = skill_result.scalars().all()

    # Recent responses with grades (last 10)
    response_result = await db.execute(
        select(Response, Grade)
        .outerjoin(Grade, Grade.response_id == Response.id)
        .where(Response.user_id == student_id)
        .order_by(Response.created_at.desc())
        .limit(10)
    )
    responses = response_result.all()

    # Peer review stats
    given_result = await db.execute(
        select(PeerReview)
        .join(PeerReviewAssignment, PeerReview.assignment_id == PeerReviewAssignment.id)
        .where(PeerReviewAssignment.reviewer_id == student_id)
    )
    reviews_given = given_result.scalars().all()

    received_result = await db.execute(
        select(PeerReview)
        .join(PeerReviewAssignment, PeerReview.assignment_id == PeerReviewAssignment.id)
        .where(PeerReviewAssignment.reviewee_id == student_id)
    )
    reviews_received = received_result.scalars().all()

    # Lesson progress (quiz scores per chunk)
    chunk_result = await db.execute(
        select(UserChunkProgress)
        .where(UserChunkProgress.user_id == student_id)
        .order_by(UserChunkProgress.updated_at.desc())
    )
    chunk_progress = chunk_result.scalars().all()

    # Streak / lesson XP
    streak_result = await db.execute(
        select(UserStreak).where(UserStreak.user_id == student_id)
    )
    streak = streak_result.scalar_one_or_none()

    # Compute overall tier
    scores = [s.score for s in skills]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    overall_tier = classify_tier(avg_score)

    return {
        "student": student,
        "skills": skills,
        "responses": responses,
        "reviews_given": reviews_given,
        "reviews_received": reviews_received,
        "chunk_progress": chunk_progress,
        "streak": streak,
        "avg_score": avg_score,
        "overall_tier": overall_tier,
    }


def format_student_context(data: dict) -> str:
    """Format student data into readable text for the LLM."""
    if not data or not data.get("student"):
        return ""

    student = data["student"]
    lines = [
        f"## Student Profile: {student.name or student.username}",
        f"- Username: {student.username}",
        f"- Level: {student.level} | XP: {student.xp_total}",
        f"- Overall MTSS Tier: {data['overall_tier'].value}",
        f"- Average Skill Score: {data['avg_score']:.1f}/100",
        "",
        "## Skill Scores",
    ]

    for skill in data["skills"]:
        tier = classify_tier(skill.score)
        lines.append(f"- {skill.skill_id}: {skill.score:.1f}/100 ({tier.value})")

    lines.append("")
    lines.append(f"## Recent Performance ({len(data['responses'])} most recent)")

    for response, grade in data["responses"]:
        if grade:
            lines.append(
                f"- Score: {grade.overall_score:.1f}/5 | "
                f"Tech: {grade.technical_accuracy:.1f} | "
                f"Risk: {grade.risk_awareness:.1f} | "
                f"Strategy: {grade.strategy_fit:.1f} | "
                f"Reasoning: {grade.reasoning_clarity:.1f}"
            )
            if grade.feedback_text:
                lines.append(f"  Feedback: {grade.feedback_text[:200]}")

    # Lesson progress
    chunk_progress = data.get("chunk_progress", [])
    streak = data.get("streak")
    if chunk_progress or streak:
        lines.append("")
        lines.append("## Lesson Progress")
        if streak:
            lines.append(f"- Lesson XP: {streak.lesson_xp_total}")
            lines.append(f"- Current streak: {streak.current_streak} day(s)")
        # Group chunk progress by module
        progress_by_module: dict[str, list] = {}
        for cp in chunk_progress:
            chunk_def = CHUNKS.get(cp.chunk_id)
            module_id = chunk_def.module_id if chunk_def else "unknown"
            progress_by_module.setdefault(module_id, []).append(cp)

        for module_id in ORDERED_MODULE_IDS:
            if module_id not in progress_by_module:
                continue
            module_def = MODULES.get(module_id)
            module_title = module_def.title if module_def else module_id
            lines.append(f"\n### {module_title}")
            for cp in progress_by_module[module_id]:
                chunk_def = CHUNKS.get(cp.chunk_id)
                chunk_title = chunk_def.title if chunk_def else cp.chunk_id
                status = "Mastered" if cp.mastered else ("Completed" if cp.completed else "In progress")
                lines.append(
                    f"- {chunk_title}: best {cp.best_score:.0f}% | last {cp.latest_score:.0f}% | "
                    f"{cp.attempts} attempt(s) | {status}"
                )

    lines.append("")
    lines.append("## Peer Review Activity")
    lines.append(f"- Reviews given: {len(data['reviews_given'])}")
    lines.append(f"- Reviews received: {len(data['reviews_received'])}")

    if data["reviews_given"]:
        avg_given = sum(r.overall_score for r in data["reviews_given"]) / len(data["reviews_given"])
        lines.append(f"- Avg score given to peers: {avg_given:.1f}/5")

    if data["reviews_received"]:
        avg_received = sum(r.overall_score for r in data["reviews_received"]) / len(data["reviews_received"])
        lines.append(f"- Avg score received from peers: {avg_received:.1f}/5")

    return "\n".join(lines)
