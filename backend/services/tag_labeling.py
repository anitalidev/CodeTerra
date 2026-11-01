from pathlib import Path
from string import Template

from models.problem import ExtraTag
from services.openai_service import send_conversation_prompt, start_conversation

MAX_TAGS = 7
MAX_ATTEMPTS = 3

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "tag_labeling_prompt.txt"
PROMPT_TEMPLATE = Template(PROMPT_PATH.read_text())


class InvalidTagsError(ValueError):
    """The model's reply could not be parsed into valid tags."""

class TagLabelingError(Exception):
    """No valid tags were produced after all attempts."""

def parse_tags(reply: str) -> list[ExtraTag]:
    names = [name.strip().lower() for name in reply.split(",") if name.strip()]
    if not names:
        raise InvalidTagsError("The reply contained no tags.")

    allowed = {tag.value for tag in ExtraTag}
    invalid = [name for name in names if name not in allowed]
    if invalid:
        raise InvalidTagsError(f"These are not allowed tags: {', '.join(invalid)}.")
    if len(names) != len(set(names)):
        raise InvalidTagsError("The reply listed a tag more than once.")
    if len(names) > MAX_TAGS:
        raise InvalidTagsError(f"You listed {len(names)} tags; the maximum is {MAX_TAGS}.")
    return [ExtraTag(name) for name in names]


async def label_problem(problem_text: str) -> list[ExtraTag]:
    """Ask the model for tags for a problem, retrying with feedback on bad replies.

    Raises:
        TagLabelingError: no valid tags after MAX_ATTEMPTS attempts.
        openai.APIError: the OpenAI request itself failed (network, auth, rate limit).
    """
    prompt = PROMPT_TEMPLATE.substitute(
        allowed_tags=",".join(tag.value for tag in ExtraTag),
        max_tags=MAX_TAGS,
        problem_text=problem_text,
    )
    reply, response_id = await start_conversation(prompt)

    for attempt in range(MAX_ATTEMPTS):
        try:
            return parse_tags(reply)
        except InvalidTagsError as error:
            if attempt == MAX_ATTEMPTS - 1:
                raise TagLabelingError(
                    f"No valid tags after {MAX_ATTEMPTS} attempts: {error}"
                ) from error
            reply, response_id = await send_conversation_prompt(
                f"{error} Reply again with only valid tags, comma-separated, "
                "with no spaces after the commas.",
                response_id,
            )