from openai import AsyncOpenAI

MODEL = "gpt-6-luna"


def create_client(api_key: str) -> AsyncOpenAI:
    """Each request brings its own key, so there is no shared client."""
    return AsyncOpenAI(api_key=api_key)


async def send_prompt(client: AsyncOpenAI, prompt: str) -> str:
    """Sends a solo prompt. Returns (reply text)."""
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": f"{prompt}"}],
    )
    return response.choices[0].message.content


async def start_conversation(client: AsyncOpenAI, prompt: str) -> tuple[str, str]:
    """Start a new conversation. Returns (reply text, response id)."""
    response = await client.responses.create(model=MODEL, input=prompt)
    return response.output_text, response.id


async def send_conversation_prompt(
    client: AsyncOpenAI, prompt: str, previous_response_id: str
) -> tuple[str, str]:
    """Continue a conversation. Returns (reply text, new response id)."""
    response = await client.responses.create(
        model=MODEL,
        input=prompt,
        previous_response_id=previous_response_id,
    )
    return response.output_text, response.id
