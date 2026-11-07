"""Typed commands: messages that start with the prefix, e.g. `cf todo` or `cf <problem link>`.

Only a few of the slash commands have a text form, because splitting parameters out of free text is
awkward. The routes are listed in match_text(); add a line there to give another action a text form.
"""
from discord.ext import commands

from errors import UserFacingError
from todo_actions import TodoActions, find_problem_link

PREFIX = "cf"


def match_text(actions: TodoActions, user_id: int, text: str):
    """`text` is what follows the prefix. Returns the action to run (a function that returns a coroutine),
    or None if it isn't one of our commands."""
    if text.lower() == "todo":  # same as /todo list
        return lambda: actions.todo_list(user_id)
    if find_problem_link(text):  # same as /tosolve <link>
        return lambda: actions.solve_link(user_id, text)
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

        action = match_text(self.bot.actions, message.author.id, parts[1].strip())
        if action is None:  # not one of our commands: stay quiet (no typing indicator either), it may just be chat
            return

        async with message.channel.typing():
            try:
                reply = await action()
            except UserFacingError as error:
                reply = f"⚠️ {error}"
        await message.reply(reply, mention_author=False)


async def setup(bot: commands.Bot):
    await bot.add_cog(TextCommands(bot))
