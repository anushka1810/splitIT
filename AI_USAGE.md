# AI Usage Log

This document details how AI was used as a primary development collaborator to build the SplitIT app, including key prompts and instances where the AI generated incorrect logic that had to be caught and corrected.

## AI Tools Used
- **Antigravity (Google DeepMind)**: Advanced agentic coding assistant used as the primary pair-programmer.

## Key Prompts Used
1. *"The CSV has 12+ deliberate errors. Instead of a silent import or failing, I want a 4-Tier Import Dashboard. Tier 1 auto-fixes, Tier 2 defaults, Tier 3 bulk maps, and Tier 4 pauses for individual user review. Build the backend importAnalyzer.js to flag these."*
2. *"Tier 4 anomalies need to be resolved individually. Build interactive React components for 'Conflicting Duplicates' (show a diff), 'Missing Payer' (dropdown), and 'Percentage Issues' (live math validation)."*
3. *"The user 'Sam' moved in mid-April. If he is charged for a March expense, flag it as 'Member Left/Joined Conflict' and allow the user to remove his share."*

## Instances Where AI Was Wrong & How I Fixed It

### 1. Blindly Defaulting Split Types to EQUAL
**What the AI did:** The AI built a beautiful frontend UI for `Percentage` and `Exact` splits, allowing the user to correctly balance the math. However, the AI's backend `handleCommit` function was hardcoded to `splitType: 'EQUAL'` and threw away all the resolved exact amounts before saving to Prisma.
**How I caught it:** While reviewing the API payload for the commit endpoint, I noticed `participants` only contained an array of `userIds` without their corresponding `shareValue`.
**What I changed:** I rewrote the backend `/imports/commit` endpoint and the frontend `handleCommit` payload to map and securely pass `shareValue`, preserving the exact mathematical ratios resolved by the user.

### 2. Assuming `share` Was a Natively Supported Database Enum
**What the AI did:** The AI completely ignored the `split_type = share` rows (e.g., Aisha 1, Rohan 2) during the import analysis because it assumed the database could just save "shares" naturally.
**How I caught it:** I checked the Prisma schema and realized `SplitType` only supported `EQUAL`, `EXACT`, and `PERCENTAGE`. Saving a "share" split would crash the database or default to EQUAL, destroying the financial accuracy.
**What I changed:** I instructed the AI to build a new `ShareResolverCard` in Tier 4. This intercepts the "share" split, mathematically converts the shares into `EXACT` Rupee amounts on the frontend, and allows the user to approve the exact monetary breakdown before saving it as an `EXACT` split.

### 3. Misclassifying Direct Payments (Settlements)
**What the AI did:** The AI detected disguised settlements like "Rohan paid Aisha back ₹5000" but just warned the user and then imported it into the `Expenses` table with everyone in the group.
**How I caught it:** If a direct payment is saved as a shared expense, the math completely breaks (the app thinks Aisha owes a fraction of the payment Rohan made to her).
**What I changed:** I forced the AI to build a separate `resolveToSettlement` function. When the user clicks "Record as Direct Payment", the row bypasses the `Expenses` table completely and is instead routed directly to `prisma.settlement.create`, ensuring balances perfectly offset.
