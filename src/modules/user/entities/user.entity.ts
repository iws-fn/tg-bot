import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "bigint", unique: true, nullable: true })
  telegram_id: string;

  @Column()
  fio: string;

  @Column({ nullable: true })
  code: string;

  // One-to-one relationship: this user sends to receiver
  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: "receiver_id" })
  receiver: User;

  // Optional: inverse relation to find who sends to this user
  @OneToOne(() => User, (user) => user.receiver, { nullable: true })
  sender: User;
}

