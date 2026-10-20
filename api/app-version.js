const RELEASE_API = 'https://api.github.com/repos/markchtechcomputers/manlung-recovery-flow-ui-fixed/releases/tags/android-latest';

module.exports = async function appVersion(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const response = await fetch(RELEASE_API, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Manlung-Recovery-Android-Update-Checker'
      },
      cache: 'no-store'
    });

    if (!response.ok) throw new Error('Release metadata unavailable (' + response.status + ')');

    const release = await response.json();
    const asset = Array.isArray(release.assets)
      ? release.assets.find(item => item && item.name === 'ManlungRecovery.apk')
      : null;
    if (!asset || !asset.browser_download_url) {
      return res.status(503).json({ success: false, error: 'Latest APK is not available yet' });
    }

    const notes = String(release.body || '');
    const versionCodeMatch = notes.match(/^Version-Code:\s*(\d+)\s*$/im);
    const versionNameMatch = notes.match(/^Version-Name:\s*([^\r\n]+)\s*$/im);
    const migrationMatch = notes.match(/^Signing-Migration:\s*(true|required)\s*$/im);
    const digestMatch = String(asset.digest || '').match(/^sha256:([a-f0-9]{64})$/i);

    return res.status(200).json({
      success: true,
      versionCode: versionCodeMatch ? Number(versionCodeMatch[1]) : null,
      versionName: versionNameMatch ? versionNameMatch[1].trim() : null,
      requiresReinstall: Boolean(migrationMatch),
      updatedAt: asset.updated_at || asset.created_at || release.updated_at || null,
      downloadUrl: asset.browser_download_url,
      sha256: digestMatch ? digestMatch[1].toLowerCase() : null,
      releaseUrl: release.html_url || 'https://github.com/markchtechcomputers/manlung-recovery-flow-ui-fixed/releases/tag/android-latest'
    });
  } catch (error) {
    console.error('Manlung Android update metadata failed:', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ success: false, error: 'Could not check Android updates right now' });
  }
};
