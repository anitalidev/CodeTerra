import asyncio
import logging
import time

import httpx

from schemas.cfproblem import CFProblem
CODEFORCES_API_PATH_PREFIX = 'https://codeforces.com/api/'

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_S = 20
MIN_SECONDS_BETWEEN_CALLS = 2.1  # Codeforces allows about one API call every two seconds

# contest id -> its problem letters. Only successful lookups are stored, and a contest's problem list never
# changes once the contest has started, so entries don't expire.
_problem_letters: dict[int, frozenset[str]] = {}
_lock = asyncio.Lock()  # one lookup at a time: keeps within the rate limit, and a waiter finds the result cached
_last_call = 0.0


class CodeforcesUnavailable(Exception):
    """Codeforces couldn't tell us (network error, rate limit, contest not started yet...)."""


async def _fetch_problem_letters(contest_id: int, transport: httpx.AsyncBaseTransport | None) -> frozenset[str] | None:
    """None if Codeforces says the contest doesn't exist. Raises CodeforcesUnavailable if it can't say."""
    global _last_call
    wait = _last_call + MIN_SECONDS_BETWEEN_CALLS - time.monotonic()
    if wait > 0:
        await asyncio.sleep(wait)
    _last_call = time.monotonic()

    try:
        # The bare form is the only one Codeforces allows for non-admins: any extra parameter (from, count...)
        # is refused. It also returns every ranked participant, which can be several MB, so we keep only
        # the problem letters.
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S, transport=transport) as client:
            response = await client.get(CODEFORCES_API_PATH_PREFIX + "contest.standings", params={"contestId": contest_id})
        body = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise CodeforcesUnavailable(f"request failed: {error!r}")

    if body.get("status") == "OK":
        return frozenset(problem["index"] for problem in body["result"]["problems"])
    comment = str(body.get("comment", ""))
    if "not found" in comment:
        return None
    raise CodeforcesUnavailable(comment or f"HTTP {response.status_code}")


async def problem_exists(contest_id: int, index: str, transport: httpx.AsyncBaseTransport | None = None) -> bool | None:
    """Does Codeforces have problem `index` in contest `contest_id`?

    True or False when Codeforces told us; None when we couldn't find out (callers should let the request
    through rather than block users because of a Codeforces outage).
    """
    letters = _problem_letters.get(contest_id)
    if letters is None:
        async with _lock:
            letters = _problem_letters.get(contest_id)  # someone may have fetched it while we waited
            if letters is None:
                try:
                    letters = await _fetch_problem_letters(contest_id, transport)
                except CodeforcesUnavailable as error:
                    logger.warning("Could not check problem %s%s on Codeforces: %s", contest_id, index, error)
                    return None
                if letters is None:
                    return False  # no such contest
                _problem_letters[contest_id] = letters
    return index in letters
