const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function edit(file, fn) {
  const p = path.join(root, file); let s = fs.readFileSync(p, 'utf8'); const n = fn(s);
  if (n !== s) fs.writeFileSync(p, n);
}
edit('server.js', s => {
  if (!s.includes("require('./routes/operations')")) s = s.replace("const platformRoutes = require('./routes/platform');", "const platformRoutes = require('./routes/platform');\nconst operationsRoutes = require('./routes/operations');");
  if (!s.includes("app.use('/api/operations', operationsRoutes);")) s = s.replace("app.use('/api/platform', platformRoutes);", "app.use('/api/platform', platformRoutes);\napp.use('/api/operations', operationsRoutes);");
  return s;
});
console.log('Operations completion patch applied.');
