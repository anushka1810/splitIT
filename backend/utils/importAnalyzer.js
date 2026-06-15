const { parse, isValid } = require('date-fns');
const stringSimilarity = require('string-similarity');

function analyzeImport(rows, members, existingExpenses = []) {
    const results = {
        tier1: [], // Auto-fixed
        tier2: [], // Auto-defaulted
        tier3: { unknownNames: [], foreignCurrency: [] }, // Bulk
        tier4: {
            missingPayer: [],
            settlements: [],
            deposits: [],
            percentageIssues: [],
            shareIssues: [],
            guests: [],
            exactDuplicates: [],
            conflictingDuplicates: [],
            negativeAmounts: [],
            zeroAmounts: [],
            ambiguousDates: [],
            memberAfterLeave: []
        },
        clean: [] // No anomalies or auto-resolved (T1/T2)
    };

    const seenFingerprints = new Map();
    const memberNames = members.map(m => m.user.name);

    rows.forEach((row, index) => {
        const stdRow = {};
        for (const key in row) {
            stdRow[key.toLowerCase().trim()] = row[key];
        }

        let dateStr = stdRow['date'] || stdRow['expensedate'] || stdRow['timestamp'] || '';
        let desc = stdRow['description'] || stdRow['notes'] || stdRow['title'] || '';
        let amountStr = stdRow['amount'] || stdRow['cost'] || '';
        let currencyStr = stdRow['currency'] || '';
        let payerStr = stdRow['payer'] || stdRow['paid_by'] || stdRow['paid by'] || '';
        let splitType = stdRow['split_type'] || '';
        let splitWith = stdRow['split_with'] || '';
        let splitDetails = stdRow['split_details'] || '';
        let notes = stdRow['notes'] || '';

        const analyzedRow = {
            id: `row_${index + 2}`, // Account for header row in UI
            originalRow: row,
            logs: [] // Store auto-fix messages
        };

        // ==========================================
        // TIER 1: Auto-Fixes
        // ==========================================
        
        // A01: Comma in amount
        if (amountStr && String(amountStr).match(/^-?\d{1,3}(,\d{3})*(\.\d+)?$/)) {
            const cleanAmountStr = String(amountStr).replace(/,/g, '');
            if (cleanAmountStr !== String(amountStr)) {
                amountStr = cleanAmountStr;
                analyzedRow.logs.push(`Stripped commas from amount: ${row.amount} -> ${amountStr}`);
            }
        }

        // A02: Nonstandard date (e.g. Mar-14)
        if (dateStr && dateStr.match(/^[a-zA-Z]{3}-\d{2}$/)) {
            const parsed = parse(`${dateStr}-2026`, 'MMM-dd-yyyy', new Date());
            if (isValid(parsed)) {
                dateStr = `${String(parsed.getDate()).padStart(2, '0')}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${parsed.getFullYear()}`;
                analyzedRow.logs.push(`Parsed nonstandard date: ${row.date} -> ${dateStr}`);
            }
        }

        // Parse date for later use
        let parsedDate = null;
        if (dateStr) {
            const pd1 = parse(dateStr, 'dd-MM-yyyy', new Date());
            const pd2 = parse(dateStr, 'MM-dd-yyyy', new Date());
            if (isValid(pd1)) parsedDate = pd1;
            else if (isValid(pd2)) parsedDate = pd2;
        }

        // A03 & A04: Name case mismatch and trailing space
        if (payerStr && memberNames.length > 0) {
            const cleanPayer = String(payerStr).trim();
            const matches = stringSimilarity.findBestMatch(cleanPayer, memberNames);
            const bestMatch = matches.bestMatch;
            
            // If it's a very close match but not exact (e.g. lowercase or trailing space)
            if (bestMatch.rating > 0.85 && bestMatch.target !== payerStr) {
                payerStr = bestMatch.target;
                analyzedRow.logs.push(`Auto-fixed payer name: "${row.payer || row.paid_by}" -> "${payerStr}"`);
            }
        }

        // A05: Subunit precision
        let amountVal = parseFloat(String(amountStr).replace(/[^0-9.-]/g, ''));
        if (!isNaN(amountVal) && amountVal.toString().split('.')[1]?.length > 2) {
            amountVal = Math.round(amountVal * 100) / 100;
            analyzedRow.logs.push(`Rounded amount to 2 decimals: ${amountStr} -> ${amountVal}`);
            amountStr = amountVal.toString();
        }

        // A06: split_type = equal but share details present
        if (String(splitType).toLowerCase().trim() === 'equal' && splitDetails) {
            analyzedRow.logs.push(`Ignored redundant split details for EQUAL split.`);
            splitDetails = '';
            // update originalRow so downstream doesn't trip on it
            row.split_details = '';
        }

        if (analyzedRow.logs.length > 0) {
            // Push to tier1 summary early so it shows up even if it hits tier4 later
            results.tier1.push(analyzedRow);
        }

        // ==========================================
        // TIER 2: Auto Defaults (Run before Tier 4 returns)
        // ==========================================
        let isMissingCurrency = false;
        if (!currencyStr || String(currencyStr).trim() === '') {
            currencyStr = 'INR'; // default it
            isMissingCurrency = true;
        }

        // Update analyzed values
        analyzedRow.date = parsedDate;
        analyzedRow.description = desc;
        analyzedRow.amount = amountVal;
        analyzedRow.currency = currencyStr;
        analyzedRow.payer = payerStr;
        analyzedRow.splitType = splitType;
        analyzedRow.splitWith = splitWith;
        analyzedRow.splitDetails = splitDetails;
        analyzedRow.notes = notes;

        // ==========================================
        // TIER 4: Hard Blockers (Must return early)
        // ==========================================
        
        let hasTier4 = false;
        
        // A15 & A16: Duplicates
        if (parsedDate && !isNaN(amountVal) && desc) {
            const cleanDesc = desc.toLowerCase().trim();
            const sortedParticipants = splitWith ? splitWith.split(';').map(s=>s.trim()).sort().join(';') : '';
            
            // Generate fingerprints
            const exactFingerprint = `${parsedDate.getTime()}_${payerStr}_${amountVal}_${sortedParticipants}`;
            const eventFingerprint = `${parsedDate.getTime()}_${sortedParticipants}`; // Same event, diff payer/amount
            
            let isExact = seenFingerprints.has(exactFingerprint);
            let isConflicting = false;
            let conflictRef = null;

            if (!isExact) {
                for (const [key, val] of seenFingerprints.entries()) {
                    if (key.includes(eventFingerprint)) {
                        // Fuzzy description check: do they share a significant word?
                        const words1 = val.desc.split(/\s+/).filter(w => w.length > 3);
                        const words2 = cleanDesc.split(/\s+/).filter(w => w.length > 3);
                        const sharesWord = words1.some(w => words2.includes(w)) || val.desc === cleanDesc;
                        
                        if (sharesWord) {
                            isConflicting = true;
                            conflictRef = val;
                            break;
                        }
                    }
                }
            }

            if (isExact) {
                analyzedRow.conflictRef = seenFingerprints.get(exactFingerprint);
                results.tier4.exactDuplicates.push(analyzedRow);
                hasTier4 = true;
            } else if (isConflicting) {
                let diffs = [];
                if (payerStr !== conflictRef.payer) diffs.push(`Payer: ${conflictRef.payer} vs ${payerStr}`);
                if (amountVal !== conflictRef.amount) diffs.push(`Amount: ₹${conflictRef.amount} vs ₹${amountVal}`);
                analyzedRow.conflictDiff = diffs.join(' | ');
                analyzedRow.conflictRef = conflictRef;
                results.tier4.conflictingDuplicates.push(analyzedRow);
                hasTier4 = true;
            } else {
                seenFingerprints.set(exactFingerprint, { row: analyzedRow, desc: cleanDesc, payer: payerStr, amount: amountVal });
            }
        }

        // A18: Zero Amount
        if (amountVal === 0) {
            results.tier4.zeroAmounts.push(analyzedRow);
            hasTier4 = true;
        }

        // A10: Missing Payer
        if (!payerStr && amountVal !== 0) {
            results.tier4.missingPayer.push(analyzedRow);
            hasTier4 = true;
        }

        // A11: Settlement as Expense
        const settlementRegex = /(settlement|paid.*back|cleared.*debt|transfer|venmo|paytm|repay)/i;
        if (settlementRegex.test(desc) || settlementRegex.test(notes)) {
            if (!splitType || String(splitType).trim() === '') {
                analyzedRow.missingSplitType = true;
            }

            // Extract potential receiver
            const fullText = (desc + " " + notes).toLowerCase();
            let suggestedReceiver = null;
            for (const m of memberNames) {
                if (m.toLowerCase() !== (payerStr || '').toLowerCase() && fullText.includes(m.toLowerCase())) {
                    suggestedReceiver = m;
                    break;
                }
            }
            analyzedRow.suggestedReceiver = suggestedReceiver;

            // Distinguish A21 (Deposit)
            if (desc.toLowerCase().includes('deposit') || notes.toLowerCase().includes('deposit')) {
                results.tier4.deposits.push(analyzedRow);
            } else {
                results.tier4.settlements.push(analyzedRow);
            }
            hasTier4 = true;
        }

        // A12 & A13: Percentage not 100
        if (String(splitType).toLowerCase().trim() === 'percentage' && splitDetails) {
            const parts = splitDetails.split(';');
            let sum = 0;
            const breakdown = [];
            parts.forEach((p, idx) => {
                const match = p.match(/(\d+)%/);
                const pct = match ? parseInt(match[1]) : 0;
                sum += pct;
                const membersArr = splitWith ? splitWith.split(';').map(s=>s.trim()) : [];
                const mName = membersArr[idx] || `Member ${idx+1}`;
                breakdown.push({ member: mName, percentage: pct });
            });
            if (sum !== 100) {
                analyzedRow.percentageSum = sum;
                analyzedRow.percentageBreakdown = breakdown;
                results.tier4.percentageIssues.push(analyzedRow);
                hasTier4 = true;
            }
        }

        // A14: Guest in split
        if (splitWith && memberNames.length > 0) {
            const participants = splitWith.split(';').map(s=>s.trim());
            const unknownGuests = participants.filter(p => {
                const bestMatch = stringSimilarity.findBestMatch(p, memberNames).bestMatch;
                return bestMatch.rating < 0.6; // Not even close
            });
            if (unknownGuests.length > 0) {
                analyzedRow.guests = unknownGuests;
                results.tier4.guests.push(analyzedRow);
                hasTier4 = true;
            }
        }

        // A24: Share-based splits
        if (String(splitType).toLowerCase().trim() === 'share' && splitDetails) {
            const parts = splitDetails.split(';');
            let totalShares = 0;
            const breakdown = [];
            const membersArr = splitWith ? splitWith.split(';').map(m=>m.trim()) : [];
            
            parts.forEach((p, idx) => {
                const s = parseFloat(p.trim());
                if (!isNaN(s)) {
                    totalShares += s;
                    const mName = membersArr[idx] || `Member ${idx+1}`;
                    breakdown.push({ member: mName, shares: s });
                }
            });
            
            if (totalShares > 0) {
                analyzedRow.totalShares = totalShares;
                analyzedRow.shareBreakdown = breakdown;
                results.tier4.shareIssues = results.tier4.shareIssues || [];
                results.tier4.shareIssues.push(analyzedRow);
                hasTier4 = true;
            }
        }

        // A17: Negative Amount
        if (amountVal < 0) {
            results.tier4.negativeAmounts.push(analyzedRow);
            hasTier4 = true;
        }

        // A19: Ambiguous Date
        if (dateStr && dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
            const parts = dateStr.split('-');
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            // If note explicitly mentions format ambiguity
            if (notes.toLowerCase().includes('format') || notes.toLowerCase().includes('ambiguous')) {
                analyzedRow.dateOptions = [
                    `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${parts[2]}`,
                    `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${parts[2]}`
                ];
                analyzedRow.dateOptionsIso = [
                    `${parts[2]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                    `${parts[2]}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`
                ];
                results.tier4.ambiguousDates.push(analyzedRow);
                hasTier4 = true;
            }
        }

        // A20: Member After Leave
        if (parsedDate && splitWith && memberNames.length > 0) {
            const participants = splitWith.split(';').map(s=>s.trim());
            const timingIssues = members.filter(m => {
                if (!participants.includes(m.user.name)) return false;
                if (!m.leftAt) return false;
                const leftAt = new Date(m.leftAt);
                return parsedDate > leftAt;
            });

            if (timingIssues.length > 0) {
                analyzedRow.conflictingMembers = timingIssues.map(m => m.user.name);
                results.tier4.memberAfterLeave.push(analyzedRow);
                hasTier4 = true;
            }
        }

        if (hasTier4) return; // Wait for user resolution

        // ==========================================
        // TIER 3: Bulk Reviews
        // ==========================================
        
        let hasTier3 = false;

        // A08: Unknown Member Name (Payer)
        if (payerStr && memberNames.length > 0) {
            const bestMatch = stringSimilarity.findBestMatch(payerStr, memberNames).bestMatch;
            if (bestMatch.rating < 0.85 && bestMatch.rating >= 0.6) {
                analyzedRow.unknownPayer = payerStr;
                results.tier3.unknownNames.push(analyzedRow);
                hasTier3 = true;
            }
        }

        // A09: Foreign Currency
        const isUSD = String(currencyStr).toLowerCase().includes('usd') || String(amountStr).includes('$');
        if (isUSD) {
            results.tier3.foreignCurrency.push(analyzedRow);
            hasTier3 = true;
        }

        if (hasTier3) return;

        // Wait, if it blocked on Tier 4, we shouldn't push it to clean.
        results.clean.push(analyzedRow);
    });

    // Go over ALL rows in the original parameter to check if they were missing currency
    // so we can populate Tier 2 correctly even if they hit Tier 4.
    rows.forEach((row, idx) => {
        const stdRow = {};
        for (const key in row) {
            stdRow[key.toLowerCase().trim()] = row[key];
        }
        if (!stdRow['currency'] || String(stdRow['currency']).trim() === '') {
            // Find the analyzedRow
            const analyzed = [...results.clean, ...Object.values(results.tier4).flat(), ...results.tier3.unknownNames, ...results.tier3.foreignCurrency].find(r => r.id === `row_${idx + 2}`);
            if (analyzed && !results.tier2.find(r => r.id === analyzed.id)) {
                results.tier2.push(analyzed);
            }
        }
    });

    return results;
}

module.exports = { analyzeImport };
