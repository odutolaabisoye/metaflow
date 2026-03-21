/**
 * Weekly Digest Job
 *
 * Sends a weekly performance summary email to every user who has opted in
 * via Settings → Notifications → Weekly Digest.
 *
 * Fired once per week (Monday 8:00 AM UTC) by the weekly BullMQ queue.
 */
import type { PrismaClient } from "@prisma/client";

interface MailService {
  sendWeeklyDigest(
    email: string,
    name: string,
    storeName: string,
    stats: {
      scaled: number;
      killed: number;
      tested: number;
      risked: number;
      totalProducts: number;
      topProduct?: string;
    }
  ): Promise<void>;
}

interface DigestResult {
  usersProcessed: number;
  emailsSent: number;
  emailsFailed: number;
}

export async function runWeeklyDigestJob(
  prisma: PrismaClient,
  mail: MailService
): Promise<DigestResult> {
  const result: DigestResult = { usersProcessed: 0, emailsSent: 0, emailsFailed: 0 };

  // Find all users who have opted into the weekly digest
  const users = await prisma.user.findMany({
    where: { settings: { notifWeeklyDigest: true } },
    select: {
      id: true,
      email: true,
      name: true,
      stores: {
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  for (const user of users) {
    result.usersProcessed++;

    for (const store of user.stores) {
      // Aggregate product categories from pre-computed scoring fields
      const [catCounts, topProduct] = await Promise.all([
        prisma.productMeta.groupBy({
          by: ["category"],
          where: { storeId: store.id, isVariant: false, isActive: true },
          _count: { id: true }
        }),
        prisma.productMeta.findFirst({
          where: { storeId: store.id, isVariant: false, isActive: true, category: "SCALE" },
          orderBy: { score: "desc" },
          select: { title: true }
        })
      ]);

      // Build category → count lookup
      const catMap = new Map<string, number>();
      for (const row of catCounts) {
        catMap.set(row.category, row._count.id);
      }

      const totalProducts = [...catMap.values()].reduce((a, b) => a + b, 0);
      if (totalProducts === 0) {
        // No products yet — skip this store to avoid a useless empty email
        continue;
      }

      const stats = {
        scaled:        catMap.get("SCALE")   ?? 0,
        killed:        catMap.get("KILL")    ?? 0,
        tested:        catMap.get("TEST")    ?? 0,
        risked:        catMap.get("RISK")    ?? 0,
        totalProducts,
        topProduct:    topProduct?.title ?? undefined
      };

      try {
        await mail.sendWeeklyDigest(user.email, user.name ?? "", store.name, stats);
        result.emailsSent++;
      } catch (err) {
        // Non-fatal — one failed send should not abort the rest of the batch
        console.error(
          `[weeklyDigest] Failed to send digest to ${user.email} for store ${store.id}:`,
          err
        );
        result.emailsFailed++;
      }
    }
  }

  return result;
}
