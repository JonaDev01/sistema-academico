// =============================================================
//  src/routes/dashboard.routes.js
// =============================================================

const express   = require('express');
const router    = express.Router();
const { verificarAuth } = require('../middlewares/auth.middleware');
const { mostrarDashboard } = require('../controllers/dashboard.controller');

router.get('/dashboard', verificarAuth, mostrarDashboard);

module.exports = router;
