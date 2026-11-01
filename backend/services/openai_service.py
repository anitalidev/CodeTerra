import os
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

MODEL = "gpt-6-luna"

async def send_prompt(prompt: str) -> str:
    """Sends a solo prompt. Returns (reply text)."""
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": f"{prompt}"}],
    )
    return response.choices[0].message.content


async def start_conversation(prompt: str) -> tuple[str, str]:
    """Start a new conversation. Returns (reply text, response id)."""
    response = await client.responses.create(model=MODEL, input=prompt)
    return response.output_text, response.id


async def send_conversation_prompt(prompt: str, previous_response_id: str) -> tuple[str, str]:
    """Continue a conversation. Returns (reply text, new response id)."""
    response = await client.responses.create(
        model=MODEL,
        input=prompt,
        previous_response_id=previous_response_id,
    )
    return response.output_text, response.id
