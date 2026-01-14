const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Invalid token format' });
        }

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        // Attach user info to request
        // We use 'sub' as the stable user ID from Google
        req.user = {
            sub: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture
        };

        // Backwards compatibility for routes expecting req.auth.sub
        req.auth = { sub: payload.sub };

        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = verifyGoogleToken;
