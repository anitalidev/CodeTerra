"""Small async client for the CodeTerra backend (FastAPI). Cogs talk to the database only through this."""
import os

import aiohttp

from errors import BackendError


def _explain(status: int, body) -> str:
    detail = body.get("detail") if isinstance(body, dict) else None
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):  # FastAPI validation errors (422): [{"loc": [...], "msg": "..."}]
        return "; ".join(f"{'.'.join(str(p) for p in e.get('loc', [])[1:])}: {e.get('msg')}" for e in detail)
    return f"The backend returned an error ({status})."


class BackendClient:
    def __init__(self):
        base_url = os.environ.get("BACKEND_URL")
        if not base_url:
            raise RuntimeError("Set BACKEND_URL in discord-bot/.env (e.g. http://localhost:8000)")
        self.base_url = base_url.rstrip("/")
        self.session: aiohttp.ClientSession | None = None

    async def start(self):
        # Must be created while the event loop is running, so not in __init__
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15))

    async def close(self):
        if self.session:
            await self.session.close()

    async def request(self, method: str, path: str, *, json=None, params=None):
        """Returns the decoded JSON body, or raises BackendError."""
        try:
            async with self.session.request(method, self.base_url + path, json=json, params=params) as res:
                body = await res.json(content_type=None)
                if res.status >= 400:
                    raise BackendError(_explain(res.status, body))
                return body
        except aiohttp.ClientError as error:
            # The Discord user gets a short message; the real cause goes to the bot's logs
            print(f"Backend call failed: {method} {self.base_url + path} -> {error!r}", flush=True)
            raise BackendError("Could not reach the CodeTerra backend. Try again in a moment.")
        except TimeoutError:
            print(f"Backend call timed out: {method} {self.base_url + path}", flush=True)
            raise BackendError("The CodeTerra backend took too long to answer.")
