const express = require('express');
const aiRouter = require('../routes/ai');

const app = express();

// Vercel's standalone function does not use the main Express app's body parser.
// Parse JSON here before forwarding requests to the AI router.
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  const url = String(req.url || '/');
  // Vercel may invoke the function with either the public route or the
  // destination filename. Normalize both forms for the Express router.
  req.url = url
    .replace(/^\/api\/ai\.js(?=\/|\?|$)/, '')
    .replace(/^\/api\/ai(?=\/|\?|$)/, '') || '/';
  next();
});

app.use('/', aiRouter);

module.exports = app;
