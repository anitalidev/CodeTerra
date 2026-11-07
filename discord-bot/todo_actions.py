"""The todo features, independent of how they are triggered (slash command, text command, ...).

Each action takes the Discord user's ID plus plain values, calls the backend, and returns the reply as
Discord-flavoured text. Nothing here imports discord or knows what a message or interaction is, so every
front end renders the same result. Failures raise a UserFacingError whose message can be shown as is.
"""
import re
from datetime import datetime, timezone

from backend_client import BackendClient
from errors import InputError

MODE_LABEL = {"MANUAL": "manual", "ON_ACCEPTED": "auto on accepted"}
STATUS_ICON = {"TODO": "⬜", "DONE": "✅", "CANCELLED": "❌"}
MESSAGE_LIMIT = 1900  # Discord rejects messages over 2000 characters

# The two Codeforces problem link formats the extension supports. The host is optional, and a trailing
# slash, query string or #fragment is allowed.
PROBLEM_LINK = re.compile(
    r"^(?:(?:https?://)?(?:www\.)?codeforces\.com)?"
    r"/(?:contest/(?P<contest>\d+)/problem/|problemset/problem/(?P<problemset>\d+)/)"
    r"(?P<index>[A-Za-z0-9]+)/?(?:[?#].*)?$"
)


def find_problem_link(text: str) -> tuple[int, str] | None:
    """'https://codeforces.com/contest/2104/problem/A' or '.../problemset/problem/2104/a' -> (2104, 'A')."""
    match = PROBLEM_LINK.match(text.strip().strip("<>"))  # Discord wraps links in <> to hide their preview
    if not match:
        return None
    return int(match["contest"] or match["problemset"]), match["index"].upper()


def parse_problem_link(text: str) -> tuple[int, str]:
    found = find_problem_link(text)
    if found is None:
        raise InputError(
            "That doesn't look like a Codeforces problem link. Use one of these formats:\n"
            "`https://codeforces.com/contest/2104/problem/A`\n"
            "`https://codeforces.com/problemset/problem/2104/A`"
        )
    return found


def parse_date(text: str | None, label: str) -> str | None:
    """Turns '2026-11-01' (or a full ISO timestamp) into an ISO string, taking UTC when no zone is given."""
    if text is None:
        return None
    try:
        when = datetime.fromisoformat(text)
    except ValueError:
        raise InputError(f"`{label}` must look like 2026-11-01 or 2026-11-01T14:30 (UTC).")
    return (when if when.tzinfo else when.replace(tzinfo=timezone.utc)).isoformat()


def problem_link(todo: dict) -> str:
    # <...> around the URL stops Discord from adding a link preview under the message
    key = f"{todo['contest_id']}{todo['index']}"
    return f"[{key}](<https://codeforces.com/contest/{todo['contest_id']}/problem/{todo['index']}>)"


def todo_line(todo: dict) -> str:
    line = f"{STATUS_ICON[todo['status']]} **#{todo['todo_number']}** {problem_link(todo)} · {MODE_LABEL[todo['completion_mode']]}"
    return f"{line} — {todo['description']}" if todo["description"] else line


class TodoActions:
    def __init__(self, api: BackendClient):
        self.api = api

    async def add(self, user_id: int, contest_id: int, index: str, completion_mode: str,
                  description: str = "") -> str:
        todo = await self.api.request("POST", f"/todos/{user_id}", json={
            "contest_id": contest_id, "index": index.upper(),
            "completion_mode": completion_mode, "description": description,
        })
        return f"Added:\n{todo_line(todo)}"

    async def solve_link(self, user_id: int, link: str) -> str:
        """Adds the linked problem as an ON_ACCEPTED todo; everything else is left at its default."""
        contest_id, index = parse_problem_link(link)
        todo = await self.api.request("POST", f"/todos/{user_id}", json={
            "contest_id": contest_id, "index": index, "completion_mode": "ON_ACCEPTED",
        })
        return f"Added:\n{todo_line(todo)}"

    async def todo_list(self, user_id: int, *, todo_number: int | None = None, contest_id: int | None = None,
                        index: str | None = None, completion_mode: str | None = None, status: str | None = None,
                        description: str | None = None, created_after: str | None = None,
                        created_before: str | None = None) -> str:
        params = {
            "todo_number": todo_number, "contest_id": contest_id,
            "index": index.upper() if index else None, "completion_mode": completion_mode,
            "status": status, "description": description,
            "created_after": parse_date(created_after, "created_after"),
            "created_before": parse_date(created_before, "created_before"),
        }
        params = {key: value for key, value in params.items() if value is not None}
        todos = await self.api.request("GET", f"/todos/{user_id}", params=params)
        if not todos:
            return "No todos match." if params else "Your todo list is empty."

        # Stop before the message limit and say how many were left out
        lines, size = [], len(f"**Your todos ({len(todos)})**\n")
        for todo in todos:
            line = todo_line(todo)
            if size + len(line) + 1 > MESSAGE_LIMIT:
                lines.append(f"…and {len(todos) - len(lines)} more. Narrow it with filters.")
                break
            lines.append(line)
            size += len(line) + 1
        return f"**Your todos ({len(todos)})**\n" + "\n".join(lines)

    async def view(self, user_id: int, todo_number: int) -> str:
        todo = await self.api.request("GET", f"/todos/{user_id}/{todo_number}")
        created = datetime.fromisoformat(todo["created_at"].replace("Z", "+00:00"))
        return f"{todo_line(todo)}\nStatus: {todo['status']} · Created <t:{int(created.timestamp())}:R>"

    async def edit(self, user_id: int, todo_number: int, description: str | None = None,
                   status: str | None = None) -> str:
        changes = {"description": description, "status": status}
        changes = {key: value for key, value in changes.items() if value is not None}
        if not changes:
            raise InputError("Give a new `description` and/or a `status`.")
        todo = await self.api.request("PATCH", f"/todos/{user_id}/{todo_number}", json=changes)
        return f"Updated:\n{todo_line(todo)}"
