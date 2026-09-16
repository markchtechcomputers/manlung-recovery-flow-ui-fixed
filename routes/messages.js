const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const {
  auth,
  adminAuth,
} = require('../middleware/auth');

const Case = require('../models/Case');
const User = require('../models/User');
const CaseMessage = require('../models/CaseMessage');
const CaseTimeline = require('../models/CaseTimeline');
const Notification = require('../models/Notification');

function validateMessage(req, res) {
  const message = String(req.body.message || '').trim();

  if (!message) {
    res.status(400).json({
      success: false,
      error: 'Message is required.',
    });
    return false;
  }

  if (message.length > 5000) {
    res.status(400).json({
      success: false,
      error: 'Message must be 5000 characters or fewer.',
    });
    return false;
  }

  req.body.message = message;
  return true;
}

function canAdminAccessCase(caseRow, user) {
  if (user.role === 'owner') return true;

  return (
    user.role === 'admin' &&
    caseRow.assigned_admin_id === user.id
  );
}

async function getOwnerUser() {
  const admins = await User.listAdminsAndOwner();
  return admins.find((user) => user.role === 'owner') || null;
}

async function getCaseParticipant(caseRow, user) {
  if (user.role === 'client') {
    if (caseRow.client_user_id !== user.id) {
      return {
        allowed: false,
      };
    }

    if (caseRow.assigned_admin_id) {
      const investigator =
        await User.findById(caseRow.assigned_admin_id);

      return {
        allowed: true,
        recipient: investigator,
      };
    }

    const owner = await getOwnerUser();

    return {
      allowed: true,
      recipient: owner,
    };
  }

  if (canAdminAccessCase(caseRow, user)) {
    const client =
      await User.findById(caseRow.client_user_id);

    return {
      allowed: true,
      recipient: client,
    };
  }

  return {
    allowed: false,
  };
}

router.get('/case/:caseId', auth, async (req, res) => {
  try {
    const caseRow =
      await Case.findByCaseId(req.params.caseId);

    if (!caseRow) {
      return res.status(404).json({
        success: false,
        error: 'Case not found.',
      });
    }

    const access =
      await getCaseParticipant(
        caseRow,
        req.user
      );

    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this case conversation.',
      });
    }

    const messages =
      await CaseMessage.listForCase(
        req.params.caseId
      );

    res.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('Case message list error:', error);

    res.status(500).json({
      success: false,
      error: 'Could not load case messages.',
    });
  }
});

router.post(
  '/case/:caseId',
  auth,
  [body('message').trim().notEmpty()],
  async (req, res) => {
    try {
      if (!validateMessage(req, res)) return;

      const caseRow =
        await Case.findByCaseId(req.params.caseId);

      if (!caseRow) {
        return res.status(404).json({
          success: false,
          error: 'Case not found.',
        });
      }

      const access =
        await getCaseParticipant(
          caseRow,
          req.user
        );

      if (!access.allowed) {
        return res.status(403).json({
          success: false,
          error: 'You are not authorized to message this case.',
        });
      }

      if (!access.recipient?.id) {
        return res.status(409).json({
          success: false,
          error:
            'No investigator is currently assigned to this case.',
        });
      }

      const created =
        await CaseMessage.create({
          caseId: req.params.caseId,
          senderUserId: req.user.id,
          recipientUserId: access.recipient.id,
          message: req.body.message,
        });

      await CaseTimeline.create({
        caseId: req.params.caseId,
        actorUserId: req.user.id,
        eventType: 'message_sent',
        description: 'A new case message was sent.',
        metadata: {
          messageId: created.id,
        },
      });

      await Notification.create({
        userId: access.recipient.id,
        caseId: req.params.caseId,
        type: 'new_message',
        title: 'New case message',
        message:
          `You have a new message for case ${req.params.caseId}.`,
      });

      res.json({
        success: true,
        message: created,
      });
    } catch (error) {
      console.error('Case message send error:', error);

      res.status(500).json({
        success: false,
        error:
          error.message ||
          'Could not send case message.',
      });
    }
  }
);

router.post('/:messageId/read', auth, async (req, res) => {
  try {
    const updated =
      await CaseMessage.markRead(
        req.params.messageId,
        req.user.id
      );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Message not found.',
      });
    }

    res.json({
      success: true,
      message: updated,
    });
  } catch (error) {
    console.error('Case message read error:', error);

    res.status(500).json({
      success: false,
      error: 'Could not mark message as read.',
    });
  }
});

router.get('/unread-count', auth, async (req, res) => {
  try {
    const count =
      await CaseMessage.unreadCount(
        req.user.id
      );

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Case message count error:', error);

    res.status(500).json({
      success: false,
      error: 'Could not load message count.',
    });
  }
});

module.exports = router;
