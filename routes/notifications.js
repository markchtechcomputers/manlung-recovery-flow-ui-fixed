const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const Notification = require('../models/Notification');
const CaseTimeline = require('../models/CaseTimeline');
const Case = require('../models/Case');

router.get('/', auth, async (req, res) => {
  try {
    const notifications =
      await Notification.listForUser(req.user.id);

    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error('Notification list error:', error);

    res.status(500).json({
      success: false,
      error: 'Could not load notifications.',
    });
  }
});

router.get('/unread-count', auth, async (req, res) => {
  try {
    const count =
      await Notification.unreadCount(req.user.id);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Notification count error:', error);

    res.status(500).json({
      success: false,
      error: 'Could not load notification count.',
    });
  }
});

router.post('/:id/read', auth, async (req, res) => {
  try {
    const notification =
      await Notification.markRead(
        req.params.id,
        req.user.id
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found.',
      });
    }

    res.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('Notification read error:', error);

    res.status(500).json({
      success: false,
      error: 'Could not mark notification as read.',
    });
  }
});

router.post('/read-all', auth, async (req, res) => {
  try {
    await Notification.markAllRead(req.user.id);

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('Notification read-all error:', error);

    res.status(500).json({
      success: false,
      error: 'Could not mark notifications as read.',
    });
  }
});

router.get('/case/:caseId/timeline', auth, async (req, res) => {
  try {
    const caseRow =
      await Case.findByCaseId(req.params.caseId);

    if (!caseRow) {
      return res.status(404).json({
        success: false,
        error: 'Case not found.',
      });
    }

    const isOwner =
      req.user.role === 'client' &&
      caseRow.client_user_id === req.user.id;

    const isPrivileged =
      req.user.role === 'admin' ||
      req.user.role === 'owner';

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this case timeline.',
      });
    }

    const timeline =
      await CaseTimeline.listForCase(
        req.params.caseId
      );

    res.json({
      success: true,
      timeline,
    });
  } catch (error) {
    console.error('Case timeline error:', error);

    res.status(500).json({
      success: false,
      error: 'Could not load case timeline.',
    });
  }
});

module.exports = router;
