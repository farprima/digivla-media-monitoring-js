const jwt = require('jsonwebtoken');

// 1. Checks if the user is logged in (valid JWT in Authorization header)
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization; // Expected: "Bearer <token>"

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verifies signature & expiration, then attaches payload (e.g., { id, role }) to req.user
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
};

// 2. Checks if the logged-in user has one of the allowed roles
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };