"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The two ways stock arrives.
 *
 * A new design needs a name, a type, photos and fresh tags. More of something
 * the shop already has needs a quantity and what the batch cost. They are
 * different enough that one form asking for everything would put fields the
 * owner must ignore in front of the one that matters, so they are separate and
 * this only chooses between them.
 *
 * Both forms are rendered by the server as children; this switches which is on
 * screen, so neither loses what has been typed into it.
 */
export function CheckInTabs({
  newDesign,
  restock,
}: {
  newDesign: React.ReactNode;
  restock: React.ReactNode;
}) {
  const [tab, setTab] = useState<"new" | "more">("new");

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="What arrived"
        className="inline-flex gap-1 rounded-lg border bg-muted/40 p-1"
      >
        <Tab active={tab === "new"} onSelect={() => setTab("new")}>
          A new design
        </Tab>
        <Tab active={tab === "more"} onSelect={() => setTab("more")}>
          More of something I have
        </Tab>
      </div>

      <div hidden={tab !== "new"}>{newDesign}</div>
      <div hidden={tab !== "more"}>{restock}</div>
    </div>
  );
}

function Tab({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "rounded-md px-4 py-1.5 text-sm transition",
        active
          ? "bg-background font-medium shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
