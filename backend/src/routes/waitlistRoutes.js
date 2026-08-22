const router = require('express').Router();
const { joinWaitlist, getOfferByToken, myWaitlistEntries } = require('../controllers/waitlistController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.post('/join', requireAuth, asyncHandler(joinWaitlist));
router.get('/my', requireAuth, asyncHandler(myWaitlistEntries));
router.get('/offer/:token', requireAuth, asyncHandler(getOfferByToken));

module.exports = router;
