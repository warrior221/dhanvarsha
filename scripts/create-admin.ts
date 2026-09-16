import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";

/**
 * Creates an administrator. RUN MANUALLY FROM A TERMINAL:
 *
 *   npx tsx scripts/create-admin.ts "Full Name" someone@example.com
 *
 * The account is created with role ADMIN and NO password. A single-use setup
 * link is emailed so the admin chooses their own password — the developer
 * running this script never learns it.
 *
 * There is deliberately no API route that does this. Spec section 7: "No
 * public route may ever create an admin."
 */

try {
  process.loadEnvFile(path.join(import.meta.dirname, "..", ".env.local"));
} catch {
  // Fall back to the real environment.
}

const SETUP_TOKEN_TTL_HOURS = 24;

async function main(): Promise<void> {
  const [name, email] = process.argv.slice(2);

  if (!name || !email) {
    console.error(
      'Usage: npx tsx scripts/create-admin.ts "Full Name" admin@example.com',
    );
    process.exitCode = 1;
    return;
  }

  const normalisedEmail = email.trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalisedEmail)) {
    console.error(`"${email}" does not look like an email address.`);
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set. Check .env.local.");
    process.exitCode = 1;
    return;
  }

  // Imported lazily so the missing-config errors above print cleanly first.
  const { sendEmail, isEmailConfigured } = await import("../src/lib/email/client");
  const { AdminSetupEmail } = await import("../src/lib/email/templates/admin-setup");

  if (!isEmailConfigured()) {
    console.error(
      "RESEND_API_KEY and EMAIL_FROM must be set in .env.local — the setup link is delivered by email.",
    );
    process.exitCode = 1;
    return;
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ["error"],
  });

  try {
    const existing = await db.user.findUnique({
      where: { email: normalisedEmail },
      select: { id: true, role: true },
    });

    if (existing && existing.role !== Role.ADMIN) {
      console.error(
        `${normalisedEmail} already exists as a ${existing.role}. Refusing to change the role of an existing account from a script.`,
      );
      process.exitCode = 1;
      return;
    }

    const user = existing
      ? await db.user.update({
          where: { id: existing.id },
          data: { name: name.trim() },
          select: { id: true, name: true, email: true },
        })
      : await db.user.create({
          data: {
            name: name.trim(),
            email: normalisedEmail,
            role: Role.ADMIN,
            // No password. The setup link is the only way in.
            passwordHash: null,
            // The address is proven by receiving the setup email.
            emailVerified: new Date(),
          },
          select: { id: true, name: true, email: true },
        });

    // High-entropy token. Stored as SHA-256 so the column stays unique and
    // directly lookupable; bcrypt would make lookup-by-token impossible and
    // buys nothing against a 256-bit random value.
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_HOURS * 3_600_000);

    await db.$transaction([
      // Retire any outstanding links for this admin.
      db.setupToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      db.setupToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const setupUrl = `${appUrl}/set-password/${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: "Set your Dhanvarsha admin password",
      react: AdminSetupEmail({
        name: user.name,
        setupUrl,
        expiryHours: SETUP_TOKEN_TTL_HOURS,
      }),
    });

    console.log(
      `\nAdmin ${existing ? "updated" : "created"}: ${user.name} <${user.email}>`,
    );
    console.log(
      `A one-time setup link was emailed to them. It expires in ${SETUP_TOKEN_TTL_HOURS} hours.\n`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("\nFailed to create admin:");
  console.error(error);
  process.exitCode = 1;
});
