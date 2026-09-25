import { Skeleton } from "@/components/ui/skeleton";

/**
 * Detail-page skeleton. Without this the catalog's loading.tsx would inherit
 * down into this route and flash a product grid while a single product loads.
 */
export default function ProductDetailLoading() {
  return (
    <div className="shell py-8">
      <Skeleton className="mb-6 h-4 w-40" />

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-md" />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
