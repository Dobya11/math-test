# Authentication setup

The app creates a passwordless anonymous Supabase account for each browser.
The account ID is the Supabase UUID and the session persists in that browser.
Clearing browser data or switching browsers/devices creates a different account;
these accounts cannot be recovered or shared across devices.

In the Supabase dashboard, enable Anonymous Sign-Ins under Auth providers.

Apply both migrations in order, including
`migrations/20261113010000_use_uuid_profiles.sql`, to set each profile's
username to its UUID and configure the profile trigger.

No username or password is requested. Existing profiles keep their associated
classroom data; the profile username field is changed to the profile UUID.
