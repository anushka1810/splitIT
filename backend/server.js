const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const prisma = require('./prismaClient');
const authenticateToken = require('./middleware/auth');
const { calculateGroupBalances, calculateIndividualBreakdown } = require('./utils/balanceEngine');

// Transporter setup for sending emails
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register API
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields (name, email, password) are required.' });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        // Validate duplicate emails
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword
            }
        });

        // Return user info (excluding password)
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                createdAt: newUser.createdAt
            }
        });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Login API
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        // If user not found
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Return token and user details (excluding password)
        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Protected route example — requires a valid Bearer token
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true, createdAt: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json({ user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Forgot Password API
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Return success even if user not found to prevent email enumeration
            return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        await prisma.user.update({
            where: { email },
            data: { resetToken, resetTokenExpiry }
        });

        const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request',
            html: `<p>You requested a password reset. Click the link below to set a new password:</p>
                   <p><a href="${resetLink}">${resetLink}</a></p>
                   <p>If you did not request this, please ignore this email.</p>`
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    } catch (error) {
        console.error('Error in forgot-password:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Reset Password API
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long.' });

        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        res.status(200).json({ message: 'Password reset successfully.' });
    } catch (error) {
        console.error('Error in reset-password:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// =======================
// GROUP MANAGEMENT APIs
// =======================

// Create a new group
app.post('/api/groups', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Group name is required.' });

        const newGroup = await prisma.group.create({
            data: {
                name,
                createdBy: req.user.id,
                members: {
                    create: { userId: req.user.id } // Automatically add creator as member
                }
            },
            include: {
                members: true
            }
        });

        res.status(201).json({ message: 'Group created successfully.', group: newGroup });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get all groups for the authenticated user
app.get('/api/groups', authenticateToken, async (req, res) => {
    try {
        const groups = await prisma.group.findMany({
            where: {
                members: {
                    some: {
                        userId: req.user.id,
                        leftAt: null // Only active memberships
                    }
                }
            },
            include: {
                creator: { select: { id: true, name: true, email: true } },
                _count: { select: { members: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ groups });
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get a specific group by ID
app.get('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);

        const group = await prisma.group.findFirst({
            where: {
                id: groupId,
                members: {
                    some: {
                        userId: req.user.id,
                        leftAt: null
                    }
                }
            },
            include: {
                creator: { select: { id: true, name: true, email: true } },
                members: {
                    include: { user: { select: { id: true, name: true, email: true } } }
                }
            }
        });

        if (!group) return res.status(404).json({ error: 'Group not found or access denied.' });

        res.status(200).json({ group });
    } catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Update a group
app.put('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const { name } = req.body;

        if (!name) return res.status(400).json({ error: 'Group name is required.' });

        const group = await prisma.group.findUnique({ where: { id: groupId } });

        if (!group) return res.status(404).json({ error: 'Group not found.' });
        if (group.createdBy !== req.user.id) return res.status(403).json({ error: 'Only the creator can edit the group.' });

        const updatedGroup = await prisma.group.update({
            where: { id: groupId },
            data: { name }
        });

        res.status(200).json({ message: 'Group updated successfully.', group: updatedGroup });
    } catch (error) {
        console.error('Error updating group:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Delete a group
app.delete('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);

        const group = await prisma.group.findUnique({ where: { id: groupId } });

        if (!group) return res.status(404).json({ error: 'Group not found.' });
        if (group.createdBy !== req.user.id) return res.status(403).json({ error: 'Only the creator can delete the group.' });

        await prisma.group.delete({ where: { id: groupId } });

        res.status(200).json({ message: 'Group deleted successfully.' });
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// =======================
// MEMBERSHIP TIMELINE APIs
// =======================

// Add a member to a group
app.post('/api/groups/:groupId/members', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const { email } = req.body;

        if (!email) return res.status(400).json({ error: 'User email is required.' });

        // 1. Check if the requester is part of this group (creator or active member)
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: { where: { leftAt: null } } }
        });

        if (!group) return res.status(404).json({ error: 'Group not found.' });

        const isAuthorized = group.createdBy === req.user.id || group.members.some(m => m.userId === req.user.id);
        if (!isAuthorized) return res.status(403).json({ error: 'You are not authorized to add members to this group.' });

        // 2. Find the user to add
        const userToAdd = await prisma.user.findUnique({ where: { email } });
        if (!userToAdd) return res.status(404).json({ error: 'User not found.' });

        // 3. Check if user is already an active member
        const activeMembership = await prisma.groupMember.findFirst({
            where: {
                groupId,
                userId: userToAdd.id,
                leftAt: null
            }
        });

        if (activeMembership) {
            return res.status(400).json({ error: 'User is already an active member of this group.' });
        }

        // 4. Add the user (creates a new row to preserve timeline if they joined multiple times)
        const newMember = await prisma.groupMember.create({
            data: {
                groupId,
                userId: userToAdd.id,
                joinedAt: new Date()
            },
            include: { user: { select: { id: true, name: true, email: true } } }
        });

        res.status(201).json({ message: 'Member added successfully.', member: newMember });
    } catch (error) {
        console.error('Error adding member:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Remove a member from a group (Updates leftAt)
app.patch('/api/groups/:groupId/members/:memberId/remove', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const memberId = parseInt(req.params.memberId); // This is the userId

        // 1. Check authorization (creator or self)
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) return res.status(404).json({ error: 'Group not found.' });

        const isAuthorized = group.createdBy === req.user.id || req.user.id === memberId;
        if (!isAuthorized) return res.status(403).json({ error: 'Not authorized to remove this member.' });

        // 2. Find active membership
        const activeMembership = await prisma.groupMember.findFirst({
            where: {
                groupId,
                userId: memberId,
                leftAt: null
            }
        });

        if (!activeMembership) {
            return res.status(404).json({ error: 'Active membership not found for this user.' });
        }

        // 3. Update leftAt (do not delete row)
        await prisma.groupMember.update({
            where: { id: activeMembership.id },
            data: { leftAt: new Date() }
        });

        res.status(200).json({ message: 'Member removed successfully.' });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get members timeline data
app.get('/api/groups/:groupId/members', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);

        // Check if requester has access
        const groupAccess = await prisma.group.findFirst({
            where: {
                id: groupId,
                OR: [
                    { createdBy: req.user.id },
                    { members: { some: { userId: req.user.id } } } // Allow access if they ever were a member
                ]
            }
        });

        if (!groupAccess) return res.status(403).json({ error: 'Access denied.' });

        // Fetch all membership records
        const membersRecords = await prisma.groupMember.findMany({
            where: { groupId },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { joinedAt: 'asc' }
        });

        const currentMembers = membersRecords.filter(m => m.leftAt === null);
        const formerMembers = membersRecords.filter(m => m.leftAt !== null);

        // Build chronological timeline history
        let membershipHistory = [];
        membersRecords.forEach(record => {
            membershipHistory.push({
                type: 'joined',
                date: record.joinedAt,
                userName: record.user.name,
                message: `${record.user.name} joined the group`
            });

            if (record.leftAt) {
                membershipHistory.push({
                    type: 'left',
                    date: record.leftAt,
                    userName: record.user.name,
                    message: `${record.user.name} left the group`
                });
            }
        });

        // Sort timeline by date
        membershipHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({
            currentMembers,
            formerMembers,
            membershipHistory
        });
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// =======================
// EXPENSE MANAGEMENT APIs
// =======================

// Create an expense
app.post('/api/groups/:groupId/expenses', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const { description, amount, currency, expenseDate, splitType, notes, payerId, participants } = req.body;

        // General Validations
        if (!description || !amount || !currency || !expenseDate || !splitType || !payerId || !participants) {
            return res.status(400).json({ error: 'All required fields must be provided.' });
        }
        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than zero.' });
        }

        // Verify group access and payer membership
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: { where: { leftAt: null } } } // active members
        });

        if (!group) return res.status(404).json({ error: 'Group not found.' });
        
        const isRequesterMember = group.members.some(m => m.userId === req.user.id) || group.createdBy === req.user.id;
        if (!isRequesterMember) return res.status(403).json({ error: 'Access denied.' });

        const isPayerMember = group.members.some(m => m.userId === payerId);
        if (!isPayerMember) return res.status(400).json({ error: 'Payer must be an active group member.' });

        // Split Logic Validation
        let validatedParticipants = [];
        if (splitType === 'EQUAL') {
            const splitAmount = amount / participants.length;
            validatedParticipants = participants.map(p => ({
                userId: p.userId,
                shareValue: null // Keep null for EQUAL to calculate dynamically on frontend
            }));
        } else if (splitType === 'EXACT') {
            const totalExact = participants.reduce((sum, p) => sum + (p.shareValue || 0), 0);
            if (Math.abs(totalExact - amount) > 0.01) { // Floating point tolerance
                return res.status(400).json({ error: 'Sum of exact amounts must equal total expense amount.' });
            }
            validatedParticipants = participants.map(p => ({ userId: p.userId, shareValue: p.shareValue }));
        } else if (splitType === 'PERCENTAGE') {
            const totalPercent = participants.reduce((sum, p) => sum + (p.shareValue || 0), 0);
            if (Math.abs(totalPercent - 100) > 0.01) {
                return res.status(400).json({ error: 'Sum of percentages must equal 100.' });
            }
            validatedParticipants = participants.map(p => ({ userId: p.userId, shareValue: p.shareValue }));
        } else {
            return res.status(400).json({ error: 'Invalid split type.' });
        }

        // Create Expense and Participants in a transaction
        const newExpense = await prisma.$transaction(async (tx) => {
            const expense = await tx.expense.create({
                data: {
                    description,
                    amount,
                    currency,
                    expenseDate: new Date(expenseDate),
                    splitType,
                    notes,
                    groupId,
                    payerId,
                    createdBy: req.user.id
                }
            });

            await tx.expenseParticipant.createMany({
                data: validatedParticipants.map(p => ({
                    expenseId: expense.id,
                    userId: p.userId,
                    shareValue: p.shareValue
                }))
            });

            return expense;
        });

        res.status(201).json({ message: 'Expense created successfully.', expense: newExpense });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get all expenses for a group
app.get('/api/groups/:groupId/expenses', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        
        const groupAccess = await prisma.group.findFirst({
            where: {
                id: groupId,
                OR: [
                    { createdBy: req.user.id },
                    { members: { some: { userId: req.user.id } } }
                ]
            }
        });
        if (!groupAccess) return res.status(403).json({ error: 'Access denied.' });

        const expenses = await prisma.expense.findMany({
            where: { groupId },
            include: {
                payer: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true } },
                participants: {
                    include: { user: { select: { id: true, name: true } } }
                }
            },
            orderBy: { expenseDate: 'desc' }
        });

        res.status(200).json({ expenses });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get specific expense
app.get('/api/expenses/:expenseId', authenticateToken, async (req, res) => {
    try {
        const expenseId = parseInt(req.params.expenseId);

        const expense = await prisma.expense.findUnique({
            where: { id: expenseId },
            include: {
                group: { include: { members: true } },
                payer: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true } },
                participants: {
                    include: { user: { select: { id: true, name: true } } }
                }
            }
        });

        if (!expense) return res.status(404).json({ error: 'Expense not found.' });

        const isAuthorized = expense.group.createdBy === req.user.id || expense.group.members.some(m => m.userId === req.user.id);
        if (!isAuthorized) return res.status(403).json({ error: 'Access denied.' });

        res.status(200).json({ expense });
    } catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Update expense
app.put('/api/expenses/:expenseId', authenticateToken, async (req, res) => {
    try {
        const expenseId = parseInt(req.params.expenseId);
        const { description, amount, currency, expenseDate, splitType, notes, payerId, participants } = req.body;

        const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
        if (!expense) return res.status(404).json({ error: 'Expense not found.' });

        // Only creator or payer can edit
        if (expense.createdBy !== req.user.id && expense.payerId !== req.user.id) {
            return res.status(403).json({ error: 'Only the creator or payer can edit this expense.' });
        }

        // Split Logic Validation (Same as creation)
        let validatedParticipants = [];
        if (splitType === 'EQUAL') {
            validatedParticipants = participants.map(p => ({ userId: p.userId, shareValue: null }));
        } else if (splitType === 'EXACT') {
            const totalExact = participants.reduce((sum, p) => sum + (p.shareValue || 0), 0);
            if (Math.abs(totalExact - amount) > 0.01) return res.status(400).json({ error: 'Sum of exact amounts must equal total expense amount.' });
            validatedParticipants = participants.map(p => ({ userId: p.userId, shareValue: p.shareValue }));
        } else if (splitType === 'PERCENTAGE') {
            const totalPercent = participants.reduce((sum, p) => sum + (p.shareValue || 0), 0);
            if (Math.abs(totalPercent - 100) > 0.01) return res.status(400).json({ error: 'Sum of percentages must equal 100.' });
            validatedParticipants = participants.map(p => ({ userId: p.userId, shareValue: p.shareValue }));
        }

        // Transaction to delete old participants and insert new, while updating expense
        await prisma.$transaction(async (tx) => {
            await tx.expenseParticipant.deleteMany({ where: { expenseId } });
            
            await tx.expense.update({
                where: { id: expenseId },
                data: {
                    description, amount, currency, splitType, notes, payerId,
                    expenseDate: new Date(expenseDate)
                }
            });

            await tx.expenseParticipant.createMany({
                data: validatedParticipants.map(p => ({
                    expenseId, userId: p.userId, shareValue: p.shareValue
                }))
            });
        });

        res.status(200).json({ message: 'Expense updated successfully.' });
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Delete expense
app.delete('/api/expenses/:expenseId', authenticateToken, async (req, res) => {
    try {
        const expenseId = parseInt(req.params.expenseId);

        const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
        if (!expense) return res.status(404).json({ error: 'Expense not found.' });

        if (expense.createdBy !== req.user.id && expense.payerId !== req.user.id) {
            return res.status(403).json({ error: 'Only the creator or payer can delete this expense.' });
        }

        await prisma.expense.delete({ where: { id: expenseId } });
        res.status(200).json({ message: 'Expense deleted successfully.' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// =======================
// BALANCE ENGINE APIs
// =======================

// Get all balances for a group
app.get('/api/groups/:groupId/balances', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);

        // Verify group access
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: { include: { user: true } } }
        });

        if (!group) return res.status(404).json({ error: 'Group not found.' });

        const isMember = group.members.some(m => m.userId === req.user.id) || group.createdBy === req.user.id;
        if (!isMember) return res.status(403).json({ error: 'Access denied.' });

        // Fetch all expenses involving the group
        const expenses = await prisma.expense.findMany({
            where: { groupId },
            include: { participants: true }
        });

        // Fetch all settlements involving the group
        const settlements = await prisma.settlement.findMany({
            where: { groupId }
        });

        // Use pure utility
        const balances = calculateGroupBalances(expenses, settlements, group.members);

        res.status(200).json({ members: balances });
    } catch (error) {
        console.error('Error fetching group balances:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get individual detailed balance breakdown
app.get('/api/groups/:groupId/balances/:userId', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const targetUserId = parseInt(req.params.userId);

        // Verify group access
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: { include: { user: true } } }
        });

        if (!group) return res.status(404).json({ error: 'Group not found.' });

        const isMember = group.members.some(m => m.userId === req.user.id) || group.createdBy === req.user.id;
        if (!isMember) return res.status(403).json({ error: 'Access denied.' });

        const targetUser = group.members.find(m => m.userId === targetUserId)?.user;
        if (!targetUser) return res.status(404).json({ error: 'User is not a member of this group.' });

        // Fetch all expenses involving the group
        const expenses = await prisma.expense.findMany({
            where: { groupId },
            include: { 
                payer: { select: { name: true } },
                participants: true 
            },
            orderBy: { expenseDate: 'desc' }
        });

        // Fetch all settlements involving the group
        const settlements = await prisma.settlement.findMany({
            where: { groupId },
            include: {
                payer: { select: { name: true } },
                receiver: { select: { name: true } }
            }
        });

        // Use pure utility
        const breakdown = calculateIndividualBreakdown(targetUserId, targetUser, expenses, settlements);

        res.status(200).json(breakdown);
    } catch (error) {
        console.error('Error fetching individual balance breakdown:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// =======================
// SETTLEMENT APIs
// =======================

// Create a settlement
app.post('/api/groups/:groupId/settlements', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const { amount, settlementDate, notes, payerId, receiverId } = req.body;

        if (!amount || !settlementDate || !payerId || !receiverId) {
            return res.status(400).json({ error: 'All required fields must be provided.' });
        }
        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than zero.' });
        }
        if (payerId === receiverId) {
            return res.status(400).json({ error: 'Payer and receiver cannot be the same person.' });
        }
        if (new Date(settlementDate) > new Date()) {
            return res.status(400).json({ error: 'Settlement date cannot be in the future.' });
        }

        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: { where: { leftAt: null } } }
        });

        if (!group) return res.status(404).json({ error: 'Group not found.' });

        const isRequesterMember = group.members.some(m => m.userId === req.user.id) || group.createdBy === req.user.id;
        if (!isRequesterMember) return res.status(403).json({ error: 'Access denied.' });

        const isPayerMember = group.members.some(m => m.userId === payerId);
        const isReceiverMember = group.members.some(m => m.userId === receiverId);
        if (!isPayerMember || !isReceiverMember) {
            return res.status(400).json({ error: 'Both payer and receiver must be active group members.' });
        }

        const settlement = await prisma.settlement.create({
            data: {
                amount,
                settlementDate: new Date(settlementDate),
                notes,
                groupId,
                payerId,
                receiverId,
                createdBy: req.user.id
            }
        });

        res.status(201).json({ message: 'Settlement created successfully.', settlement });
    } catch (error) {
        console.error('Error creating settlement:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get all settlements for a group
app.get('/api/groups/:groupId/settlements', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        
        const groupAccess = await prisma.group.findFirst({
            where: {
                id: groupId,
                OR: [
                    { createdBy: req.user.id },
                    { members: { some: { userId: req.user.id } } }
                ]
            }
        });
        if (!groupAccess) return res.status(403).json({ error: 'Access denied.' });

        const settlements = await prisma.settlement.findMany({
            where: { groupId },
            include: {
                payer: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true } }
            },
            orderBy: { settlementDate: 'desc' }
        });

        res.status(200).json({ settlements });
    } catch (error) {
        console.error('Error fetching settlements:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get specific settlement
app.get('/api/settlements/:settlementId', authenticateToken, async (req, res) => {
    try {
        const settlementId = parseInt(req.params.settlementId);

        const settlement = await prisma.settlement.findUnique({
            where: { id: settlementId },
            include: {
                group: { include: { members: true } },
                payer: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true } }
            }
        });

        if (!settlement) return res.status(404).json({ error: 'Settlement not found.' });

        const isAuthorized = settlement.group.createdBy === req.user.id || settlement.group.members.some(m => m.userId === req.user.id);
        if (!isAuthorized) return res.status(403).json({ error: 'Access denied.' });

        res.status(200).json({ settlement });
    } catch (error) {
        console.error('Error fetching settlement:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Update settlement
app.put('/api/settlements/:settlementId', authenticateToken, async (req, res) => {
    try {
        const settlementId = parseInt(req.params.settlementId);
        const { amount, settlementDate, notes, payerId, receiverId } = req.body;

        const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
        if (!settlement) return res.status(404).json({ error: 'Settlement not found.' });

        if (settlement.createdBy !== req.user.id && settlement.payerId !== req.user.id && settlement.receiverId !== req.user.id) {
            return res.status(403).json({ error: 'Only the creator, payer, or receiver can edit this settlement.' });
        }

        if (amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero.' });
        if (payerId === receiverId) return res.status(400).json({ error: 'Payer and receiver cannot be the same person.' });
        if (new Date(settlementDate) > new Date()) return res.status(400).json({ error: 'Settlement date cannot be in the future.' });

        await prisma.settlement.update({
            where: { id: settlementId },
            data: {
                amount,
                settlementDate: new Date(settlementDate),
                notes,
                payerId,
                receiverId
            }
        });

        res.status(200).json({ message: 'Settlement updated successfully.' });
    } catch (error) {
        console.error('Error updating settlement:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Delete settlement
app.delete('/api/settlements/:settlementId', authenticateToken, async (req, res) => {
    try {
        const settlementId = parseInt(req.params.settlementId);

        const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
        if (!settlement) return res.status(404).json({ error: 'Settlement not found.' });

        if (settlement.createdBy !== req.user.id && settlement.payerId !== req.user.id && settlement.receiverId !== req.user.id) {
            return res.status(403).json({ error: 'Only the creator, payer, or receiver can delete this settlement.' });
        }

        await prisma.settlement.delete({ where: { id: settlementId } });
        res.status(200).json({ message: 'Settlement deleted successfully.' });
    } catch (error) {
        console.error('Error deleting settlement:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.listen(3000, () => {
    console.log(`Server running on port 3000`);
});

// Prevent silent crashes — log and keep the process alive
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

module.exports = app; 