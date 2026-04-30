# Security Specification - Jan Shop

## 1. Data Invariants
- **Products**: Must have `name` (string, max 100 chars), `price` (number, positive), `stock` (number, min 0).
- **Orders**: Must link to a `productId` and have `customerPhone` matching the creator if not admin.
- **Activities**: Immutable log entries once written. `from` and `to` are required.
- **Customers**: PII (phone, name) restricted to self-read or admin-read.
- **System Config**: Only modifiable by system/admin.

## 2. The Dirty Dozen Payloads
1. **Negative Stock**: `{ "stock": -5 }` on `Product`.
2. **Price Spoofing**: `{ "totalPrice": 0.01 }` on `Order`.
3. **Identity Theft**: Creating an order with `customerPhone: "+1234567890"` when authenticated as `+9999999999`.
4. **Denial of Wallet**: Sending a 1MB string as a message in `Activity`.
5. **PII Scraping**: List query on `customers` without filter.
6. **State Escalation**: Updating `Order` status to `entregado` by customer.
7. **Bypassing Rules**: Using `.` in document IDs to traverse paths (guarded by `isValidId`).
8. **Time Travel**: Setting `createdAt` to a future date.
9. **Admin Spoofing**: Setting `role: "admin"` in user profile.
10. **Unauthorized Follow-up**: Deleting someone else's `FollowUp`.
11. **Shadow Fields**: Adding `isVerified: true` to a `Store` document.
12. **Malicious IDs**: Creating a product with ID `../../../etc/passwd`.
