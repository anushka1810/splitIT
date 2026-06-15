# Decision Log

This document explains the major technical and design decisions we made while building the SplitIT CSV Import system. It explains *why* we chose to do things the way we did.

## 1. The 4-Tier Import System
**The Problem:** CSV files are messy. If we just blindly import them, the database gets corrupted. If we just throw an error and reject the whole file, the user gets frustrated.
**Options Considered:**
1. **Strict Reject:** Reject the whole file if there is even one error. (Too frustrating for users).
2. **Silent Ignore:** Skip bad rows and only import the good ones. (Causes users to lose data without knowing).
3. **Interactive 4-Tier System:** Fix what we can automatically, ask for bulk help, and then show interactive cards for critical issues.
**Our Decision:** We chose the **Interactive 4-Tier System**. It provides the best user experience. We fix the easy stuff (like commas in numbers) so the user isn't annoyed, but we FORCE the user to manually review high-risk money issues (like negative amounts or missing payers) using beautiful UI cards.

## 2. Handling Settlements vs. Shared Expenses
**The Problem:** People often log "Rohan paid Aisha back ₹5000" inside their expense CSVs. If we save this as an Expense, it gets split among the group, which is mathematically wrong.
**Options Considered:**
1. **Keep as Expense:** Leads to double counting and ruined balances.
2. **Delete it:** Data loss.
3. **Route to Settlement Table:** Detect these rows and save them directly as a "Direct Payment" between two people.
**Our Decision:** We chose to **Route to Settlement Table**. Our `importAnalyzer` scans the description for words like "paid back". It then shows a UI card asking the user to confirm. Once confirmed, it bypasses the `Expenses` table completely and saves directly to the `Settlements` table.

## 3. Handling Unrecognised Members (Guests)
**The Problem:** The CSV contains names of people who are not registered in the group (e.g., "Dev's friend Kabir").
**Options Considered:**
1. **Auto-create accounts for them:** Bad idea. We don't have their email or permission.
2. **Block the whole row:** Too restrictive.
3. **Re-assign their share:** Let the user assign the guest's financial burden to an existing member.
**Our Decision:** We chose to **Re-assign their share**. The user gets a dropdown menu where they can say "Assign Kabir's share to Dev". This keeps the group membership clean while ensuring the math still balances perfectly.

## 4. Handling "Share" Split Types (e.g. 1:2:1)
**The Problem:** The CSV uses `split_type = share` (Aisha pays 1 share, Rohan pays 2 shares). But our database only supports `EQUAL`, `EXACT`, and `PERCENTAGE`.
**Options Considered:**
1. **Change the database schema:** Add "SHARE" to the database. (Too much backend refactoring).
2. **Force it to EQUAL:** Destroys the custom math (Data loss).
3. **Convert Shares to EXACT amounts:** Do the math on the frontend and save it as Rupee amounts.
**Our Decision:** We chose to **Convert Shares to EXACT amounts**. The frontend takes the total amount, divides it by the total shares, and shows the exact Rupee amount for each person. When the user clicks Save, we store it in the database as an `EXACT` split.

## 5. Conflicting Duplicates
**The Problem:** The CSV has two rows for the exact same event, but with different amounts (e.g. "Dinner 2400" vs "Dinner 2450").
**Options Considered:**
1. **Auto-delete the older one:** Might delete the correct one.
2. **Show a diff comparison:** Show both rows side-by-side so the user can see the conflict.
**Our Decision:** We chose to **Show a diff comparison**. The UI highlights both rows in a single card, allowing the user to click "Keep This Version" on the correct one, safely discarding the mistake.
