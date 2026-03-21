import { PrismaClient } from "@prisma/client";
import { encryptToken } from "../src/utils/crypto.js";

const prisma = new PrismaClient();

async function main() {
  const connections = await prisma.connection.findMany();
  let updated = 0;

  for (const conn of connections) {
    const nextAccess = encryptToken(conn.accessToken);
    const nextRefresh = conn.refreshToken ? encryptToken(conn.refreshToken) : null;

    const accessChanged = nextAccess !== conn.accessToken;
    const refreshChanged = nextRefresh !== conn.refreshToken;

    if (!accessChanged && !refreshChanged) continue;

    await prisma.connection.update({
      where: { id: conn.id },
      data: {
        accessToken: nextAccess,
        refreshToken: nextRefresh,
      },
    });

    updated += 1;
  }

  console.log(`Encrypted tokens for ${updated} connection(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
