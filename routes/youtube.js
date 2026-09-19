const express = require('express');
const ytSearch = require('yt-search');
const axios = require('axios');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

function cleanQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

// Admin-only YouTube discovery API.
// Playback stays on YouTube's official embed player; this endpoint does not
// download or proxy copyrighted audio/video.
router.get('/search', adminAuth, async (req, res) => {
  const query = cleanQuery(req.query.q);

  if (!query) {
    return res.status(400).json({ success: false, error: 'Enter a song, artist, or video to search.' });
  }

  if (query.length < 2) {
    return res.status(400).json({ success: false, error: 'Search must contain at least 2 characters.' });
  }

  try {
    let videos = [];
    try {
      const result = await ytSearch(query);
      videos = Array.isArray(result?.videos) ? result.videos : [];
    } catch (searchError) {
      console.error('yt-search failed:', searchError?.message || searchError);
    }

    // Fallback: YouTube's public search page is useful when yt-search is
    // temporarily blocked or its upstream response changes.
    if (!videos.length) {
      try {
        const page = await axios.get('https://www.youtube.com/results', {
          params: { search_query: query },
          headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36',
            'accept-language': 'en-US,en;q=0.9',
          },
          timeout: 10000,
        });

        const html = String(page.data || '');
        const marker = 'var ytInitialData = ';
        const start = html.indexOf(marker);
        const end = start === -1 ? -1 : html.indexOf(';</script>', start + marker.length);
        const match = start !== -1 && end !== -1 ? html.slice(start + marker.length, end) : null;
        if (match) {
          const data = JSON.parse(match);
          const renderers = [];
          const walk = (node) => {
            if (!node || typeof node !== 'object') return;
            if (node.videoRenderer) renderers.push(node.videoRenderer);
            Object.values(node).forEach(walk);
          };
          walk(data);
          videos = renderers.slice(0, 20).map((v) => ({
            title: { text: v.title?.runs?.[0]?.text || v.title?.simpleText || '' },
            videoId: v.videoId,
            url: v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : '',
            thumbnail: v.thumbnail?.thumbnails?.at(-1)?.url || '',
            views: Number(String(v.viewCountText?.simpleText || '').replace(/[^0-9]/g, '')) || 0,
            duration: v.lengthText?.simpleText || 'Live',
            ago: v.publishedTimeText?.simpleText || '',
            author: { name: v.ownerText?.runs?.[0]?.text || '' },
          }));
        }
      } catch (fallbackError) {
        console.error('YouTube fallback search failed:', fallbackError?.message || fallbackError);
      }
    }

    const songs = videos
      .filter((video) => video && video.videoId && video.title)
      .slice(0, 20)
      .map((video) => ({
        title: String(video.title),
        id: String(video.videoId),
        url: String(video.url || `https://www.youtube.com/watch?v=${video.videoId}`),
        thumbnail: String(video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`),
        views: Number.isFinite(Number(video.views)) ? Number(video.views) : 0,
        duration: video.duration?.toString?.() || 'Live',
        published: video.ago || video.uploadDate || '',
        author: video.author?.name || video.author?.channelName || '',
      }));

    res.set('Cache-Control', 'private, max-age=30');
    return res.json({ success: true, query, songs });
  } catch (error) {
    console.error('Admin YouTube search error:', error);
    return res.status(502).json({
      success: false,
      error: 'YouTube search is temporarily unavailable. Please try again.',
    });
  }
});

module.exports = router;
