import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { User } from "./entities/user.entity";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async createOrUpdate(telegram_id: number, fio: string): Promise<User> {
    const telegramIdStr = telegram_id.toString();

    // First, try to find user by FIO (exact match)
    let user = await this.findByFio(fio);

    if (user) {
      // User exists, link telegram_id if not already set
      if (user.telegram_id && user.telegram_id !== telegramIdStr) {
        this.logger.warn(
          `User with FIO "${fio}" already has telegram_id ${user.telegram_id}, updating to ${telegramIdStr}`
        );
      }
      user.telegram_id = telegramIdStr;
      this.logger.log(`Linking telegram_id ${telegramIdStr} to user: ${fio}`);
    } else {
      // Try to find by telegram_id
      user = await this.findByTelegramId(telegram_id);
      if (user) {
        user.fio = fio;
        this.logger.log(`Updating FIO for user ${telegramIdStr}: ${fio}`);
      } else {
        // Create new user
        user = this.userRepository.create({ telegram_id: telegramIdStr, fio });
        this.logger.log(`Creating new user ${telegramIdStr}: ${fio}`);
      }
    }

    await this.userRepository.save(user);

    return (await this.findById(user.id)) as User;
  }

  async findById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id },
      relations: ["receiver"],
    });
  }

  async findByTelegramId(telegram_id: number): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { telegram_id: telegram_id.toString() },
    });
  }

  async findByTelegramIdWithReceiver(
    telegram_id: number
  ): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { telegram_id: telegram_id.toString() },
      relations: ["receiver"],
    });
  }

  async findByFio(fio: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { fio } });
  }

  async hasSecretSanta(userId: number): Promise<boolean> {
    // Check if anyone has chosen this user as their receiver
    const user = await this.findByTelegramId(userId);
    if (!user) {
      return false;
    }

    // Find if there's anyone whose receiver is this user
    const secretSanta = await this.userRepository.findOne({
      where: { receiver: { id: user.id } },
    });

    return !!secretSanta;
  }

  async findSendersForReceiver(userId: number): Promise<User[]> {
    // Find all users who have chosen this user as their receiver
    const user = await this.findByTelegramId(userId);
    if (!user) {
      return [];
    }

    // Find all users whose receiver is this user
    const senders = await this.userRepository.find({
      where: { receiver: { id: user.id } },
      relations: ["receiver"],
    });

    return senders;
  }

  async linkReceiverByFio(
    telegram_id: number,
    receiverFio: string
  ): Promise<User> {
    // Find the sender user
    const user = await this.findByTelegramId(telegram_id);
    if (!user) {
      throw new Error(`User with telegram_id ${telegram_id} not found`);
    }

    // Find or create receiver by FIO
    let receiver = await this.findByFio(receiverFio);
    if (!receiver) {
      // Create new receiver (without assigning a receiver to avoid circular link)
      receiver = this.userRepository.create({
        fio: receiverFio,
        telegram_id: null,
      });
      await this.userRepository.save(receiver);
      this.logger.log(`Created new receiver: ${receiverFio}`);
    }

    // Link receiver to user
    user.receiver = receiver;
    await this.userRepository.save(user);
    this.logger.log(`Linked ${user.fio} -> ${receiver.fio}`);

    // Return user with receiver relation
    return (await this.findById(user.id)) as User;
  }

  async findByFios(fios: string[]): Promise<User[]> {
    return await this.userRepository.find({ where: { fio: In(fios) } });
  }

  async bulkCreate(
    users: { fio: string; receiver_fio?: string }[]
  ): Promise<{ created: number; linked: number }> {
    let created = 0;
    let linked = 0;

    // First pass: create all users
    for (const userData of users) {
      const existingUser = await this.findByFio(userData.fio);

      if (!existingUser) {
        const user = this.userRepository.create({
          fio: userData.fio,
          telegram_id: null,
        });
        await this.userRepository.save(user);
        created++;
        this.logger.log(`Created user: ${userData.fio}`);
      } else {
        this.logger.log(`User already exists: ${userData.fio}, skipping`);
      }
    }

    // Second pass: link receivers by FIO
    for (const userData of users) {
      if (userData.receiver_fio) {
        const sender = await this.findByFio(userData.fio);
        const receiver = await this.findByFio(userData.receiver_fio);

        if (sender && receiver) {
          sender.receiver = receiver;
          await this.userRepository.save(sender);
          linked++;
          this.logger.log(`Linked ${userData.fio} -> ${userData.receiver_fio}`);
        } else {
          if (!sender) {
            this.logger.warn(`Sender not found: ${userData.fio}`);
          }
          if (!receiver) {
            this.logger.warn(`Receiver not found: ${userData.receiver_fio}`);
          }
        }
      }
    }

    return { created, linked };
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      relations: ["receiver"],
    });
  }
}
