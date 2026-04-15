// =============================================================
//  src/routes/exportarNotas.routes.js
// =============================================================

const express = require('express');
const router  = express.Router();
const { verificarAuth, verificarAdmin } = require('../middlewares/auth.middleware');
const { exportarGeneral, exportarCorte, exportarGradoGeneral, exportarGradoCorte } = require('../controllers/exportarNotas.controller');

router.get('/notas/exportar/general',      verificarAuth, exportarGeneral);
router.get('/notas/exportar/corte',        verificarAuth, exportarCorte);
router.get('/notas/exportar/grado-general',verificarAdmin, exportarGradoGeneral);
router.get('/notas/exportar/grado-corte',  verificarAdmin, exportarGradoCorte);

module.exports = router;
