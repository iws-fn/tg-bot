import { Injectable, Logger } from "@nestjs/common";
import { InjectBot } from "nestjs-telegraf";
import { Context, Telegraf } from "telegraf";
import { UserService } from "../user/user.service";

@Injectable()
export class BotHandlerService {
  private readonly logger = new Logger(BotHandlerService.name);

  constructor(
    private readonly userService: UserService,
    @InjectBot() private readonly bot: Telegraf<Context>
  ) {}

  async handleFioInput(ctx: Context, userId: number, fio: string) {
    try {
      // Save to database (will search by FIO first, then link telegram_id)
      const user = await this.userService.createOrUpdate(userId, fio);

      this.logger.log(
        `User FIO saved: telegram_id=${userId}, fio=${fio}, user_id=${user.id}`
      );

      // Find all users who are waiting for THIS user to register (they chose this user as receiver)
      const senders = await this.userService.findSendersForReceiver(userId);
      
      // Notify all senders that their receiver has registered
      for (const sender of senders) {
        if (sender.telegram_id) {
          try {
            await this.bot.telegram.sendMessage(
              sender.telegram_id,
              `🎉 Ваш получатель ${user.fio} зарегистрировался в боте!\n\nТеперь можете отправить ему QR-код командой /send`
            );
            this.logger.log(
              `Notified sender ${sender.fio} that receiver ${user.fio} registered`
            );
          } catch (notifyError) {
            this.logger.error(
              `Failed to notify sender ${sender.fio}:`,
              notifyError
            );
          }
        }
      }

      // Check if user already has assigned their own receiver
      if (user.receiver) {
        // User already has a receiver, complete registration
        this.logger.log(
          `User ${user.fio} already has receiver assigned for gifting`
        );

        // Check receiver registration status
        const receiverStatus = user.receiver.telegram_id
          ? "✅ Ваш получатель уже зарегистрирован в боте! Можете отправить QR-код командой /send"
          : "⏳ Ваш получатель еще не зарегистрирован. Мы уведомим вас когда он зарегистрируется.";

        await ctx.reply(
          `🎅 Регистрация завершена!\n\n✅ Вам назначен получатель для отправки подарка!\n\n${receiverStatus}\n\n📋 Следующие шаги:\n1️⃣ Получите QR-код вашего подарка из приложения\n2️⃣ Отправьте его своему тайному получателю командой /send\n3️⃣ Ожидайте QR-код от вашего тайного санты!`
        );
        
        return { hasReceiver: true };
      } else {
        // No receiver assigned yet, ask for recipient FIO
        await ctx.reply(`🎄 Отлично! Ваше ФИО: ${fio}\n\nТеперь введите ФИО вашего тайного получателя:`);
        
        return { hasReceiver: false };
      }
    } catch (error) {
      console.log(error);
      this.logger.error(`Error saving FIO for user ${userId}:`, error);
      await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте позже.");
      throw error;
    }
  }

  async handleRecipientInput(
    ctx: Context,
    userId: number,
    recipientFio: string
  ) {
    try {
      // Link receiver by FIO (find or create receiver, then link)
      const user = await this.userService.linkReceiverByFio(userId, recipientFio);

      this.logger.log(
        `Secret Santa receiver linked: user=${user.fio}, receiver=${user.receiver.fio}`
      );

      // Check receiver registration status
      const receiverStatus = user.receiver.telegram_id
        ? "✅ Ваш получатель уже зарегистрирован в боте! Можете отправить QR-код командой /send"
        : "⏳ Ваш получатель еще не зарегистрирован. Мы уведомим вас когда он зарегистрируется.";

      await ctx.reply(
        `🎅 Регистрация завершена!\n\n✅ Вам назначен получатель для отправки подарка!\n\n${receiverStatus}\n\n📋 Следующие шаги:\n1️⃣ Получите QR-код вашего подарка из приложения\n2️⃣ Отправьте его своему тайному получателю командой /send\n3️⃣ Ожидайте QR-код от вашего тайного санты!`
      );
    } catch (error) {
      console.log(error);
      this.logger.error(`Error linking receiver for user ${userId}:`, error);
      await ctx.reply("❌ Произошла ошибка при назначении получателя. Попробуйте позже.");
      throw error;
    }
  }

  async handleContentForward(ctx: Context, userId: number) {
    try {
      // Get user with receiver
      const user = await this.userService.findByTelegramIdWithReceiver(userId);
      
      if (!user || !user.receiver || !user.receiver.telegram_id) {
        await ctx.reply("❌ Ошибка: не удалось найти вашего тайного получателя.");
        return;
      }

      // Check if message exists
      if (!ctx.message) {
        await ctx.reply("❌ Ошибка: сообщение не найдено.");
        return;
      }

      // Forward content anonymously to receiver using copyMessage
      // copyMessage creates a copy without forwarding header (anonymous)
      await this.bot.telegram.copyMessage(
        user.receiver.telegram_id,
        ctx.message.chat.id,
        ctx.message.message_id
      );

      this.logger.log(
        `QR-code forwarded from Secret Santa ${user.fio} (${userId}) to receiver (${user.receiver.telegram_id})`
      );

      await ctx.reply("🎁 QR-код успешно отправлен вашему тайному получателю!");
    } catch (error) {
      this.logger.error(`Error forwarding content for user ${userId}:`, error);
      await ctx.reply(
        "❌ Произошла ошибка при отправке QR-кода. Попробуйте позже."
      );
      throw error;
    }
  }

}
