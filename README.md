# Telegraf + NestJS Bot Template

A simple Telegram bot template built with NestJS and Telegraf.

## Features

- NestJS framework integration
- Telegraf library for Telegram Bot API
- `/start` command handler with FIO collection
- REST API for bulk user upload
- TypeORM integration with PostgreSQL
- User persistence in database
- Automatic Telegram ID linking by FIO match
- Environment-based configuration
- TypeScript support with validation

## Prerequisites

- Node.js (v18 or higher)
- pnpm package manager
- PostgreSQL database
- Telegram Bot Token (get it from [@BotFather](https://t.me/botfather))

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd tg-bot
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up PostgreSQL database:

```bash
# Create a database named 'telegram_bot' (or use your preferred name)
createdb telegram_bot
```

4. Create a `.env` file in the root directory:

```bash
BOT_TOKEN=your_bot_token_here

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=telegram_bot
```

Replace the values with your actual bot token and database credentials.

## Running the Bot

### Development mode

```bash
pnpm start:dev
```

### Production mode

```bash
# Build the project
pnpm build

# Run the compiled code
pnpm start:prod
```

## Project Structure

```
tg-bot/
├── src/
│   ├── modules/
│   │   ├── bot/
│   │   │   ├── bot.module.ts      # Bot module
│   │   │   └── bot.update.ts      # Bot command handlers
│   │   └── user/
│   │       ├── dto/
│   │       │   └── bulk-upload.dto.ts  # DTOs for API
│   │       ├── entities/
│   │       │   └── user.entity.ts      # User entity
│   │       ├── user.controller.ts      # REST API controller
│   │       ├── user.module.ts          # User module
│   │       └── user.service.ts         # User service
│   ├── app.module.ts              # Root application module
│   └── main.ts                    # Application entry point
├── .env                           # Environment variables (create this)
├── env-template.txt               # Environment template
├── package.json                   # Dependencies and scripts
└── tsconfig.json                  # TypeScript configuration
```

## Available Bot Commands

- `/start` - Start the bot and register your FIO

## REST API

The bot also exposes a REST API on port 3000:

- `POST /users/bulk-upload` - Upload users in bulk
- `GET /users` - Get all users

## How It Works

### User Registration Flow

1. **Pre-upload users (optional):**
   - Use the REST API to upload a list of users with their FIOs
   - These users will be created in the database without Telegram IDs

2. **Telegram Registration:**
   - User sends `/start` to the bot
   - Bot asks for their full name (FIO)
   - User enters their FIO
   - Bot searches for existing user by exact FIO match:
     - **If found:** Links the Telegram ID to existing user
     - **If not found:** Creates a new user with Telegram ID and FIO
   - Bot confirms registration
   - **If user has a receiver who is already registered:** Receiver gets notified about the registration

### REST API Endpoints

**POST /users/bulk-upload** - Upload multiple users

Request body:
```json
{
  "users": [
    { 
      "fio": "Иванов Иван Иванович",
      "receiver_fio": "Петров Петр Петрович"
    },
    { 
      "fio": "Петров Петр Петрович",
      "receiver_fio": "Сидоров Сидор Сидорович"
    },
    {
      "fio": "Сидоров Сидор Сидорович"
    }
  ]
}
```

Note: `receiver_fio` is optional. It creates a one-to-one relationship where each sender can have one receiver.

Response:
```json
{
  "created": 3,
  "total": 3,
  "linked": 2,
  "message": "Successfully processed 3 users. Created: 3, Skipped: 0, Receiver links: 2"
}
```

**GET /users** - Get all users

Response:
```json
[
  {
    "id": 1,
    "telegram_id": 123456789,
    "fio": "Иванов Иван Иванович",
    "receiver": {
      "id": 2,
      "telegram_id": null,
      "fio": "Петров Петр Петрович"
    }
  },
  {
    "id": 2,
    "telegram_id": null,
    "fio": "Петров Петр Петрович",
    "receiver": {
      "id": 3,
      "telegram_id": null,
      "fio": "Сидоров Сидор Сидорович"
    }
  },
  {
    "id": 3,
    "telegram_id": null,
    "fio": "Сидоров Сидор Сидорович",
    "receiver": null
  }
]
```

## Adding New Commands

To add new commands, edit `src/modules/bot/bot.update.ts`:

```typescript
import { Update, Ctx, Start, Command } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Update()
export class BotUpdate {
  @Start()
  async start(@Ctx() ctx: Context) {
    await ctx.reply('Welcome! 👋\n\nThis is a simple Telegraf + NestJS bot.');
  }

  @Command('help')
  async help(@Ctx() ctx: Context) {
    await ctx.reply('Available commands:\n/start - Start the bot\n/help - Show this message');
  }
}
```

## License

MIT

