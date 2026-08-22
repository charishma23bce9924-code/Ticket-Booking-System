const router = require('express').Router();
const { createBooking, myBookings, cancelBooking } = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.post('/', requireAuth, asyncHandler(createBooking));
router.get('/my', requireAuth, asyncHandler(myBookings));
router.post('/:id/cancel', requireAuth, asyncHandler(cancelBooking));

module.exports = router;
