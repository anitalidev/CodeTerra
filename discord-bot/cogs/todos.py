"""Slash commands. Each one is a thin wrapper: it defers, calls the matching TodoActions method and sends
the text it returns. The logic itself lives in todo_actions.py, shared with the text commands."""
from typing import Literal, Optional

import discord
from discord import app_commands
from discord.ext import commands

from errors import UserFacingError

Mode = Literal["MANUAL", "ON_ACCEPTED"]
Status = Literal["TODO", "DONE", "CANCELLED"]


# Replies are private to whoever ran the command, and every request uses the caller's own Discord ID,
# so nobody can read or change someone else's list.
async def reply(interaction: discord.Interaction, action):
    await interaction.response.defer(ephemeral=True)  # the backend may take longer than Discord's 3 s limit
    try:
        text = await action(interaction.user.id)
    except UserFacingError as error:
        text = f"⚠️ {error}"
    await interaction.followup.send(text, ephemeral=True)


class ToSolve(commands.Cog):
    """The one top-level command: /tosolve."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="tosolve", description="Add a problem to your todo list, done when you get Accepted")
    @app_commands.describe(link="A problem link, e.g. https://codeforces.com/contest/2104/problem/A")
    async def tosolve(self, interaction: discord.Interaction, link: str):
        await reply(interaction, lambda uid: self.bot.actions.solve_link(uid, link))


class Todos(commands.GroupCog, group_name="todo", group_description="Your Codeforces todo list"):
    """/todo add | list | view | edit. In a GroupCog every command becomes a subcommand of /todo."""

    def __init__(self, bot: commands.Bot):
        super().__init__()
        self.bot = bot

    @app_commands.command(name="add", description="Add a problem to your todo list")
    @app_commands.describe(
        contest_id="Contest number, e.g. 2104",
        index="Problem letter, e.g. A or B1",
        completion_mode="MANUAL: you mark it done. ON_ACCEPTED: it completes when you get Accepted",
        description="Optional note",
    )
    async def add(self, interaction: discord.Interaction, contest_id: int, index: str,
                      completion_mode: Mode, description: str = ""):
        await reply(interaction, lambda uid: self.bot.actions.add(
            uid, contest_id, index, completion_mode, description))

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
        await reply(interaction, lambda uid: self.bot.actions.todo_list(
            uid, todo_number=todo_number, contest_id=contest_id, index=index,
            completion_mode=completion_mode, status=status, description=description,
            created_after=created_after, created_before=created_before))

    @app_commands.command(name="view", description="Show one of your todos")
    @app_commands.describe(todo_number="The # shown in /todo list")
    async def view(self, interaction: discord.Interaction, todo_number: int):
        await reply(interaction, lambda uid: self.bot.actions.view(uid, todo_number))

    @app_commands.command(name="edit", description="Change a todo's note, or mark it done or cancelled")
    @app_commands.describe(
        todo_number="The # shown in /todo list",
        description="New note",
        status="DONE is only allowed for MANUAL todos",
    )
    async def edit(self, interaction: discord.Interaction, todo_number: int,
                       description: Optional[str] = None, status: Optional[Literal["DONE", "CANCELLED"]] = None):
        await reply(interaction, lambda uid: self.bot.actions.edit(uid, todo_number, description, status))


async def setup(bot: commands.Bot):
    await bot.add_cog(ToSolve(bot))
    await bot.add_cog(Todos(bot))
