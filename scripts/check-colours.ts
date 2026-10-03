import path from "node:path";

/**
 * Checks that linked colours behave.
 *
 * Colours are separate products joined into a design group, so a shopper looking
 * at one is offered the others. The thing that can go wrong is not obvious from
 * the screen: a colour can end up seeing SOME of its set but not all of it, and
 * the page still looks right. That is what this checks.
 *
 * It creates its own throwaway products, asserts, and removes them again. It
 * touches nothing that was already there, and exits non-zero if anything fails.
 *
 *   npx tsx scripts/check-colours.ts
 *
 * It can also leave three linked colours in the shop to click through, which is
 * the only way to judge how it LOOKS:
 *
 *   npx tsx scripts/check-colours.ts --demo          (adds them)
 *   npx tsx scripts/check-colours.ts --remove-demo   (takes them away)
 */

/** The demo colours are found by their web address, which is their only name. */
const DEMO_SLUG_PREFIX = "demo-colour-saree-";

/** The check's own throwaway colours, likewise. */
const CHECK_SLUG_PREFIX = "chk-colour-";

async function main() {
  if (!process.env.DATABASE_URL) {
    process.loadEnvFile(path.join(import.meta.dirname, "..", ".env.local"));
  }

  // Imported after the environment is loaded: these modules build a database
  // client the moment they are imported.
  const { db } = await import("../src/lib/db");
  const { createProduct, updateProduct } = await import("../src/lib/queries/admin-products");
  const { publicProductSelect, toProductView } = await import("../src/lib/queries/product");
  type ProductFormInput = import("../src/lib/validations/product").ProductFormInput;

  const foundAdmin = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (!foundAdmin) {
    throw new Error("No admin user. Run scripts/create-admin.ts first.");
  }

  // Held in a plain const so the closures below keep the narrowing.
  const admin = foundAdmin;

  const category = await db.category.findFirst({
    orderBy: { position: "asc" },
    select: { id: true },
  });

  if (!category) throw new Error("No categories. Seed the database first.");

  let failures = 0;

  function ok(label: string, pass: boolean, extra = "") {
    console.log(`${pass ? "PASS" : "FAIL"}  ${label}${extra ? `  — ${extra}` : ""}`);
    if (!pass) failures += 1;
  }

  function form(
    over: Partial<ProductFormInput> & { slug: string; name: string },
  ): ProductFormInput {
    return {
      description: "Created by scripts/check-colours.ts. Safe to delete.",
      categoryId: category!.id,
      mrp: "5000.00",
      sellingPrice: "4000.00",
      costPrice: "2000.00",
      supplierName: "",
      purchaseNote: "",
      isActive: true,
      careInstructions: "",
      silkMarkNumber: "",
      colourName: "",
      sameDesignAsProductId: null,
      images: [],
      stockQty: 3,
      attributeValueIds: [],
      ...over,
    };
  }

  /** What a shopper is offered on this product's page, by colour name. */
  async function coloursOn(id: string): Promise<string[]> {
    const raw = await db.product.findUniqueOrThrow({
      where: { id },
      select: publicProductSelect,
    });

    return toProductView(raw)
      .colours.map((colour) => colour.colourName ?? colour.name)
      .sort();
  }

  /* ------------------------------------------------------------------ */
  /* The demo set                                                        */
  /* ------------------------------------------------------------------ */

  async function removeDemo() {
    const existing = await db.product.findMany({
      where: { slug: { startsWith: DEMO_SLUG_PREFIX } },
      select: { id: true, groupId: true },
    });

    // Deleted straight from the database rather than through deleteProduct,
    // which reaches for the ImageKit SDK. These carry no uploaded files, so
    // there is nothing to clean up there.
    await db.product.deleteMany({ where: { id: { in: existing.map((p) => p.id) } } });
    await db.productGroup.deleteMany({ where: { products: { none: {} } } });

    return existing.length;
  }

  if (process.argv.includes("--remove-demo")) {
    const count = await removeDemo();
    console.log(
      count === 0
        ? "No demo colours were there."
        : `Removed ${count} demo ${count === 1 ? "colour" : "colours"}.`,
    );
    await db.$disconnect();
    return;
  }

  if (process.argv.includes("--demo")) {
    await removeDemo();

    // Three stock levels on purpose: plenty, nearly gone, and sold out. That is
    // every state the colour row can show, on one design.
    const pieces = [
      { colour: "Ruby", stockQty: 4 },
      { colour: "Emerald", stockQty: 1 },
      { colour: "Indigo", stockQty: 0 },
    ];

    let linkTo: string | null = null;

    for (const piece of pieces) {
      const slug = `${DEMO_SLUG_PREFIX}${piece.colour.toLowerCase()}`;

      const id: string = await createProduct(
        form({
          slug,
          name: `Demo Colour Saree in ${piece.colour}`,
          colourName: piece.colour,
          stockQty: piece.stockQty,
          sameDesignAsProductId: linkTo,
          images: [
            {
              url: `https://picsum.photos/seed/${slug}/900/1350`,
              publicId: `demo-colour/${slug}`,
              altText: `Demo Colour Saree in ${piece.colour}`,
            },
          ],
        }),
        admin.id,
      );

      // Each new colour is linked to the previous one, which is how the owner
      // would do it: one link at a time, in whatever order.
      linkTo = id;
      console.log(`added ${piece.colour} — ${piece.stockQty} in stock`);
    }

    console.log("\nOpen any of these in the shop:");
    console.log("  /products/demo-colour-saree-ruby");
    console.log("  /products/demo-colour-saree-emerald");
    console.log("  /products/demo-colour-saree-indigo");
    console.log("\nEach one should offer the other two, and Indigo should read as sold out.");
    console.log("Remove them with:  npx tsx scripts/check-colours.ts --remove-demo");

    await db.$disconnect();
    return;
  }

  /* ------------------------------------------------------------------ */
  /* The checks                                                          */
  /* ------------------------------------------------------------------ */

  const made: string[] = [];

  async function make(
    colour: string,
    linkedTo: string | null,
    over: Partial<ProductFormInput> = {},
  ): Promise<string> {
    const id = await createProduct(
      form({
        slug: `${CHECK_SLUG_PREFIX}${colour.toLowerCase()}`,
        name: `Colour Check ${colour}`,
        colourName: colour,
        sameDesignAsProductId: linkedTo,
        ...over,
      }),
      admin.id,
    );

    made.push(id);
    return id;
  }

  // Counted before and after, so the run can prove it tidied up after itself
  // without assuming it is the only thing in the shop with colours.
  let setsBefore = 0;

  try {
    // Nothing left over from a run that was interrupted.
    await db.product.deleteMany({ where: { slug: { startsWith: CHECK_SLUG_PREFIX } } });
    await db.productGroup.deleteMany({ where: { products: { none: {} } } });

    setsBefore = await db.productGroup.count();

    console.log("A design in four colours, linked one at a time\n");

    const amber = await make("Amber", null);
    const blue = await make("Blue", amber);
    const cream = await make("Cream", blue);
    const dune = await make("Dune", cream);

    for (const [name, id] of [
      ["Amber", amber],
      ["Blue", blue],
      ["Cream", cream],
      ["Dune", dune],
    ] as const) {
      const seen = await coloursOn(id);
      ok(`${name} is offered the other three`, seen.length === 3, seen.join(", "));
    }

    console.log("\nA second design, then one link between the two\n");

    const ember = await make("Ember", null);
    const fern = await make("Fern", ember);

    ok("the second design starts on its own", (await coloursOn(ember)).length === 1);
    ok("and the first is untouched", (await coloursOn(amber)).length === 3);

    // One link between a colour in each design. Everything on both sides must
    // end up seeing everything else: a colour that ends up seeing only part of
    // its set looks perfectly fine on screen, which is why this is checked.
    await updateProduct(
      blue,
      form({
        slug: "chk-colour-blue",
        name: "Colour Check Blue",
        colourName: "Blue",
        sameDesignAsProductId: fern,
      }),
      admin.id,
    );

    for (const [name, id] of [
      ["Amber", amber],
      ["Blue", blue],
      ["Cream", cream],
      ["Dune", dune],
      ["Ember", ember],
      ["Fern", fern],
    ] as const) {
      const seen = await coloursOn(id);
      ok(`${name} is offered the other five`, seen.length === 5, seen.join(", "));
    }

    // Asked about THESE six, not about how many sets the shop has. A global
    // count would fail the moment anything else in the shop has colours, which
    // is a test crying wolf rather than finding anything.
    const sets = await db.product.findMany({
      where: { id: { in: [amber, blue, cream, dune, ember, fern] } },
      select: { groupId: true },
    });

    ok(
      "they are one design, not two",
      new Set(sets.map((row) => row.groupId)).size === 1 && sets[0].groupId !== null,
    );

    console.log("\nWhat a shopper is not offered\n");

    // Entered but never priced: it sits in the admin waiting for a price and no
    // customer sees it anywhere, including here.
    const unpriced = await make("Unpriced", amber, { mrp: "", sellingPrice: "" });
    ok(
      "a colour with no price yet is not offered",
      !(await coloursOn(amber)).includes("Unpriced"),
      (await coloursOn(amber)).join(", "),
    );

    const hidden = await make("Hidden", amber, { isActive: false });
    ok(
      "a colour switched off is not offered",
      !(await coloursOn(amber)).includes("Hidden"),
    );

    const soldOut = await make("SoldOut", amber, { stockQty: 0 });
    ok(
      "a sold-out colour IS still offered",
      (await coloursOn(amber)).includes("SoldOut"),
    );

    ok("no colour is offered itself", !(await coloursOn(amber)).includes("Amber"));

    console.log("\nUnlinking\n");

    await updateProduct(
      dune,
      form({
        slug: "chk-colour-dune",
        name: "Colour Check Dune",
        colourName: "Dune",
        sameDesignAsProductId: null,
      }),
      admin.id,
    );

    ok("the unlinked colour is offered nothing", (await coloursOn(dune)).length === 0);
    ok("and is no longer offered to the rest", !(await coloursOn(amber)).includes("Dune"));
    ok(
      "the rest still see each other",
      (await coloursOn(amber)).length === 5,
      (await coloursOn(amber)).join(", "),
    );

    void unpriced;
    void hidden;
    void soldOut;
  } finally {
    await db.product.deleteMany({ where: { id: { in: made } } });
    await db.productGroup.deleteMany({ where: { products: { none: {} } } });
  }

  ok(
    "nothing of this run was left behind",
    (await db.productGroup.count()) === setsBefore &&
      (await db.product.count({ where: { slug: { startsWith: CHECK_SLUG_PREFIX } } })) === 0,
  );

  console.log(
    failures === 0
      ? "\nColours behave. Nothing was left behind."
      : `\n${failures} ${failures === 1 ? "check" : "checks"} failed.`,
  );

  if (failures > 0) process.exitCode = 1;

  await db.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
