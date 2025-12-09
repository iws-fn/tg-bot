import { Module } from '@nestjs/common';
import { BotUpdate } from './bot.update';
import { BotHandlerService } from './bot-handler.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  providers: [BotUpdate, BotHandlerService],
})
export class BotModule {}

