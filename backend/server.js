const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const prisma = require('./prismaClient');
const authenticateToken = require('./middleware/auth');

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