// =============================================================
//  src/routes/admin.routes.js
// =============================================================

const express = require('express');
const router  = express.Router();
const { verificarAdmin } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/admin.controller');

router.get( '/admin/corte',               verificarAdmin, ctrl.mostrarGestionCorte);
router.post('/admin/corte/cambiar',       verificarAdmin, ctrl.cambiarCorte);
router.get( '/admin/fin-de-anio',         verificarAdmin, ctrl.mostrarFinDeAnio);
router.post('/admin/fin-de-anio/aplicar', verificarAdmin, ctrl.aplicarFinDeAnio);
router.get( '/admin/papelera',            verificarAdmin, ctrl.mostrarPapelera);
router.post('/admin/papelera/restaurar',  verificarAdmin, ctrl.restaurarElemento);
router.post('/admin/papelera/eliminar',   verificarAdmin, ctrl.eliminarPermanente);
router.get( '/admin/perfil',              verificarAdmin, ctrl.mostrarPerfilAdmin);
router.post('/admin/perfil',              verificarAdmin, ctrl.actualizarPerfilAdmin);

module.exports = router;
