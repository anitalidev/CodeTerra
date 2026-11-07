"""Typed commands: messages that start with the prefix, e.g. `cf todo` or `cf <problem link>`.

Only a few of the slash commands have a text form, because splitting parameters out of free text is
awkward. The routes are listed in route_text(); add a line there to give another action a text form.
"""
from discord.ext import commands

from errors import UserFacingError
from todo_actions import TodoActions, find_problem_link

PREFIX = "cf"


async def route_text(actions: TodoActions, user_id: int, text: str) -> str | None:
    """`text` is what follows the prefix. Returns the reply, or None if it isn't one of our commands."""
    if text.lower() == "todo":  # same as /todo list
        return await actions.todo_list(user_id)
    if find_problem_link(text):  # same as /tosolve <link>
        return await actions.solve_link(user_id, text)
    return None


class TextCommands(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot:
            return
        parts = message.content.strip().split(None, 1)
        if len(parts) != 2 or parts[0].lower() != PREFIX:
            return

        async with message.channel.typing():
            try:
                reply = await route_text(self.bot.actions, message.author.id, parts[1].strip())
            except UserFacingError as error:
                reply = f"⚠️ {error}"
        if reply is not None:  # not one of our commands: stay quiet, it may just be chat
            await message.reply(reply, mention_author=False)


async def setup(bot: commands.Bot):
    await bot.add_cog(TextCommands(bot))
