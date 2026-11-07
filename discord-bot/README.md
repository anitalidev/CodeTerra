# CodeTerra Discord bot

Python bot built on discord.py, living beside `extension/` and `backend/`.

## Setup
1. Create an application at https://discord.com/developers/applications, add a Bot, copy its token.
2. `cp .env.example .env`, paste the token as `DISCORD_TOKEN`, and set `BACKEND_URL` (`http://localhost:8000` when running the backend locally).
3. `pip install -r requirements.txt`
4. `python bot.py`

Invite it with the `bot` and `applications.commands` scopes.

Typed commands (`cf todo`) need the **Message Content Intent**: in the developer portal open
**Bot → Privileged Gateway Intents**, switch it on, and save. Without it the bot refuses to log in.

## Commands
| Slash | Typed |
|---|---|
| `/tosolve link:<problem link>` | `cf <problem link>` |
| `/todo list` (with optional filters) | `cf todo` |
| `/todo add`, `/todo view`, `/todo edit` | (slash only) |

Slash replies are private to you. Typed replies are posted in the channel.

## Layout
- `bot.py`: startup; creates one backend client and one `TodoActions`, shared by every command
- `todo_actions.py`: the todo logic. Takes plain values, returns reply text, knows nothing about Discord
- `backend_client.py`: async HTTP client for the CodeTerra backend (cogs never touch the database)
- `errors.py`: errors whose message is safe to show the user
- `cogs/todos.py`: slash commands (`/tosolve` and the `/todo` group), thin wrappers around `TodoActions`
- `cogs/text_commands.py`: typed commands; `match_text()` lists them
- `cogs/general.py`: `/ping`

To give another action a typed form, add a line to `match_text()`.
