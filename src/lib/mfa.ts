/**
 * The admin sign-in ladder: email, then WhatsApp, then authenticator app.
 *
 * PURE MODULE — no database, no node:crypto — so the verify screen and the
 * server decide "which step is next" with exactly the same function.
 */

export const MFA_STEPS = ["EMAIL", "WHATSAPP", "TOTP"] as const;

export type MfaStep = (typeof MFA_STEPS)[number];

export const STEP_TITLE: Record<MfaStep, string> = {
  EMAIL: "Code sent to your email",
  WHATSAPP: "Code sent on WhatsApp",
  TOTP: "Code from your authenticator app",
};

export const STEP_SHORT: Record<MfaStep, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  TOTP: "Authenticator",
};

/** How long an admin has to finish all three steps before starting again. */
export const CHALLENGE_MINUTES = 15;

export type MfaProgress = {
  emailDone: boolean;
  whatsappDone: boolean;
  totpDone: boolean;
  /** Steps that cannot run — WhatsApp before Meta approval, for instance. */
  skipped: MfaStep[];
};

/**
 * The next step to present, or null when the ladder is complete.
 *
 * Order is fixed. A skipped step counts as passed so the ladder can still
 * finish, which is what keeps the shop usable while WhatsApp is pending —
 * and why the screen says plainly which steps actually ran.
 */
export function nextStep(progress: MfaProgress): MfaStep | null {
  const done: Record<MfaStep, boolean> = {
    EMAIL: progress.emailDone,
    WHATSAPP: progress.whatsappDone,
    TOTP: progress.totpDone,
  };

  for (const step of MFA_STEPS) {
    if (done[step]) continue;
    if (progress.skipped.includes(step)) continue;

    return step;
  }

  return null;
}

/** Every step either passed or deliberately skipped. */
export function isComplete(progress: MfaProgress): boolean {
  return nextStep(progress) === null;
}

/** 1-based position, for "Step 2 of 3". */
export function stepNumber(step: MfaStep): number {
  return MFA_STEPS.indexOf(step) + 1;
}

export const RECOVERY_CODE_COUNT = 10;
