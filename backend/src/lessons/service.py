"""Lessons content and progress service for phase 1."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User, UserChunkProgress, UserStreak
from src.gamification.xp import calculate_level

MASTERY_THRESHOLD = 80.0
BASE_COMPLETION_XP = 20
RETRY_COMPLETION_XP = 10
FIRST_MASTERY_BONUS_XP = 30


@dataclass(frozen=True)
class QuizItemDef:
    """Single quiz item definition."""

    item_id: str
    item_type: str
    prompt: str
    options: list[dict[str, str]]
    correct_option_id: str | None
    explanation: str
    why_it_matters: str


@dataclass(frozen=True)
class ChunkDef:
    """Lesson chunk definition."""

    chunk_id: str
    module_id: str
    order: int
    title: str
    estimated_minutes: int
    learning_goal: str
    explain_text: str
    example_text: str
    key_takeaway: str
    common_mistakes: list[str]
    quick_check_prompts: list[str]
    quiz_items: list[QuizItemDef]


@dataclass(frozen=True)
class ModuleDef:
    """Lesson module definition."""

    module_id: str
    title: str
    track: str
    order: int
    objective: str | None
    estimated_minutes: int
    prerequisite_ids: list[str]
    chunk_ids: list[str]


MODULE_BLUEPRINTS: list[dict[str, object]] = [
    {"module_id": "f1", "title": "Market Basics and Language", "track": "foundation", "objective": None},
    {"module_id": "f2", "title": "Instruments and Options Basics", "track": "foundation", "objective": None},
    {"module_id": "f3", "title": "Risk-First Thinking and Trade Planning", "track": "foundation", "objective": None},
    {"module_id": "m1", "title": "Price Action", "track": "core", "objective": "price_action"},
    {"module_id": "m2", "title": "Options Chain", "track": "core", "objective": "options_chain"},
    {"module_id": "m3", "title": "Strike Selection", "track": "core", "objective": "strike_select"},
    {"module_id": "m4", "title": "Risk Management", "track": "core", "objective": "risk_mgmt"},
    {"module_id": "m5", "title": "Position Sizing", "track": "core", "objective": "position_size"},
    {"module_id": "m6", "title": "Regime Identification", "track": "core", "objective": "regime_id"},
    {"module_id": "m7", "title": "Volatility Assessment", "track": "core", "objective": "vol_assess"},
    {"module_id": "m8", "title": "Trade Management", "track": "core", "objective": "trade_mgmt"},
    {"module_id": "c1", "title": "Capstone Trading Mission", "track": "capstone", "objective": None},
]

CHUNK_TITLES = [
    "Core Concept",
    "Worked Example",
    "Decision Framing",
    "Checkpoint Quiz",
]

MODULE_DEEP_DIVE: dict[str, dict[str, object]] = {
    "f2": {
        "focus": "instrument selection",
        "concept": "stocks vs options, contract multiplier, calls vs puts",
        "example": "A stock position has no expiry, while an option decays with time and expires.",
        "rule": "Only trade instruments whose max loss and behavior you can explain clearly.",
        "traps": [
            "Using options without understanding expiration",
            "Ignoring 100-share contract multiplier",
            "Choosing products based only on low price",
        ],
    },
    "f3": {
        "focus": "risk-first planning",
        "concept": "max loss, stop logic, risk-reward, no-trade criteria",
        "example": "If max loss is above plan before entry, the trade is skipped.",
        "rule": "Define invalidation and max loss before entry.",
        "traps": [
            "Sizing from confidence instead of risk budget",
            "Moving stops farther after entry",
            "Entering without no-trade criteria",
        ],
    },
    "m1": {
        "focus": "price action context",
        "concept": "trend, range, break, pullback, support and resistance",
        "example": "A breakout that instantly fails back into range is a warning sign.",
        "rule": "Trade patterns only when context supports continuation.",
        "traps": [
            "Trading candle shapes without context",
            "Ignoring nearby support/resistance",
            "Chasing after extended candles",
        ],
    },
    "m2": {
        "focus": "options chain interpretation",
        "concept": "open interest, volume, spread, implied volatility by strike",
        "example": "High open interest and tight spread typically indicate better execution quality.",
        "rule": "Prefer liquid strikes with manageable spread and clear volatility context.",
        "traps": [
            "Picking illiquid strikes for cheap premium",
            "Ignoring spread costs",
            "Using open interest without confirming current volume",
        ],
    },
    "m3": {
        "focus": "strike selection",
        "concept": "ITM/ATM/OTM tradeoffs, delta, probability versus premium cost",
        "example": "ATM options react faster than far OTM, but cost more premium.",
        "rule": "Strike choice must match thesis strength, horizon, and acceptable loss.",
        "traps": [
            "Buying far OTM just because it is cheap",
            "No link between thesis and strike distance",
            "Ignoring time decay for short-dated options",
        ],
    },
    "m4": {
        "focus": "risk management execution",
        "concept": "hard stop, soft stop, daily loss cap, hedge decisions",
        "example": "A daily max loss cap prevents emotional overtrading after drawdown.",
        "rule": "Risk limits are pre-committed and non-negotiable.",
        "traps": [
            "Removing stops during stress",
            "Adding size to recover losses fast",
            "No daily drawdown guardrail",
        ],
    },
    "m5": {
        "focus": "position sizing",
        "concept": "risk per trade, stop distance, volatility-adjusted size",
        "example": "Wider stop means smaller size to keep risk constant.",
        "rule": "Size equals allowed risk divided by per-unit risk.",
        "traps": [
            "Using same size across all volatility regimes",
            "Rounding position size up aggressively",
            "Ignoring portfolio correlation",
        ],
    },
    "m6": {
        "focus": "market regime identification",
        "concept": "trend, range, high-volatility transition, strategy fit",
        "example": "A range strategy breaks when volatility expansion starts.",
        "rule": "Identify regime first, then pick strategy family.",
        "traps": [
            "Applying trend strategy in chop",
            "Ignoring volatility expansion warnings",
            "No regime checklist before entry",
        ],
    },
    "m7": {
        "focus": "volatility assessment",
        "concept": "IV vs HV, percentile context, expansion and contraction",
        "example": "High IV may justify premium selling, but event risk still matters.",
        "rule": "Volatility context must influence strategy and size.",
        "traps": [
            "Treating high IV as automatic sell signal",
            "No event-calendar awareness",
            "Ignoring post-event volatility crush",
        ],
    },
    "m8": {
        "focus": "trade management",
        "concept": "partial profit, trailing stop, adjustment triggers, exit discipline",
        "example": "Taking partials can reduce emotional pressure and preserve expectancy.",
        "rule": "Manage with predefined triggers, not emotion.",
        "traps": [
            "No plan for managing winners",
            "Taking all profits too early every trade",
            "Holding losers without adjustment criteria",
        ],
    },
    "c1": {
        "focus": "integrated mission execution",
        "concept": "context, product, strike, risk, regime, volatility, management",
        "example": "A complete plan aligns setup quality, instrument choice, and risk limits.",
        "rule": "If any core layer is weak, reduce size or pass.",
        "traps": [
            "Skipping one layer because others look strong",
            "Overconfidence after one good setup",
            "No post-trade review loop",
        ],
    },
}


def _build_quiz_items(
    module_title: str,
    chunk_title: str,
    seed: str,
    focus: str,
) -> list[QuizItemDef]:
    """Build mixed quiz format for each chunk."""
    return [
        QuizItemDef(
            item_id=f"{seed}-q1",
            item_type="mcq",
            prompt=f"In {module_title.lower()}, what should come first?",
            options=[
                {"id": "a", "text": "Define risk before execution"},
                {"id": "b", "text": "Increase size first"},
                {"id": "c", "text": "Skip context and react fast"},
            ],
            correct_option_id="a",
            explanation="Risk-first process is the foundation of repeatable decisions.",
            why_it_matters="Without risk structure, one bad trade can erase many good ones.",
        ),
        QuizItemDef(
            item_id=f"{seed}-q2",
            item_type="mcq",
            prompt=f"In {chunk_title.lower()}, what shows strong reasoning?",
            options=[
                {"id": "a", "text": "If/then rule with invalidation"},
                {"id": "b", "text": "A hunch with no stop"},
                {"id": "c", "text": "Copying someone else blindly"},
            ],
            correct_option_id="a",
            explanation="If/then framing makes choices testable and reviewable.",
            why_it_matters="Review quality improves only when your logic is explicit.",
        ),
        QuizItemDef(
            item_id=f"{seed}-q3",
            item_type="scenario",
            prompt=f"Mini scenario ({focus}): uncertainty rises and setup quality drops. Best action?",
            options=[
                {"id": "a", "text": "Reduce size and wait for confirmation"},
                {"id": "b", "text": "Double down immediately"},
                {"id": "c", "text": "Ignore your risk limits"},
            ],
            correct_option_id="a",
            explanation="When uncertainty rises, risk should be reduced rather than increased.",
            why_it_matters="Capital protection keeps you in the game long enough to improve.",
        ),
        QuizItemDef(
            item_id=f"{seed}-q4",
            item_type="reflection",
            prompt="Confidence check: explain in 1-2 sentences when you would skip this trade.",
            options=[],
            correct_option_id=None,
            explanation="Skip rules are as important as entry rules.",
            why_it_matters="Avoiding low-quality setups is core professional behavior.",
        ),
    ]


def _generic_quick_checks(focus: str, rule: str) -> list[str]:
    return [
        f"What is your one-sentence thesis for this {focus} setup?",
        f"What invalidates your idea? ({rule})",
        "How would you reduce risk if volatility increases suddenly?",
    ]


def _build_f1_chunk(
    chunk_id: str,
    module_id: str,
    chunk_order: int,
    seed: str,
) -> ChunkDef:
    """Authored beginner-friendly content for Market Basics and Language."""
    if chunk_order == 1:
        return ChunkDef(
            chunk_id=chunk_id,
            module_id=module_id,
            order=chunk_order,
            title="Market Basics and Language: What a market is",
            estimated_minutes=6,
            learning_goal=(
                "Understand what a market is, what a ticker symbol means, and why prices move."
            ),
            explain_text=(
                "A market is a place where buyers and sellers come together to exchange assets (like stocks or options) "
                "at prices they agree on. No single person sets the price—it emerges from the balance of supply and demand.\n\n"
                "Every tradable asset has a ticker symbol: a short code that identifies it. For example, AAPL is Apple Inc., "
                "SPY is an S&P 500 ETF, and MSFT is Microsoft. Tickers let everyone refer to the same asset quickly and avoid confusion.\n\n"
                "Prices move because of who is more aggressive at that moment. When buyers are willing to pay more and keep "
                "lifting their bids, price tends to rise. When sellers are more aggressive and keep lowering their asks to find a taker, "
                "price tends to fall. So price movement is really the outcome of a continuous auction between buyers and sellers—not random noise."
            ),
            example_text=(
                "Imagine a stock is trading around $100. A wave of buy orders comes in; buyers keep raising their bids "
                "($100.05, $100.10, $100.20) to get filled. Sellers see the demand and hold out for higher prices. The result: "
                "price climbs because buyers are in control and are accepting higher levels. If instead sellers rushed to exit "
                "and kept lowering their asks, price would fall. So who is in control—buyers or sellers—drives short-term direction."
            ),
            key_takeaway="Price movement is a buyer-vs-seller auction, not random noise. Read who is in control.",
            common_mistakes=[
                "Confusing ticker code with company name assumptions",
                "Ignoring who is in control (buyers or sellers)",
                "Trading without understanding the instrument",
            ],
            quick_check_prompts=[
                "In one sentence, what is a market?",
                "How do buyers and sellers push price up or down?",
                "What condition would make you avoid this ticker today?",
            ],
            quiz_items=[
                QuizItemDef(
                    item_id=f"{seed}-q1",
                    item_type="mcq",
                    prompt="What does a ticker symbol represent?",
                    options=[
                        {"id": "a", "text": "A short code for a tradable asset"},
                        {"id": "b", "text": "The number of shares available"},
                        {"id": "c", "text": "A guaranteed future price"},
                    ],
                    correct_option_id="a",
                    explanation="Tickers identify tradable assets quickly and consistently.",
                    why_it_matters="Correct asset identification is step one of valid analysis.",
                ),
                QuizItemDef(
                    item_id=f"{seed}-q2",
                    item_type="mcq",
                    prompt="When does price usually move up?",
                    options=[
                        {"id": "a", "text": "When buyers are more aggressive than sellers"},
                        {"id": "b", "text": "Only at market open"},
                        {"id": "c", "text": "Only when there are no sellers"},
                    ],
                    correct_option_id="a",
                    explanation="Up moves happen when buy pressure accepts higher prices.",
                    why_it_matters="This helps you read momentum instead of guessing direction.",
                ),
                QuizItemDef(
                    item_id=f"{seed}-q3",
                    item_type="scenario",
                    prompt="Mini scenario: heavy buy orders push price up quickly. Best interpretation?",
                    options=[
                        {"id": "a", "text": "Buyers currently control short-term action"},
                        {"id": "b", "text": "The ticker is broken"},
                        {"id": "c", "text": "Price must reverse immediately"},
                    ],
                    correct_option_id="a",
                    explanation="Aggressive buying often signals short-term buyer control.",
                    why_it_matters="Control shifts are core context for setup decisions.",
                ),
                QuizItemDef(
                    item_id=f"{seed}-q4",
                    item_type="reflection",
                    prompt="In one sentence, explain how buyers and sellers create price movement.",
                    options=[],
                    correct_option_id=None,
                    explanation="Clear causal language is foundational market literacy.",
                    why_it_matters="You need this mental model before advanced strategy layers.",
                ),
            ],
        )

    if chunk_order == 2:
        return ChunkDef(
            chunk_id=chunk_id,
            module_id=module_id,
            order=chunk_order,
            title="Market Basics and Language: Bid, ask, and spread",
            estimated_minutes=6,
            learning_goal="Understand bid/ask/spread and how liquidity impacts execution quality.",
            explain_text=(
                "The bid is the highest price that a buyer is currently willing to pay. The ask is the lowest price "
                "that a seller is currently willing to accept. When you buy, you typically pay the ask; when you sell, "
                "you typically receive the bid.\n\n"
                "The spread is the difference between the ask and the bid (ask minus bid). It represents the cost of "
                "trading that security at that moment. A tight spread (e.g. one cent) usually means many participants and "
                "good liquidity. A wide spread means fewer participants or more uncertainty—and your real execution cost "
                "is higher because you give up that spread on every round trip."
            ),
            example_text=(
                "If the bid is 99.90 and the ask is 100.10, the spread is 0.20. If you buy at the ask (100.10) and "
                "the price doesn't move, selling at the bid (99.90) would lock in a 0.20 loss—that's the spread cost. "
                "In liquid names the spread might be 0.01; in illiquid ones it can be much wider. Always check the spread "
                "before you enter so you know your hidden friction."
            ),
            key_takeaway="Spread is hidden friction. Check it before every entry.",
            common_mistakes=[
                "Ignoring spread on low-liquidity instruments",
                "Using market orders in wide spreads",
                "Assuming all tickers have equal liquidity",
            ],
            quick_check_prompts=[
                "Define bid, ask, and spread in plain words.",
                "How does a wide spread change your execution plan?",
                "When would you avoid a market order?",
            ],
            quiz_items=_build_quiz_items(
                module_title="Market Basics and Language",
                chunk_title=CHUNK_TITLES[1],
                seed=seed,
                focus="bid-ask execution",
            ),
        )

    if chunk_order == 3:
        return ChunkDef(
            chunk_id=chunk_id,
            module_id=module_id,
            order=chunk_order,
            title="Market Basics and Language: If/then trade language",
            estimated_minutes=6,
            learning_goal="Write a clear if/then trade rule with invalidation.",
            explain_text=(
                "Professional traders use clear if/then language so they know exactly when to act and when to exit. "
                "Vague language like 'it looks strong' leads to emotional, inconsistent decisions.\n\n"
                "A solid rule has two parts: (1) IF your setup condition appears, THEN you take the planned action (e.g. enter, add). "
                "(2) IF your invalidation condition appears, THEN you exit or reduce. Invalidation is the sign that your thesis "
                "is wrong or no longer valid—for example, price breaking below a key level, or volume drying up.\n\n"
                "Writing these down before you trade forces you to define what you believe and what would prove you wrong. "
                "That reduces impulsive moves when the market gets noisy."
            ),
            example_text=(
                "IF price holds above the prior day's high with rising volume, THEN enter a small long position. "
                "IF price closes back below that prior day high, THEN exit—that invalidates the breakout thesis. "
                "Having this written before you enter keeps you from moving the exit when you're in the trade."
            ),
            key_takeaway="If you cannot define invalidation, the setup is incomplete.",
            common_mistakes=[
                "Using vague terms like 'looks strong'",
                "Entering without invalidation",
                "Changing rules after entry",
            ],
            quick_check_prompts=[
                "Write one IF/THEN rule for a long idea.",
                "What exact event invalidates your thesis?",
                "How do you change size if volatility expands?",
            ],
            quiz_items=_build_quiz_items(
                module_title="Market Basics and Language",
                chunk_title=CHUNK_TITLES[2],
                seed=seed,
                focus="rule clarity",
            ),
        )

    return ChunkDef(
        chunk_id=chunk_id,
        module_id=module_id,
        order=chunk_order,
        title="Market Basics and Language: Checkpoint application",
        estimated_minutes=6,
        learning_goal="Apply ticker, pressure, spread, and if/then logic in one workflow.",
        explain_text=(
            "Checkpoint workflow:\n"
            "1) Identify instrument and context\n"
            "2) Check spread and liquidity\n"
            "3) Define if/then rule and invalidation"
        ),
        example_text="Example flow: identify -> assess pressure -> validate liquidity -> decide or pass.",
        key_takeaway="A simple checklist beats emotional improvisation.",
        common_mistakes=[
            "Skipping steps when market feels urgent",
            "Entering before risk is defined",
            "Confusing confidence with setup quality",
        ],
        quick_check_prompts=[
            "What are your 3 pre-trade checklist steps?",
            "Where is invalidation in this setup?",
            "What would make this a no-trade?",
        ],
        quiz_items=_build_quiz_items(
            module_title="Market Basics and Language",
            chunk_title=CHUNK_TITLES[3],
            seed=seed,
            focus="checklist discipline",
        ),
    )


def _build_module_chunk(
    module_id: str,
    module_title: str,
    chunk_id: str,
    chunk_order: int,
    seed: str,
) -> ChunkDef:
    """Build module-specific chunks for all non-f1 modules."""
    data = MODULE_DEEP_DIVE[module_id]
    focus = str(data["focus"])
    concept = str(data["concept"])
    example = str(data["example"])
    rule = str(data["rule"])
    traps = list(data["traps"])  # type: ignore[arg-type]
    chunk_title = CHUNK_TITLES[chunk_order - 1]

    if chunk_order == 1:
        learning_goal = f"Understand the core of {focus}: {concept}."
        explain_text = (
            f"This chunk focuses on {focus}. In plain terms: {concept}\n\n"
            "Before you act on any setup, identify the specific signal or condition you are relying on. "
            "That keeps you from trading on gut feel or noise. Also separate what the market is actually "
            "doing (context) from how you feel about it (emotion)—decisions should follow your rules, not your mood."
        )
        example_text = f"Example: {example}"
        takeaway = rule
    elif chunk_order == 2:
        learning_goal = f"Apply {focus} through a realistic worked example."
        explain_text = (
            "Worked example sequence:\n"
            "- Read context first\n"
            "- Compare at least two choices\n"
            "- Select the option with controlled downside"
        )
        example_text = f"Worked example: {example}"
        takeaway = "Good decisions come from process quality, not prediction certainty."
    elif chunk_order == 3:
        learning_goal = f"Convert {focus} into if/then rules you can execute consistently."
        explain_text = (
            "Decision framing template:\n"
            "IF setup condition appears -> THEN execute planned action\n"
            "IF invalidation appears -> THEN reduce or exit\n"
            "IF uncertainty expands -> THEN reduce size"
        )
        example_text = f"Rule anchor: {rule}"
        takeaway = "Write rule logic before entry so stress does not rewrite your plan."
    else:
        learning_goal = f"Demonstrate practical understanding of {focus} under pressure."
        explain_text = (
            "Checkpoint flow:\n"
            "- State thesis\n"
            "- State invalidation and risk\n"
            "- State management plan for both favorable and adverse paths"
        )
        example_text = f"Checkpoint context: {example}"
        takeaway = "Mastery means clear logic plus clear risk control."

    return ChunkDef(
        chunk_id=chunk_id,
        module_id=module_id,
        order=chunk_order,
        title=f"{module_title}: {chunk_title}",
        estimated_minutes=6,
        learning_goal=learning_goal,
        explain_text=explain_text,
        example_text=example_text,
        key_takeaway=takeaway,
        common_mistakes=traps,
        quick_check_prompts=_generic_quick_checks(focus, rule),
        quiz_items=_build_quiz_items(module_title, chunk_title, seed, focus),
    )


def _build_catalog() -> tuple[dict[str, ModuleDef], dict[str, ChunkDef], list[str]]:
    modules: dict[str, ModuleDef] = {}
    chunks: dict[str, ChunkDef] = {}
    order_ids: list[str] = []

    previous_module_id: str | None = None

    for idx, blueprint in enumerate(MODULE_BLUEPRINTS, start=1):
        module_id = str(blueprint["module_id"])
        module_title = str(blueprint["title"])
        track = str(blueprint["track"])
        objective = blueprint["objective"]

        chunk_ids: list[str] = []
        for chunk_order in range(1, 5):
            chunk_id = f"{module_id}-ch{chunk_order}"
            chunk_ids.append(chunk_id)
            seed = f"{module_id}-{chunk_order}"
            if module_id == "f1":
                chunks[chunk_id] = _build_f1_chunk(
                    chunk_id=chunk_id,
                    module_id=module_id,
                    chunk_order=chunk_order,
                    seed=seed,
                )
            else:
                chunks[chunk_id] = _build_module_chunk(
                    module_id=module_id,
                    module_title=module_title,
                    chunk_id=chunk_id,
                    chunk_order=chunk_order,
                    seed=seed,
                )

        modules[module_id] = ModuleDef(
            module_id=module_id,
            title=module_title,
            track=track,
            order=idx,
            objective=str(objective) if objective else None,
            estimated_minutes=24,
            prerequisite_ids=[previous_module_id] if previous_module_id else [],
            chunk_ids=chunk_ids,
        )
        order_ids.append(module_id)
        previous_module_id = module_id

    return modules, chunks, order_ids


MODULES, CHUNKS, ORDERED_MODULE_IDS = _build_catalog()


async def get_user_state(user_id: int, db: AsyncSession) -> UserStreak:
    """Get or create UserStreak row for a user."""
    result = await db.execute(select(UserStreak).where(UserStreak.user_id == user_id))
    streak_row = result.scalar_one_or_none()
    if streak_row is None:
        streak_row = UserStreak(
            user_id=user_id,
            current_streak=0,
            last_activity_date=None,
            lesson_xp_total=0,
        )
        db.add(streak_row)
        await db.commit()
        await db.refresh(streak_row)
    return streak_row


def list_modules() -> list[ModuleDef]:
    """List modules in sequence."""
    return [MODULES[module_id] for module_id in ORDERED_MODULE_IDS]


def get_module(module_id: str) -> ModuleDef | None:
    """Get a module by ID."""
    return MODULES.get(module_id)


def list_module_chunks(module_id: str) -> list[ChunkDef]:
    """Return ordered chunks for module."""
    module = MODULES[module_id]
    return [CHUNKS[chunk_id] for chunk_id in module.chunk_ids]


def get_chunk(chunk_id: str) -> ChunkDef | None:
    """Get a chunk by ID."""
    return CHUNKS.get(chunk_id)


async def _ensure_chunk_progress(
    user_id: int, chunk_id: str, db: AsyncSession
) -> UserChunkProgress:
    """Get or create UserChunkProgress row for a user/chunk pair."""
    result = await db.execute(
        select(UserChunkProgress).where(
            UserChunkProgress.user_id == user_id,
            UserChunkProgress.chunk_id == chunk_id,
        )
    )
    progress = result.scalar_one_or_none()
    if progress is None:
        progress = UserChunkProgress(
            user_id=user_id,
            chunk_id=chunk_id,
            attempts=0,
            latest_score=0.0,
            best_score=0.0,
            mastered=False,
            completed=False,
            completion_xp_awarded=False,
            mastery_bonus_awarded=False,
        )
        db.add(progress)
        await db.commit()
        await db.refresh(progress)
    return progress


def _update_streak(streak_row: UserStreak) -> None:
    """Update streak fields on the ORM object (no DB I/O — caller commits)."""
    today = datetime.now(UTC).date()
    if streak_row.last_activity_date is None:
        streak_row.current_streak = 1
    elif streak_row.last_activity_date == today:
        return
    elif (today - streak_row.last_activity_date).days == 1:
        streak_row.current_streak += 1
    else:
        streak_row.current_streak = 1
    streak_row.last_activity_date = today


async def attempt_chunk(
    user_id: int,
    chunk_id: str,
    answers_by_item: dict[str, str],
    db: AsyncSession,
    chunk: ChunkDef,
) -> dict[str, object]:
    """Score a quiz attempt and return feedback. Chunk content comes from DB (caller loads via repository)."""
    streak_row = await get_user_state(user_id, db)
    progress = await _ensure_chunk_progress(user_id, chunk_id, db)

    graded_items = [item for item in chunk.quiz_items if item.item_type != "reflection"]
    correct_count = 0
    feedback: list[dict[str, object]] = []

    for item in chunk.quiz_items:
        answer = answers_by_item.get(item.item_id, "")
        if item.item_type == "reflection":
            feedback.append(
                {
                    "item_id": item.item_id,
                    "correct": None,
                    "feedback": "Reflection captured. Keep your rule specific and measurable.",
                    "why_it_matters": item.why_it_matters,
                }
            )
            continue

        is_correct = answer == item.correct_option_id
        if is_correct:
            correct_count += 1
        feedback.append(
            {
                "item_id": item.item_id,
                "correct": is_correct,
                "feedback": item.explanation,
                "why_it_matters": item.why_it_matters,
            }
        )

    score_percent = round((correct_count / len(graded_items)) * 100.0, 1) if graded_items else 0.0
    progress.attempts += 1
    progress.latest_score = score_percent
    if score_percent > progress.best_score:
        progress.best_score = score_percent

    newly_mastered = False
    if score_percent >= MASTERY_THRESHOLD and not progress.mastered:
        progress.mastered = True
        newly_mastered = True

    xp_earned = 0
    if newly_mastered and not progress.mastery_bonus_awarded:
        xp_earned += FIRST_MASTERY_BONUS_XP
        progress.mastery_bonus_awarded = True

    if xp_earned > 0:
        streak_row.lesson_xp_total += xp_earned

    _update_streak(streak_row)

    db.add(progress)
    db.add(streak_row)
    await db.commit()
    await db.refresh(progress)
    await db.refresh(streak_row)

    # Update User.xp_total and level when XP is earned
    if xp_earned > 0:
        user = await db.get(User, user_id)
        if user is not None:
            user.xp_total = (user.xp_total or 0) + xp_earned
            user.level = calculate_level(user.xp_total)
            db.add(user)
            await db.commit()

    _ordered = ORDERED_MODULE_IDS
    _chunk_ids = {mid: MODULES[mid].chunk_ids for mid in _ordered}
    _tracks = {mid: MODULES[mid].track for mid in _ordered}
    _titles = {mid: MODULES[mid].title for mid in _ordered}
    badges = await calculate_new_badges(
        user_id, db, _ordered, _chunk_ids, _tracks, _titles
    )

    return {
        "score_percent": score_percent,
        "mastered": progress.mastered,
        "recommended_retry": score_percent < MASTERY_THRESHOLD,
        "attempt_number": progress.attempts,
        "latest_score": progress.latest_score,
        "best_score": progress.best_score,
        "item_feedback": feedback,
        "xp_earned": xp_earned,
        "badges_awarded": badges,
    }


async def complete_chunk(user_id: int, chunk_id: str, db: AsyncSession) -> dict[str, object]:
    """Mark chunk complete and grant completion XP."""
    streak_row = await get_user_state(user_id, db)
    progress = await _ensure_chunk_progress(user_id, chunk_id, db)
    progress.completed = True

    xp_earned = 0
    if not progress.completion_xp_awarded:
        xp_earned = BASE_COMPLETION_XP if progress.attempts <= 1 else RETRY_COMPLETION_XP
        progress.completion_xp_awarded = True
        streak_row.lesson_xp_total += xp_earned

    _update_streak(streak_row)

    db.add(progress)
    db.add(streak_row)
    await db.commit()
    await db.refresh(progress)
    await db.refresh(streak_row)

    # Update User.xp_total and level when XP is earned
    if xp_earned > 0:
        user = await db.get(User, user_id)
        if user is not None:
            user.xp_total = (user.xp_total or 0) + xp_earned
            user.level = calculate_level(user.xp_total)
            db.add(user)
            await db.commit()

    _ordered = ORDERED_MODULE_IDS
    _chunk_ids = {mid: MODULES[mid].chunk_ids for mid in _ordered}
    _tracks = {mid: MODULES[mid].track for mid in _ordered}
    _titles = {mid: MODULES[mid].title for mid in _ordered}
    badges = await calculate_new_badges(
        user_id, db, _ordered, _chunk_ids, _tracks, _titles
    )

    return {
        "completed": progress.completed,
        "xp_earned": xp_earned,
        "badges_awarded": badges,
    }


async def get_streak(user_id: int, db: AsyncSession) -> dict[str, object]:
    """Return streak details."""
    streak_row = await get_user_state(user_id, db)
    return {
        "current_streak": streak_row.current_streak,
        "last_activity_date": streak_row.last_activity_date.isoformat()
        if streak_row.last_activity_date
        else None,
    }


async def _module_stats(
    user_id: int,
    module_id: str,
    chunk_ids: list[str],
    db: AsyncSession,
) -> dict[str, object]:
    completed = 0
    mastered = 0

    for chunk_id in chunk_ids:
        result = await db.execute(
            select(UserChunkProgress).where(
                UserChunkProgress.user_id == user_id,
                UserChunkProgress.chunk_id == chunk_id,
            )
        )
        progress = result.scalar_one_or_none()
        if progress and progress.completed:
            completed += 1
        if progress and progress.mastered:
            mastered += 1

    n = len(chunk_ids) or 1
    return {
        "module_id": module_id,
        "completed_chunks": completed,
        "total_chunks": len(chunk_ids),
        "completion_percent": round((completed / n) * 100.0, 1),
        "mastered_chunks": mastered,
        "mastered": mastered == len(chunk_ids),
    }


async def _next_action(
    user_id: int,
    db: AsyncSession,
    ordered_module_ids: list[str],
    module_chunk_ids: dict[str, list[str]],
) -> tuple[str | None, str | None]:
    for module_id in ordered_module_ids:
        for chunk_id in module_chunk_ids.get(module_id, []):
            result = await db.execute(
                select(UserChunkProgress).where(
                    UserChunkProgress.user_id == user_id,
                    UserChunkProgress.chunk_id == chunk_id,
                )
            )
            progress = result.scalar_one_or_none()
            if progress is None or not progress.completed:
                return module_id, chunk_id
    return None, None


async def _foundation_finished(
    user_id: int,
    db: AsyncSession,
    ordered_module_ids: list[str],
    module_chunk_ids: dict[str, list[str]],
    module_tracks: dict[str, str],
) -> bool:
    foundation_ids = [
        m for m in ordered_module_ids
        if module_tracks.get(m) == "foundation"
    ]
    for module_id in foundation_ids:
        for chunk_id in module_chunk_ids.get(module_id, []):
            result = await db.execute(
                select(UserChunkProgress).where(
                    UserChunkProgress.user_id == user_id,
                    UserChunkProgress.chunk_id == chunk_id,
                )
            )
            progress = result.scalar_one_or_none()
            if not progress or not progress.completed:
                return False
    return True


async def calculate_new_badges(
    user_id: int,
    db: AsyncSession,
    ordered_module_ids: list[str],
    module_chunk_ids: dict[str, list[str]],
    module_tracks: dict[str, str],
    module_titles: dict[str, str],
) -> list[str]:
    """Calculate currently earned badge set."""
    streak_row = await get_user_state(user_id, db)
    badges: list[str] = []

    if await _foundation_finished(
        user_id, db, ordered_module_ids, module_chunk_ids, module_tracks
    ):
        badges.append("Foundation Finisher")

    for module_id in ordered_module_ids:
        if module_tracks.get(module_id) != "core":
            continue
            all_mastered = True
            for chunk_id in module_chunk_ids.get(module_id, []):
                result = await db.execute(
                    select(UserChunkProgress).where(
                        UserChunkProgress.user_id == user_id,
                        UserChunkProgress.chunk_id == chunk_id,
                    )
                )
                progress = result.scalar_one_or_none()
                if not progress or not progress.mastered:
                    all_mastered = False
                    break
            if all_mastered:
                badges.append(f"{module_titles.get(module_id, module_id)} Mastery")

    capstone_id = "c1" if "c1" in ordered_module_ids else (ordered_module_ids[-1] if ordered_module_ids else None)
    all_completed = True
    if capstone_id:
        for chunk_id in module_chunk_ids.get(capstone_id, []):
            result = await db.execute(
                select(UserChunkProgress).where(
                    UserChunkProgress.user_id == user_id,
                    UserChunkProgress.chunk_id == chunk_id,
                )
            )
            progress = result.scalar_one_or_none()
            if not progress or not progress.completed:
                all_completed = False
                break
        if all_completed:
            badges.append("Capstone Complete")

    if streak_row.current_streak >= 3:
        badges.append("3-Day Streak")
    if streak_row.current_streak >= 7:
        badges.append("7-Day Streak")

    return badges


async def get_progress_summary(
    user_id: int, db: AsyncSession, modules: list[ModuleDef]
) -> dict[str, object]:
    """Build user progress summary. Modules must be loaded from DB (e.g. repository.fetch_modules)."""
    streak_row = await get_user_state(user_id, db)

    ordered_module_ids = [m.module_id for m in modules]
    module_chunk_ids = {m.module_id: m.chunk_ids for m in modules}
    module_tracks = {m.module_id: m.track for m in modules}
    module_titles = {m.module_id: m.title for m in modules}

    module_progress = [
        await _module_stats(user_id, m.module_id, m.chunk_ids, db)
        for m in modules
    ]

    total_chunks = sum(len(m.chunk_ids) for m in modules)
    completed_chunks = sum(int(item["completed_chunks"]) for item in module_progress)  # type: ignore[arg-type]

    result = await db.execute(
        select(UserChunkProgress).where(UserChunkProgress.user_id == user_id)
    )
    all_progress_rows = {row.chunk_id: row for row in result.scalars().all()}

    all_chunk_ids = [cid for m in modules for cid in m.chunk_ids]
    chunk_progress: dict[str, dict[str, object]] = {}
    for chunk_id in all_chunk_ids:
        progress = all_progress_rows.get(chunk_id)
        chunk_progress[chunk_id] = {
            "completed": progress.completed if progress else False,
            "best_score": progress.best_score if progress else 0.0,
            "last_score": progress.latest_score if progress else 0.0,
            "mastered": progress.mastered if progress else False,
            "attempts": progress.attempts if progress else 0,
        }

    next_module_id, next_chunk_id = await _next_action(
        user_id, db, ordered_module_ids, module_chunk_ids
    )

    badges = await calculate_new_badges(
        user_id, db, ordered_module_ids, module_chunk_ids, module_tracks, module_titles
    )

    return {
        "program_completion_percent": round((completed_chunks / total_chunks) * 100.0, 1)
        if total_chunks
        else 0.0,
        "lesson_xp_total": streak_row.lesson_xp_total,
        "module_progress": module_progress,
        "chunk_progress": chunk_progress,
        "badges": badges,
        "next_module_id": next_module_id,
        "next_chunk_id": next_chunk_id,
    }
