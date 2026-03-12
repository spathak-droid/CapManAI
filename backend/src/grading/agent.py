"""Probing and grading logic for student responses.

Implements the two-phase assessment:
1. Probing: Generate follow-up questions to test depth of understanding
2. Grading: Score responses across multiple dimensions using rubric
"""

class ProbingAgent:
    """Generates probing follow-up questions for student responses."""

    async def generate_probes(
        self,
        scenario_text: str,
        student_response: str,
        num_probes: int = 3,
    ) -> list[str]:
        """Generate probing questions based on the student's response.

        Args:
            scenario_text: The original scenario description.
            student_response: The student's initial answer.
            num_probes: Number of follow-up questions to generate.

        Returns:
            List of probing question strings.
        """
        raise NotImplementedError


class GradingAgent:
    """Grades student responses across rubric dimensions."""

    async def grade(
        self,
        scenario_text: str,
        student_response: str,
        probe_answers: list[dict[str, str]],
    ) -> dict[str, float | str]:
        """Grade a student's complete response including probe answers.

        Args:
            scenario_text: The original scenario description.
            student_response: The student's initial answer.
            probe_answers: List of {question, answer} dicts from probing.

        Returns:
            Dict with scores for each GradingDimension and feedback_text.
        """
        raise NotImplementedError
