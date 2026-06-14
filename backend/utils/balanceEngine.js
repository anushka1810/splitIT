/**
 * Calculates the total paid, total owed, and net balance for all members in a group.
 * 
 * @param {Array} expenses - Array of expense objects, including participants.
 * @param {Array} settlements - Array of settlement objects.
 * @param {Array} members - Array of group member objects.
 * @returns {Array} Array of user balance objects.
 */
function calculateGroupBalances(expenses, settlements = [], members) {
    const balances = {};

    // Initialize balances for all members
    members.forEach(member => {
        balances[member.userId] = {
            userId: member.userId,
            name: member.user.name,
            totalPaid: 0,
            totalOwed: 0,
            netBalance: 0
        };
    });

    expenses.forEach(expense => {
        const { amount, splitType, payerId, participants } = expense;

        // If the payer is part of the group, add to their totalPaid
        if (balances[payerId]) {
            balances[payerId].totalPaid += amount;
        }

        participants.forEach(p => {
            const userId = p.userId;
            if (!balances[userId]) return; // Skip if they left the group but we only fetched current members (depends on query)

            let share = 0;
            if (splitType === 'EQUAL') {
                share = amount / participants.length;
            } else if (splitType === 'EXACT') {
                share = parseFloat(p.shareValue) || 0;
            } else if (splitType === 'PERCENTAGE') {
                const percentage = parseFloat(p.shareValue) || 0;
                share = (percentage / 100) * amount;
            }

            balances[userId].totalOwed += share;
        });
    });

    // Store balances before settlements
    members.forEach(member => {
        balances[member.userId].balanceBeforeSettlements = parseFloat((balances[member.userId].totalPaid - balances[member.userId].totalOwed).toFixed(2));
    });

    // Apply Settlements
    settlements.forEach(settlement => {
        const { amount, payerId, receiverId } = settlement;
        
        // The payer of the settlement is reducing their debt (or increasing their credit)
        if (balances[payerId]) {
            balances[payerId].netBalance += amount;
            balances[payerId].totalPaid += amount;
        }
        
        // The receiver is getting paid back, reducing their credit
        if (balances[receiverId]) {
            balances[receiverId].netBalance -= amount;
            // From a purely "expenses" perspective, they aren't owing more, but their net drops.
            // We'll track settlements as part of totalPaid/totalOwed conceptually, or just adjust netBalance directly.
            // To keep math simple: payer paid money (+), receiver got money (-).
        }
    });

    // Calculate net balances and format output
    return Object.values(balances).map(b => {
        // Base net balance before settlements was totalPaid - totalOwed
        const baseNet = b.totalPaid - b.totalOwed;
        
        // Since we adjusted netBalance directly above for settlements, let's recalculate cleanly
        // Actually, we modified totalPaid. Let's reset and calculate cleanly.
        b.netBalance = (b.balanceBeforeSettlements || 0);
        
        // Re-apply settlements to netBalance
        settlements.forEach(s => {
            if (s.payerId === b.userId) b.netBalance += s.amount;
            if (s.receiverId === b.userId) b.netBalance -= s.amount;
        });

        b.totalPaid = parseFloat(b.totalPaid.toFixed(2));
        b.totalOwed = parseFloat(b.totalOwed.toFixed(2));
        b.netBalance = parseFloat(b.netBalance.toFixed(2));
        return b;
    });
}

/**
 * Calculates a detailed breakdown of a specific user's balance across all expenses.
 * 
 * @param {number} userId - The ID of the user.
 * @param {Object} user - The user object (for name).
 * @param {Array} expenses - Array of expense objects involving the group.
 * @param {Array} settlements - Array of settlement objects involving the group.
 * @returns {Object} Detailed breakdown object.
 */
function calculateIndividualBreakdown(userId, user, expenses, settlements = []) {
    let totalPaid = 0;
    let totalOwed = 0;
    const breakdown = [];

    expenses.forEach(expense => {
        const { id, description, amount, splitType, payer, payerId, participants } = expense;
        
        const participant = participants.find(p => p.userId === userId);
        const didPay = payerId === userId;
        
        // If user didn't pay and isn't a participant, this expense didn't affect them
        if (!participant && !didPay) return;

        let userShare = 0;
        if (participant) {
            if (splitType === 'EQUAL') {
                userShare = amount / participants.length;
            } else if (splitType === 'EXACT') {
                userShare = parseFloat(participant.shareValue) || 0;
            } else if (splitType === 'PERCENTAGE') {
                const percentage = parseFloat(participant.shareValue) || 0;
                userShare = (percentage / 100) * amount;
            }
        }

        const paidByMe = didPay ? amount : 0;
        const impact = paidByMe - userShare;

        totalPaid += paidByMe;
        totalOwed += userShare;

        breakdown.push({
            type: 'EXPENSE',
            id: id, // unique id for sorting/rendering
            date: expense.expenseDate,
            description,
            amount: parseFloat(amount.toFixed(2)),
            payer: payer.name,
            userShare: parseFloat(userShare.toFixed(2)),
            impact: parseFloat(impact.toFixed(2))
        });
    });

    settlements.forEach(settlement => {
        const { id, amount, notes, payerId, receiverId, payer, receiver, settlementDate } = settlement;
        
        if (payerId !== userId && receiverId !== userId) return;

        const isPayer = payerId === userId;
        const impact = isPayer ? amount : -amount;
        const description = isPayer ? `Paid ${receiver.name}` : `Received from ${payer.name}`;

        breakdown.push({
            type: 'SETTLEMENT',
            id: `s_${id}`,
            date: settlementDate,
            description: notes || description,
            amount: parseFloat(amount.toFixed(2)),
            payer: isPayer ? 'You' : payer.name,
            userShare: 0,
            impact: parseFloat(impact.toFixed(2))
        });
    });

    // Sort breakdown by date descending
    breakdown.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate final netBalance
    let netBalance = totalPaid - totalOwed;
    settlements.forEach(s => {
        if (s.payerId === userId) netBalance += s.amount;
        if (s.receiverId === userId) netBalance -= s.amount;
    });

    return {
        user: { id: userId, name: user.name },
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        totalOwed: parseFloat(totalOwed.toFixed(2)),
        netBalance: parseFloat(netBalance.toFixed(2)),
        breakdown
    };
}

module.exports = {
    calculateGroupBalances,
    calculateIndividualBreakdown
};
