import express from 'express';
const router = express.Router();

router.use('/rmp', require('./rmp'));
router.use('/albert', require('./albert'));

module.exports = router;