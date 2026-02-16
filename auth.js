const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    // Postman mein 'Header' se token nikalna
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).send("No token, entry denied!");
    }

    try {
        const decoded = jwt.verify(token, 'SecretKey123');
        req.user = decoded.id;
        next(); // Sab sahi hai, aage badho
    } catch (err) {
        res.status(401).send("Token galat hai!");
    }
};