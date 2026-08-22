const router = require('express').Router();
const { register, login, me, googleLogin } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/google-login', asyncHandler(googleLogin));
router.get('/me', requireAuth, asyncHandler(me));

module.exports = router;
