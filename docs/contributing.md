# Contributing

Contribute through [the public repository](https://github.com/arcacomputer/cafe-compute-kit). Keep changes small, state the behavior changed and include a synthetic reproduction. Security-sensitive details belong in a private channel; see [security](security.md).

## Local workflow

1. Read [getting started](getting-started.md), [architecture](architecture.md) and the root package scripts. Use the Node/package-manager versions declared by the checkout and the checked-in lockfile.
2. Work in the owning subtree: `apps/event-site` for public content/build; `apps/feedback` for auth, feedback, private operations and its sender; `docs` for guides. Root integration owns workspace scripts, merge rules and Cloudflare configuration; `api/` and `vercel/` own the native Vercel adapters and separate sender project. Both platforms share private handlers/SQL; keep environment projections and authority separation intact.
3. Use synthetic data and disposable local PostgreSQL only. Never copy a real event DB/Neon branch, roster, photo, code, login URL, environment file, export, operational log or private-repository history into a fixture.
4. Add a regression for changed behavior before a fix when practical. Run the existing workspace checks listed in [getting started](getting-started.md#checks), including native PostgreSQL/browser checks for affected private flows. If prerequisites are absent, report that explicitly; skipped/mock tests do not prove the missing layer.
5. Inspect the built public artifacts, not just the source. Confirm the feedback build exposes assets, not an authenticated form; the root build rejects collisions. Review `git diff --check` and the actual patch before opening a PR.
6. In the PR, list commands actually executed, their results, fixture/data classification, external side effects (normally none) and unresolved limitations. Do not claim provider verification you did not perform. Disclose material AI assistance and human review.

There must be no install lifecycle hook that deploys, sends mail, enables claims, creates paid resources or imports private data. Unit tests and CI must not silently fall back to real credentials. Database-prerequisite failures must be explicit rather than green skips. Never weaken grants, disable CSRF, add a public auth bypass or hardcode a cohort size to make a test pass.

## Review checklist

- [ ] No secret, private data, live resource identifier or redeemable value in source, fixtures, screenshots, generated assets or history.
- [ ] Public event config contains only public facts; owner and provider credentials remain server-only.
- [ ] Both English and Spanish copy agree; criticism and N/A are accepted; photos and reuse consent remain optional and separate.
- [ ] Exact code values are preserved; links are HTTPS and origin-allowlisted without visits. Existing assignments are never reset.
- [ ] Text save, retry/reconciliation, allocation and photo state remain distinct. Independent PostgreSQL sessions cover changed transactional behavior.
- [ ] Owner login does not grant benefit eligibility. Sender stays private and one-attempt; broad mail key never enters the main Worker.
- [ ] Keyboard focus, visible labels, status/errors, reduced motion and narrow-screen use work. Review accessibility audit incomplete findings as well as violations.
- [ ] Code, examples and docs use actual available commands and current configuration names. New assets have rights/notice records.

## Collaboration

Be respectful of participants and contributors. Do not pressure anyone for a positive testimonial, public photo consent or sensitive personal details. Review criticism on its substance, keep private matters private and offer an accessible text-only path when someone cannot upload media. Maintainers may remove abusive content without treating ordinary negative feedback as abuse.

Publishing a fork, deploying infrastructure, mailing participants, revealing real benefits and sharing feedback are separate decisions. A merged contribution is not authorization for any of them.
