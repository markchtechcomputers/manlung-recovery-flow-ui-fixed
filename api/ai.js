const aiRouter = require('../routes/ai');

// Vercel invokes this function directly. Strip the serverless function prefix
// so the Express router can match /chat and /site-context consistently.
module.exports = (req, res) => {
  const originalUrl = req.url;
  req.url = String(req.url || '').replace(/^\/api\/ai(?=\/|\?|$)/, '') || '/';
  aiRouter(req, res, () => {
    req.url = originalUrl;
    res.statusCode = 404;
    res.end('Not found');
  });
};
