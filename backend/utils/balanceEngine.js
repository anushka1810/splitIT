/**
 * Calculates the total paid, total owed, and net balance for all members in a group.
 * 
 * @param {Array} expenses - Array of expense objects, including participants.
 * @param {Array} members - Array of group member objects.
 * @returns {Array} Array of user balance objects.
 */
function calculateGroupBalances(expenses, members) {
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

    // Calculate net balances and format output
    return Object.values(balances).map(b => {
        b.netBalance = b.totalPaid - b.totalOwed;
        // Float precision fix
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
 * @returns {Object} Detailed breakdown object.
 */
function calculateIndividualBreakdown(userId, user, expenses) {
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
            expenseId: id,
            description,
            amount: parseFloat(amount.toFixed(2)),
            payer: payer.name,
            userShare: parseFloat(userShare.toFixed(2)),
            impact: parseFloat(impact.toFixed(2))
        });
    });

    const netBalance = totalPaid - totalOwed;

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
