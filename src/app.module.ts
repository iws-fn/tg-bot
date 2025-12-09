import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TelegrafModule } from "nestjs-telegraf";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BotModule } from "./modules/bot/bot.module";
import { UserModule } from "./modules/user/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DATABASE_HOST || "localhost",
      port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
      username: process.env.DATABASE_USER || "postgres",
      password: process.env.DATABASE_PASSWORD || "postgres",
      database: process.env.DATABASE_NAME || "telegram_bot",
      entities: [__dirname + "/**/*.entity{.ts,.js}"],
      synchronize: true, // Set to false in production
    }),
    TelegrafModule.forRoot({
      token: process.env.BOT_TOKEN,
    }),
    UserModule,
    BotModule,
  ],
})
export class AppModule {}
