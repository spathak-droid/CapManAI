"""Prompt templates for LLM scenario generation.

Contains system prompts, scenario generation templates,
and output format specifications for OpenRouter calls.
"""

SYSTEM_PROMPT = """You are an expert trading instructor creating realistic
trading scenarios for educational assessment. Generate scenarios that test
specific trading skills with appropriate complexity levels."""

SCENARIO_TEMPLATE = """Generate a trading scenario with the following parameters:
- Skill Target: {skill_target}
- Complexity Level: {complexity}/5
- Market Regime: {market_regime}
- Instrument Type: {instrument_type}

Provide:
1. A realistic market situation description
2. Relevant market data (prices, volumes, indicators)
3. A specific question testing the target skill

Format your response as JSON with keys: situation, market_data, question"""

PROBE_TEMPLATE = """Given the following trading scenario and student response,
generate {num_probes} follow-up probing questions to assess depth of understanding.

Scenario: {scenario}
Student Response: {response}

Generate questions that:
1. Test understanding beyond surface-level answers
2. Explore edge cases and risk considerations
3. Assess ability to adapt to changing conditions"""
