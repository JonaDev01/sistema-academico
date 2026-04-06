// =============================================================
//  src/routes/boletin.routes.js
// =============================================================

const express = require('express');
const router  = express.Router();
const { verificarAuth } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/boletin.controller');

router.get('/boletin',              verificarAuth, ctrl.mostrarBoletin);
router.get('/boletin/generar',      verificarAuth, ctrl.generarBoletin);
router.get('/boletin/estudiantes',  verificarAuth, ctrl.estudiantesPorGrado);

module.exports = router;
