const express = require('express');
const router = express.Router();
const upload = require('../config/multerConfig');
const { handleReceiveMessage } = require('../controllers/messageController');

// 收消息API
router.post('/receive-message', upload.single('content'), handleReceiveMessage);

module.exports = router;
