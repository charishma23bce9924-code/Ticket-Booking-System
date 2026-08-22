const router = require('express').Router();
const { createEvent, listEvents, getEvent, getSeatMap, getEventSummary } = require('../controllers/eventController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.post('/', requireAuth, requireRole('ORGANISER', 'ADMIN'), asyncHandler(createEvent));
router.get('/', asyncHandler(listEvents));
router.get('/:id', asyncHandler(getEvent));
router.get('/:id/seatmap', asyncHandler(getSeatMap));
router.get('/:id/summary', requireAuth, requireRole('ORGANISER', 'ADMIN'), asyncHandler(getEventSummary));

module.exports = router;
