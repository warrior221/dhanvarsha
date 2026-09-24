import { OrderStatus, type Prisma } from "@prisma/client";
import { paiseToDecimal } from "@/lib/cart";
import { db } from "@/lib/db";
import { formatInr, toPaise } from "@/lib/format";
import { type DateRange, dateKeysInRange, istDateKey } from "@/lib/reports";

/**
 * Sales reporting. ADMIN ONLY — every figure here is derived from cost price.
 *
 * CANCELLED and RETURNED orders are excluded throughout. Money that came back
 * is not revenue, and counting it would make every number flattering and
 * useless for deciding what to reorder.
 *
 * All arithmetic is in integer paise (spec 1.4). Revenue is taken from the
 * order TOTAL, which is what the customer actually paid; profit is computed
 * per line, because delivery charges are not margin.
 */

export type SalesSummary = {
  orders: number;
  units: number;
  revenueFormatted: string;
  profitFormatted: string;
  averageOrderFormatted: string;
  /** Profit as a whole percentage of revenue. Null with no sales. */
  marginPercent: number | null;
};

export type BestSeller = {
  productName: string;
  productImage: string;
  units: number;
  revenueFormatted: string;
  profitFormatted: string;
};

export type DailyPoint = {
  dateKey: string;
  revenuePaise: number;
  revenueFormatted: string;
  orders: number;
};

export type SalesReport = {
  summary: SalesSummary;
  bestSellers: BestSeller[];
  daily: DailyPoint[];
  /** The busiest day in the range, for the chart scale. */
  peakPaise: number;
};

/** Orders that count as real sales. */
function countableOrders(range: DateRange): Prisma.OrderWhereInput {
  return {
    createdAt: { gte: range.from, lt: range.to },
    status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
  };
}

export async function getSalesReport(range: DateRange): Promise<SalesReport> {
  const orders = await db.order.findMany({
    where: countableOrders(range),
    select: {
      total: true,
      createdAt: true,
      items: {
        select: {
          productName: true,
          productImage: true,
          price: true,
          costPrice: true,
          quantity: true,
        },
      },
    },
  });

  let revenuePaise = 0;
  let profitPaise = 0;
  let units = 0;

  /** Keyed by product name, which is the snapshot stored on the order. */
  const byProduct = new Map<
    string,
    { image: string; units: number; revenue: number; profit: number }
  >();

  const byDay = new Map<string, { revenue: number; orders: number }>();

  for (const order of orders) {
    const orderTotal = toPaise(order.total.toString());
    revenuePaise += orderTotal;

    const dayKey = istDateKey(order.createdAt);
    const day = byDay.get(dayKey) ?? { revenue: 0, orders: 0 };
    day.revenue += orderTotal;
    day.orders += 1;
    byDay.set(dayKey, day);

    for (const item of order.items) {
      const unit = toPaise(item.price.toString());
      const cost = toPaise(item.costPrice.toString());
      const lineRevenue = unit * item.quantity;
      const lineProfit = (unit - cost) * item.quantity;

      units += item.quantity;
      profitPaise += lineProfit;

      const entry = byProduct.get(item.productName) ?? {
        image: item.productImage,
        units: 0,
        revenue: 0,
        profit: 0,
      };

      entry.units += item.quantity;
      entry.revenue += lineRevenue;
      entry.profit += lineProfit;
      byProduct.set(item.productName, entry);
    }
  }

  const bestSellers = [...byProduct.entries()]
    .sort((a, b) => b[1].units - a[1].units || b[1].revenue - a[1].revenue)
    .slice(0, 10)
    .map(([productName, entry]) => ({
      productName,
      productImage: entry.image,
      units: entry.units,
      revenueFormatted: formatInr(paiseToDecimal(entry.revenue)),
      profitFormatted: formatInr(paiseToDecimal(entry.profit)),
    }));

  // Every day in the range, including the ones with no sales — a gap in the
  // chart is information, and skipping empty days would hide it.
  const keys = dateKeysInRange(range);
  const daily: DailyPoint[] = (keys.length > 0 ? keys : [...byDay.keys()].sort()).map(
    (dateKey) => {
      const day = byDay.get(dateKey) ?? { revenue: 0, orders: 0 };

      return {
        dateKey,
        revenuePaise: day.revenue,
        revenueFormatted: formatInr(paiseToDecimal(day.revenue)),
        orders: day.orders,
      };
    },
  );

  return {
    summary: {
      orders: orders.length,
      units,
      revenueFormatted: formatInr(paiseToDecimal(revenuePaise)),
      profitFormatted: formatInr(paiseToDecimal(profitPaise)),
      averageOrderFormatted: formatInr(
        paiseToDecimal(orders.length > 0 ? Math.round(revenuePaise / orders.length) : 0),
      ),
      marginPercent:
        revenuePaise > 0 ? Math.round((profitPaise / revenuePaise) * 100) : null,
    },
    bestSellers,
    daily,
    peakPaise: daily.reduce((max, point) => Math.max(max, point.revenuePaise), 0),
  };
}
