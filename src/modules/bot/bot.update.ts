import { Logger } from "@nestjs/common";
import { Update, Ctx, Start, On, Command } from "nestjs-telegraf";
import { Context } from "telegraf";
import { BotHandlerService } from "./bot-handler.service";
import { UserService } from "../user/user.service";

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);
  private waitingForFio = new Set<number>(); // Track users waiting to enter FIO
  private waitingForRecipient = new Set<number>(); // Track users waiting to enter recipient FIO
  private waitingForContent = new Set<number>(); // Track users waiting to send content

  constructor(
    private readonly botHandlerService: BotHandlerService,
    private readonly userService: UserService
  ) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    this.logger.log(
      `Start command received from user: ${userId} (@${ctx.from?.username})`
    );

    // Check if user is already registered
    const user = await this.userService.findByTelegramIdWithReceiver(userId);
    
    if (user) {
      // User already registered, show status information
      this.logger.log(`User ${user.fio} already registered, showing status`);

      let statusMessage = `🎅 Добро пожаловать, ${user.fio}!\n\n`;

      // Check receiver status
      if (user.receiver) {
        if (user.receiver.telegram_id) {
          statusMessage += "✅ Ваш получатель зарегистрирован в боте\n";
        } else {
          statusMessage += "⏳ Ваш получатель еще не зарегистрирован\n";
        }
      } else {
        statusMessage += "❌ У вас не назначен получатель\n";
      }

      // Check if user has a secret santa (someone chose them as receiver)
      const hasSecretSanta = await this.userService.hasSecretSanta(userId);
      if (hasSecretSanta) {
        statusMessage += "✅ Ваш тайный санта зарегистрирован и может отправить вам подарок\n";
      } else {
        statusMessage += "⏳ Ваш тайный санта еще не зарегистрирован\n";
      }

      statusMessage += "\n📋 Используйте /send для отправки QR-кода своему получателю";

      await ctx.reply(statusMessage);
      return;
    }

    // User not registered, start registration
    this.waitingForFio.add(userId);

    await ctx.reply("🎅 Добро пожаловать в Тайного Санту!\n\nПожалуйста, введите ваше ФИО:\n\n💡 Пример: Иванов Иван Иванович");
  }

  @Command("send")
  async sendCommand(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    this.logger.log(`Send command received from user: ${userId}`);

    // Check if user is registered
    const user = await this.userService.findByTelegramIdWithReceiver(userId);

    if (!user) {
      await ctx.reply(
        "❌ Вы не зарегистрированы. Используйте /start для регистрации."
      );
      return;
    }

    // Check if user has a receiver
    if (!user.receiver) {
      await ctx.reply("❌ У вас еще не назначен тайный получатель.");
      return;
    }

    // Check if receiver is registered in bot
    if (!user.receiver.telegram_id) {
      await ctx.reply("❌ Ваш тайный получатель еще не зарегистрирован в боте.");
      return;
    }

    // Mark user as waiting for content
    this.waitingForContent.add(userId);

    await ctx.reply("🎁 Отправьте QR-код или код из приложения:");
  }

  @On("text")
  async onText(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (!("text" in ctx.message)) return;

    const text = ctx.message.text;

    // Skip if it's a command
    if (text.startsWith("/")) {
      return;
    }

    // Handle FIO input
    if (this.waitingForFio.has(userId)) {
      await this.handleFioInput(ctx, userId, text);
      return;
    }

    // Handle recipient FIO input
    if (this.waitingForRecipient.has(userId)) {
      await this.handleRecipientInput(ctx, userId, text);
      return;
    }

    // Handle content forwarding (text messages)
    if (this.waitingForContent.has(userId)) {
      await this.handleContentForward(ctx, userId);
      return;
    }
  }

  @On("photo")
  async onPhoto(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (this.waitingForContent.has(userId)) {
      await this.handleContentForward(ctx, userId);
    }
  }

  @On("video")
  async onVideo(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (this.waitingForContent.has(userId)) {
      await this.handleContentForward(ctx, userId);
    }
  }

  @On("document")
  async onDocument(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (this.waitingForContent.has(userId)) {
      await this.handleContentForward(ctx, userId);
    }
  }

  @On("voice")
  async onVoice(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (this.waitingForContent.has(userId)) {
      await this.handleContentForward(ctx, userId);
    }
  }

  @On("audio")
  async onAudio(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (this.waitingForContent.has(userId)) {
      await this.handleContentForward(ctx, userId);
    }
  }

  @On("sticker")
  async onSticker(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (this.waitingForContent.has(userId)) {
      await this.handleContentForward(ctx, userId);
    }
  }

  @On("video_note")
  async onVideoNote(@Ctx() ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (this.waitingForContent.has(userId)) {
      await this.handleContentForward(ctx, userId);
    }
  }

  private async handleFioInput(ctx: Context, userId: number, fio: string) {
    try {
      const result = await this.botHandlerService.handleFioInput(ctx, userId, fio);

      // Remove user from waiting FIO state
      this.waitingForFio.delete(userId);

      // If no receiver, mark as waiting for recipient
      if (result && !result.hasReceiver) {
        this.waitingForRecipient.add(userId);
      }
    } catch (error) {
      // Error already handled by service
      this.waitingForFio.delete(userId);
    }
  }

  private async handleRecipientInput(
    ctx: Context,
    userId: number,
    recipientFio: string
  ) {
    try {
      await this.botHandlerService.handleRecipientInput(
        ctx,
        userId,
        recipientFio
      );

      // Remove user from waiting recipient state
      this.waitingForRecipient.delete(userId);
    } catch (error) {
      // Error already handled by service
      this.waitingForRecipient.delete(userId);
    }
  }

  private async handleContentForward(ctx: Context, userId: number) {
    try {
      await this.botHandlerService.handleContentForward(ctx, userId);

      // Remove user from waiting state
      this.waitingForContent.delete(userId);
    } catch (error) {
      // Error already handled by service
      this.waitingForContent.delete(userId);
    }
  }
}
