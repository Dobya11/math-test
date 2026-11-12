# Authentication setup

The app uses Supabase email/password authentication with the username mapped to
an internal address of the form `<username>@login.math-test.invalid`. The
address is not a real mailbox.

In the Supabase dashboard, enable the Email provider and disable email
confirmation. Otherwise Supabase will create an account without returning a
session, and the user cannot confirm the generated address.

Existing anonymous accounts from older app versions cannot sign in with a
username and password until they are migrated or recreated.
