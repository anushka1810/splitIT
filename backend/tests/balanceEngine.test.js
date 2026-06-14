const { calculateGroupBalances, calculateIndividualBreakdown } = require('../utils/balanceEngine');

describe('Balance Engine', () => {
    
    const mockMembers = [
        { userId: 1, user: { name: 'Rohan' } },
        { userId: 2, user: { name: 'Priya' } },
        { userId: 3, user: { name: 'Dev' } }
    ];

    describe('calculateGroupBalances', () => {
        test('EQUAL split among all 3 members', () => {
            const expenses = [{
                id: 1,
                amount: 300,
                splitType: 'EQUAL',
                payerId: 1, // Rohan paid 300
                participants: [
                    { userId: 1 },
                    { userId: 2 },
                    { userId: 3 }
                ]
            }];

            const balances = calculateGroupBalances(expenses, mockMembers);
            
            // Everyone owes 100
            // Rohan: paid 300, owes 100 -> +200
            // Priya: paid 0, owes 100 -> -100
            // Dev: paid 0, owes 100 -> -100

            const rohan = balances.find(b => b.userId === 1);
            const priya = balances.find(b => b.userId === 2);
            const dev = balances.find(b => b.userId === 3);

            expect(rohan.netBalance).toBe(200);
            expect(priya.netBalance).toBe(-100);
            expect(dev.netBalance).toBe(-100);
        });

        test('EXACT split', () => {
            const expenses = [{
                id: 2,
                amount: 500,
                splitType: 'EXACT',
                payerId: 2, // Priya paid 500
                participants: [
                    { userId: 1, shareValue: 150 }, // Rohan owes 150
                    { userId: 2, shareValue: 50 },  // Priya owes 50
                    { userId: 3, shareValue: 300 }  // Dev owes 300
                ]
            }];

            const balances = calculateGroupBalances(expenses, mockMembers);

            const rohan = balances.find(b => b.userId === 1);
            const priya = balances.find(b => b.userId === 2);
            const dev = balances.find(b => b.userId === 3);

            expect(rohan.netBalance).toBe(-150);
            expect(priya.netBalance).toBe(450); // paid 500 - owes 50 = +450
            expect(dev.netBalance).toBe(-300);
        });

        test('PERCENTAGE split', () => {
            const expenses = [{
                id: 3,
                amount: 1000,
                splitType: 'PERCENTAGE',
                payerId: 3, // Dev paid 1000
                participants: [
                    { userId: 1, shareValue: 25 }, // Rohan 25% = 250
                    { userId: 2, shareValue: 25 }, // Priya 25% = 250
                    { userId: 3, shareValue: 50 }  // Dev 50% = 500
                ]
            }];

            const balances = calculateGroupBalances(expenses, mockMembers);

            const rohan = balances.find(b => b.userId === 1);
            const priya = balances.find(b => b.userId === 2);
            const dev = balances.find(b => b.userId === 3);

            expect(rohan.netBalance).toBe(-250);
            expect(priya.netBalance).toBe(-250);
            expect(dev.netBalance).toBe(500); // paid 1000 - owes 500 = +500
        });

        test('Mixed expense scenarios', () => {
            const expenses = [
                {
                    id: 1, amount: 300, splitType: 'EQUAL', payerId: 1,
                    participants: [{ userId: 1 }, { userId: 2 }, { userId: 3 }] // 100 each
                },
                {
                    id: 2, amount: 200, splitType: 'EXACT', payerId: 2,
                    participants: [{ userId: 1, shareValue: 200 }] // Rohan owes 200
                }
            ];

            const balances = calculateGroupBalances(expenses, mockMembers);
            
            // Rohan: paid 300 (exp1), owes 100 (exp1) + 200 (exp2) = 300. Net: 0
            // Priya: paid 200 (exp2), owes 100 (exp1). Net: +100
            // Dev: paid 0, owes 100 (exp1). Net: -100

            const rohan = balances.find(b => b.userId === 1);
            const priya = balances.find(b => b.userId === 2);
            const dev = balances.find(b => b.userId === 3);

            expect(rohan.netBalance).toBe(0);
            expect(priya.netBalance).toBe(100);
            expect(dev.netBalance).toBe(-100);
        });
    });

    describe('calculateIndividualBreakdown', () => {
        test('Returns detailed breakdown for a user', () => {
            const expenses = [
                {
                    id: 1, description: 'Lunch', amount: 300, splitType: 'EQUAL', payerId: 1,
                    payer: { name: 'Rohan' },
                    participants: [{ userId: 1 }, { userId: 2 }, { userId: 3 }]
                },
                {
                    id: 2, description: 'Cab', amount: 200, splitType: 'EXACT', payerId: 2,
                    payer: { name: 'Priya' },
                    participants: [{ userId: 1, shareValue: 200 }]
                }
            ];

            const breakdown = calculateIndividualBreakdown(1, { name: 'Rohan' }, expenses);

            expect(breakdown.user.name).toBe('Rohan');
            expect(breakdown.totalPaid).toBe(300); // Paid for Lunch
            expect(breakdown.totalOwed).toBe(300); // Owes 100 for Lunch, 200 for Cab
            expect(breakdown.netBalance).toBe(0);

            expect(breakdown.breakdown).toHaveLength(2);
            
            // Expense 1: Lunch
            expect(breakdown.breakdown[0].impact).toBe(200); // Paid 300 - Owes 100
            
            // Expense 2: Cab
            expect(breakdown.breakdown[1].impact).toBe(-200); // Paid 0 - Owes 200
        });
    });
});
