const fs = require('fs');

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) return false;
  fs.writeFileSync(path, after);
  console.log(`patched ${path}`);
  return true;
}

let changed = false;

if (patch('server.js', (s) => {
  if (!s.includes("const platformRoutes = require('./routes/platform');")) {
    s = s.replace("const careerRoutes = require('./routes/careers');", "const careerRoutes = require('./routes/careers');\nconst platformRoutes = require('./routes/platform');");
  }
  if (!s.includes("app.use('/api/platform', platformRoutes);")) {
    s = s.replace("app.use('/api/careers', careerRoutes);", "app.use('/api/careers', careerRoutes);\napp.use('/api/platform', platformRoutes);");
  }
  return s;
})) changed = true;

if (patch('routes/auth.js', (s) => {
  s = s.replace(
    "{ id: user.id, role: user.role, mfa: ['admin', 'owner'].includes(user.role) ? Boolean(user.mfa_enabled) : undefined },",
    "{ id: user.id, role: user.role, sessionVersion: Number(user.session_version || 0), mfa: ['admin', 'owner'].includes(user.role) ? Boolean(user.mfa_enabled) : undefined },"
  );

  const marker = "router.post('/admin/logout', (req, res) => {";
  if (!s.includes("router.post('/client/logout-all'")) {
    const insert = `router.post('/client/logout-all', auth, async (req, res) => {\n  try {\n    if (req.user.role !== 'client') return res.status(403).json({ error: 'Client access required.' });\n    await User.bumpSessionVersion(req.user.id);\n    res.json({ success: true, message: 'All client sessions have been revoked. Sign in again.' });\n  } catch (error) {\n    console.error('Client logout-all error:', error);\n    res.status(500).json({ success: false, error: 'Could not revoke sessions.' });\n  }\n});\n\n`;
    s = s.replace(marker, insert + marker);
  }
  return s;
})) changed = true;

console.log(changed ? 'Platform completion patch applied.' : 'Platform completion patch already applied.');
