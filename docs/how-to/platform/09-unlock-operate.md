# Platform: Audit control

**Where:** the audit-control widget in the platform sidebar
**Result:** platform actions are recorded to the audit trail under the audit controller

---

## What audit control means on the platform

Only the organization's **primary** user can sign in to the platform, so the
platform does not require an authorizer or an operate session. Your actions run
directly and are written to the audit trail under the audit controller.

The **applications** keep full dual control — there, sensitive mutations need an
operate session and, when enabled, an authorizer's approval.

---

## Steps

1. Assign the audit controller ([04-assign-audit-control.md](./04-assign-audit-control.md)).
2. Sign in as the primary user.
3. Manage people, keys, branding, connections and billing directly — every action
   is recorded.
4. Review or export the trail under **Audit**.

---

## Notes

- The controller's name and title are snapshotted onto each recorded action.
- Reads never need anything extra; writes are recorded automatically.
