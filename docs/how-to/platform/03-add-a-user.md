# Platform: Add a new user

**Where:** **People & Control** → `/users`  
**Who:** Company admin (operate / audit-control may be required after bootstrap)

![Users](../../screenshots/platform/users.png)

---

## Process flow

```mermaid
flowchart TD
  A[People & Control] --> B[Add user / Create]
  B --> C[Fill: full name, email, title, role]
  C --> D{Submit}
  D -->|Audit-control configured| E[Audit control]
  E --> F[User appears in list · OTP-only by default]
  D -->|No audit-control| F
  F --> G[Optional next: assign initiator / authorizer]
  F --> H[Optional next: issue Command Centre login link]
```

---

## Steps

1. Sign in to Platform → **People & Control**.
2. Platform actions are recorded to the audit trail under the audit controller; no separate unlock is required.
3. Click **Add user** / **Create**.
4. Enter:
   - Full name  
   - Work email (receives OTPs / login links)  
   - Title (optional)  
   - Role (e.g. admin / security / viewer — as offered in UI)
5. Save.
6. Confirm the user shows as **active**.
7. Prefer **login links** for Command Centre access rather than sharing the company password.

---

## Notes

- Users are typically **OTP-oriented** for day-to-day access.
- Creating users after audit-control bootstrap often needs an active audit-control session.
- Do not reuse one password across the whole team; issue per-user app links.

**Related:** [04-assign-audit-control.md](./04-assign-audit-control.md) · [05-issue-app-login-link.md](./05-issue-app-login-link.md)
