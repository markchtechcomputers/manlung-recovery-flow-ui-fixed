const RELEASE_API = 'https://api.github.com/repos/markchtechcomputers/manlung-recovery-flow-ui-fixed/releases/tags/android-latest';

module.exports = async function downloadApk(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  try {
    const response = await fetch(RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Manlung-Recovery-APK-Download'
      },
      cache: 'no-store'
    });

    if (!response.ok) throw new Error('Release metadata unavailable (' + response.status + ')');

    const release = await response.json();
    const asset = Array.isArray(release.assets)
      ? release.assets.find(item => item && item.name === 'ManlungRecovery.apk' && item.state === 'uploaded')
      : null;

    if (!asset || !asset.browser_download_url) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(503).send('The latest Android APK is not published yet. Please try again shortly.');
    }

    res.setHeader('Location', asset.browser_download_url);
    return res.status(302).end();
  } catch (error) {
    console.error('Manlung APK download redirect failed:', error);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(503).send('The APK download is temporarily unavailable. Please try again shortly.');
  }
};
