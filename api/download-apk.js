const RELEASE_API = 'https://api.github.com/repos/markchtechcomputers/manlung-recovery-flow-ui-fixed/releases/tags/android-latest';
const DIRECT_APK_URL = 'https://github.com/markchtechcomputers/manlung-recovery-flow-ui-fixed/releases/download/android-latest/ManlungRecovery.apk';

module.exports = async function downloadApk(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  // Prefer GitHub release metadata, but never make the download depend on the
  // GitHub API being available or under its unauthenticated rate limit.
  try {
    const response = await fetch(RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Manlung-Recovery-APK-Download'
      },
      cache: 'no-store'
    });

    if (response.ok) {
      const release = await response.json();
      const asset = Array.isArray(release.assets)
        ? release.assets.find(item => item && item.name === 'ManlungRecovery.apk' && item.state === 'uploaded')
        : null;

      if (asset && asset.browser_download_url) {
        res.setHeader('Location', asset.browser_download_url);
        return res.status(302).end();
      }
    } else {
      console.warn('Manlung APK release metadata returned HTTP', response.status, '- trying the stable asset URL');
    }
  } catch (error) {
    console.warn('Manlung APK metadata lookup failed; trying the stable asset URL:', error);
  }

  // The stable URL is also used by the homepage and Android release workflow.
  // This fallback avoids showing a false temporary-unavailable message when
  // GitHub's metadata API is throttled or briefly unreachable.
  res.setHeader('Location', DIRECT_APK_URL);
  return res.status(302).end();
};
