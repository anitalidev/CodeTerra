# CodeTerra Discord bot

Python bot built on discord.py, living beside `extension/` and `backend/`.

## Setup
1. Create an application at https://discord.com/developers/applications, add a Bot, copy its token.
2. `cp .env.example .env` and paste the token as `DISCORD_TOKEN`.
3. `pip install -r requirements.txt`
4. `python bot.py`

Invite it with the `bot` and `applications.commands` scopes.

## Layout
- `bot.py`: startup and cog loading
- `cogs/`: one file per feature group (`general.py` has `/ping`)
