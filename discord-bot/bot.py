"""CodeTerra Discord bot entry point. Run with: python bot.py"""
import asyncio
import os

import discord
from discord.ext import commands
from dotenv import load_dotenv

from backend_client import BackendClient
from todo_actions import TodoActions

load_dotenv()

intents = discord.Intents.default()
intents.message_content = True  # needed to read typed commands like "cf todo"; also enable it in the developer portal
bot = commands.Bot(
    command_prefix="!",
    intents=intents,
    # Todo notes are user text, so never let a reply ping @everyone, roles or people
    allowed_mentions=discord.AllowedMentions.none(),
)


@bot.event
async def on_ready():
    synced = await bot.tree.sync()
    print(f"Logged in as {bot.user} ({bot.user.id})")
    print(f"Synced {len(synced)} commands: {', '.join(c.name for c in synced)}")


async def main():
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        raise SystemExit("Set DISCORD_TOKEN in discord-bot/.env")

    # One backend client and one set of actions, shared by the slash and text commands
    backend = BackendClient()
    await backend.start()
    bot.actions = TodoActions(backend)
    try:
        async with bot:
            await bot.load_extension("cogs.general")
            await bot.load_extension("cogs.todos")
            await bot.load_extension("cogs.text_commands")
            await bot.start(token)
    finally:
        await backend.close()


if __name__ == "__main__":
    asyncio.run(main())
