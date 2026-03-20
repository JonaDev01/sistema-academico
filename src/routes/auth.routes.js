const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verificarAuth } = require('../middlewares/auth.middleware');

router.get('/login', authController.mostrarLogin);
router.post('/login', authController.procesarLogin);
router.get('/logout', verificarAuth, authController.logout);
router.get('/', verificarAuth, (req, res) => res.redirect('/dashboard'));

module.exports = router;