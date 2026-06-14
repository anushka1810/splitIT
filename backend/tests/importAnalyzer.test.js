const { analyzeImport } = require('../utils/importAnalyzer');

describe('4-Tier Import Analyzer Engine', () => {
    const mockMembers = [
        { userId: 1, user: { name: 'Aisha' }, joinedAt: new Date('2023-01-01'), leftAt: null },
        { userId: 2, user: { name: 'Rohan' }, joinedAt: new Date('2023-01-01'), leftAt: null },
        { userId: 3, user: { name: 'Priya' }, joinedAt: new Date('2023-01-01'), leftAt: null },
        { userId: 4, user: { name: 'Meera' }, joinedAt: new Date('2023-01-01'), leftAt: new Date('2023-03-31') },
        { userId: 5, user: { name: 'Sam' }, joinedAt: new Date('2023-04-15'), leftAt: null },
    ];

    test('Tier 1: Auto-fixes commas, case mismatch, precision, redundant details', () => {
        const rows = [
            { date: '01-02-2026', description: 'Test', amount: '1,200.555', payer: 'priya ', split_type: 'equal', split_details: 'Aisha 1; Rohan 1', currency: 'INR' },
            { date: 'Mar-14', description: 'Test', amount: '100', payer: 'Rohan', split_type: 'equal', currency: 'INR' } // A02 nonstandard date
        ];

        const result = analyzeImport(rows, mockMembers);
        const cleanRow1 = result.clean[0];
        expect(cleanRow1.amount).toBe(1200.56); // Stripped comma + rounded
        expect(cleanRow1.payer).toBe('Priya'); // Fuzzy matched case mismatch + trailing space
        expect(cleanRow1.splitDetails).toBe(''); // Redundant details cleared

        const cleanRow2 = result.clean[1];
        expect(cleanRow2.date.getTime()).toBe(new Date('2026-03-14').getTime()); // Parsed Mar-14 to date
    });

    test('Tier 2: Missing currency defaults to INR', () => {
        const rows = [
            { date: '15-03-2026', description: 'Groceries', amount: '2105', payer: 'Aisha' }
        ];

        const result = analyzeImport(rows, mockMembers);
        expect(result.tier2).toHaveLength(1);
        expect(result.clean).toHaveLength(1);
        expect(result.clean[0].currency).toBe('INR');
    });

    test('Tier 3: Bulk review for unknown name and foreign currency', () => {
        const rows = [
            { date: '15-03-2026', description: 'Test', amount: '100', payer: 'Priya Sharma', currency: 'INR' }, // A08
            { date: '09-03-2026', description: 'Goa', amount: '540', payer: 'Aisha', currency: 'USD' } // A09
        ];

        const result = analyzeImport(rows, mockMembers);
        expect(result.tier3.unknownNames).toHaveLength(1);
        expect(result.tier3.foreignCurrency).toHaveLength(1);
        expect(result.clean).toHaveLength(0);
    });

    test('Tier 4: Missing Payer, Settlements, Zero, Negative, Guests', () => {
        const rows = [
            { date: '15-03-2026', description: 'Test', amount: '100', payer: '', currency: 'INR' }, // A10 Missing payer
            { date: '15-03-2026', description: 'Rohan paid Aisha back', amount: '500', payer: 'Rohan', currency: 'INR' }, // A11 Settlement
            { date: '15-03-2026', description: 'Refund', amount: '-30', payer: 'Rohan', currency: 'INR' }, // A17 Negative
            { date: '15-03-2026', description: 'Mistake', amount: '0', payer: 'Rohan', currency: 'INR' }, // A18 Zero
            { date: '15-03-2026', description: 'Trip', amount: '100', payer: 'Rohan', split_with: 'Aisha; Rohan; Kabir', currency: 'INR' } // A14 Guest
        ];

        const result = analyzeImport(rows, mockMembers);
        expect(result.tier4.missingPayer).toHaveLength(1);
        expect(result.tier4.settlements).toHaveLength(1);
        expect(result.tier4.negativeAmounts).toHaveLength(1);
        expect(result.tier4.zeroAmounts).toHaveLength(1);
        expect(result.tier4.guests).toHaveLength(1);
        expect(result.clean).toHaveLength(0);
    });

    test('Tier 4: Duplicates (Exact vs Conflicting)', () => {
        const rows = [
            { date: '08-02-2026', description: 'Dinner at Marina Bites', amount: '3200', payer: 'Aisha', split_with: 'Aisha; Priya; Rohan' }, // Original
            { date: '08-02-2026', description: 'dinner - marina bites', amount: '3200', payer: 'Aisha', split_with: 'Aisha; Priya; Rohan' }, // Exact Duplicate
            { date: '11-03-2026', description: 'Dinner at Thalassa', amount: '2400', payer: 'Aisha', split_with: 'Aisha; Priya; Rohan' }, // Conflict 1
            { date: '11-03-2026', description: 'Dinner at Thalassa', amount: '2450', payer: 'Rohan', split_with: 'Aisha; Priya; Rohan' } // Conflict 2
        ];

        const result = analyzeImport(rows, mockMembers);
        expect(result.tier4.exactDuplicates).toHaveLength(1); // The second Marina Bites
        expect(result.tier4.conflictingDuplicates).toHaveLength(1); // The second Thalassa dinner
        // The first of each goes to clean (if no other anomalies)
        expect(result.clean).toHaveLength(2);
    });
});
