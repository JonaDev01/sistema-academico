// =============================================================
//  src/routes/materias.routes.js
// =============================================================

const express = require('express');
const router  = express.Router();
const { verificarAdmin } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/materias.controller');

router.get( '/grados/:gradoId/materias',               verificarAdmin, ctrl.listarMaterias);
router.post('/grados/:gradoId/materias/nueva',         verificarAdmin, ctrl.crearMateria);
router.post('/grados/:gradoId/materias/:id/editar',    verificarAdmin, ctrl.actualizarMateria);
router.post('/grados/:gradoId/materias/:id/toggle',    verificarAdmin, ctrl.toggleMateria);

module.exports = router;
