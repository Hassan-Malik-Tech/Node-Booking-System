import prisma from '../../db/prisma.js';

export async function createUserForRegistration(userData) {
  const { username, passwordHash, name, email } = userData;

  const createdUser = await prisma.user.create({
    data: {
      username,
      passwordHash,
      name: name ?? null,
      email,
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return createdUser;
}
