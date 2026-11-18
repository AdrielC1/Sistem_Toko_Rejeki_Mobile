# API Coverage — Apps Toko Rejeki (Phase 1 Auth & Connectivity)

> Full coverage by default for the Phase 1 authentication, connectivity, and public store-branding surface of the internal `Apps_Toko_Rejeki` Next.js Web Service API. Opt-outs are explicit, reasoned decisions.

| capability | decision | reason |
|---|---|---|
| pre-login-settings-get | INTEGRATE | |
| auth-login-post | INTEGRATE | |
| auth-me-get | INTEGRATE | |
| auth-logout-post | INTEGRATE | |
| health-get | OPT-OUT | Deferred to Phase 2 per ROADMAP.md NAV-03 (authenticated DB health header polling); pre-login reachability uses public GET /api/settings per D-02 |
| sync-full-delta-get | OPT-OUT | Deferred to Phase 2 per ROADMAP.md SYNC-01..SYNC-03 and 01-CONTEXT.md Deferred Ideas |
| settings-put | OPT-OUT | Deferred to Phase 5 per ROADMAP.md SETT-02 (Owner store identity and logo editing) |
| users-crud | OPT-OUT | Deferred to Phase 5 per ROADMAP.md SETT-04 (Owner staff account administration) |
| products-categories-units-print-walog | OPT-OUT | Deferred to Phases 3–5 per ROADMAP.md (POS checkout, catalog CRUD, and category/unit management) |
