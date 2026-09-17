"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CartItemView } from "@/lib/cart";
import { formatInr } from "@/lib/format";
import { useCartStore } from "@/store/cart-store";

export function CartLineItem({
  item,
  onNavigate,
}: {
  item: CartItemView;
  onNavigate?: () => void;
}) {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const remove = useCartStore((state) => state.remove);
  const isPending = useCartStore((state) => state.pending[item.variantId] ?? false);

  // The server caps quantity at available stock; mirror that in the control so
  // the shopper is not offered a number that will be refused.
  const atStockLimit = item.quantity >= item.stockQty;

  return (
    <li className="flex gap-3 py-4">
      <Link
        href={`/products/${item.product.slug}`}
        onClick={onNavigate}
        className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-md bg-muted"
      >
        {item.product.image ? (
          <Image
            src={item.product.image.url}
            alt={item.product.image.altText}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/products/${item.product.slug}`}
          onClick={onNavigate}
          className="line-clamp-2 text-sm font-medium hover:underline"
        >
          {item.product.name}
        </Link>

        {item.size ? (
          <p className="text-xs text-muted-foreground">Size {item.size}</p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {formatInr(item.unitPrice)} each
        </p>

        {item.stockQty <= 3 && item.stockQty > 0 ? (
          <p className="text-xs font-medium text-amber-700 dark:text-amber-500">
            Only {item.stockQty} left
          </p>
        ) : null}

        <div className="mt-1 flex items-center gap-2">
          <div className="flex items-center rounded-md border">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-r-none"
              disabled={isPending}
              aria-label={`Decrease quantity of ${item.product.name}`}
              onClick={() => void setQuantity(item.variantId, item.quantity - 1)}
            >
              <Minus className="size-3.5" aria-hidden />
            </Button>

            <span
              className="min-w-8 text-center text-sm tabular-nums"
              aria-live="polite"
              aria-label={`Quantity: ${item.quantity}`}
            >
              {item.quantity}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-l-none"
              disabled={isPending || atStockLimit}
              aria-label={`Increase quantity of ${item.product.name}`}
              onClick={() => void setQuantity(item.variantId, item.quantity + 1)}
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            disabled={isPending}
            aria-label={`Remove ${item.product.name} from bag`}
            onClick={() => void remove(item.variantId)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <p className="shrink-0 text-sm font-medium tabular-nums">
        {formatInr(item.lineTotal)}
      </p>
    </li>
  );
}
