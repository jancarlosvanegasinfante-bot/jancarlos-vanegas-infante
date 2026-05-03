# Security Specification - Jan Vanegas Sales App

## Data Invariants
1. A Product must have a name, price, and stock. Stock cannot be negative.
2. An Order must have a customer name, phone, address, and city.
3. An Order must reference a valid productId.
4. Activity logs must have a 'from' number and a status from the allowed enum.
5. Only the designated admin (Jan) can read orders and delete products.
6. The bot (server-side) is responsible for creating orders and updating stock, but since we are using the client-side SDK for simplicity in this demo environment, we allow public creation/update with strict schema validation.

## The "Dirty Dozen" Payloads (Denial Tests)

1. **Identity Spoofing (Orders)**: Try to create an order as an admin by setting a fake admin flag if it existed.
2. **Identity Spoofing (Activity)**: Try to modify an activity log status to 'respondido' without being the bot logic.
3. **State Shortcutting**: Try to update an order status directly from 'pendiente' to 'entregado' without passing through 'despachado' (if we had strict transitions, but here we'll at least protect against unauthorized updates).
4. **Resource Poisoning (Product ID)**: Create a product with a 2MB string as ID.
5. **Resource Poisoning (Long Strings)**: Create an order with a 100KB customer name.
6. **Price Manipulation**: Create an order with a `totalPrice` of 0 for a premium product.
7. **Stock Hijacking**: Update product stock to a negative number.
8. **Unauthorized Read**: Try to list all orders as an unauthenticated user.
9. **Unauthorized Delete**: Try to delete a product as an unauthenticated user.
10. **Schema Break**: Create a product missing the 'price' field.
11. **Type Mismatch**: Create an order where 'quantity' is a string.
12. **PII Leak**: Try to read the `orders` collection without being the admin.

## Test Runner (Logic Verification)
See `firestore.rules.test.ts` (conceptual).
