# Address autocomplete

By default, explicit searches use public Nominatim (rate-limited and cached); its policy forbids autocomplete. The pin and Google Maps verification link remain available even when search fails.

To enable live suggestions, create a Geoapify project and place its private key in the server .env as GEOAPIFY_API_KEY. Recreate the web container using the normal deployment process. Configure provider-side quota on the free plan, and review attribution. The UI queries only when typing, with an 850 ms debounce, and the server verifies merchant/admin access. A local 2500 requests/day safety limit is best-effort and resets on process restart; provider quotas are authoritative. No paid Google API is enabled.
