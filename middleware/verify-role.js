const verifyRole = (roles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(403).send({ success: false, message: 'No role found in token' });
    }

    // roles can be a string or an array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).send({ 
        success: false, 
        message: 'Access denied! You do not have permission to perform this action' 
      });
    }

    next();
  };
};

module.exports = verifyRole;
