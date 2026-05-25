import prisma from '../db/prisma.js';

try {
  await prisma.$connect(); // top level await

  const userCount = await prisma.user.count();

  console.log('Prisma connection successful.');
  console.log(`User count: ${userCount}`);
} catch (error) {
  console.error('Prisma connection failed.');
  console.error(error);

  // Do not use process.exit(1) here because it can stop cleanup too early.
  // Exit code 1 means failure. Exit code 0 means success.
  // Since the error is caught, the failure code is set manually.
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
