const router = require('express').Router();
const { holdSeats, releaseSeats } = require('../controllers/seatController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.post('/hold', requireAuth, asyncHandler(holdSeats));
router.post('/release', requireAuth, asyncHandler(releaseSeats));

module.exports = router;
