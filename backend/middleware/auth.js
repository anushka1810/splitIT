const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development';

/**
 * JWT Authentication Middleware
 * Expects: Authorization: Bearer <token>
 * Attaches decoded user payload to req.user on success.
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // Check header exists and starts with "Bearer "
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, email, iat, exp }
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token has expired.' });
        }
        return res.status(403).json({ error: 'Invalid token.' });
    }
};

module.exports = authenticateToken;
