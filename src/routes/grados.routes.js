// =============================================================
//  src/routes/grados.routes.js
// =============================================================

const express    = require('express');
const router     = express.Router();
const { verificarAuth, verificarAdmin } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/grados.controller');

// Todas las rutas de grados son solo para admin
router.get( '/grados',              verificarAdmin, ctrl.listarGrados);
router.get( '/grados/nuevo',        verificarAdmin, ctrl.mostrarFormNuevo);
router.post('/grados/nuevo',        verificarAdmin, ctrl.crearGrado);
router.get( '/grados/:id/editar',   verificarAdmin, ctrl.mostrarFormEditar);
router.post('/grados/:id/editar',   verificarAdmin, ctrl.actualizarGrado);
router.post('/grados/:id/toggle',   verificarAdmin, ctrl.toggleGrado);

module.exports = router;
