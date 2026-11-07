"""CodeTerra Discord bot entry point. Run with: python bot.py"""
import asyncio
import os

import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"Logged in as {bot.user} ({bot.user.id})")


async def main():
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        raise SystemExit("Set DISCORD_TOKEN in discord-bot/.env")
    async with bot:
        await bot.load_extension("cogs.general")
        await bot.load_extension("cogs.todos")
        await bot.start(token)


if __name__ == "__main__":
    asyncio.run(main())
