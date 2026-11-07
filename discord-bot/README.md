# CodeTerra Discord bot

Python bot built on discord.py, living beside `extension/` and `backend/`.

## Setup
1. Create an application at https://discord.com/developers/applications, add a Bot, copy its token.
2. `cp .env.example .env`, paste the token as `DISCORD_TOKEN`, and set `BACKEND_URL` (`http://localhost:8000` when running the backend locally).
3. `pip install -r requirements.txt`
4. `python bot.py`

Invite it with the `bot` and `applications.commands` scopes.

## Layout
- `bot.py`: startup and cog loading
- `backend_client.py`: async HTTP client for the CodeTerra backend; cogs use it instead of touching the database
- `cogs/`: one file per feature group (`general.py` has `/ping`, `todos.py` has `/todo add|list|view|edit`)
