# Project Scope & Anomaly Log

This document explains all the data problems we found in the CSV file and exactly how our system handles them. It also includes the simple database schema we used for this project.

## Part 1: The Anomaly Log (CSV Data Problems)

We found 19 different types of problems in the CSV file. Here is how our smart engine catches and fixes them:

### ⚡ Automatically Fixed (Tier 1 & 2)
These are minor issues that the system fixes silently behind the scenes.
1. **Amount Format Inconsistency (e.g., `1,200`):** System automatically removes commas so math doesn't break.
2. **Member Name Case Inconsistency (`priya` vs `Priya`):** System ignores upper/lower case and matches them smoothly.
3. **Invalid Date Format (`Mar-14`):** System converts all weird date formats into standard dates automatically.
4. **Missing Currency:** If currency is blank, the system safely defaults it to `INR` so the import doesn't crash.
5. **Split Type / Data Mismatch:** If split type says `equal` but share details are also given, the system safely ignores the extra share details.

### 🔄 Bulk Fixed (Tier 3)
These are problems that affect multiple rows. The system asks you once, and applies the fix everywhere.
6. **Member Name Variant (`Priya S` instead of `Priya`):** System flags unknown names and lets you map "Priya S" to the existing "Priya" account.
7. **Currency Conversion Problem (USD):** System finds all foreign currencies and asks you for one conversion rate to change them all to INR at once.

### 🛑 Manual Review Required (Tier 4)
These are critical financial issues. The system pauses the import and asks you to make a decision using interactive UI cards.
8. **Exact Duplicate Expense:** Detects identical rows. You can "Keep One", "Keep Both", or "Discard".
9. **Conflicting Duplicate Expenses:** Same event, but different amounts! System highlights the difference and asks you to pick the right one.
10. **Missing Payer:** Expense has no payer. System blocks import until you select a payer from a dropdown.
11. **Settlement Recorded as Expense:** Detects words like "paid back". It lets you "Record as Direct Payment" so it goes to the Settlements table, not Expenses.
12. **Deposit Treated as Expense:** Detects rent deposits. You can correctly reroute it as a direct payment.
13. **Percentage Split Validation:** Checks if percentages don't add up to 100%. Provides number boxes for you to fix the math before saving.
14. **Share-Based Split Type (`share`):** Since our DB doesn't support "shares" (like 1:2:1), the system mathematically converts shares into EXACT Rupee amounts for you to approve.
15. **Unknown Member (Guests):** Someone like "Kabir" is in the split but not in the group. You can reassign their share to a group member, or add them to the group.
16. **Negative Amount (`-30`):** Detects negative numbers. You can either flip it to positive or treat it as a refund.
17. **Zero Amount Expense:** Blocks ₹0 expenses. You must enter the real amount or discard the row.
18. **Ambiguous Date (`04-05-2026`):** Asks you to clarify if this means April 5th or May 4th.
19. **Member Left But Still Charged:** Detects if someone is charged for an expense *after* they moved out. You can choose to remove them from that split.

---

## Part 2: Database Schema

Here is the simple structure of how data is saved in our database.

**1. User**
- `id`: Unique ID
- `name`: User's full name
- `email`: User's email

**2. Group**
- `id`: Unique ID
- `name`: Group Name (e.g., "Goa Trip")
- `members`: List of Users in this group

**3. Expense (Shared Bills)**
- `id`: Unique ID
- `description`: What was bought (e.g., "Dinner")
- `amount`: Total bill amount
- `expenseDate`: Date of purchase
- `payerId`: Who paid the bill
- `splitType`: How it is split (EQUAL, EXACT, PERCENTAGE)
- `participants`: List of people involved in the split and their exact share amounts

**4. Settlement (Direct Payments)**
- `id`: Unique ID
- `amount`: Money transferred
- `settlementDate`: Date of payment
- `payerId`: Who sent the money
- `receiverId`: Who received the money
- *Note: This is separate from Expenses so we don't double-count!*
