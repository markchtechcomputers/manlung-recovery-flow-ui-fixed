};

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');


const ADMIN_COOKIE = 'manlung_admin_session';
const MFA_TICKET_EXPIRE = '5m';

// Owner identity is required for MFA management, but unlike ownerAuth it
// intentionally does not require MFA yet: the Owner must be able to turn MFA on.
const ownerIdentity = async (req, res, next) => {
  await auth(req, res, () => {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Owner access required' });
    }
    next();
  });
};

function setAdminCookie(res, token) {
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.PUBLIC_APP_URL?.startsWith('https://'),