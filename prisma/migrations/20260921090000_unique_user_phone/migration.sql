-- Make User.phone a sign-in identifier in its own right.
--
-- Safe: checked before writing this that no row has a phone number at all, so
-- there is nothing to clash. Postgres does not treat NULLs as equal, so any
-- number of users may still have no phone.
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
