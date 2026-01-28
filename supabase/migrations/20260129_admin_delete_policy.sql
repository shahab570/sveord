-- Allow Admin to DELETE any profile
-- This is required for the "Delete" button in the Admin Dashboard
create policy "Admin can delete any profile"
on profiles
for delete
using (
  auth.jwt() ->> 'email' = 'mjsahab570@gmail.com'
);
