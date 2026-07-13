# Curriculum Gap Analysis — 140-Task Sprint vs. Current Exam Outlines

**Date:** 2026-07-13
**Sources:** Official Microsoft Learn study guides — MD-102 "Skills measured as of
April 28, 2026" and SC-300 "Skills measured as of April 27, 2026."
**Method:** Keyword scan of the full curriculum source (day titles, task text,
and all step content) against every subsection of both current outlines, plus
manual review. Zero mentions = gap. One to three mentions = flagged as thin
(depth should be verified — a single strong task can still be adequate).
A keyword scan can miss synonyms; treat this as a high-confidence screen, not
a formal audit.

**Bottom line:** Core coverage is strong — Autopilot (73 mentions), Conditional
Access (31), MFA/Authenticator (83), compliance (18), PIM (25), BitLocker (39),
entitlement management (12), break-glass (10) are all well represented. The
gaps cluster in two places: **the exam sections Microsoft added or expanded in
the April 2026 refresh**, and a handful of long-standing objectives the sprint
skipped.

---

## MD-102 gaps (zero mentions)

| # | Exam objective (April 28, 2026 outline) | Hands-on in a Business Premium tenant? |
|---|---|---|
| 1 | **Intune Suite: Endpoint Privilege Management** | Add-on license — Intune Suite trial, else conceptual |
| 2 | **Intune Suite: Enterprise App Catalog** | Add-on — trial or conceptual |
| 3 | **Intune Suite: Advanced Analytics** | Add-on — trial or conceptual |
| 4 | **Intune Suite: Remote Help** | Add-on — trial or conceptual |
| 5 | **Intune Suite: Cloud PKI** (exam asks "identify use cases") | Conceptual by design |
| 6 | **Intune Suite: Microsoft Tunnel for MAM** | Add-on — conceptual |
| 7 | **Security Copilot** (named in the audience profile) | Conceptual |
| 8 | **Run a device query by using KQL** (Remote actions) | Requires Advanced Analytics — trial or conceptual; KQL syntax itself is free to learn |
| 9 | **Android updates via config profiles / FOTA** | Conceptual (needs Android Enterprise + OEM FOTA) |
| 10 | **Deploy M365 Apps with ODT / Office Customization Tool** | **Fully doable now — real hands-on gap** |
| 11 | **M365 Apps admin center (config.office.com)** | **Fully doable now — real hands-on gap** |

**Thin (verify depth):** provisioning packages (1 mention), Delivery
Optimization (1), app configuration policies (1), ADMX import (2), local group
membership via Intune (2), Defender for Endpoint integration/onboarding (3 —
Business Premium includes Defender for Business, so deeper hands-on is free),
Windows LAPS (3).

The entire **"Implement Intune Suite add-on capabilities"** subsection (items
1–6) is new emphasis in the current outline and has zero curriculum presence.
Most of it is testable conceptually; a 90-day Intune Suite trial can make
EPM/Remote Help/Advanced Analytics hands-on at no cost if started deliberately.

## SC-300 gaps (zero mentions)

| # | Exam objective (April 27, 2026 outline) | Hands-on in a Business Premium tenant? |
|---|---|---|
| 1 | **Administrative units** (built-in objective) | **Yes — real hands-on gap** |
| 2 | **Custom security attributes** | **Yes — real hands-on gap** |
| 3 | **Self-service password reset (SSPR)** | **Yes — core P1 feature, real gap** |
| 4 | **Continuous access evaluation (CAE)** | Mostly conceptual + verification steps — doable |
| 5 | **Authentication context** (Conditional Access) | **Yes — doable with P1** |
| 6 | **Protected actions** | **Yes — doable** |
| 7 | **MFA registration campaigns** (nudge to Authenticator) | **Yes — doable** |
| 8 | **Global Secure Access** (entire new section: GSA clients, Private Access, Internet Access, IA for M365) | Entra Suite / GSA licensing — trial or conceptual |
| 9 | **API permissions** (app registrations) | **Yes — doable, pairs with existing Graph work** |
| 10 | **App roles** | **Yes — doable** |
| 11 | **PIM for Groups** | Needs Entra ID P2 — the sprint already covers PIM (25 mentions), so extend whatever licensing approach those tasks use |
| 12 | **Entra Kerberos for hybrid** | Conceptual (no on-prem AD in the lab) |
| 13 | **Workbooks** (monitoring) | Needs Log Analytics — Azure free tier covers a lab-scale workspace |

**Thin (verify depth):** cross-tenant access/sync (1), certificate-based
authentication (1), password protection (1), managed identities (1), service
principals (2), diagnostic settings / Log Analytics (2), app registrations (3),
Application Proxy (3).

**Global Secure Access** is the headline: a full top-level subsection in the
current exam with zero curriculum presence.

---

## Recommended remediation

Twelve added or upgraded tasks would close every zero-mention gap at the
right depth for the exam:

1. **ODT/OCT + M365 Apps admin center** — hands-on deploy task (MD, free)
2. **SSPR end-to-end** — enable, register, reset, audit (SC, free)
3. **Administrative units + custom security attributes** — one combined task (SC, free)
4. **Authentication context + protected actions** — Conditional Access deep-cut (SC, free)
5. **MFA registration campaign** — nudge rollout + report (SC, free)
6. **App registrations II: API permissions + app roles** — extends the existing Graph days (SC, free)
7. **Defender for Business onboarding depth** — onboard the Surface, run a simulated detection (MD, free)
8. **Delivery Optimization + provisioning package** — config + verify (MD, free)
9. **Intune Suite survey** — EPM, Enterprise App Catalog, Advanced Analytics, Remote Help, Cloud PKI, Tunnel-MAM: use-case mapping study task, optionally a trial activation (MD)
10. **Device query with KQL** — KQL fundamentals + device query walkthrough (MD; hands-on if trial active)
11. **Global Secure Access** — architecture + Private/Internet Access study task, optional trial (SC)
12. **Workbooks + diagnostic settings** — route sign-in logs to Log Analytics, build one workbook, KQL queries (SC; Azure free tier)

Conceptual-only leftovers (Security Copilot, FOTA, Entra Kerberos, CAE
internals) fold into existing interview-prep days as reading objectives.

**Engineering note:** adding tasks changes the task count. The invariant gate
pins `TASK_COUNT = 140` in `build/verify.js` — bump it in the same commit that
adds tasks, and the gate will hold the new number from then on. New task IDs
must be `id:"dXtY"` declarations inside DAYS; the gate derives the expected set
from those declarations automatically.

Each new task should follow the established gold-standard format: why-now
rationale, MS Learn path mapping, exact click paths, documentation URLs, common
errors, and a what-you-learned close.
