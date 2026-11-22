import { prisma } from './prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding initial data...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // Upsert user alex
  const alex = await prisma.user.upsert({
    where: { username: 'alex' },
    update: {},
    create: {
      username: 'alex',
      email: 'alex@example.com',
      password: passwordHash,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alex',
      status: 'offline',
    },
  });

  // Upsert user maria
  const maria = await prisma.user.upsert({
    where: { username: 'maria' },
    update: {},
    create: {
      username: 'maria',
      email: 'maria@example.com',
      password: passwordHash,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=maria',
      status: 'offline',
    },
  });

  // Upsert user john
  const john = await prisma.user.upsert({
    where: { username: 'john' },
    update: {},
    create: {
      username: 'john',
      email: 'john@example.com',
      password: passwordHash,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=john',
      status: 'offline',
    },
  });

  // Create General Room if not exists
  let general = await prisma.room.findFirst({
    where: { name: 'Общий чат', isGroup: true },
  });

  if (!general) {
    general = await prisma.room.create({
      data: {
        name: 'Общий чат',
        isGroup: true,
      },
    });
  }

  // Ensure members
  for (const user of [alex, maria, john]) {
    await prisma.roomMember.upsert({
      where: {
        roomId_userId: { roomId: general.id, userId: user.id },
      },
      update: {},
      create: {
        roomId: general.id,
        userId: user.id,
      },
    });
  }

  // Add welcome messages if empty
  const msgCount = await prisma.message.count({
    where: { roomId: general.id },
  });

  if (msgCount === 0) {
    await prisma.message.create({
      data: {
        roomId: general.id,
        senderId: alex.id,
        content: 'Всем привет! Добро пожаловать в наш новый чат! 🚀',
      },
    });

    await prisma.message.create({
      data: {
        roomId: general.id,
        senderId: maria.id,
        content: 'Привет, Алекс! Сообщения приходят мгновенно, дизайн отличный! 🎉',
      },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
