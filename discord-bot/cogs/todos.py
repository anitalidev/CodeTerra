from datetime import datetime, timezone
from typing import Literal, Optional

import discord
from discord import app_commands
from discord.ext import commands

from backend_client import BackendClient, BackendError

Mode = Literal["MANUAL", "ON_ACCEPTED"]
Status = Literal["TODO", "DONE", "CANCELLED"]

MODE_LABEL = {"MANUAL": "manual", "ON_ACCEPTED": "auto on accepted"}
STATUS_ICON = {"TODO": "⬜", "DONE": "✅", "CANCELLED": "❌"}


def problem_link(todo: dict) -> str:
    key = f"{todo['contest_id']}{todo['index']}"
    return f"[{key}](https://codeforces.com/contest/{todo['contest_id']}/problem/{todo['index']})"


def todo_line(todo: dict) -> str:
    line = f"{STATUS_ICON[todo['status']]} **#{todo['todo_number']}** {problem_link(todo)} · {MODE_LABEL[todo['completion_mode']]}"
    return f"{line} — {todo['description']}" if todo["description"] else line


def parse_date(text: str | None, label: str) -> str | None:
    """Turns '2026-11-01' (or a full ISO timestamp) into an ISO string, taking UTC when no zone is given."""
    if text is None:
        return None
    try:
        when = datetime.fromisoformat(text)
    except ValueError:
        raise BackendError(f"`{label}` must look like 2026-11-01 or 2026-11-01T14:30 (UTC).")
    return (when if when.tzinfo else when.replace(tzinfo=timezone.utc)).isoformat()


class Todos(commands.GroupCog, group_name="todo", group_description="Your Codeforces todo list"):
    """/todo add | list | view | edit, each backed by one /todos endpoint of the backend."""

    def __init__(self, bot: commands.Bot):
        super().__init__()
        self.bot = bot
        self.api = BackendClient()

    async def cog_load(self):
        await self.api.start()

    async def cog_unload(self):
        await self.api.close()

    # Everything the bot sends here is private to the user who ran the command, and every request uses
    # the caller's own Discord ID, so nobody can read or change someone else's list.
    async def _run(self, interaction: discord.Interaction, call):
        await interaction.response.defer(ephemeral=True)  # the backend may take longer than Discord's 3 s limit
        try:
            await call(interaction.user.id)
        except BackendError as error:
            await interaction.followup.send(f"⚠️ {error}", ephemeral=True)

    @app_commands.command(name="add", description="Add a problem to your todo list")
    @app_commands.describe(
        contest_id="Contest number, e.g. 2104",
        index="Problem letter, e.g. A or B1",
        completion_mode="MANUAL: you mark it done. ON_ACCEPTED: it completes when you get Accepted",
        description="Optional note",
    )
    async def add(self, interaction: discord.Interaction, contest_id: int, index: str, completion_mode: Mode,
                  description: str = ""):
        async def call(user_id: int):
            todo = await self.api.request("POST", f"/todos/{user_id}", json={
                "contest_id": contest_id, "index": index.upper(),
                "completion_mode": completion_mode, "description": description,
            })
            await interaction.followup.send(f"Added:\n{todo_line(todo)}", ephemeral=True)

        await self._run(interaction, call)

    @app_commands.command(name="list", description="List your todos, optionally filtered")
    @app_commands.describe(
        todo_number="Only this todo number",
        contest_id="Only this contest",
        index="Only this problem letter",
        completion_mode="Only MANUAL or ON_ACCEPTED todos",
        status="Only TODO, DONE or CANCELLED (default: all)",
        description="Only todos with exactly this note",
        created_after="Created after this date, e.g. 2026-11-01 (UTC)",
        created_before="Created before this date, e.g. 2026-11-30 (UTC)",
    )
    async def list(self, interaction: discord.Interaction, todo_number: Optional[int] = None,
                   contest_id: Optional[int] = None, index: Optional[str] = None,
                   completion_mode: Optional[Mode] = None, status: Optional[Status] = None,
                   description: Optional[str] = None, created_after: Optional[str] = None,
                   created_before: Optional[str] = None):
        async def call(user_id: int):
            params = {
                "todo_number": todo_number, "contest_id": contest_id,
                "index": index.upper() if index else None, "completion_mode": completion_mode,
                "status": status, "description": description,
                "created_after": parse_date(created_after, "created_after"),
                "created_before": parse_date(created_before, "created_before"),
            }
            todos = await self.api.request(
                "GET", f"/todos/{user_id}", params={k: v for k, v in params.items() if v is not None}
            )
            if not todos:
                await interaction.followup.send("No todos match.", ephemeral=True)
                return
            # An embed holds 4096 characters; stop before that and say how many were left out
            lines, size = [], 0
            for todo in todos:
                line = todo_line(todo)
                if size + len(line) > 3800:
                    lines.append(f"…and {len(todos) - len(lines)} more. Narrow it with filters.")
                    break
                lines.append(line)
                size += len(line) + 1
            embed = discord.Embed(title=f"Your todos ({len(todos)})", description="\n".join(lines))
            await interaction.followup.send(embed=embed, ephemeral=True)

        await self._run(interaction, call)

    @app_commands.command(name="view", description="Show one of your todos")
    @app_commands.describe(todo_number="The # shown in /todo list")
    async def view(self, interaction: discord.Interaction, todo_number: int):
        async def call(user_id: int):
            todo = await self.api.request("GET", f"/todos/{user_id}/{todo_number}")
            embed = discord.Embed(title=f"Todo #{todo['todo_number']}", description=todo_line(todo))
            embed.add_field(name="Mode", value=MODE_LABEL[todo["completion_mode"]])
            embed.add_field(name="Status", value=todo["status"])
            created = datetime.fromisoformat(todo["created_at"].replace("Z", "+00:00"))
            embed.add_field(name="Created", value=discord.utils.format_dt(created, "R"))
            if todo["description"]:
                embed.add_field(name="Notes", value=todo["description"], inline=False)
            await interaction.followup.send(embed=embed, ephemeral=True)

        await self._run(interaction, call)

    @app_commands.command(name="edit", description="Change a todo's note, or mark it done or cancelled")
    @app_commands.describe(
        todo_number="The # shown in /todo list",
        description="New note",
        status="DONE is only allowed for MANUAL todos",
    )
    async def edit(self, interaction: discord.Interaction, todo_number: int,
                   description: Optional[str] = None, status: Optional[Literal["DONE", "CANCELLED"]] = None):
        async def call(user_id: int):
            changes = {"description": description, "status": status}
            changes = {k: v for k, v in changes.items() if v is not None}
            if not changes:
                raise BackendError("Give a new `description` and/or a `status`.")
            todo = await self.api.request("PATCH", f"/todos/{user_id}/{todo_number}", json=changes)
            await interaction.followup.send(f"Updated:\n{todo_line(todo)}", ephemeral=True)

        await self._run(interaction, call)


async def setup(bot: commands.Bot):
    await bot.add_cog(Todos(bot))
