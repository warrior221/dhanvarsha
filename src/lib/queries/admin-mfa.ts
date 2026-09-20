import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { OtpCodeEmail } from "@/lib/email/templates/otp-code";
import { AppError } from "@/lib/errors";
import {
  CHALLENGE_MINUTES,
  type MfaProgress,
  type MfaStep,
  RECOVERY_CODE_COUNT,
  isComplete,
  nextStep,
} from "@/lib/mfa";
import { OTP_EXPIRY_MINUTES, sendCodeEmail } from "@/lib/otp";
import { generateTotpSecret, verifyTotp } from "@/lib/totp";
import { isWhatsappConfigured, sendWhatsappOtp } from "@/lib/whatsapp";

/**
 * The admin second-factor ladder.
 *
 * Every caller must already have established WHO the admin is. These
 * functions decide only whether that admin has proved it a second, third and
 * fourth time on this particular session.
 */

const BCRYPT_COST = 12;
/** Step codes are short-lived and single-use; they are never logged. */
const STEP_CODE_MINUTES = OTP_EXPIRY_MINUTES;

/* ------------------------------------------------------------------ */
/* Enrolment                                                           */
/* ------------------------------------------------------------------ */

export type MfaSetup = {
  totpConfirmed: boolean;
  whatsappPhone: string | null;
  whatsappVerified: boolean;
  whatsappAvailable: boolean;
  recoveryCodesRemaining: number;
  /** True once the admin must pass the ladder to reach /admin. */
  active: boolean;
};

export async function getMfaSetup(userId: string): Promise<MfaSetup> {
  const row = await db.adminMfa.findUnique({
    where: { userId },
    select: {
      totpConfirmedAt: true,
      whatsappPhone: true,
      whatsappVerifiedAt: true,
      recoveryCodes: { where: { usedAt: null }, select: { id: true } },
    },
  });

  return {
    totpConfirmed: Boolean(row?.totpConfirmedAt),
    whatsappPhone: row?.whatsappPhone ?? null,
    whatsappVerified: Boolean(row?.whatsappVerifiedAt),
    whatsappAvailable: isWhatsappConfigured(),
    recoveryCodesRemaining: row?.recoveryCodes.length ?? 0,
    // The authenticator app is the anchor: without it there is no second
    // factor worth enforcing, so the gate only switches on once it is
    // confirmed. This is also what stops an admin locking themselves out by
    // half-finishing setup.
    active: Boolean(row?.totpConfirmedAt),
  };
}

/**
 * Starts authenticator enrolment and returns the secret to show as a QR code.
 *
 * Calling it again before confirming issues a NEW secret, so an abandoned
 * half-setup cannot be resumed by someone else who saw the first screen.
 */
export async function beginTotpEnrolment(userId: string): Promise<string> {
  const existing = await db.adminMfa.findUnique({
    where: { userId },
    select: { totpConfirmedAt: true },
  });

  if (existing?.totpConfirmedAt) {
    throw new AppError(
      "TOTP_ALREADY_SET",
      "An authenticator app is already set up. Remove it first if you are changing phones.",
      409,
    );
  }

  const secret = generateTotpSecret();

  await db.adminMfa.upsert({
    where: { userId },
    create: { userId, totpSecret: secret },
    update: { totpSecret: secret, totpConfirmedAt: null },
  });

  return secret;
}

/**
 * Confirms the app is working, and issues the recovery codes.
 *
 * The codes are returned ONCE, in plain text, and only their hashes are
 * stored. A lost phone with no recovery code means a shop owner locked out of
 * their own admin permanently, so this step is not optional.
 */
export async function confirmTotpEnrolment(
  userId: string,
  code: string,
): Promise<string[]> {
  const row = await db.adminMfa.findUnique({
    where: { userId },
    select: { id: true, totpSecret: true, totpConfirmedAt: true },
  });

  if (!row?.totpSecret) {
    throw new AppError("TOTP_NOT_STARTED", "Scan the QR code first.", 400);
  }

  if (row.totpConfirmedAt) {
    throw new AppError("TOTP_ALREADY_SET", "That app is already confirmed.", 409);
  }

  if (!verifyTotp(row.totpSecret, code)) {
    throw new AppError(
      "TOTP_WRONG",
      "That code did not match. Check your phone's clock is set automatically, then try the next code.",
      400,
    );
  }

  const plain = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  const hashed = await Promise.all(
    plain.map((value) => bcrypt.hash(normaliseRecovery(value), BCRYPT_COST)),
  );

  await db.$transaction([
    db.adminMfa.update({
      where: { userId },
      data: { totpConfirmedAt: new Date() },
    }),
    db.adminRecoveryCode.deleteMany({ where: { mfaId: row.id } }),
    db.adminRecoveryCode.createMany({
      data: hashed.map((codeHash) => ({ mfaId: row.id, codeHash })),
    }),
  ]);

  return plain;
}

/** Turns the whole ladder off. Requires a live code, so a hijacked session cannot. */
export async function disableMfa(userId: string, code: string): Promise<void> {
  const row = await db.adminMfa.findUnique({
    where: { userId },
    select: { totpSecret: true, totpConfirmedAt: true },
  });

  if (!row?.totpSecret || !row.totpConfirmedAt) {
    throw new AppError("TOTP_NOT_SET", "There is nothing to turn off.", 400);
  }

  if (!verifyTotp(row.totpSecret, code)) {
    throw new AppError("TOTP_WRONG", "That code did not match.", 400);
  }

  await db.adminMfa.delete({ where: { userId } });
  // Any session that passed the old ladder must prove itself again.
  await db.session.updateMany({ where: { userId }, data: { mfaVerifiedAt: null } });
}

export async function setWhatsappNumber(userId: string, phone: string): Promise<void> {
  await db.adminMfa.upsert({
    where: { userId },
    create: { userId, whatsappPhone: phone, whatsappVerifiedAt: new Date() },
    update: { whatsappPhone: phone, whatsappVerifiedAt: new Date() },
  });
}

/* ------------------------------------------------------------------ */
/* The challenge                                                       */
/* ------------------------------------------------------------------ */

export type ChallengeState = {
  progress: MfaProgress;
  next: MfaStep | null;
  complete: boolean;
  /** Where the current step's code went, for the screen to say. */
  sentTo: string | null;
  whatsappSkipReason: string | null;
};

/** Which steps cannot run for this admin, and why. */
async function skippedSteps(userId: string): Promise<MfaStep[]> {
  const row = await db.adminMfa.findUnique({
    where: { userId },
    select: { whatsappPhone: true, whatsappVerifiedAt: true },
  });

  const skipped: MfaStep[] = [];

  if (!isWhatsappConfigured() || !row?.whatsappPhone || !row.whatsappVerifiedAt) {
    skipped.push("WHATSAPP");
  }

  return skipped;
}

export async function getChallengeState(
  sessionId: string,
  userId: string,
): Promise<ChallengeState> {
  const challenge = await ensureChallenge(sessionId);
  const skipped = await skippedSteps(userId);

  const progress: MfaProgress = {
    emailDone: Boolean(challenge.emailAt),
    whatsappDone: Boolean(challenge.whatsappAt),
    totpDone: Boolean(challenge.totpAt),
    skipped,
  };

  return {
    progress,
    next: nextStep(progress),
    complete: isComplete(progress),
    sentTo: null,
    whatsappSkipReason: skipped.includes("WHATSAPP")
      ? await whatsappSkipExplanation(userId)
      : null,
  };
}

async function whatsappSkipExplanation(userId: string): Promise<string> {
  if (!isWhatsappConfigured()) {
    return "WhatsApp is not connected yet — it needs a verified Meta Business account and an approved template. This step is skipped.";
  }

  const row = await db.adminMfa.findUnique({
    where: { userId },
    select: { whatsappPhone: true },
  });

  return row?.whatsappPhone
    ? "This WhatsApp number is not confirmed yet, so the step is skipped."
    : "No WhatsApp number saved, so the step is skipped. Add one in Security.";
}

async function ensureChallenge(sessionId: string) {
  const now = new Date();
  const existing = await db.adminMfaChallenge.findUnique({ where: { sessionId } });

  if (existing && existing.expiresAt > now) return existing;

  // Expired or absent: start a clean ladder. Half-finished progress must not
  // survive, or a walk-away would leave two steps already passed.
  return db.adminMfaChallenge.upsert({
    where: { sessionId },
    create: {
      sessionId,
      expiresAt: new Date(now.getTime() + CHALLENGE_MINUTES * 60_000),
    },
    update: {
      emailAt: null,
      whatsappAt: null,
      totpAt: null,
      expiresAt: new Date(now.getTime() + CHALLENGE_MINUTES * 60_000),
    },
  });
}

/**
 * Sends the code for the step the admin is currently on.
 *
 * TOTP needs no send — the app already has it — so asking for one is refused
 * rather than silently doing nothing.
 */
export async function sendStepCode(
  sessionId: string,
  userId: string,
): Promise<{ step: MfaStep; sentTo: string }> {
  const state = await getChallengeState(sessionId, userId);

  if (!state.next) {
    throw new AppError("MFA_COMPLETE", "All steps are already done.", 400);
  }

  if (state.next === "TOTP") {
    throw new AppError(
      "NO_CODE_TO_SEND",
      "Open your authenticator app for this code — there is nothing to send.",
      400,
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const mfa = await db.adminMfa.findUnique({
    where: { userId },
    select: { whatsappPhone: true },
  });

  const code = sixDigits();
  const codeHash = await bcrypt.hash(code, BCRYPT_COST);
  const expiresAt = new Date(Date.now() + STEP_CODE_MINUTES * 60_000);

  // One live code per step at a time.
  await db.otpCode.updateMany({
    where: { identifier: stepIdentifier(sessionId, state.next), consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await db.otpCode.create({
    data: {
      identifier: stepIdentifier(sessionId, state.next),
      channel: state.next === "EMAIL" ? "EMAIL" : "WHATSAPP",
      purpose: "ADMIN_MFA",
      codeHash,
      expiresAt,
    },
  });

  if (state.next === "EMAIL") {
    if (!user?.email) {
      throw new AppError("NO_EMAIL", "This account has no email address.", 400);
    }

    // Through sendCodeEmail, so the development fallback applies here too —
    // otherwise an unverified mail domain locks the owner out of their own
    // admin, which is worse than the risk the ladder guards against.
    await sendCodeEmail({
      to: user.email,
      subject: `${code} is your Dhanvarsha admin sign-in code`,
      code,
      react: OtpCodeEmail({
        code,
        expiryMinutes: STEP_CODE_MINUTES,
        purpose: "EMAIL_VERIFICATION",
      }),
    });

    return { step: "EMAIL", sentTo: maskEmail(user.email) };
  }

  if (!mfa?.whatsappPhone) {
    throw new AppError("NO_WHATSAPP", "No WhatsApp number is saved.", 400);
  }

  await sendWhatsappOtp({ phone: mfa.whatsappPhone, code });

  return { step: "WHATSAPP", sentTo: maskPhone(mfa.whatsappPhone) };
}

/**
 * Checks the code for the current step and records it as passed.
 *
 * Marks the SESSION as verified once the ladder finishes, which is what
 * requireAdmin() reads. Nothing is trusted from the browser about which step
 * it thinks it is on.
 */
export async function verifyStep(
  sessionId: string,
  userId: string,
  code: string,
): Promise<ChallengeState> {
  const state = await getChallengeState(sessionId, userId);

  if (!state.next) return state;

  const step = state.next;

  if (step === "TOTP") {
    const row = await db.adminMfa.findUnique({
      where: { userId },
      select: { totpSecret: true, totpConfirmedAt: true },
    });

    if (!row?.totpSecret || !row.totpConfirmedAt) {
      throw new AppError("TOTP_NOT_SET", "No authenticator app is set up.", 400);
    }

    if (!verifyTotp(row.totpSecret, code)) {
      throw new AppError("STEP_WRONG", "That code did not match. Try the next one.", 400);
    }
  } else {
    await consumeStepCode(sessionId, step, code);
  }

  const field =
    step === "EMAIL" ? "emailAt" : step === "WHATSAPP" ? "whatsappAt" : "totpAt";

  await db.adminMfaChallenge.update({
    where: { sessionId },
    data: { [field]: new Date() },
  });

  const after = await getChallengeState(sessionId, userId);

  if (after.complete) {
    await db.$transaction([
      db.session.update({
        where: { id: sessionId },
        data: { mfaVerifiedAt: new Date() },
      }),
      db.adminMfaChallenge.deleteMany({ where: { sessionId } }),
    ]);
  }

  return after;
}

/** Burns a posted code, with the same attempt limits as any other OTP. */
async function consumeStepCode(
  sessionId: string,
  step: MfaStep,
  code: string,
): Promise<void> {
  const identifier = stepIdentifier(sessionId, step);
  const now = new Date();

  const record = await db.otpCode.findFirst({
    where: { identifier, purpose: "ADMIN_MFA", consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });

  const wrong = new AppError(
    "STEP_WRONG",
    "That code is wrong or has expired. Send a new one.",
    400,
  );

  if (!record) throw wrong;

  if (record.attempts >= 5) {
    await db.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: now },
    });
    throw new AppError(
      "TOO_MANY_ATTEMPTS",
      "Too many wrong tries. Send a new code.",
      429,
    );
  }

  if (!(await bcrypt.compare(code.trim(), record.codeHash))) {
    await db.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw wrong;
  }

  await db.otpCode.update({ where: { id: record.id }, data: { consumedAt: now } });
}

/**
 * The way back in when the phone is gone.
 *
 * One recovery code clears the WHOLE ladder — it is the last resort, so it
 * cannot itself be gated behind the steps it replaces. Each is single use.
 */
export async function useRecoveryCode(
  sessionId: string,
  userId: string,
  code: string,
): Promise<void> {
  const row = await db.adminMfa.findUnique({
    where: { userId },
    select: { id: true, recoveryCodes: { where: { usedAt: null } } },
  });

  const wrong = new AppError(
    "RECOVERY_WRONG",
    "That recovery code is not valid.",
    400,
  );

  if (!row || row.recoveryCodes.length === 0) throw wrong;

  const candidate = normaliseRecovery(code);
  let matched: string | null = null;

  for (const stored of row.recoveryCodes) {
    if (await bcrypt.compare(candidate, stored.codeHash)) {
      matched = stored.id;
      break;
    }
  }

  if (!matched) throw wrong;

  await db.$transaction([
    db.adminRecoveryCode.update({
      where: { id: matched },
      data: { usedAt: new Date() },
    }),
    db.session.update({
      where: { id: sessionId },
      data: { mfaVerifiedAt: new Date() },
    }),
    db.adminMfaChallenge.deleteMany({ where: { sessionId } }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function stepIdentifier(sessionId: string, step: MfaStep): string {
  return `mfa:${sessionId}:${step}`;
}

function sixDigits(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Readable, unambiguous: no O/0 or I/1 to misread off a printout. */
function generateRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";

  for (let i = 0; i < 10; i += 1) {
    out += alphabet[randomInt(0, alphabet.length)];
    if (i === 4) out += "-";
  }

  return out;
}

function normaliseRecovery(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "your email";

  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

function maskPhone(phone: string): string {
  return `•••••${phone.slice(-5)}`;
}
