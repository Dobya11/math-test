# Authentication setup

The app creates a passwordless anonymous Supabase account for each browser.
The account ID is the Supabase UUID and the session persists in that browser.
Clearing browser data or switching browsers/devices creates a different account;
these accounts cannot be recovered or shared across devices.

In the Supabase dashboard, enable Anonymous Sign-Ins under Auth providers.

Apply both migrations in order, including
`migrations/20261113010000_use_uuid_profiles.sql`, to configure the profile
trigger without requiring a username column.

No username or password is requested. Existing profiles keep their associated
classroom data. Their UUID is available as the profile ID.
