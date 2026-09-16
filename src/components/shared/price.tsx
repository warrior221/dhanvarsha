import { cn } from "@/lib/utils";
import { discountPercent, formatInr } from "@/lib/format";

/**
 * Selling price, with MRP struck through and the saving shown as a percentage.
 * The discount is computed here every time — it is never stored, so it cannot
 * drift out of step with the prices (spec section 4).
 *
 * Amounts arrive as decimal strings, never as JS numbers.
 */
export function Price({
  mrp,
  sellingPrice,
  size = "md",
  className,
}: {
  mrp: string;
  sellingPrice: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const discount = discountPercent(mrp, sellingPrice);

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span
        className={cn(
          "font-semibold text-foreground",
          size === "lg" ? "text-2xl" : "text-base",
        )}
      >
        {formatInr(sellingPrice)}
      </span>

      {discount !== null ? (
        <>
          <span
            className={cn(
              "text-muted-foreground line-through",
              size === "lg" ? "text-base" : "text-sm",
            )}
          >
            <span className="sr-only">Was </span>
            {formatInr(mrp)}
          </span>
          <span
            className={cn(
              "font-medium text-emerald-700 dark:text-emerald-500",
              size === "lg" ? "text-base" : "text-sm",
            )}
          >
            {discount}% off
          </span>
        </>
      ) : null}
    </div>
  );
}
