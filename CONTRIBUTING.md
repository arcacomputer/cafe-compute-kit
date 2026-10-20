# Contributing

Small, testable changes are welcome. Read [architecture](docs/architecture.md), [contributor details](docs/contributing.md) and the relevant app guide first.

- Use Node 22.22.2 and `npm ci`; keep the lockfile in sync.
- Add an executable regression before a behavior fix when practical.
- Run source checks, builds and focused tests; run native PostgreSQL/browser proof for auth, quotas, assignments, mail fences, exports or permission changes.
- Keep both attendee languages matched. Verify mobile, keyboard access and accessibility violations **and** incomplete checks.
- Never use actual rosters, codes, mail credentials, deployment IDs, production databases or private photos in fixtures.
- Do not add an HTTP test-auth bypass. Test capabilities belong in in-process harness bindings, not requests.
- Keep deployments, imports, sends and release-gate changes explicit. No install/test hook should contact a real attendee or redeem a value.

Contributions are under MIT. Disclose AI assistance honestly; humans remain responsible for reviewing what they submit. Provider trademarks and third-party media require their own rights and are not licensed by this repository's MIT grant.
