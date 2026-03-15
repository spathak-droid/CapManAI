"""Lessons content and progress service for phase 1."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import LessonChunk, LessonModule, User, UserChunkProgress, UserStreak
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


def _build_f2_chunk(
    chunk_id: str,
    module_id: str,
    chunk_order: int,
    seed: str,
) -> ChunkDef:
    """Authored beginner-friendly content for Instruments and Options Basics."""
    if chunk_order == 1:
        return ChunkDef(
            chunk_id=chunk_id,
            module_id=module_id,
            order=chunk_order,
            title="Instruments and Options Basics: What are stocks, ETFs, and options?",
            estimated_minutes=7,
            learning_goal=(
                "Understand the three main instrument types traders use and how they differ."
            ),
            explain_text=(
                "When you buy a stock, you own a tiny piece of a real company. If Apple is worth "
                "$3 trillion and has roughly 15 billion shares outstanding, each share is your "
                "$190-ish slice of the whole business. You make money if the price goes up and lose "
                "money if it goes down. There is no expiration date — you can hold a stock forever. "
                "That simplicity is why stocks are the most straightforward instrument.\n\n"
                "ETFs — exchange-traded funds — are like pre-made baskets. SPY, for example, holds "
                "all 500 companies in the S&P 500 index. Instead of buying 500 individual stocks, "
                "you buy one ticker and get instant diversification across all of them. ETFs trade "
                "just like stocks: same bid/ask mechanics, same market hours, same order types. "
                "Think of an ETF as a playlist compared to buying individual songs.\n\n"
                "Options are where it gets interesting. An option is a CONTRACT that gives you the "
                "RIGHT (but not the obligation) to buy or sell a stock at a specific price, by a "
                "specific date. Think of it like putting a deposit on a house — you pay a small "
                "amount now to lock in a purchase price, but you can walk away and just lose the "
                "deposit. The critical difference from stocks: options have an EXPIRATION DATE. "
                "After that date, they are worthless. This single fact changes everything about "
                "how you manage them.\n\n"
                "Why does the instrument choice matter? Each one has a different risk profile. "
                "Stocks are straightforward — buy, hold, sell whenever you want. Options can "
                "amplify both gains AND losses because of leverage and expiration pressure. "
                "Knowing WHAT you are trading is step zero before you ever think about direction "
                "or strategy."
            ),
            example_text=(
                "You think Apple ($190) will go up. With $1,900 you could buy 10 shares of stock. "
                "OR you could buy an option contract for maybe $300 that controls 100 shares. "
                "The stock approach risks $1,900 but has no deadline — if Apple dips temporarily, "
                "you can wait it out. The option approach risks only $300 but expires in 30 days. "
                "If Apple has not moved up enough by then, you lose the entire $300. Same thesis, "
                "same stock, completely different risk shape depending on the instrument you pick."
            ),
            key_takeaway=(
                "Stocks have no expiration and straightforward risk. Options amplify outcomes "
                "but expire — know which one you are using and why."
            ),
            common_mistakes=[
                "Treating options like stocks (forgetting they expire)",
                "Not understanding that one option contract = 100 shares",
                "Buying an instrument just because it is cheap without understanding what it does",
            ],
            quick_check_prompts=[
                "In your own words, what is the difference between owning a stock and owning an option?",
                "Why might someone choose an ETF over buying individual stocks?",
                "What happens to an option you hold if it reaches its expiration date and is not profitable?",
            ],
            quiz_items=[
                QuizItemDef(
                    item_id=f"{seed}-q1",
                    item_type="mcq",
                    prompt="What is the key difference between a stock and an option?",
                    options=[
                        {"id": "a", "text": "Options have expiration dates, stocks do not"},
                        {"id": "b", "text": "Stocks are riskier than options"},
                        {"id": "c", "text": "Options can only be used for ETFs"},
                        {"id": "d", "text": "Stocks expire after one year"},
                    ],
                    correct_option_id="a",
                    explanation=(
                        "Options always have an expiration date after which they become worthless. "
                        "Stocks can be held indefinitely with no expiration pressure."
                    ),
                    why_it_matters=(
                        "Forgetting about expiration is the most common and costly beginner mistake "
                        "with options."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q2",
                    item_type="mcq",
                    prompt="What does an ETF like SPY give you?",
                    options=[
                        {"id": "a", "text": "Ownership of a single tech company"},
                        {"id": "b", "text": "Exposure to a basket of stocks through one ticker"},
                        {"id": "c", "text": "A guaranteed return on investment"},
                        {"id": "d", "text": "The right to buy stocks at a discount"},
                    ],
                    correct_option_id="b",
                    explanation=(
                        "SPY holds all 500 companies in the S&P 500, giving you broad market "
                        "exposure through a single purchase."
                    ),
                    why_it_matters=(
                        "Understanding ETFs lets you diversify without needing to pick individual "
                        "winners."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q3",
                    item_type="scenario",
                    prompt=(
                        "You believe Tesla will rise over the next year. You are new to trading "
                        "and want something simple with no time pressure. What is the best "
                        "instrument choice?"
                    ),
                    options=[
                        {"id": "a", "text": "Buy Tesla stock"},
                        {"id": "b", "text": "Buy Tesla call options expiring in 30 days"},
                        {"id": "c", "text": "Buy a put option on Tesla"},
                        {"id": "d", "text": "Short sell Tesla stock"},
                    ],
                    correct_option_id="a",
                    explanation=(
                        "For a long-term, no-deadline thesis, stock is the simplest and safest "
                        "choice. Options would introduce expiration pressure and time decay that "
                        "work against a vague timeline."
                    ),
                    why_it_matters=(
                        "Matching the instrument to your thesis timeline prevents unnecessary "
                        "losses from time decay."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q4",
                    item_type="reflection",
                    prompt=(
                        "In your own words, why would a trader choose options over stocks for "
                        "a short-term idea?"
                    ),
                    options=[],
                    correct_option_id=None,
                    explanation=(
                        "Options let you control more shares with less capital and can amplify "
                        "percentage returns on short-term moves, but they come with expiration "
                        "risk."
                    ),
                    why_it_matters=(
                        "Understanding the trade-off between leverage and expiration is "
                        "fundamental to instrument selection."
                    ),
                ),
            ],
        )

    if chunk_order == 2:
        return ChunkDef(
            chunk_id=chunk_id,
            module_id=module_id,
            order=chunk_order,
            title="Instruments and Options Basics: Calls, puts, and the x100 multiplier",
            estimated_minutes=8,
            learning_goal=(
                "Understand what call and put options are, how the x100 multiplier works, "
                "and how to read a basic option quote."
            ),
            explain_text=(
                "A call option gives you the right to BUY a stock at a set price (the 'strike "
                "price') before a deadline. You buy calls when you think the stock will go UP. "
                "Analogy: imagine you find a house worth $300K. You pay $5K for the right to buy "
                "it at $300K anytime in the next 3 months. If the house jumps to $350K, you "
                "exercise your right, buy at $300K, and you have made $50K on a $5K bet. If the "
                "house drops to $250K, you walk away — you only lost your $5K deposit.\n\n"
                "A put option gives you the right to SELL a stock at a set price. You buy puts "
                "when you think the stock will go DOWN. Same house analogy in reverse — you lock "
                "in a selling price. If the house drops, you can still sell at the higher locked-in "
                "price. Puts are how traders profit from declines without short-selling stock.\n\n"
                "Here is the thing that catches every beginner: ONE option contract controls 100 "
                "shares. So if an option is quoted at $3.00, you actually pay $3.00 x 100 = $300 "
                "for one contract. If it is quoted at $0.50, you pay $50. This multiplier is why "
                "options can be powerful — small price moves in the stock translate to large "
                "percentage moves in the option — but it is also why they can hurt if you do not "
                "respect it.\n\n"
                "Reading an option quote: 'AAPL Jan 190 Call @ $5.20' means the right to buy "
                "Apple at $190 per share, expiring in January, and it costs $5.20 per share "
                "(= $520 per contract). The $190 is the strike price — the price you are locking "
                "in. The $5.20 is the premium — that is your maximum risk if you are buying the "
                "option."
            ),
            example_text=(
                "AAPL is at $190. You buy 1 call contract with a $190 strike for $5.00. You pay "
                "$5.00 x 100 = $500 total. If AAPL rises to $200, your call is now worth at "
                "least $10.00 ($200 - $190 = $10 intrinsic value). Your contract is worth "
                "$10 x 100 = $1,000. You paid $500, it is now worth $1,000 — that is a 100% "
                "return. Meanwhile, buying 100 shares at $190 would have cost $19,000 and made "
                "$1,000 profit (about 5% return). The option amplified your percentage gain — "
                "but if AAPL stayed flat or dropped, you would lose your entire $500."
            ),
            key_takeaway=(
                "Calls profit when price rises, puts profit when price falls. Always multiply "
                "by 100 to know your real cost and exposure."
            ),
            common_mistakes=[
                "Forgetting the x100 multiplier and accidentally risking 100x what you intended",
                "Buying calls when you are bearish (or puts when you are bullish)",
                "Ignoring the strike price — thinking any call makes money if the stock goes up even a little",
                "Not realizing that out-of-the-money options can expire completely worthless",
            ],
            quick_check_prompts=[
                "If a put option is quoted at $2.50, how much does one contract actually cost?",
                "When would you buy a call vs a put?",
                "What happens if you buy a $200 strike call on a stock at $190, and the stock is still at $195 at expiration?",
            ],
            quiz_items=[
                QuizItemDef(
                    item_id=f"{seed}-q1",
                    item_type="mcq",
                    prompt="An option is quoted at $4.00. How much do you actually pay for one contract?",
                    options=[
                        {"id": "a", "text": "$4.00"},
                        {"id": "b", "text": "$40"},
                        {"id": "c", "text": "$400"},
                        {"id": "d", "text": "$4,000"},
                    ],
                    correct_option_id="c",
                    explanation=(
                        "One option contract controls 100 shares, so you multiply the quoted "
                        "price by 100. $4.00 x 100 = $400."
                    ),
                    why_it_matters=(
                        "Forgetting the x100 multiplier is how beginners accidentally take on "
                        "positions far larger than they intended."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q2",
                    item_type="mcq",
                    prompt="You think a stock will decline. Which option type do you buy?",
                    options=[
                        {"id": "a", "text": "A call option"},
                        {"id": "b", "text": "A put option"},
                        {"id": "c", "text": "An ETF"},
                        {"id": "d", "text": "A stock share"},
                    ],
                    correct_option_id="b",
                    explanation=(
                        "Put options give you the right to sell at a set price and increase in "
                        "value when the stock drops. Calls do the opposite."
                    ),
                    why_it_matters=(
                        "Buying the wrong option type means you lose money even when your "
                        "directional thesis is correct."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q3",
                    item_type="scenario",
                    prompt=(
                        "You buy 1 AAPL $190 call at $5.00. AAPL drops to $185 at expiration. "
                        "What is your outcome?"
                    ),
                    options=[
                        {"id": "a", "text": "You lose $500 (the option expires worthless)"},
                        {"id": "b", "text": "You lose $185"},
                        {"id": "c", "text": "You break even"},
                        {"id": "d", "text": "You make $500"},
                    ],
                    correct_option_id="a",
                    explanation=(
                        "With AAPL below the $190 strike at expiration, the call has no intrinsic "
                        "value and expires worthless. Your max loss is the premium paid: "
                        "$5.00 x 100 = $500."
                    ),
                    why_it_matters=(
                        "Understanding max loss before you enter a trade is essential risk "
                        "management."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q4",
                    item_type="reflection",
                    prompt=(
                        "Why is the x100 multiplier both powerful and dangerous? Give an example."
                    ),
                    options=[],
                    correct_option_id=None,
                    explanation=(
                        "The multiplier amplifies both gains and losses. A $2 move in the stock "
                        "means a $200 change per contract. This leverage works for you when you "
                        "are right but magnifies losses when you are wrong."
                    ),
                    why_it_matters=(
                        "Respecting the multiplier prevents position-sizing errors that can "
                        "blow up a small account."
                    ),
                ),
            ],
        )

    if chunk_order == 3:
        return ChunkDef(
            chunk_id=chunk_id,
            module_id=module_id,
            order=chunk_order,
            title="Instruments and Options Basics: Time decay and choosing the right instrument",
            estimated_minutes=8,
            learning_goal=(
                "Understand that options lose value over time (theta decay), and learn how to "
                "choose between stocks and options based on your trading idea."
            ),
            explain_text=(
                "Remember how we said options are like putting a deposit on a house? Well, that "
                "deposit loses a little value every single day as the expiration gets closer. This "
                "is called time decay or 'theta.' If you own a call option and the stock does not "
                "move at all for two weeks, your option is now worth LESS than when you bought it "
                "— even though the stock price did not change. Think of it like an ice cube "
                "melting: every day a little more drips away, and it melts faster as expiration "
                "approaches.\n\n"
                "Time decay is the number-one surprise for new options traders. You can be RIGHT "
                "about the direction of a stock and STILL lose money on an option if the stock "
                "does not move far enough, fast enough. A stock trader does not have this problem "
                "— if the stock stays flat, they just wait. But an option trader is paying rent "
                "every day through theta, and that rent accelerates as the expiration date gets "
                "closer.\n\n"
                "So when do you use options versus stocks? Use stocks when you have a longer-term "
                "view (weeks to months), you want simplicity, or you do not mind tying up more "
                "capital. Use options when you have a SHORT-TERM view with a specific catalyst "
                "(earnings announcement, product launch, FDA decision), you want to risk a small "
                "amount for a potentially large return, or you want to protect an existing stock "
                "position like insurance. The key decision factor: do you have a TIME-SPECIFIC "
                "thesis? If your idea is 'Apple will go up eventually,' buy the stock. If your "
                "idea is 'Apple will jump after earnings next week,' an option might make sense.\n\n"
                "The instrument selection rule: before every trade, ask yourself — 'Can I explain "
                "what this instrument does, what my max loss is, and when it expires?' If the "
                "answer is no to any of those, do not trade it. This single rule prevents most "
                "beginner disasters."
            ),
            example_text=(
                "You buy a call option with 30 days to expiration for $3.00 ($300 total). The "
                "stock stays completely flat. After 15 days, even though nothing changed, your "
                "option might be worth only $2.00 ($200). You have lost $100 to time decay alone. "
                "After 25 days with the stock still flat, it might be worth $0.80 ($80). You have "
                "lost $220 and the stock literally did not move. This is theta at work. Now imagine "
                "the same situation but you bought stock instead — your position would be worth "
                "exactly what you paid. No decay. That is why the instrument choice matters so "
                "much."
            ),
            key_takeaway=(
                "Options melt like ice cubes. If you do not have a time-specific reason to use "
                "them, stocks are simpler and safer."
            ),
            common_mistakes=[
                "Buying options with no catalyst or timeline (just bleeding theta)",
                "Choosing options purely because they are 'cheaper' per share (ignoring that they expire)",
                "Holding options too long — waiting for a move that comes after expiration",
                "Not considering that you need to be right about BOTH direction AND timing with options",
            ],
            quick_check_prompts=[
                "If you buy an option and the stock stays flat for a month, what happens to your option's value?",
                "Give one scenario where an option makes more sense than stock, and one where stock makes more sense.",
                "What question should you always ask yourself before choosing between stocks and options?",
            ],
            quiz_items=[
                QuizItemDef(
                    item_id=f"{seed}-q1",
                    item_type="mcq",
                    prompt="You buy an option and the stock stays flat. What happens to your option value over time?",
                    options=[
                        {"id": "a", "text": "It stays the same"},
                        {"id": "b", "text": "It increases slightly"},
                        {"id": "c", "text": "It decreases due to time decay (theta)"},
                        {"id": "d", "text": "It doubles in value"},
                    ],
                    correct_option_id="c",
                    explanation=(
                        "Options lose value over time even if the stock price does not move. "
                        "This erosion is called theta or time decay, and it accelerates as "
                        "expiration approaches."
                    ),
                    why_it_matters=(
                        "Time decay is invisible to beginners who only watch the stock price. "
                        "It is the hidden cost of holding options."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q2",
                    item_type="mcq",
                    prompt="Which situation is BEST suited for buying an option instead of stock?",
                    options=[
                        {"id": "a", "text": "You think a stock will rise sometime this year"},
                        {"id": "b", "text": "You expect a big move within 2 weeks due to an earnings report"},
                        {"id": "c", "text": "You want to hold an investment for retirement"},
                        {"id": "d", "text": "You are unsure about the direction"},
                    ],
                    correct_option_id="b",
                    explanation=(
                        "Options shine when you have a specific, near-term catalyst. The defined "
                        "timeline justifies accepting time decay because you expect the move to "
                        "happen before expiration."
                    ),
                    why_it_matters=(
                        "Matching your instrument to your thesis timeline is the core skill of "
                        "instrument selection."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q3",
                    item_type="scenario",
                    prompt=(
                        "A friend says 'I think Amazon will go up sometime this year, so I "
                        "bought options expiring next month.' What is the problem with this "
                        "approach?"
                    ),
                    options=[
                        {"id": "a", "text": "Amazon is too expensive to trade"},
                        {"id": "b", "text": "Options expire — without a specific near-term catalyst, time decay will erode the position"},
                        {"id": "c", "text": "You should only buy puts on Amazon"},
                        {"id": "d", "text": "There is no problem with this approach"},
                    ],
                    correct_option_id="b",
                    explanation=(
                        "A vague 'sometime this year' thesis does not match a 30-day option. "
                        "Time decay will eat the premium while waiting for a move that may not "
                        "come until long after expiration."
                    ),
                    why_it_matters=(
                        "This is the most common beginner mistake — using options for ideas that "
                        "have no specific timeline."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q4",
                    item_type="reflection",
                    prompt=(
                        "Think of a real company. Would you trade it with stock or options right "
                        "now, and why?"
                    ),
                    options=[],
                    correct_option_id=None,
                    explanation=(
                        "The right answer depends on whether you have a time-specific catalyst. "
                        "If you do, options can make sense. If not, stock avoids time decay."
                    ),
                    why_it_matters=(
                        "Practicing instrument selection on real examples builds the habit of "
                        "always asking 'why this instrument?' before trading."
                    ),
                ),
            ],
        )

    # chunk_order == 4 (checkpoint)
    return ChunkDef(
        chunk_id=chunk_id,
        module_id=module_id,
        order=chunk_order,
        title="Instruments and Options Basics: Checkpoint — instrument selection in action",
        estimated_minutes=7,
        learning_goal=(
            "Apply everything from this module — identify the instrument type, calculate "
            "real costs, and choose the right tool for a trading idea."
        ),
        explain_text=(
            "Before you touch any trade, run through this instrument checklist:\n\n"
            "1. WHAT am I trading? (Stock, ETF, or option — and if option, call or put?)\n"
            "2. WHY this instrument? (Do I have a time-specific thesis that justifies options, "
            "or should I use stock?)\n"
            "3. WHAT IS my real cost? (For options: premium x 100. For stocks: share price x "
            "number of shares.)\n"
            "4. WHAT IS my max loss? (For bought options: the premium you paid — that is it. "
            "For stocks: theoretically it could go to $0.)\n"
            "5. WHEN does this expire? (Stocks: never. Options: check the date. Is there enough "
            "time for your thesis to play out?)\n\n"
            "If you can answer all five questions clearly, you understand your instrument. If you "
            "cannot answer even one, step back and figure it out before risking money. This "
            "checklist is not optional — it is the difference between trading and gambling."
        ),
        example_text=(
            "Let us walk through a complete example. You think Microsoft ($410) will rise "
            "after their earnings report in 8 days. Checklist: (1) WHAT: MSFT call option. "
            "(2) WHY: Short-term catalyst (earnings in 8 days) — options make sense. (3) COST: "
            "The $410 call is $6.00, so $600 per contract. (4) MAX LOSS: $600 (the premium). "
            "(5) EXPIRES: 10 days from now — enough time for the earnings catalyst. All five "
            "answers are clear. Now compare this to a different idea: 'I think tech will do "
            "well.' (1) WHAT: Maybe SPY or QQQ stock. (2) WHY: No specific timeline — stock is "
            "better than options here. (3) COST: $500 per share x 10 shares = $5,000. (4) MAX "
            "LOSS: Could be significant if tech drops — maybe set a stop at $480 = $200 max "
            "loss per share. (5) EXPIRY: Stock does not expire — no rush. Two different ideas, "
            "two different instruments, both with clear reasoning."
        ),
        key_takeaway=(
            "The right instrument depends on your thesis. Always answer WHAT, WHY, COST, "
            "MAX LOSS, and WHEN before trading."
        ),
        common_mistakes=[
            "Skipping the instrument checklist when the market feels urgent",
            "Using options for a vague, long-term idea (time decay will eat you alive)",
            "Not calculating real cost (forgetting the x100 multiplier)",
            "Choosing an instrument because someone else recommended it without understanding it yourself",
        ],
        quick_check_prompts=[
            "Run through the 5-question checklist for a trade idea of your choice.",
            "What is the total cost of buying 2 call option contracts quoted at $3.50?",
            "Give an example of when you would definitely NOT use options.",
        ],
        quiz_items=[
            QuizItemDef(
                item_id=f"{seed}-q1",
                item_type="mcq",
                prompt="You want to buy 3 call contracts quoted at $2.00 each. What is your total cost?",
                options=[
                    {"id": "a", "text": "$6.00"},
                    {"id": "b", "text": "$60"},
                    {"id": "c", "text": "$600"},
                    {"id": "d", "text": "$200"},
                ],
                correct_option_id="c",
                explanation=(
                    "Each contract costs $2.00 x 100 = $200. Three contracts cost "
                    "$200 x 3 = $600."
                ),
                why_it_matters=(
                    "Getting the total cost right is non-negotiable. Miscalculating by 100x "
                    "can blow up your account."
                ),
            ),
            QuizItemDef(
                item_id=f"{seed}-q2",
                item_type="mcq",
                prompt="You believe a stock will rise but have no specific timeline. What is the best instrument?",
                options=[
                    {"id": "a", "text": "Call options expiring this week"},
                    {"id": "b", "text": "Put options"},
                    {"id": "c", "text": "Stock (no time decay pressure)"},
                    {"id": "d", "text": "As many option contracts as you can afford"},
                ],
                correct_option_id="c",
                explanation=(
                    "Without a specific timeline or catalyst, stock avoids the time decay "
                    "that would erode an option position while you wait."
                ),
                why_it_matters=(
                    "This is the most practical takeaway of the module: match the instrument "
                    "to the thesis."
                ),
            ),
            QuizItemDef(
                item_id=f"{seed}-q3",
                item_type="scenario",
                prompt=(
                    "Your friend says 'This put option only costs $0.50 — it is so cheap!' "
                    "Should they buy it?"
                ),
                options=[
                    {"id": "a", "text": "Yes, cheap options are always a good deal"},
                    {"id": "b", "text": "Not without understanding what it controls (100 shares), when it expires, and whether they have a bearish thesis"},
                    {"id": "c", "text": "Yes, puts always make money"},
                    {"id": "d", "text": "No, puts are always a bad investment"},
                ],
                correct_option_id="b",
                explanation=(
                    "A $0.50 option still controls 100 shares ($50 real cost) and will expire "
                    "worthless without a directional move. 'Cheap' means nothing without "
                    "understanding the instrument, the timeline, and the thesis."
                ),
                why_it_matters=(
                    "Price alone never justifies a trade. The 5-question checklist catches "
                    "exactly this kind of mistake."
                ),
            ),
            QuizItemDef(
                item_id=f"{seed}-q4",
                item_type="reflection",
                prompt=(
                    "Pick a stock you know. Would you trade it with stock or options this week? "
                    "Walk through the 5-question checklist."
                ),
                options=[],
                correct_option_id=None,
                explanation=(
                    "There is no single right answer — it depends on your thesis, timeline, "
                    "and risk tolerance. The point is that you CAN answer all five questions "
                    "before entering."
                ),
                why_it_matters=(
                    "Building the checklist habit now prevents costly instrument-selection "
                    "errors when real money is on the line."
                ),
            ),
        ],
    )


def _build_f3_chunk(
    chunk_id: str,
    module_id: str,
    chunk_order: int,
    seed: str,
) -> ChunkDef:
    """Authored beginner-friendly content for Risk-First Thinking and Trade Planning."""
    if chunk_order == 1:
        return ChunkDef(
            chunk_id=chunk_id,
            module_id=module_id,
            order=chunk_order,
            title="Risk-First Thinking: What risk-first thinking means",
            estimated_minutes=7,
            learning_goal=(
                "Understand why managing risk matters more than picking winners, and learn "
                "the core rules that keep your account alive."
            ),
            explain_text=(
                "Here is a truth that surprises most beginners: your ability to pick winning "
                "stocks matters far less than your ability to manage risk. A trader who is right "
                "only 40% of the time but manages risk well will outperform a trader who is right "
                "60% of the time but sizes positions recklessly. Think of a casino. The house does "
                "not win every hand of blackjack — it wins about 51% of them. But that tiny edge, "
                "applied consistently over thousands of hands with disciplined bet sizing, generates "
                "billions. You need to be the casino, not the gambler.\n\n"
                "The most important rule in trading is the 1-2% rule: never risk more than 1-2% of "
                "your total account on a single trade. If your account is $10,000, that means your "
                "maximum loss on any single trade is $100 to $200. Not $1,000. Not $3,000. A small, "
                "predetermined, manageable amount. Why does this work? Even if you hit ten losing "
                "trades in a row — which happens to every trader at some point — you have lost only "
                "10-20% of your account. Painful, but recoverable. If you were risking 10% per trade, "
                "ten losers wipes you out. And the math of recovery is brutal: a 50% loss requires a "
                "100% gain to break even, but a 10% loss only requires an 11% gain.\n\n"
                "Risk-first thinking means you define your risk BEFORE you enter. Before you even look "
                "at potential profit, you answer: 'How much can I lose on this trade, and where is my "
                "stop-loss?' Your stop-loss is your invalidation point — the price level where your "
                "thesis is proven wrong. If you buy a stock at $50 because it is bouncing off support "
                "at $48, then $48 is your invalidation. If it breaks below $48, your reason for being "
                "in the trade is gone, and you exit. No negotiation, no hoping.\n\n"
                "The risk-reward ratio ties it all together. Before entering, calculate: how much am I "
                "risking (distance to stop) versus how much can I gain (distance to target)? The minimum "
                "acceptable ratio is 1:2 — you should target at least twice as much profit as you are "
                "risking. At a 2:1 reward-to-risk ratio, you only need to win 34% of your trades to "
                "break even. At 3:1, you only need 25%. This is the math that makes risk management so "
                "powerful. Finally, know when NOT to trade. If you cannot define your stop-loss, if the "
                "risk-reward ratio is below 1:2, or if you are trading to recover a loss rather than "
                "because a genuine setup appeared — those are no-trade conditions. The best trade is "
                "often the one you do not take."
            ),
            example_text=(
                "You have a $10,000 account and apply the 1% rule: max risk per trade is $100. You "
                "see AAPL trading at $190. Support is at $185, so your stop-loss is $185 — that is a "
                "$5 risk per share. Your target is $200 — that is a $10 reward per share. Risk-reward "
                "ratio: $10 / $5 = 2:1. That passes your minimum threshold. Position size: $100 risk / "
                "$5 per share = 20 shares. Total invested: 20 x $190 = $3,800. If AAPL drops to $185 "
                "and your stop triggers, you lose exactly $100 — 1% of your account. If it hits $200, "
                "you make $200 — 2% of your account. Notice you are not investing your full $10,000. "
                "The position size is determined by your risk tolerance, not by how much cash you have."
            ),
            key_takeaway=(
                "Define your risk before your entry. If you cannot state your stop-loss and "
                "risk-reward ratio, the trade is not ready."
            ),
            common_mistakes=[
                "Deciding position size based on how much cash you have instead of how much you can afford to lose",
                "Entering a trade without a predetermined stop-loss level",
                "Taking trades with a risk-reward ratio below 1:2",
                "Trading to recover losses instead of waiting for a valid setup",
            ],
            quick_check_prompts=[
                "What is the 1-2% rule and why does it protect your account?",
                "If your account is $20,000 and you risk 1%, what is your max loss per trade?",
                "Name two conditions that make a trade a no-trade.",
            ],
            quiz_items=[
                QuizItemDef(
                    item_id=f"{seed}-q1",
                    item_type="mcq",
                    prompt="Why does risk management matter more than stock picking?",
                    options=[
                        {"id": "a", "text": "Because a trader who manages risk can survive losing streaks and compound over time"},
                        {"id": "b", "text": "Because stock picking never works"},
                        {"id": "c", "text": "Because risk management guarantees profits"},
                        {"id": "d", "text": "Because professional traders never pick stocks"},
                    ],
                    correct_option_id="a",
                    explanation=(
                        "Risk management keeps losses small and survivable. Even a trader who is "
                        "wrong more than half the time can be profitable if losses are contained "
                        "and winners are larger than losers."
                    ),
                    why_it_matters=(
                        "Understanding this shifts your focus from trying to be right to managing "
                        "what happens when you are wrong — which is the real edge in trading."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q2",
                    item_type="mcq",
                    prompt="You have a $10,000 account and follow the 1% rule. What is the maximum you should lose on any single trade?",
                    options=[
                        {"id": "a", "text": "$1,000"},
                        {"id": "b", "text": "$500"},
                        {"id": "c", "text": "$100"},
                        {"id": "d", "text": "$10"},
                    ],
                    correct_option_id="c",
                    explanation=(
                        "1% of $10,000 is $100. This is the maximum loss you should accept on "
                        "any single trade to keep drawdowns recoverable."
                    ),
                    why_it_matters=(
                        "Knowing your dollar risk per trade is the first step in every position "
                        "sizing calculation."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q3",
                    item_type="scenario",
                    prompt=(
                        "A trade has a risk of $3 per share (entry to stop) and a reward of $2 "
                        "per share (entry to target). Should you take this trade?"
                    ),
                    options=[
                        {"id": "a", "text": "Yes — any potential profit is worth taking"},
                        {"id": "b", "text": "No — the risk-reward ratio is below 1:2, meaning you risk more than you stand to gain"},
                        {"id": "c", "text": "Yes — the stop-loss will protect you anyway"},
                        {"id": "d", "text": "It depends on the stock's name"},
                    ],
                    correct_option_id="b",
                    explanation=(
                        "The reward ($2) divided by the risk ($3) is only 0.67:1. You need at "
                        "least a 2:1 reward-to-risk ratio. This trade requires you to be right "
                        "more than 60% of the time just to break even."
                    ),
                    why_it_matters=(
                        "Filtering out poor risk-reward setups before entry is one of the most "
                        "impactful habits a trader can build."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q4",
                    item_type="reflection",
                    prompt=(
                        "In your own words, explain why defining risk before entry is more "
                        "important than finding the perfect entry price."
                    ),
                    options=[],
                    correct_option_id=None,
                    explanation=(
                        "The entry price matters, but knowing exactly how much you can lose and "
                        "where you will exit if wrong is what keeps you in the game. A great entry "
                        "with no risk plan can still destroy your account."
                    ),
                    why_it_matters=(
                        "This mental shift — from 'how much can I make?' to 'how much can I "
                        "lose?' — is the foundation of professional trading."
                    ),
                ),
            ],
        )

    if chunk_order == 2:
        return ChunkDef(
            chunk_id=chunk_id,
            module_id=module_id,
            order=chunk_order,
            title="Risk-First Thinking: Position sizing and risk calculation",
            estimated_minutes=8,
            learning_goal=(
                "Master the position sizing formula and understand how stop-loss distance "
                "determines your share count."
            ),
            explain_text=(
                "Position sizing is the bridge between your risk rule (1-2% max loss) and your "
                "actual trade. The formula is simple but powerful:\n\n"
                "Number of Shares = Risk per Trade / (Entry Price - Stop-Loss Price)\n\n"
                "This formula automatically adjusts your position size based on how much room "
                "you give the trade. A wider stop means fewer shares. A tighter stop means more "
                "shares. But your dollar risk stays constant. That consistency is the whole point — "
                "regardless of whether you are trading a $20 stock or a $500 stock, regardless of "
                "whether your stop is $1 away or $10 away, you always risk the same dollar amount.\n\n"
                "Let us walk through a complete example. Account size: $10,000. Risk per trade: 1% "
                "= $100. You want to buy XYZ at $50.00. Your stop-loss is at $47.00 (below a "
                "support level). Distance to stop: $50 - $47 = $3.00. Shares = $100 / $3.00 = 33 "
                "shares (round down). Total position: 33 x $50 = $1,650. If XYZ drops to $47 and "
                "your stop triggers, you lose 33 x $3 = $99. Almost exactly 1% of your account.\n\n"
                "Now watch what happens with different stop distances. Same stock, same $100 risk. "
                "Tighter stop at $49 (distance $1): Shares = $100 / $1 = 100 shares. Position: "
                "$5,000. You get more shares but less room for the stock to move against you. Wider "
                "stop at $45 (distance $5): Shares = $100 / $5 = 20 shares. Position: $1,000. Fewer "
                "shares but more breathing room. The risk is still $100 in both cases.\n\n"
                "This is why you should never decide position size by thinking 'I have $10,000, let "
                "me invest it all.' Your position size is a FUNCTION of your risk tolerance and your "
                "stop distance. Sometimes the formula tells you to invest $1,000 of a $10,000 account. "
                "Sometimes it tells you $5,000. Both are correct if the math limits your loss to 1-2%. "
                "The formula also acts as a filter: if the calculated position requires more capital "
                "than you have, the trade is too large for your account — skip it or find a tighter "
                "stop with a valid technical reason."
            ),
            example_text=(
                "Full walkthrough with two scenarios on the same stock:\n\n"
                "Account: $20,000. Risk: 2% = $400. Stock: MSFT at $410.\n\n"
                "Scenario A — Stop at $400 (below round-number support):\n"
                "Distance: $410 - $400 = $10. Shares = $400 / $10 = 40 shares.\n"
                "Position cost: 40 x $410 = $16,400. If stopped out: loss = 40 x $10 = $400 (2%).\n"
                "Target: $430. Reward = $20/share x 40 = $800. Risk-reward: 2:1. Good trade.\n\n"
                "Scenario B — Stop at $405 (tighter, below a minor level):\n"
                "Distance: $410 - $405 = $5. Shares = $400 / $5 = 80 shares.\n"
                "Position cost: 80 x $410 = $32,800. That exceeds your $20,000 account — this "
                "trade is too large. You would need to either accept a wider stop (reducing shares) "
                "or reduce your risk percentage. The formula caught the problem before you entered."
            ),
            key_takeaway=(
                "Position size = Risk$ / (Entry - Stop). Let the formula decide your share "
                "count — never size by feel or available cash."
            ),
            common_mistakes=[
                "Rounding UP instead of DOWN when calculating share count (this increases risk beyond your limit)",
                "Setting a stop-loss based on desired position size rather than a meaningful technical level",
                "Ignoring when the formula produces a position larger than your account can support",
                "Changing the stop distance to justify a larger position (fitting the math to your desire instead of the market)",
            ],
            quick_check_prompts=[
                "Calculate: $15,000 account, 1% risk, entry $75, stop $72. How many shares?",
                "What happens to position size when you use a wider stop? Why?",
                "When would the formula tell you to skip a trade entirely?",
            ],
            quiz_items=[
                QuizItemDef(
                    item_id=f"{seed}-q1",
                    item_type="mcq",
                    prompt=(
                        "Account: $10,000. Risk: 1% ($100). Entry: $200. Stop: $195. "
                        "How many shares should you buy?"
                    ),
                    options=[
                        {"id": "a", "text": "50 shares"},
                        {"id": "b", "text": "20 shares"},
                        {"id": "c", "text": "100 shares"},
                        {"id": "d", "text": "5 shares"},
                    ],
                    correct_option_id="b",
                    explanation=(
                        "Risk per share = $200 - $195 = $5. Shares = $100 / $5 = 20 shares. "
                        "If stopped out, loss = 20 x $5 = $100, exactly 1%."
                    ),
                    why_it_matters=(
                        "This is the core calculation you will use before every single trade. "
                        "Getting it right keeps your risk consistent."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q2",
                    item_type="mcq",
                    prompt="What happens to your position size when you widen your stop-loss?",
                    options=[
                        {"id": "a", "text": "You buy more shares to compensate"},
                        {"id": "b", "text": "Nothing changes — position size is always the same"},
                        {"id": "c", "text": "You buy fewer shares because each share risks more dollars"},
                        {"id": "d", "text": "Your risk percentage automatically increases"},
                    ],
                    correct_option_id="c",
                    explanation=(
                        "A wider stop means more risk per share, so the formula gives you fewer "
                        "shares to keep the total dollar risk constant."
                    ),
                    why_it_matters=(
                        "Understanding this relationship prevents the common mistake of using a "
                        "wide stop with a large position — which blows past your risk limit."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q3",
                    item_type="scenario",
                    prompt=(
                        "You calculate that you need 200 shares at $150 each ($30,000 position) "
                        "but your account only has $20,000. What should you do?"
                    ),
                    options=[
                        {"id": "a", "text": "Use margin to buy all 200 shares anyway"},
                        {"id": "b", "text": "Buy as many shares as you can afford and hope for the best"},
                        {"id": "c", "text": "Skip the trade or find a wider stop at a valid technical level to reduce the share count"},
                        {"id": "d", "text": "Remove the stop-loss so you can buy fewer shares"},
                    ],
                    correct_option_id="c",
                    explanation=(
                        "If the formula demands more capital than you have, the trade is too large. "
                        "Either find a valid wider stop (which reduces shares) or skip the trade. "
                        "Never remove your stop-loss to make the math work."
                    ),
                    why_it_matters=(
                        "The formula is also a trade filter. When the numbers do not work, that is "
                        "the formula protecting you from an oversized position."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q4",
                    item_type="reflection",
                    prompt=(
                        "Walk through the position sizing formula for a stock you know. "
                        "State your account size, risk %, entry, stop, share count, and total position."
                    ),
                    options=[],
                    correct_option_id=None,
                    explanation=(
                        "Practicing the formula on real stocks builds the habit of calculating "
                        "before entering. The specific numbers matter less than the process."
                    ),
                    why_it_matters=(
                        "You will use this formula before every trade for the rest of your trading "
                        "career. Practicing it now makes it second nature."
                    ),
                ),
            ],
        )

    if chunk_order == 3:
        return ChunkDef(
            chunk_id=chunk_id,
            module_id=module_id,
            order=chunk_order,
            title="Risk-First Thinking: Building your pre-trade checklist",
            estimated_minutes=7,
            learning_goal=(
                "Convert risk-first principles into concrete IF/THEN rules and build a "
                "repeatable pre-trade checklist."
            ),
            explain_text=(
                "Knowing the theory of risk management is not enough — you need to turn it into "
                "concrete rules you follow every time. The best way to do this is with IF/THEN "
                "statements and a pre-trade checklist. IF/THEN rules remove ambiguity: 'IF the "
                "stock breaks below my stop, THEN I sell immediately — no exceptions.' Compare that "
                "to vague intentions like 'I will probably sell if it drops too much.' The first is "
                "a rule. The second is a wish.\n\n"
                "Start with a daily loss limit. A common rule is 3-5% of your account per day. If "
                "your account is $10,000, a 3% daily limit means you stop trading after losing $300 "
                "in a day. Close your charts, step away, review what went wrong. Why? Because losing "
                "streaks create emotional spiraling. After two bad trades you are frustrated. After "
                "three you are angry. Angry traders make impulsive decisions — bigger bets, chasing "
                "trades, abandoning strategies. A daily loss limit forces you to stop before emotions "
                "take over. Write it down: 'IF I lose $300 today, THEN I am done for the day.'\n\n"
                "Correlation risk is another rule most beginners miss. If you own Apple, Microsoft, "
                "Google, Amazon, and NVIDIA, you might think you have five different trades. You do "
                "not. You have one giant tech bet. These stocks are highly correlated — when tech "
                "sells off, they all sell off together. Your five 'separate' 1% risk trades suddenly "
                "act like one 5% risk position. Rule: 'IF more than two of my open positions are in "
                "the same sector, THEN I reduce total size or skip the new trade.'\n\n"
                "Stop-loss types are another decision you should make BEFORE entry, not during:\n"
                "- Hard stop: An actual order placed in your brokerage that triggers automatically. "
                "Most reliable — removes emotion entirely.\n"
                "- Mental stop: A price level you plan to exit at, but no order is placed. Dangerous "
                "because hope and fear override plans in the moment.\n"
                "- Trailing stop: Follows price in your favor but never moves against you. Locks in "
                "gains as the trade works. Example: a $5 trailing stop on a stock that moves from "
                "$50 to $60 would trigger at $55, locking in $5 of profit.\n"
                "- Time stop: Exit if the trade has not worked within a set period. 'IF this trade is "
                "not profitable within 5 days, THEN I exit.' Prevents capital from sitting in dead "
                "trades.\n\n"
                "Here is a template for your pre-trade checklist:\n"
                "1. What is my entry price?\n"
                "2. Where is my stop-loss? (What invalidates my thesis?)\n"
                "3. What is my target price?\n"
                "4. What is the risk-reward ratio? (Must be at least 1:2)\n"
                "5. How many shares? (Use the position sizing formula)\n"
                "6. What type of stop am I using? (Hard stop recommended for beginners)\n"
                "7. Does this trade push me past my daily loss limit?\n"
                "8. Am I correlated with other open positions?\n"
                "If you cannot answer all eight questions, the trade is not ready."
            ),
            example_text=(
                "Before entering a trade on XYZ at $100, you fill out your checklist:\n"
                "1. Entry: $100. 2. Stop: $97 (below yesterday's low). 3. Target: $106. "
                "4. Risk-reward: $6 reward / $3 risk = 2:1. Passes. "
                "5. Shares: $150 risk (1.5% of $10K) / $3 = 50 shares. "
                "6. Stop type: hard stop order placed immediately after entry. "
                "7. Daily P&L so far: -$50. Still well within $300 daily limit. "
                "8. Other positions: one energy stock, one healthcare stock. No correlation issue. "
                "All eight boxes checked — the trade is ready. If any answer was missing or "
                "unfavorable (e.g., risk-reward below 1:2 or daily limit already hit), you skip it."
            ),
            key_takeaway=(
                "Rules beat intentions. Build an 8-point checklist and do not enter any trade "
                "until every box is checked."
            ),
            common_mistakes=[
                "Using mental stops instead of hard stops (emotions override plans in the heat of the moment)",
                "Ignoring correlation — holding multiple positions in the same sector without adjusting total risk",
                "Skipping the checklist when you feel confident about a trade (confidence is not a risk metric)",
                "Not having a daily loss limit, leading to spiraling losses on bad days",
            ],
            quick_check_prompts=[
                "Write an IF/THEN rule for your daily loss limit.",
                "Why is a hard stop safer than a mental stop for beginners?",
                "You hold 3 tech stocks. A 4th tech setup appears. What do you do?",
            ],
            quiz_items=[
                QuizItemDef(
                    item_id=f"{seed}-q1",
                    item_type="mcq",
                    prompt="What is the purpose of a daily loss limit?",
                    options=[
                        {"id": "a", "text": "To maximize the number of trades you can take"},
                        {"id": "b", "text": "To force you to stop trading before emotional spiraling leads to impulsive decisions"},
                        {"id": "c", "text": "To ensure you always make money each day"},
                        {"id": "d", "text": "To impress other traders with your discipline"},
                    ],
                    correct_option_id="b",
                    explanation=(
                        "Losing streaks trigger frustration and anger, which lead to bigger bets "
                        "and abandoned strategies. A daily loss limit stops the bleeding before "
                        "emotions take over."
                    ),
                    why_it_matters=(
                        "Most catastrophic trading days happen because the trader kept going after "
                        "multiple losses. The daily limit is your circuit breaker."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q2",
                    item_type="mcq",
                    prompt="You hold positions in Apple, Google, and Microsoft. You find a setup on Amazon. What is the risk concern?",
                    options=[
                        {"id": "a", "text": "Amazon is too expensive to trade"},
                        {"id": "b", "text": "All four stocks are highly correlated tech names — a tech selloff would hit all of them simultaneously"},
                        {"id": "c", "text": "You can only hold three positions at a time"},
                        {"id": "d", "text": "There is no risk concern — more positions means more diversification"},
                    ],
                    correct_option_id="b",
                    explanation=(
                        "Correlated positions move together. Four tech stocks behave like one large "
                        "tech bet, meaning a sector selloff could trigger losses on all positions at once, "
                        "far exceeding your intended per-trade risk."
                    ),
                    why_it_matters=(
                        "Correlation risk is invisible until it hits. Checking sector overlap before "
                        "entering keeps your real portfolio risk aligned with your plan."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q3",
                    item_type="scenario",
                    prompt=(
                        "You have a checklist but a stock is moving fast and you feel urgency to enter. "
                        "You have not calculated your position size or set a stop. What do you do?"
                    ),
                    options=[
                        {"id": "a", "text": "Jump in now and figure out the stop later — you might miss the move"},
                        {"id": "b", "text": "Enter with half your account and set a mental stop"},
                        {"id": "c", "text": "Complete your checklist first — if you miss the move, there will be other setups"},
                        {"id": "d", "text": "Ask a friend what they think and follow their advice"},
                    ],
                    correct_option_id="c",
                    explanation=(
                        "FOMO (fear of missing out) is one of the strongest emotional traps in "
                        "trading. A trade entered without a plan is gambling. If the move is real, "
                        "there will usually be another entry opportunity. If it is not, you just "
                        "saved yourself money."
                    ),
                    why_it_matters=(
                        "The checklist exists precisely for moments of urgency. Following it when "
                        "it is hardest is what separates rule-followers from emotional traders."
                    ),
                ),
                QuizItemDef(
                    item_id=f"{seed}-q4",
                    item_type="reflection",
                    prompt=(
                        "Write your own 3-rule pre-trade checklist using IF/THEN format. "
                        "Include at least one rule about when NOT to trade."
                    ),
                    options=[],
                    correct_option_id=None,
                    explanation=(
                        "A personalized checklist is more likely to be followed than a generic one. "
                        "The IF/THEN format removes ambiguity and makes rules executable."
                    ),
                    why_it_matters=(
                        "Your checklist is your trading operating system. Building it now means you "
                        "have rules in place before real money is on the line."
                    ),
                ),
            ],
        )

    # chunk_order == 4 (checkpoint)
    return ChunkDef(
        chunk_id=chunk_id,
        module_id=module_id,
        order=chunk_order,
        title="Risk-First Thinking: Applying risk-first thinking under pressure",
        estimated_minutes=8,
        learning_goal=(
            "Integrate all risk-first concepts by comparing disciplined vs undisciplined "
            "approaches and understanding the psychology that makes risk rules hard to follow."
        ),
        explain_text=(
            "Let us put everything together with a case study of two traders facing the same "
            "market.\n\n"
            "Trader A has a $20,000 account. He finds a 'sure thing' — a biotech stock about to "
            "announce trial results. He goes all in: $20,000 in one position. No stop-loss. 'It is "
            "going to moon.' The trial results are mixed. The stock drops 30%. Trader A's account "
            "goes from $20,000 to $14,000. He holds, hoping for recovery. It drops more. $14,000 "
            "becomes $10,000. He finally sells. He has lost 50% of his account. To get back to "
            "$20,000, he needs a 100% return — which could take years.\n\n"
            "Trader B has the same $20,000 account and the same trade idea. She risks 2% ($400). "
            "She buys $4,000 worth of the biotech with a stop-loss $2 below her entry. The trial "
            "disappoints. Her stop triggers. She loses $400. Her account is at $19,600 — a 2% "
            "drawdown. She shrugs, reviews the trade, and moves on to the next opportunity. Same "
            "stock, same outcome, wildly different results. The difference was not stock-picking "
            "skill. It was risk management.\n\n"
            "Why is Trader A's behavior so common? Because of how human brains are wired. "
            "Psychologists Daniel Kahneman and Amos Tversky showed that losing $100 causes about "
            "twice as much emotional pain as gaining $100 causes pleasure. This is called loss "
            "aversion, and it creates three dangerous behaviors:\n\n"
            "1. Holding losers too long: 'It will come back.' You refuse to take a small loss, and "
            "it grows into a big one. Your $100 loss becomes $500 because you could not accept the "
            "pain of being wrong.\n"
            "2. Cutting winners too early: 'Let me lock in this gain before it disappears.' You sell "
            "a winning trade at $195 because you are afraid of giving back profit, even though your "
            "target was $210. You traded your fear, not your plan.\n"
            "3. Revenge trading: After a loss, you take an impulsive trade to 'make it back.' These "
            "revenge trades are usually oversized, poorly planned, and make things worse. A $200 loss "
            "turns into a $600 loss because you chased.\n\n"
            "The solution is not willpower — it is structure. Your stop-loss is at $47? Sell at $47. "
            "No negotiation. Your target is $53? Do not sell at $50 because you got nervous. Let the "
            "plan play out. The rules exist specifically for the moments when your emotions are "
            "screaming at you to break them. Rules-based trading does not mean you never feel fear or "
            "greed — it means you act on your plan instead of your feelings."
        ),
        example_text=(
            "End-of-day review for Trader B after the biotech loss:\n"
            "- Did I follow my checklist? Yes — entry, stop, target, position size all defined.\n"
            "- Was the risk-reward acceptable? Yes — 2:1 ratio at entry.\n"
            "- Did my stop trigger for a valid reason? Yes — thesis invalidated by trial results.\n"
            "- Was the loss within my plan? Yes — $400 = 2% of account.\n"
            "- Do I want to revenge trade? Honestly, yes. But my daily P&L is -$400, within my "
            "5% daily limit. I will check for valid setups, not emotional ones.\n\n"
            "This kind of review is what turns a loss into a learning experience instead of a "
            "spiral. Trader A has no review because he had no plan — just hope."
        ),
        key_takeaway=(
            "Every trader feels fear, greed, and loss aversion. The difference is whether you "
            "act on your rules or your emotions."
        ),
        common_mistakes=[
            "Believing that risk management is only for beginners (professionals are even more disciplined about it)",
            "Moving your stop-loss further away when the trade goes against you ('just giving it more room')",
            "Revenge trading after a loss — taking impulsive, oversized positions to recover",
            "Selling winners too early out of fear while holding losers too long out of hope",
        ],
        quick_check_prompts=[
            "What would Trader A need to do differently to match Trader B's approach?",
            "Name the three dangerous behaviors caused by loss aversion.",
            "After a losing trade, what should your next action be?",
        ],
        quiz_items=[
            QuizItemDef(
                item_id=f"{seed}-q1",
                item_type="mcq",
                prompt=(
                    "Trader A goes all-in with no stop-loss and loses 50%. What return does "
                    "he need to break even?"
                ),
                options=[
                    {"id": "a", "text": "50%"},
                    {"id": "b", "text": "75%"},
                    {"id": "c", "text": "100%"},
                    {"id": "d", "text": "150%"},
                ],
                correct_option_id="c",
                explanation=(
                    "A 50% loss requires a 100% gain to recover. If you have $10,000 and lose "
                    "50%, you have $5,000. You need to double that $5,000 (100% gain) to get "
                    "back to $10,000."
                ),
                why_it_matters=(
                    "The asymmetry of losses is why keeping them small matters so much. Small "
                    "losses are easy to recover from; large losses may be career-ending."
                ),
            ),
            QuizItemDef(
                item_id=f"{seed}-q2",
                item_type="mcq",
                prompt="Which behavior is an example of revenge trading?",
                options=[
                    {"id": "a", "text": "Reviewing your trade journal after a loss"},
                    {"id": "b", "text": "Immediately entering a bigger trade to recover the money you just lost"},
                    {"id": "c", "text": "Stepping away from the screen after hitting your daily loss limit"},
                    {"id": "d", "text": "Reducing position size after a losing streak"},
                ],
                correct_option_id="b",
                explanation=(
                    "Revenge trading is taking impulsive, often oversized trades driven by the "
                    "desire to 'get back' what you lost. It usually leads to even larger losses."
                ),
                why_it_matters=(
                    "Recognizing revenge trading in yourself is the first step to stopping it. "
                    "If you are trading to recover instead of trading a setup, step away."
                ),
            ),
            QuizItemDef(
                item_id=f"{seed}-q3",
                item_type="scenario",
                prompt=(
                    "Your trade is up $150 but your target is $300. You feel the urge to sell "
                    "now and lock in profit. Your stop is already moved to breakeven. What should "
                    "you do?"
                ),
                options=[
                    {"id": "a", "text": "Sell immediately — a profit is a profit"},
                    {"id": "b", "text": "Stick to your plan — your stop at breakeven protects you from loss, and your target was chosen for a reason"},
                    {"id": "c", "text": "Double your position since it is working"},
                    {"id": "d", "text": "Remove your stop and target and just watch"},
                ],
                correct_option_id="b",
                explanation=(
                    "Cutting winners early is driven by loss aversion — the fear of giving back "
                    "gains. With your stop at breakeven, the worst outcome is zero loss. Let the "
                    "trade reach its planned target."
                ),
                why_it_matters=(
                    "Consistently cutting winners early while holding losers too long is the "
                    "pattern that makes traders unprofitable over time, even when they pick more "
                    "winners than losers."
                ),
            ),
            QuizItemDef(
                item_id=f"{seed}-q4",
                item_type="reflection",
                prompt=(
                    "Describe a time (real or imagined) when emotions could override a trading "
                    "plan. What specific rule would prevent the mistake?"
                ),
                options=[],
                correct_option_id=None,
                explanation=(
                    "Connecting emotional scenarios to specific rules builds the mental rehearsal "
                    "needed to follow those rules under pressure."
                ),
                why_it_matters=(
                    "Trading is easy when nothing is on the line. The real test is whether your "
                    "rules hold when money, ego, and emotions are in play."
                ),
            ),
        ],
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
            elif module_id == "f2":
                chunks[chunk_id] = _build_f2_chunk(
                    chunk_id=chunk_id,
                    module_id=module_id,
                    chunk_order=chunk_order,
                    seed=seed,
                )
            elif module_id == "f3":
                chunks[chunk_id] = _build_f3_chunk(
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


async def check_prerequisites_met(
    user_id: int, module_id: str, db: AsyncSession
) -> tuple[bool, str | None]:
    """Check if a user has mastered all prerequisite modules.

    Returns (met, reason) where met is True if all prerequisites are satisfied
    (or there are none), and reason describes which prerequisite is unmet.
    """
    # Try DB first for the module's prerequisite_ids
    result = await db.execute(
        select(LessonModule.prerequisite_ids).where(
            LessonModule.module_id == module_id
        )
    )
    row = result.scalar_one_or_none()
    if row is not None:
        prereq_ids: list[str] = row or []
    else:
        # Fallback to in-memory definitions
        module = MODULES.get(module_id)
        if module is None:
            return True, None
        prereq_ids = module.prerequisite_ids

    if not prereq_ids:
        return True, None

    for prereq_module_id in prereq_ids:
        # Get all chunk_ids for the prerequisite module (DB first, fallback in-memory)
        chunk_result = await db.execute(
            select(LessonChunk.chunk_id).where(
                LessonChunk.module_id == prereq_module_id
            )
        )
        chunk_ids = [r[0] for r in chunk_result.all()]
        if not chunk_ids:
            # Fallback to in-memory
            prereq_mod = MODULES.get(prereq_module_id)
            if prereq_mod is None:
                continue
            chunk_ids = prereq_mod.chunk_ids

        if not chunk_ids:
            continue

        # Check that ALL chunks in the prerequisite module are mastered (80%+)
        for chunk_id in chunk_ids:
            prog_result = await db.execute(
                select(UserChunkProgress).where(
                    UserChunkProgress.user_id == user_id,
                    UserChunkProgress.chunk_id == chunk_id,
                )
            )
            progress = prog_result.scalar_one_or_none()
            if progress is None or not progress.mastered:
                # Look up prereq title for a helpful message
                prereq_title = prereq_module_id
                title_result = await db.execute(
                    select(LessonModule.title).where(
                        LessonModule.module_id == prereq_module_id
                    )
                )
                title_row = title_result.scalar_one_or_none()
                if title_row:
                    prereq_title = title_row
                elif prereq_module_id in MODULES:
                    prereq_title = MODULES[prereq_module_id].title
                reason = (
                    f"Prerequisite not met: master all chunks in "
                    f"'{prereq_title}' (module {prereq_module_id}) first."
                )
                return False, reason

    return True, None


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
    if streak_row.current_streak >= 30:
        badges.append("30-Day Streak")

    # Level-based badges
    level_badges: dict[int, str] = {
        2: "Rookie Trader",
        3: "Market Watcher",
        4: "Chart Reader",
        5: "Risk Manager",
        6: "Options Strategist",
        7: "Senior Analyst",
        8: "Portfolio Manager",
        9: "Managing Director",
        10: "Trading Legend",
    }
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        level = user.level
        for lvl, badge_name in level_badges.items():
            if level >= lvl:
                badges.append(badge_name)

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
