// =============================================================
//  src/routes/notas.routes.js
// =============================================================

const express = require('express');
const router  = express.Router();
const { verificarAuth } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/notas.controller');

router.get( '/notas',               verificarAuth, ctrl.mostrarNotas);
router.post('/notas/guardar',       verificarAuth, ctrl.guardarNotas);
router.post('/notas/:id/eliminar',  verificarAuth, ctrl.eliminarNota);

module.exports = router;
