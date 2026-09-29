# Dhanvarsha — Handover addendum

Written 29 September 2026, after the main handover of the same date.
**Revised the same day:** the owner clarified that the website is for
**inventory management only. It is not a billing system.** Everything that
described counter billing, GST invoices and invoice numbers has been removed.

**Reading order:** the main handover first, then this document. Everything in
the main handover still stands unless this document changes it explicitly.

**This replaces `INVENTORY_SPEC.md`.** That file was an earlier draft of parts
of this document. Delete it so there is only one source.

The main handover's working agreements apply throughout: the owner is not a
developer, the owner runs git (hand over exact commands, never run
`add`/`commit`/`push`), complete files and exact commands one block at a time,
plain language, and verify against the running system before claiming
anything.

---

## 1. What changed since the handover

After the handover, the owner decided to use the website to manage the shop's
**inventory**, and then made the limits clear: **it is not a billing system and
it does not replace counter billing.** The handwritten bill book keeps doing all
the counter billing, exactly as today. The only billing the website does is for
online orders, and for those the owner sends an informal receipt with the
parcel. In summary:

1. **Inventory.** Every piece bought from a weaver is entered into the system.
   Every piece that leaves the shop, sold online or scanned out at the counter,
   reduces stock by one. Nothing that has left is ever deleted.
2. **Stock ledger.** Every change to stock is recorded with a reason: the
   shop's permanent history of what came in and what went out.
3. **Suppliers.** Weavers and sellers become supplier records ("cards"): name,
   mobile number, and room for one photo (the owner may use an ID card, or
   something else). The photo is an ImageKit private file.
4. **Stock in.** Pick the weaver, enter each saree with cost price and
   quantity, and photograph it right then. Selling price is optional at this
   point.
5. **Barcodes.** Every piece gets a printed barcode label. Staff scan it at the
   counter to take the piece out of stock. Scanning is not billing.
6. **Staff.** A STAFF role that can only scan pieces out. Staff never see cost
   price or supplier details.
7. **Stock-take**, a monthly shelf audit by scanning, which also catches any
   piece that left without being scanned.
8. **Online receipts.** The owner sends an informal receipt with each parcel.
   Nothing new is built for it by default (§14).
9. **Cheapest safe infrastructure.** Neon free plan, ImageKit free plan,
   Render Starter hosting, and daily encrypted backups through GitHub Actions
   kept for 7 days.
10. **Gradual tagging.** The ~10,000 pieces already in the shop are tagged at
    the owner's pace. Untagged pieces are simply not in the system yet.

Earlier drafts of this addendum also included counter billing, GST tax rules,
invoice numbers, split payments, below-cost flags, credit notes, backup bills
and a staff PIN on every bill. The owner has ruled all of that out (§10). Do
not build any of it.

---

## 2. The shop, as the owner describes it

- Dhanvarsha, Varanasi. Sarees, lehengas and suits; the categories also
  include kurta pyjama, dupatta and crop top.
- About **10,000 pieces** in the shop today. The owner will tag them
  gradually, not all at once. There is no speed target.
- In-store billing is a **handwritten bill book**, and it stays that way. The
  website does not bill at the counter.
- The shop is **GST-registered**, has a CA and an accountant, and has about
  **10 staff**.
- Stock comes from **weavers and sellers** who deliver to the shop. The owner
  pays a cost price per piece. Identical pieces can arrive in quantities.
- The shop **already owns a barcode label printer**. The owner is **buying a
  barcode gun** (USB scanner). Staff use it to scan pieces out of stock at the
  counter.
- **Staff only scan pieces out.** They never see cost price or supplier
  details.
- **Online orders:** the owner sends an informal receipt with the parcel.
- One admin account, as in the main handover §8.

---

## 3. Decisions and the reasons for them

This section records *why*, so a later session doesn't undo a decision by
accident.

**This is inventory management, not billing.** The owner's words: it "would not
be a billing system, does not replace counter billing, it is just for inventory
management"; the barcodes "are only scanned by staff to checkout items in
inventory, not billing"; and "the only billing usage is for online", where the
owner sends "an informal receipt" with the parcel. This replaced an earlier
draft in which the website printed GST tax invoices at the counter. Scanning
now has one job: take one piece out of stock and record who did it and when.
The bill book stays the only counter bill.

**A piece that has left is never deleted.** Its stock goes to zero. Past orders
reference the piece (the database already refuses such deletes, handover §6),
the CA will want purchase and sales records for years, and the owner wants the
full history of every piece: who supplied it, what it cost, when it left and,
for online sales, who bought it and for how much. Customers stop seeing pieces
that are gone; the records stay.

**Every stock change goes through a ledger.** A `stockQty` number alone can't
answer "where did this saree go?". The ledger is the shop's permanent
in-and-out history. The owner understands it as a bank passbook.

**Scanning happens at the moment the piece leaves.** Billing (the bill book) and
stock (the scan) are separate steps done by hand. The risk is a piece that is
sold but not scanned: the website still shows it in stock and may sell it a
second time. So staff scan at the same moment they write the bill, the monthly
stock-take catches misses, and an oversold online order shows up when the owner
packs the parcel.

**Suppliers are records, not typed names.** Free text turns "Ramesh Weavers",
"Ramesh weavers" and "Ramesh" into three suppliers in any report, and has
nowhere to keep a phone number.

**The supplier photo is one optional photo, not a specific document.** The
owner said the photo "might not be Aadhaar at all — just room for one pic". So
the system makes no assumption about what the photo shows, and nothing is
verified, read or extracted from it. Because it may be an identity document, it
is still treated as sensitive by default (next paragraph).

**The supplier photo is an ImageKit private file.** The owner asked why a
photo like this couldn't simply go on ImageKit and be hidden from customers.
The answer given: a normal ImageKit file opens for anyone who has its link, and
not showing it on the website doesn't make it private. ImageKit's private mode,
with signed links that expire, does. An earlier draft stored the photo
encrypted in the database instead; that was replaced because the owner wants
the cheapest setup and the free database is only 0.5 GB. Both designs are
acceptable. Don't switch back without a reason.

**If the photo is an Aadhaar card, the first eight digits should be covered.**
In December 2025 UIDAI announced that private entities would be stopped from
collecting and storing Aadhaar photocopies, and its newer regulations require
registered entities that keep copies to mask the first eight digits. Since the
photo may or may not be an Aadhaar, the upload screen shows this as a reminder
and does not force a tick. CA question 4 asks whether any ID needs keeping at
all.

**Selling price is optional at intake.** That is the owner's own flow: the
weaver delivers, and the owner records cost, quantity and a photo. The price is
set later. A piece can't be listed online without one. Nothing at the counter
needs a price, because the counter isn't billing.

**GST handling on the website stays as it is.** The single GST rate in
`StoreSetting` (currently 0%, a go-live blocker in the main handover) is left
alone. Earlier in the conversation the owner was told that sarees are 0% GST
and that garments are 5%/12% around ₹1,000. Both were wrong and were
corrected: sarees are 5%, and readymade apparel has been 5% up to ₹2,500 per
piece and 18% above since 22 September 2025 (to be confirmed by the CA). One
rate cannot represent that. Whether online orders need per-category rates, and
whether an informal receipt is enough, are CA questions 1 and 2 (§19). Nothing
is built until they are answered. First check how the online checkout uses the
setting today and tell the owner.

**Infrastructure is the cheapest safe option.** The owner asked for the lowest
cost. Everything starts on free plans except hosting, because Vercel's free
plan forbids commercial use. Each service is upgraded only when its own usage
calls for it.

**Backups are kept 7 days.** Backups exist for accidents ("someone deleted 50
products yesterday"), not for record-keeping. The permanent records live in
the database itself. A backup older than a week is rarely useful, because
restoring it would lose that week's real orders and scans.

---

## 3a. Decisions taken after this document was written

Recorded 29 September 2026, from the owner directly. These override the
sketches above where they conflict.

**The main handover is gone and is not coming back.** The owner had a problem
with it and deleted it. Do not restore it. This addendum is the only handover
document; anything it relies on from the old one has to be re-established here
as it comes up.

**Restocking an existing piece is rare.** When new stock arrives the owner will
usually create a NEW product with its own id, not add to an existing one. The
restock path must still exist, but it is the uncommon case and should not
drive the design.

**Restock takes a quantity and a freely typed cost.** When the owner does
restock, they want to change the quantity and enter whatever cost that batch
came in at — not be held to the previous cost. This replaces the weighted-
average rule sketched in §9: the average was designed for mixed stock, and the
owner has said mixed stock will rarely happen. Purchases keep their own
`unitCost` per line either way, so the history is intact regardless. Settle the
per-variant vs per-product cost question (§3b) before building it.

**A piece with no price is invisible, and pricing it is what publishes it.**
Built and verified on 29 September 2026, ahead of the phases. `Product.mrp`,
`Product.sellingPrice` and `ProductVariant.price` are all nullable now. A
product is shown to customers only when it has a selling price
(`PUBLIC_PRODUCT_WHERE` in `src/lib/queries/product.ts`, spread by the shop
listing, search, the product page, the home page, the sitemap and the
wishlist). Until then the piece sits in the database and in the admin, in
stock, marked "Not priced".

MRP is separately optional: without one the shop shows the selling price
alone, with no strikethrough and no discount badge.

The cart drops an item whose price has been cleared, and checkout refuses the
whole order rather than silently charging less for fewer pieces. The admin form
accepts a blank price, and refuses a half-priced state where the product has a
selling price but a size does not.

## 3c. Pricing and availability rules

From the owner, 29 September 2026. These are settled.

**Cost never varies by size.** So `ProductCost` stays one row per product
(`productId @unique`) and §3b's per-variant question is CLOSED — no migration.
`PurchaseItem` records the cost of the line; the product carries the current
cost.

**MRP and selling price arrive together.** A piece is either unpriced, or has
both. Entering an MRP requires either a discount or a selling price, and the
other is computed from it. A discount of 0 is meaningful: sell at the MRP, no
badge. Built: the admin pricing row is MRP / Discount % / Selling price, and
typing any two fills in the third.

**The discount is never stored.** It is a way of arriving at the selling price.
The shop recomputes it from the two prices wherever it is shown, so a stored
copy could only drift. 100% is refused — it would set the price to zero, which
the shop would publish and sell for nothing, and it is far likelier to be a
slipped keystroke than a gift.

**Clearing the MRP takes the piece off sale.** `PUBLIC_PRODUCT_WHERE` requires
`isActive`, an MRP and a selling price.

**A price CHANGE never empties a bag.** The cart reads the variant price at
read time, so a repriced piece stays in the bag at the new price. Only a piece
whose price was CLEARED drops out of the total, because there is nothing to
charge.

**Nothing ever leaves a wishlist.** A saved piece that goes off sale stays
saved and is shown as "Not available", with the button disabled. Someone saved
it deliberately; silently emptying their list is worse than telling them it has
gone. This is why `WishlistProductView.sellingPrice` is nullable where the shop
grid's is not, and why the wishlist does NOT filter on
`PUBLIC_PRODUCT_WHERE` — only adding to it does.

**Weighted average cost applies only when quantity is added to an existing
product.** Not on a new product, not on a price edit. History is never
rewritten: past orders keep the cost snapshotted onto their line items, and
past purchase lines keep the cost they were bought at. (Phase 2.)

## 3d. Still to build from these rules

1. ~~An "awaiting pricing" queue~~ — **BUILT** 29 September 2026.
   `/admin/products/unpriced`, with a count badge in the admin nav. Unpriced
   pieces were also removed from the main Products list, which now means "on
   the shop"; ten thousand pieces tagged gradually would otherwise bury the
   catalogue.
2. ~~An approval step separate from pricing~~ — **SETTLED: there is none.**
   Pricing IS the approval. A piece with an MRP and a selling price is on the
   shop; clear either and it comes off. No `isListedOnline` flag was added —
   two ways of saying the same thing eventually disagree.
3. **Weighted average on restock** (§3c), as part of Phase 2. Still to build.

A customer's only route to an unpriced piece is a wishlist they had already
saved it to, where it reads "Not available" with the button disabled. The shop
grid, the product page, search and the sitemap all hide it.

## 3b. Still to settle

**Per-variant or per-product cost.** `ProductCost` is `productId @unique` —
one cost row per product. But `PurchaseItem` is sketched with `variantId` and
`unitCost`, and restocking is described as changing "the variant's current
cost". There is no per-variant cost today. Either `ProductCost` moves to
per-variant, or the purchase model changes. It is a migration either way, and
it blocks Phase 2.

**Phase 1's surface is five writes, not three.** Every place `stockQty` is
written today:

| Where | What |
|---|---|
| `src/lib/queries/checkout.ts` | decrement when an order is placed |
| `src/lib/queries/admin-orders.ts` | increment when an order is cancelled |
| `src/app/api/admin/inventory/route.ts` | direct set from the inventory screen |
| `src/lib/queries/admin-products.ts` | the product form, on create and on update |
| `prisma/seed.ts` | seeding |

The product form is the one that gets missed: it sets variant stock on both
create and update, and does not look like "an inventory edit".

---

## 4. Open questions — ask the owner before the phase they affect

1. **Label printer model and label size**, before building labels (Phase 2).
2. **Pieces with zero stock leaving the shop grid**: confirm before changing
   the current behaviour (Phase 2).
3. **Staff logins** (Phase 3). Ask two things. Do several staff share one
   counter computer? Do all staff have an email address? If they share a
   computer, scans would be attributed to whoever signed in that morning, so
   offer a quick 4-digit PIN to confirm each scanning session. If some staff
   have no email, agree with the owner how the admin creates their accounts.
   Do not invent either without asking.
4. **Should a scan-out record a sold price?** (Phase 4.) The default is no: the
   scan only removes the piece. Recording a price would let the owner see
   profit on counter sales as well as online ones, but it adds a step for staff
   at the counter, and the owner has said the counter isn't billing. Ask once,
   and do nothing if the answer is no.
5. **Online receipt** (§14): does the admin order page already give the owner
   something to put in the parcel, or does the owner want a printable slip?
6. **Hosting**: Render Starter first. Confirm at deployment (§15).

The owner's earlier remarks "no need for 1, keep it flexible" and "no need 2"
were never clarified. The features that message discussed (counter billing with
GST rules, and per-bill staff PINs) have since been removed (§10), so it should
no longer matter.

---

## 5. Rules (additions to the handover's §7)

1. A piece that has left is never deleted. Its stock goes to zero.
2. Every change to stock writes a `StockMovement` row in the same transaction
   as the change. `stockQty` is a cached balance and must always equal the sum
   of that variant's movements. No code path may write `stockQty` without
   writing a movement.
3. Stock movements are never deleted or edited. A mistake is corrected by a new
   movement that points at the original.
4. Stock never goes below zero. A scan of a piece with no stock is refused.
5. Cost price, supplier and margin never reach STAFF, exactly as they never
   reach customers.
6. No UI or API path can create or promote an ADMIN. That stays terminal-only
   through `scripts/create-admin.ts`. An admin may create STAFF accounts in
   the UI.
7. A piece is scanned out when it leaves the shop. There is no back-dating:
   pieces that left during an outage are scanned when the connection returns
   and are timestamped then.
8. **The one exception to rules 1 and 3: pre-launch cleanup.** The handover's
   go-live list deletes the 2 test orders and 5 placeholder products. That
   happens once, before go-live, through a script the owner runs, which also
   removes their stock movements. After go-live, nothing covered by rules 1
   and 3 is ever deleted.

---

## 6. Before starting

1. Run `git status` with the owner. The handover (§11) lists uncommitted work:
   the policy pages, the phone-verification suspension, and the sitemap entries
   for the policies. If any of it is still uncommitted, give the owner the
   commands to commit it first. If `.env.local` ever appears in `git status`,
   stop.
2. Read the real schema (29 models) and compare it with the model sketches in
   this document. They are suggested shapes, not final definitions. Tell the
   owner where they conflict before changing anything.
3. Build one phase at a time. Each phase ends with its verification and the
   commit commands for the owner.

---

## 7. Build order

| Phase | What | Unblocks |
|---|---|---|
| 1 | Stock ledger | everything else |
| 2 | Suppliers, purchases, barcodes, labels, "show online" | entering real products |
| 3 | Staff role | staff scanning at the counter |
| 4 | Shop checkout (scan out) | stock leaving when pieces are sold in the shop |
| 5 | Stock-take | catching missed scans, monthly audit |

Phase 2 is what lets the owner start entering real stock, which also clears the
main handover's biggest blocker (placeholder products). **Do not let the owner
list a tagged piece online until Phase 4 is in use at the counter**, or a piece
sold in the shop will still show as in stock on the website.

---

## 8. Phase 1 — Stock ledger

```
StockMovement
  id
  variantId       → ProductVariant
  delta           Int, signed (+ in, − out)
  balanceAfter    Int
  reason          enum, below
  orderId?  purchaseId?  stocktakeId?  reversesMovementId?
  note            String?
  createdById     String?   (null = system or webhook)
  createdAt
  @@index([variantId, createdAt])

reason: OPENING_BALANCE, PURCHASE, ONLINE_SALE, ONLINE_CANCEL, ONLINE_RETURN,
        SHOP_CHECKOUT, SHOP_CHECKOUT_UNDO, STOCKTAKE, DAMAGE, ADJUSTMENT
```

- Backfill one `OPENING_BALANCE` movement per existing variant, equal to its
  current `stockQty`.
- Find every existing write to `stockQty` (order creation, cancellation
  restock, admin inventory edits, the seed) and make each one write its
  movement in the same transaction.
- The admin inventory "edit stock" becomes "adjust stock". A reason (DAMAGE or
  ADJUSTMENT) and a note are required.
- Admin → Inventory → any variant shows its movement history, newest first.
- `SHOP_CHECKOUT_UNDO` movements point at the original `SHOP_CHECKOUT` through
  `reversesMovementId` (used in Phase 4). Nothing is ever edited in place.
- Add a check, as both a script and a test, that `sum(delta) == stockQty` for
  every variant.

**Verify:** place a COD test order, cancel it, and adjust one piece for damage.
The history shows all three, and the check reports zero mismatches.

---

## 9. Phase 2 — Suppliers, purchases, barcodes

### Suppliers (weavers)

Weavers and sellers are kept as cards. The owner picks one when stock arrives,
or adds a new one on the same screen. Each holds a name, a mobile number, and
room for **one optional photo**. The owner may use it for an ID card or for
something else; the system doesn't care which, and nothing is verified.

```
Supplier
  id, name, mobile (unique when present), notes?, isActive, createdAt,
  photoFileId?   (ImageKit private file ID; never a URL)
SupplierPhotoView
  supplierId, viewedById, viewedAt
```

- Cards show name and mobile only, never the photo. Searchable by
  name or mobile.
- Mobile is required for new suppliers and unique, so a weaver can't be added
  twice.
- A supplier with purchases is never deleted, only deactivated.
- `ProductCost.supplierName` is free text today. Migrate it: group names that
  match after trimming and ignoring case, show the owner the proposed groups,
  and apply them only after the owner confirms. Never merge silently. Then
  replace the text field with `supplierId`. Migrated suppliers may have no
  mobile until the owner adds one.

### Supplier photo

One optional photo per supplier. It may well be an identity document, so it
goes on ImageKit **as a private file**, never as a normal one (reasons in §3).

- Uploaded with `isPrivateFile: true` into a separate folder, under a random
  file name, never the weaver's name. Store only the ImageKit file ID.
- Viewed only through one admin-only route. It checks `requireAdmin()`,
  writes a `SupplierPhotoView` row, and returns a signed URL that expires
  within about 60 seconds. Never store a signed URL anywhere. Display it with
  a plain `<img>`, not `next/image`.
- **No named transformations in the ImageKit account.** ImageKit serves named
  transformations of private files without a signature, so a single one would
  expose every supplier photo. Add this to the handover's traps (§21).
- ImageKit's own dashboard shows private files in its media library, so the
  ImageKit account must have two-factor sign-in turned on.
- The upload screen shows a reminder next to the picker: "If this is an
  Aadhaar card, cover the first 8 digits before photographing." It is a
  reminder only. Nothing is blocked, and no confirmation is required.
- Compressed on the device before upload, like product photos.
- Nothing is read from the photo: no OCR, no text extraction, no checking of
  what it shows. In particular, an Aadhaar number is never stored as text.
- The owner can replace or delete the photo at any time. Deleting removes the
  file from ImageKit and purges its cache.
- Cards and list queries never include the photo. The admin opens it
  deliberately with "View photo".

### Purchases (stock in)

The owner's flow: the weaver delivers, the admin picks the weaver's card,
enters each saree with its cost price and quantity, and photographs it right
then. **Selling price is not needed at this point.**

```
Purchase       id, purchaseNumber (P-00001), supplierId, purchaseDate,
               createdById, createdAt
PurchaseItem   purchaseId, variantId, quantity, unitCost
```

Each line at intake:

| Field | At intake |
|---|---|
| Category | required |
| Cost price | required |
| Quantity | required |
| Photo | required, taken with the phone camera on this screen |
| Name | optional; defaults to category + code, e.g. "Saree SAR-01234" |
| Sizes | readymade items only; one variant per size |
| Selling price, MRP, attributes | optional; added later |

- A line is either a new design or a restock of an existing one (scan its tag
  or search).
- Save: one transaction creates any new products and variants, the purchase
  and its items, and a `PURCHASE` movement per line. Upload photos and prepare
  everything before the transaction opens (Neon's 5-second limit, handover
  §6).
- Straight after saving, print labels: one per piece, so a quantity of 3
  prints 3.
- **Opening stock mode** records the pieces already in the shop (about
  10,000): same screen, supplier optional, and the movements use
  `OPENING_BALANCE`. Cost stays required; for old stock the owner enters their
  best figure.
- MRP becomes optional everywhere. With no MRP, the shop shows the selling
  price alone, with no strikethrough or discount.
- There is no speed target, because the owner tags gradually. The screen
  should still remember the last supplier and category, and work well on a
  phone.

**Photos:**
- Captured from the page with the phone camera
  (`<input type="file" accept="image/*" capture="environment">`).
- Resized and compressed on the device before upload: about 2,000 px on the
  long side, roughly 200–300 KB (WebP where the browser supports it). ImageKit
  bills storage by uploaded size, and uploads from the shop may run on mobile
  data.
- Check that iPhone photos arrive in a format the pipeline handles.
- The intake photo becomes the product's first photo. More can be added
  before it's listed online.

**Cost on restock:** when a design is restocked at a different cost, the
variant's current cost becomes the weighted average of the stock on hand and
the new purchase. Online orders keep snapshotting cost onto their line items, as
today. (CA question 3.)

### Barcodes

- `ProductVariant.barcode String @unique`.
- Generated when the variant is created, as Code 128. It encodes letters and
  digits and needs no registration for in-store use.
- If a piece already carries a barcode tag, the purchase screen accepts
  scanning it in and stores that code instead of generating one.
- Each size of a readymade product is its own variant with its own barcode. A
  saree has one.
- USB scanners act as a keyboard: they type the code and press Enter. Every
  scan input is a plain text field that submits on Enter. No drivers, no
  device APIs.

### Labels

- Printable labels for a purchase, or for any selection of variants: the
  barcode, the code as text, a short name, and the selling price if one is
  set.
- One label per piece.
- The owner already has a barcode label printer. **Ask for its model and
  label size before building this** (open question 1), and make the label size
  a setting.
- CSS `@page` sized to the label, printed through the browser's print dialog.
- Barcodes are rendered client-side as SVG by a maintained library. No
  external barcode API.

### "Show online"

- A product can exist in inventory with no selling price and a single photo.
- New flag, e.g. `isListedOnline`. It can only be set to true when the product
  has a selling price, a proper name (not the default), at least one
  photograph (4–5 recommended), and every attribute marked `isRequired`.
  Enforce this on the server.
- Reconcile with the existing `isActive`: `isActive` means it can be sold at
  all; `isListedOnline` means it's visible on the website. Record the final
  meaning in the handover.
- Pieces with zero stock drop out of the shop grid and search results. Their
  product pages stay live and show "Sold out", so shared links and search
  ranking survive. This changes the handover's current behaviour; confirm with
  the owner first (open question 2).
- **Do not list a tagged piece online until Phase 4 (scan-out) is in use at the
  counter.** Otherwise a piece sold in the shop still shows as in stock on the
  website. This is an instruction to the owner, not something to enforce in
  code.

**Verify:** add a weaver with a photo, and another with none. The file's plain
ImageKit URL fails without a signature, a signed link stops working once it
expires, and each view is logged. Record a purchase of three new sarees (one
with quantity 2) plus a restock. Labels print one per piece; scan one in the
admin lookup and land on the right piece. Stock and movements are correct.
Listing a piece online without a selling price is refused.

---

## 10. Not being built: counter billing, GST rules and invoices

The owner has ruled these out. They were in an earlier draft of this addendum
and must not come back unless the owner asks:

- Billing at the counter, with prices, totals, payments or receipts
- Split payments (cash, UPI, card) and an end-of-day cash report
- GST tax rules per category, HSN codes and slabs on bills
- Invoice numbers and invoice series, credit notes, cancelled invoices
- Backup bills for the handwritten bill book
- A staff PIN on every bill, and staff discount limits
- Below-cost sale flags at the counter

If the owner ever wants the website to bill at the counter, that is a new
project with its own GST and invoice design. Ask before building any of it.

The existing online checkout is unchanged, apart from sharing one stock count
with the ledger (Phase 1) and with scan-out (Phase 4).

---

## 11. Phase 3 — Staff role

**Ask open question 3 before starting this phase.**

- `Role` gains `STAFF`.
- STAFF can open the scan-out screen (Phase 4), look up a piece by scan or
  search (photo, name, size, tag code, stock on hand, and the selling price if
  one is set; customers see that price too), and see the pieces they scanned in
  the current session.
- STAFF cannot see cost price, supplier, supplier photos, margin or profit
  reports; enter purchases; edit products or prices; adjust stock; undo a scan;
  see orders or customers; or open any other admin page.
- The staff screens live in their own route group, e.g. `/staff`, with their
  own layout. Not inside `/admin`, and not under `/checkout`, which is the
  customer checkout.
- Guards: a `requireStaffOrAdmin()` alongside `requireAdmin()`. Every staff
  route guards itself. Every STAFF-facing query uses an explicit select with no
  cost or supplier fields.
- An admin creates staff accounts in the UI: sign-in by email with a
  single-use setup link, as for admins (staff without email: open question 3).
  One account per person, never shared. An admin can disable an account, which
  ends its sessions immediately.
- Each scan records the signed-in staff member. The owner's answer to open
  question 3 decides whether a PIN confirms scans on a shared computer.

**Verify:** a STAFF login gets 403 on every `/api/admin/*` route. No staff API
response contains a cost or supplier key; write this as a test.

---

## 12. Phase 4 — Shop checkout (scan out)

This is not billing. The bill is still written in the bill book. Staff scan a
piece when it leaves the shop so the website's stock stays true.

The screen (STAFF and admin):
- A large scan box, focused automatically and refocused after every scan.
- After a scan it shows the piece: photo, name, size, tag code, stock on hand,
  and the selling price if set (read-only). No prices to edit, no totals, no
  payments, no customer details, no receipt.
- One action confirms it (Enter or a tap): remove one from stock.
- A read-only list of what was scanned in this session.

On confirm, in one transaction: check that stock is at least 1 with an atomic
conditional decrement (the same way the online checkout does), decrement it, and
write one `SHOP_CHECKOUT` movement recording the staff member and the time.

If stock is 0, refuse and write nothing. Show: "None in stock in the system. It
may have just sold online, or it was never entered. Tell the owner."

Admin only:
- A "Today's scans" list: piece, who, when.
- **Undo a scan.** It writes a `SHOP_CHECKOUT_UNDO` movement that points at the
  original through `reversesMovementId`, with a required note. The original is
  never edited or deleted.

Not built here unless the owner says so (open question 4): a sold price on the
scan.

**Verify:** scan a tagged piece and confirm; stock drops by one and the history
shows the staff member and time. A scan at zero stock is refused and writes
nothing. Race test: buy the last piece online and scan it at the counter at the
same moment; exactly one succeeds. An admin undo restores stock and leaves both
movements in the history.

---

## 13. Phase 5 — Stock-take

This is the safety net for pieces that left without being scanned.

- Start a session, scan every piece on the shelves (USB scanner or phone
  camera), then finish.
- The report lists what should be there but wasn't scanned, what was scanned
  but shouldn't be there, and counts that differ.
- The admin reviews it and applies chosen corrections as `STOCKTAKE`
  movements with a note. Nothing is applied automatically.
- Phone camera scanning must work in Android Chrome and iOS Safari. Safari's
  built-in barcode detection isn't reliable, so use a library that works in
  both.

**Verify:** take one tagged piece off the shelf, run a stock-take, and see it
reported missing.

---

## 14. Online orders and receipts

The owner sends an informal receipt with each parcel. **By default, build
nothing for this.**

- Check what the admin order page already shows or prints, and tell the owner.
- If the owner wants a printable slip (open question 5): order number, date,
  the items, the amounts the customer paid (subtotal, shipping, tax as the site
  already computes it, total, payment method) and the shop's name and address.
  It carries no invoice number, makes no claim to be a GST tax invoice, and
  never shows cost or supplier.
- **Flag once, plainly, and leave it with the CA.** A GST-registered seller
  normally has to issue a tax invoice (a bill of supply, for composition
  dealers) with specific details, including for online sales. Whether an
  informal receipt is enough is the CA's decision (CA question 1). Do not
  decide it, and do not build a tax-invoice system unless the owner and the CA
  say it is needed. If they do, that is a new phase.

---

## 15. Storage, hosting and backups — cheapest safe setup

The owner wants the lowest running cost. Start on free plans and upgrade each
service only when its own usage calls for it. Prices below were checked in
late September 2026; check them again before acting on them.

**Records versus backups.** Explain it this way if the owner asks. The database
is the permanent record: every purchase, online order, stock movement and counter scan, kept
forever. Backups are spare copies of the database, kept for 7 days, and used
only when something goes wrong. If nothing ever goes wrong, no backup is ever
opened and the records are still complete. The owner has confirmed they
understand this.

### Database: Neon free plan

- Holds text and numbers only; photos are links. 10,000 products plus years
  of orders and stock movements stay well within the 0.5 GB limit.
- The limit that matters is compute: 100 CU-hours a month. Set the compute's
  maximum size to 0.25 CU in Neon's settings so the hours last as long as
  possible: about 400 awake hours a month, since it sleeps after 5 minutes
  idle.
- If the CU-hours run out, Neon suspends the database until the next month or
  until the plan is upgraded. The website and staff scanning both stop. No data
  is lost.
- The free plan's 5 GB monthly network transfer has the same effect if
  exceeded. Watch it too.
- Show the owner where Neon's console shows usage, and ask them to check it
  weekly.
- Move to the pay-as-you-go plan before a limit is reached, most likely once
  online orders and staff scanning keep it busy most of the day. It has no monthly minimum: $0.106 per CU-hour
  and $0.35 per GB-month of storage. Estimate for this shop: $10–20 a month, probably less now that the counter only scans; check real usage.

### Backups: free, daily, kept 7 days

- Neon's free plan can only restore the last 6 hours. Add a daily `pg_dump`,
  compressed and encrypted, run by a scheduled GitHub Actions job and kept for
  **7 days**, then deleted automatically.
- `DATABASE_URL` and a backup passphrase go in GitHub repository secrets. The
  owner keeps the passphrase in their password manager. Without it, the
  backups cannot be opened.
- The job must notify the owner when a run fails, so a broken backup isn't
  missed for weeks. Show the owner where to see the run history (a green tick
  per night).
- Check whether GitHub's inactivity rules can disable a scheduled workflow on
  this repository. If so, tell the owner what keeps it alive.
- **Restoring is never done over the live database.** That would wipe the
  day's real orders and stock movements. Restore into a separate database and
  bring back only what was lost.
- Test one full restore before go-live, and document the exact steps in the
  handover so a future session can follow them under pressure.

### Photos: ImageKit free plan

- 3 GB of storage and 20 GB of bandwidth a month. On the free plan, images
  stop being delivered once the monthly bandwidth runs out.
- ImageKit counts storage by the size of the uploaded files. With on-device
  compression (§9) to 200–300 KB, 3 GB holds roughly 10,000 photos.
- Give `next/image` a custom loader that requests sized images from ImageKit,
  so the app server never resizes images itself. This matters on a 512 MB
  host.
- Move to ImageKit Lite before a limit is reached: $9 a month for 10 GB of
  storage and 40 GB of bandwidth, then $0.10 per GB of storage and $0.50 per
  GB of bandwidth.
- The private supplier photos live in the same account (§9): no named
  transformations, and two-factor sign-in on.

### Hosting

- **Never Vercel Hobby for production.** Vercel's free plan is for personal,
  non-commercial projects only.
- **Start on Render:** a Starter web service, about $7 a month, 512 MB RAM, on
  Render's free workspace plan. Render calls that workspace plan "Hobby" too;
  the commercial restriction discussed here is Vercel's. Render's own
  small-business cost guide uses this combination; confirm Render's terms at
  signup.
- Run `next build` then `next start` as a single instance, so `revalidatePath`
  refreshes stay consistent.
- Confirm the build and the running app fit in 512 MB. If they don't, Render's
  next size costs more than Vercel Pro ($20 per user a month), so move to
  Vercel Pro instead.
- Put the app in the same region as the Neon database; check Neon's console
  for which region that is. On Vercel, set the function region explicitly,
  because its default is in the US.
- DNS stays at GoDaddy. Add the host's records there.

---

## 16. Running costs in India (reference)

Nothing to build here. It's recorded so that a future session gives the owner
consistent numbers.

- Foreign services bill in US dollars. Most Indian cards add a forex markup
  of about 3.5%, plus 18% GST on that markup: about 4.1% on top of each bill.
  Some cards charge 0%; the owner was advised to check theirs.
- GST applies to these subscriptions. The shop is GST-registered and may be
  able to claim it back as input tax credit (ask the CA).

| | Now | Once online orders, counter scanning and the catalogue grow |
|---|---|---|
| Hosting: Render Starter | ~$7 (~₹640) | ~$7 (~₹640) |
| Database: Neon | free | ~$10–20 (~₹900–1,800) |
| Photos: ImageKit | free | $9 (~₹820) |
| Email, rate limiting | free | free |
| **Total** | **~₹640 a month** | **~₹2,400–3,300 a month** |

Rupee figures assume about ₹88 to the dollar and include the ~4.1% card
markup.

**Later option: one Indian server.** A Hostinger VPS (KVM 1) in Mumbai renews at
about ₹999 a month (₹599 for the first term), billed in rupees with GST and
payable by UPI. It could run the site, database and photos together: cheaper
at scale, faster for Indian customers, and simpler GST invoices. But it's
self-managed: someone has to install, patch, back up and repair the server.
The owner was advised to stay on managed services until the monthly bill
reaches roughly ₹2,800, then reconsider.

---

## 17. Hardware

- A computer with Chrome (or a phone) at the counter for scanning
- Barcode gun (USB scanner) for scanning pieces out, any model in its default
  keyboard mode. The owner is buying one.
- Barcode label printer: the owner already has one (model and label size to
  confirm, open question 1)
- A phone for intake photos
- A mobile hotspot as an internet backup. During an outage the bill book carries
  on and pieces are scanned when the connection returns (§18)

---

## 18. Transition

Only tagged pieces are in the system and on the website. The counter routine:
- **Billing is unchanged: the bill book, for every piece, tagged or not.**
- **For a tagged piece, staff also scan it out at the moment they write the
  bill.** That is the only new step.
- **Untagged pieces are not in the system.** Sell and bill them as today, with
  no scan, until they are tagged.

Rules that keep it safe:
- Do not list a tagged piece online until scanning is in use at the counter
  (Phase 4). Otherwise a piece sold in the shop still shows as in stock online.
- A piece that is sold but not scanned stays in stock on the website and may
  sell online a second time. The monthly stock-take (Phase 5) finds these, and
  an oversold online order shows up when the owner packs the parcel.
- During an internet or power cut, staff carry on with the bill book and keep a
  written list of the tag codes that left. They scan them when the connection is
  back. Nothing is back-dated.

The shop holds about 10,000 pieces; the owner tags them gradually, at their own
pace, using Opening stock mode.

---

## 19. Questions for the CA

None of these block building. Questions 1 and 2 should be answered before the
website takes real online orders. Question 3 affects Phase 2, question 4
affects the supplier photo, and question 5 affects how long records and backups
are kept.

1. Online sales: the shop is GST-registered and the owner sends an informal
   receipt with each parcel. Is that enough, or must an online order come with
   a proper GST tax invoice (or bill of supply)? What does it need to show?
2. GST rate for online orders, per category: saree, lehenga, suit, kurta
   pyjama, dupatta, crop top. Until per-category rates exist (if they are
   needed at all), what single rate should be entered in the website settings?
3. Cost of restocked designs: is a weighted average acceptable?
4. What ID proof, if any, should we keep for the weavers we buy from: a
   masked Aadhaar, PAN for large purchases, anything else? (The system has
   room for one photo per weaver; this decides what it should be.)
5. How long must we keep sales, purchase and stock records, and in what form?

---

## 20. Go-live checklist — additions to the handover's §10

- Phase 4 (scan-out) in use at the counter before any tagged piece is listed
  online.
- CA questions 1 and 2 answered, and the GST rate setting set as the CA says
  (it is still the main handover's blocker). Legal name and GSTIN set in
  settings, as the handover already says.
- Deployed on Render Starter (or Vercel Pro), never Vercel Hobby. Same region
  as Neon. `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` set to
  `https://dhanvarshasilk.in` (handover §4 already requires the real domain).
- Neon compute capped at 0.25 CU, and the owner knows where to check usage.
- ImageKit: two-factor sign-in on, no named transformations, custom
  `next/image` loader in place.
- Daily backup running, failure alert tested, one full restore tested, and the
  restore steps written into the handover.
- Two-factor sign-in on every technical account: GitHub, Neon, ImageKit, the
  host, GoDaddy and Resend, in addition to the admin authenticator the
  handover already requires.
- Pre-launch cleanup (rule 8) run once.

---

## 21. Traps to add to the handover's §6

- **ImageKit named transformations bypass private-file signing.** One named
  transformation exposes every private supplier photo.
- **Neon's free plan suspends the database** when CU-hours or network transfer
  run out. The website and staff scanning stop until the next month or an
  upgrade.
- **Vercel Hobby is non-commercial only**, and Vercel functions default to a
  US region.
- **Never restore a backup over the live database.** It wipes the day's real
  orders and stock movements.
- **A piece sold in the shop but not scanned stays in stock online**, and can be
  sold a second time.
- **One GST rate can't represent this catalogue**: sarees are 5%, and readymade
  apparel is 5% up to ₹2,500 per piece and 18% above (to be confirmed by the
  CA).
- **GitHub scheduled workflows** may be disabled by inactivity rules; verify
  this for the repository.

---

## 22. Do not

- Delete pieces, orders or stock movements (except rule 8)
- Change `stockQty` without writing a movement
- Let stock go below zero
- Select cost price or supplier in any STAFF-facing query
- Build counter billing, GST tax invoices, invoice numbers, payment records,
  credit notes, staff discount limits or back-dated sale entry. The owner has
  said this is inventory only (§10)
- Merge suppliers without the owner's confirmation
- Build accounting (supplier dues, payables); it's out of scope
- Upload supplier photos as public files, store signed URLs, or include the
  photos in any list query
- Create named transformations in the ImageKit account
- Run production on Vercel Hobby
- Restore a backup over the live database
- Let the owner list a tagged piece online before Phase 4 is in use

---

## 23. Explaining things to the owner

- The owner runs every command and pastes every file. They want complete
  files, exact commands one block at a time, and what they'll see on screen
  at each manual step, including which account or dashboard to open.
- When the owner says "explain", simplify further: short sentences, a small
  flow diagram in a code block, and a concrete example in rupees.
- Analogies that have worked:
  - the stock ledger is a bank passbook
  - Neon's 6-hour restore is CCTV that keeps only 6 hours of footage
  - the nightly backup is photocopying the register every night into a locker
  - a normal ImageKit file vs a private one is a link anyone can open vs a
    locked cupboard
  - a scan-out is ticking a piece off the shelf list; the bill is still written
    in the bill book
- Already explained to the owner: tables, rows, primary keys, relations,
  indexes and cascades; why pieces that have left aren't deleted; records versus
  backups; why the supplier photo can't be a normal ImageKit file; and the
  running costs in rupees.
