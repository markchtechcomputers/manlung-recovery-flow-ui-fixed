const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Case = require('../models/Case');
const { auth } = require('../middleware/auth');
const AdminInvitation = require('../models/AdminInvitation');
const AdminPermission = require('../models/AdminPermission');
const { sendEmail } = require('../services/email');
const { supabase, EVIDENCE_BUCKET } = require('../config/supabase');

const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    }
  );

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

function checkValidation(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      error: errors.array()[0].msg,
    });
    return false;
  }

  return true;
}


// ============================================================
// ADMIN REGISTRATION
// Invitation required — clients cannot self-promote.
// ============================================================

router.post(
  '/admin/register',
  [
    body('token')
      .trim()
      .notEmpty()
      .withMessage('Invitation token is required'),

    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required')
      .isLength({ max: 200 }),

    body('username')
      .trim()
      .isLength({ min: 3, max: 80 })
      .withMessage('Username must be between 3 and 80 characters'),

    body('email')
      .trim()
      .isEmail()
      .withMessage('A valid email is required')
      .normalizeEmail(),

    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),

    body('phone')
      .optional()
      .trim()
      .isLength({ max: 40 }),
  ],
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    try {
      const invitation = await AdminInvitation.findValid(req.body.token);

      if (!invitation) {
        return res.status(400).json({
          error: 'This admin invitation is invalid or expired.',
        });
      }

      if (
        invitation.email.toLowerCase() !==
        req.body.email.toLowerCase()
      ) {
        return res.status(403).json({
          error:
            'This invitation was issued to a different email address.',
        });
      }

      if (await User.findByUsername(req.body.username)) {
        return res.status(409).json({
          error: 'Username already exists.',
        });
      }

      if (await User.findByEmail(req.body.email)) {
        return res.status(409).json({
          error: 'An account with this email already exists.',
        });
      }

      const admin = await User.createAdminFromInvitation({
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        phone: req.body.phone,
        invitationId: invitation.id,
        appointedBy: invitation.invited_by,
      });

      await AdminInvitation.accept(invitation.id);

      await AdminPermission.replace(
        admin.id,
        AdminPermission.DEFAULT_PERMISSIONS,
        invitation.invited_by
      );

      res.status(201).json({
        success: true,
        pendingApproval: true,
        message:
          'Admin account created. Wait for the Owner to approve your account.',
      });
    } catch (error) {
      console.error('Admin registration error:', error);

      res.status(500).json({
        error:
          error.message || 'Could not create admin account',
      });
    }
  }
);


// ============================================================
// ADMIN / OWNER LOGIN
// Login accepts either USERNAME or EMAIL.
// ============================================================

router.post(
  '/admin/login',
  [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username or email is required'),

    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    try {
      const login = req.body.username.trim();
      const password = req.body.password;

      let admin = null;

      // ------------------------------------------------------
      // First try username
      // ------------------------------------------------------

      admin = await User.findByUsername(login);

      // ------------------------------------------------------
      // If username was not found and login looks like email,
      // try email.
      // ------------------------------------------------------

      if (!admin && login.includes('@')) {
        admin = await User.findByEmail(login);
      }

      // ------------------------------------------------------
      // Bootstrap Owner
      //
      // If the Owner account does not exist yet, create it
      // ONLY when the submitted username matches
      // ADMIN_USERNAME.
      // ------------------------------------------------------

      if (
        !admin &&
        process.env.ADMIN_USERNAME &&
        login === process.env.ADMIN_USERNAME
      ) {
        if (!process.env.ADMIN_PASSWORD) {
          console.error(
            'ADMIN_PASSWORD environment variable is missing.'
          );

          return res.status(500).json({
            error: 'Owner account is not configured correctly.',
          });
        }

        admin = await User.create({
          username: process.env.ADMIN_USERNAME,
          password: process.env.ADMIN_PASSWORD,
          role: 'owner',
        });

        console.log(
          `Owner bootstrap account created: ${admin.username}`
        );
      }

      // ------------------------------------------------------
      // Account must be Admin or Owner
      // ------------------------------------------------------

      if (
        !admin ||
        (admin.role !== 'admin' && admin.role !== 'owner')
      ) {
        return res.status(401).json({
          error: 'Invalid credentials',
        });
      }

      // ------------------------------------------------------
      // Suspended / pending Admin accounts cannot log in.
      // Owner is not affected by admin_status.
      // ------------------------------------------------------

      if (
        admin.role === 'admin' &&
        admin.admin_status !== 'active'
      ) {
        if (admin.admin_status === 'pending') {
          return res.status(403).json({
            error:
              'Your Admin account is awaiting Owner approval.',
          });
        }

        return res.status(403).json({
          error:
            'Your admin access has been suspended. Contact the site owner.',
        });
      }

      // ------------------------------------------------------
      // Check password
      // ------------------------------------------------------

      const isMatch = await User.comparePassword(
        admin,
        password
      );

      if (!isMatch) {
        return res.status(401).json({
          error: 'Invalid credentials',
        });
      }

      // ------------------------------------------------------
      // Create JWT
      // ------------------------------------------------------

      const token = signToken(admin);

      console.log(
        `Admin/Owner login successful: ${admin.username} (${admin.role})`
      );

      return res.json({
        success: true,
        token,
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
        },
      });
    } catch (error) {
      console.error('Admin login error:', error);

      return res.status(500).json({
        error: error.message || 'Server error',
      });
    }
  }
);


// ============================================================
// CLIENT REGISTRATION
// ============================================================

router.post(
  '/client/register',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('A valid email is required')
      .normalizeEmail(),

    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),

    body('fullName')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .escape(),

    body('phone')
      .optional()
      .trim()
      .isLength({ max: 40 })
      .escape(),
  ],
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    try {
      const {
        fullName,
        email,
        phone,
        password,
      } = req.body;

      const existing = await User.findByEmail(email);

      if (existing) {
        return res.status(409).json({
          error:
            'An account with this email already exists',
        });
      }

      const client = await User.create({
        username: fullName || email.split('@')[0],
        email,
        phone,
        password,
        role: 'client',
      });

      const token = signToken(client);

      res.status(201).json({
        success: true,
        token,
        user: {
          id: client.id,
          email: client.email,
          username: client.username,
          role: client.role,
        },
      });
    } catch (error) {
      console.error('Client register error:', error);

      if (error.code === '23505') {
        return res.status(409).json({
          error:
            'An account with this email already exists',
        });
      }

      res.status(500).json({
        error: error.message || 'Server error',
      });
    }
  }
);


// ============================================================
// CLIENT LOGIN
// ============================================================

router.post(
  '/client/login',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('A valid email is required')
      .normalizeEmail(),

    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    try {
      const {
        email,
        password,
      } = req.body;

      const client =
        await User.findByEmailAndRole(email, 'client');

      if (!client) {
        return res.status(401).json({
          error: 'Invalid credentials',
        });
      }

      const isMatch =
        await User.comparePassword(client, password);

      if (!isMatch) {
        return res.status(401).json({
          error: 'Invalid credentials',
        });
      }

      const token = signToken(client);

      res.json({
        success: true,
        token,
        user: {
          id: client.id,
          email: client.email,
          username: client.username,
          role: client.role,
        },
      });
    } catch (error) {
      console.error('Client login error:', error);

      res.status(500).json({
        error: error.message || 'Server error',
      });
    }
  }
);



// ============================================================
// CLIENT OAUTH
// Google / GitHub / other Supabase OAuth providers
// ============================================================

router.post(
  '/client/oauth',
  [
    body('accessToken')
      .trim()
      .notEmpty()
      .withMessage('OAuth access token is required'),
  ],
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    try {
      const { supabase } = require('../config/supabase');

      const {
        data,
        error,
      } = await supabase.auth.getUser(
        req.body.accessToken
      );

      if (error || !data?.user) {
        return res.status(401).json({
          error: 'Social sign-in could not be verified.',
        });
      }

      const oauthUser = data.user;

      const email = String(
        oauthUser.email || ''
      ).trim().toLowerCase();

      if (!email) {
        return res.status(400).json({
          error:
            'Your social account did not provide an email address.',
        });
      }

      let client = await User.findByEmail(email);

      // Existing admin/owner accounts must never be converted
      // into client accounts through social sign-in.
      if (client && client.role !== 'client') {
        return res.status(403).json({
          error:
            'This social account is reserved for an admin or owner account.',
        });
      }

      const metadata = oauthUser.user_metadata || {};

      const fullName = String(
        metadata.full_name ||
        metadata.name ||
        metadata.user_name ||
        metadata.preferred_username ||
        email.split('@')[0]
      ).trim().slice(0, 200);

      const phone = String(
        metadata.phone || ''
      ).trim().slice(0, 40) || null;

      if (!client) {
        let username =
          fullName ||
          email.split('@')[0];

        const existingUsername =
          await User.findByUsername(username);

        if (existingUsername) {
          username =
            `${username}-${String(oauthUser.id).slice(0, 8)}`
              .slice(0, 80);
        }

        const randomPassword =
          crypto.randomBytes(32).toString('hex');

        client = await User.create({
          username,
          email,
          phone,
          password: randomPassword,
          role: 'client',
        });
      }

      const token = signToken(client);

      return res.json({
        success: true,
        token,
        user: {
          id: client.id,
          email: client.email,
          username: client.username,
          role: client.role,
        },
      });

    } catch (error) {
      console.error(
        'Client OAuth error:',
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          'Could not complete social sign-in.',
      });
    }
  }
);



// ============================================================
// CLIENT: Delete Own Account
// ============================================================

router.delete(
  '/client/account',
  auth,
  async (req, res) => {
    try {
      if (req.user.role !== 'client') {
        return res.status(403).json({
          error: 'Only client accounts can be deleted here.',
        });
      }

      const cases = await Case.findByClientUserId(req.user.id);

      const paths = [...new Set(
        cases.flatMap(c =>
          Array.isArray(c.files)
            ? c.files.map(f => f?.path).filter(Boolean)
            : []
        )
      )];

      if (paths.length) {
        const { error: storageError } =
          await supabase.storage
            .from(EVIDENCE_BUCKET)
            .remove(paths);

        if (storageError) {
          console.error(
            'Account deletion evidence cleanup failed:',
            storageError
          );

          return res.status(500).json({
            error:
              'Your account could not be deleted because some case files could not be removed.',
          });
        }
      }

      for (const caseRow of cases) {
        await Case.removeForClient(
          caseRow.case_id,
          req.user.id
        );
      }

      const deleted = await User.deleteById(req.user.id);

      if (!deleted) {
        return res.status(500).json({
          error: 'Account could not be deleted.',
        });
      }

      return res.json({
        success: true,
        message: 'Your account and your linked cases have been deleted.',
      });
    } catch (error) {
      console.error(
        'Client account deletion error:',
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          'Could not delete your account.',
      });
    }
  }
);


// ============================================================
// CLIENT FORGOT PASSWORD
// ============================================================

router.post(
  '/client/forgot-password',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('A valid email is required')
      .normalizeEmail(),
  ],
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    try {
      const { email } = req.body;

      const client =
        await User.findByEmailAndRole(email, 'client');

      if (!client) {
        return res.json({
          success: true,
          message:
            'If that account exists, a reset link has been generated.',
        });
      }

      const rawToken =
        crypto.randomBytes(32).toString('hex');

      const tokenHash = hashToken(rawToken);

      const expires =
        new Date(
          Date.now() + 60 * 60 * 1000
        ).toISOString();

      await User.setResetToken(
        email,
        tokenHash,
        expires
      );

      const base =
        process.env.PUBLIC_APP_URL ||
        `${req.protocol}://${req.get('host')}`;

      const resetLink =
        `${base}/reset-password.html?token=${rawToken}&email=${encodeURIComponent(email)}`;

      const emailResult = await sendEmail({
        to: email,
        subject:
          'Manlung Recovery password reset',
        html: `
          <p>
            We received a password reset request
            for your Manlung Recovery account.
          </p>

          <p>
            <a href="${resetLink}">
              Reset your password
            </a>
          </p>

          <p>
            This link expires in one hour.
          </p>
        `,
      });

      const response = {
        success: true,
        message:
          'If that account exists, a reset link has been generated.',
      };

      if (
        process.env.NODE_ENV !== 'production' &&
        !emailResult.sent
      ) {
        response.devResetLink = resetLink;
      }

      res.json(response);
    } catch (error) {
      console.error(
        'Forgot password error:',
        error
      );

      res.status(500).json({
        error:
          error.message || 'Server error',
      });
    }
  }
);


// ============================================================
// CLIENT RESET PASSWORD
// ============================================================

router.post(
  '/client/reset-password',
  [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),

    body('password')
      .isLength({ min: 6 })
      .withMessage(
        'Password must be at least 6 characters'
      ),
  ],
  async (req, res) => {
    if (!checkValidation(req, res)) return;

    try {
      const {
        token,
        password,
      } = req.body;

      const tokenHash = hashToken(token);

      const user =
        await User.findByValidResetToken(tokenHash);

      if (!user) {
        return res.status(400).json({
          error:
            'This reset link is invalid or has expired. Please request a new one.',
        });
      }

      await User.resetPassword(
        user.id,
        password
      );

      res.json({
        success: true,
        message:
          'Password updated. You can now sign in.',
      });
    } catch (error) {
      console.error(
        'Reset password error:',
        error
      );

      res.status(500).json({
        error:
          error.message || 'Server error',
      });
    }
  }
);


// ============================================================
// VERIFY TOKEN
// ============================================================

router.get(
  '/verify',
  auth,
  async (req, res) => {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
      },
    });
  }
);


module.exports = router;
