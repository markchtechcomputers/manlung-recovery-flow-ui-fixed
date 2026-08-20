const fs = require('fs');
const path = require('path');

const routesDir = path.join(process.cwd(), 'routes');

const routeStart =
  /\brouter\.(get|post|put|patch|delete)\s*\(/;

const securityMiddleware =
  /\bauth\b|\badminAuth\b|\bownerAuth\b|require[A-Za-z]*Role|require[A-Za-z]*Permission/i;

const publicCandidates = new Set([
  'auth.js:45',
  'auth.js:217',
  'auth.js:372',
  'auth.js:517',
  'auth.js:775',
  'auth.js:1039',
  'auth.js:1149',
  'auth.js:1219',
  'auth.js:1323',
  'config.js:4',
  'careers.js:19',
  'donations.js:27',
  'donations.js:96',
  'donations.js:169',
  'donations.js:214',
  'subscription.js:195',
]);

function collectRouteBlock(lines, start) {
  let depth = 0;
  let seenOpenParen = false;
  const result = [];

  for (
    let i = start;
    i < lines.length && result.length < 80;
    i += 1
  ) {
    result.push(lines[i]);

    for (const char of lines[i]) {
      if (char === '(') {
        depth += 1;
        seenOpenParen = true;
      } else if (char === ')') {
        depth -= 1;
      }
    }

    if (seenOpenParen && depth <= 0) {
      break;
    }
  }

  return result.join('\n');
}

for (const file of fs
  .readdirSync(routesDir)
  .filter((name) => name.endsWith('.js'))) {

  const fullPath = path.join(routesDir, file);
  const lines =
    fs.readFileSync(fullPath, 'utf8')
      .split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const match =
      lines[i].match(routeStart);

    if (!match) continue;

    const method =
      match[1].toUpperCase();

    const location =
      `${file}:${i + 1}`;

    const block =
      collectRouteBlock(lines, i);

    const protectedRoute =
      securityMiddleware.test(block);

    const explicitlyPublic =
      publicCandidates.has(location);

    console.log(
      [
        location,
        method,
        protectedRoute
          ? 'PROTECTED'
          : explicitlyPublic
            ? 'PUBLIC-CANDIDATE'
            : 'REVIEW'
      ].join(' | ')
    );
  }
}
