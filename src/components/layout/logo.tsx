import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The shop's logo: the gold lotus beside the wordmark.
 *
 * The wordmark is live text in Cinzel, not part of the image — it stays sharp
 * at any size, can be selected and searched, and reads out as the shop's name.
 * It takes its colour from `text-primary`, which the silk bar rebinds to gold.
 *
 * Below `sm` only the lotus shows. The wordmark is 150px of a 375px bar, which
 * is enough to push the account controls off the edge — more so for an admin,
 * who carries an extra button. The link still announces the full name either
 * way, so nothing is lost but width.
 */
export function Logo({
  className,
  tone = "paper",
}: {
  className?: string;
  /**
   * `silk` for the red bar: the lotus is keyed out of its background so it
   * sits straight on the weave, with the cloth showing through the filigree.
   * `paper` for light surfaces, where that gold would wash out — there the
   * lotus keeps its own square of silk to hold the contrast.
   */
  tone?: "paper" | "silk";
}) {
  const onSilk = tone === "silk";

  return (
    <Link
      href="/"
      aria-label="Dhanvarsha Banarasi Silks — home"
      className={cn("flex shrink-0 items-center gap-2.5", className)}
    >
      <Image
        src={onSilk ? "/brand/dhanvarsha-lotus.png" : "/brand/dhanvarsha-mark.jpg"}
        alt=""
        width={onSilk ? 288 : 360}
        height={onSilk ? 237 : 296}
        priority
        className={cn(
          "h-9 w-11",
          onSilk
            ? "object-contain"
            : "rounded-md object-cover ring-1 ring-foreground/10",
        )}
      />

      <span className="hidden leading-none sm:block">
        <span className="block font-display text-base font-bold tracking-[0.2em] text-primary">
          DHANVARSHA
        </span>
        <span className="mt-1 block font-display text-[0.5rem] font-medium tracking-[0.3em] text-muted-foreground">
          BANARASI SILKS
        </span>
      </span>
    </Link>
  );
}
