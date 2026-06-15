# Import Report

**Status:** Completed Successfully
**File Processed:** `expenses_export.csv`
**Total Rows Parsed:** 42

Here is a simple summary of every problem the system detected during the import, and exactly how it was handled to keep your group balances perfect.

## ✅ Automatically Fixed (No Action Required)
These issues were handled silently in the background.
- **Row 6:** Stripped comma from amount `1,200` to `1200`.
- **Row 8:** Matched lowercase name `priya` to existing user `Priya`.
- **Row 26:** Successfully converted weird date `Mar-14` to standard format.
- **Row 27:** Added missing currency (defaulted to `INR`).
- **Row 41:** Safely ignored redundant share details because the split type was already marked as `EQUAL`.

## 🛠️ Bulk Mapped 
These issues were resolved using your bulk mapping rules.
- **Row 10:** Mapped unknown user `Priya S` to the registered account `Priya`.
- **Goa Trip Rows:** Detected `USD` currency and successfully converted to `INR` using the global exchange rate you provided.

## ⚠️ Manually Resolved (Tier 4 Decisions)
These were critical issues that required your explicit approval.

| Issue | Found In | Your Decision | Action Taken |
| :--- | :--- | :--- | :--- |
| **Exact Duplicate** | Rows 4 & 5 | *Keep One* | Deleted Row 5 to prevent double-charging for "Dinner at Marina Bites". |
| **Missing Payer** | Row 12 | *Assign Payer* | Assigned "House cleaning supplies" to Rohan. |
| **Disguised Settlement** | Row 13 | *Record as Direct Payment* | Bypassed the expenses table. Saved "Rohan paid Aisha back" directly to the Settlements ledger. |
| **Percentage Math Error** | Rows 14 & 31 | *Save Adjusted Percentages* | Corrected the percentages so they perfectly equaled 100% before saving. |
| **Share-Based Split** | Row 21 | *Convert to EXACT* | Converted custom shares (1:2:1:2) into exact Rupee amounts. |
| **Guest in Split** | Row 22 | *Assign Share* | Re-assigned "Kabir's" share of the bill to Dev's account since Kabir is not in the group. |
| **Conflicting Duplicates** | Rows 23 & 24 | *Keep This Version* | Kept Row 23 (Dinner at Thalassa ₹2400) and safely dropped the duplicate Row 24. |
| **Negative Amount** | Row 25 | *Confirm Refund* | Flagged the -30 USD as a refund to correctly credit the payer. |
| **Zero Amount** | Row 30 | *Discard Row* | Dropped the ₹0 "Dinner order Swiggy" row. |
| **Ambiguous Date** | Row 33 | *Select Date* | Clarified `04-05-2026` as May 4th, 2026. |
| **Member Left** | Row 35 | *Remove Them* | Safely removed Meera from the April expense since she moved out in March. |
| **Deposit as Expense** | Row 37 | *Record as Direct Payment* | Rerouted "Sam deposit share" to the Settlements ledger to prevent messing up monthly expense totals. |

---
**Summary:** 
Your database is clean. No corrupt data was imported, no balances were artificially inflated, and all missing data was successfully mapped.
