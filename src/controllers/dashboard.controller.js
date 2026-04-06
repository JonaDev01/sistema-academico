// =============================================================
//  src/controllers/dashboard.controller.js
// =============================================================

const { Estudiante, Docente, Grado, Periodo, Nota, Materia } = require('../models');
const { Op } = require('sequelize');

const mostrarDashboard = async (req, res) => {
  try {
    const usuario = req.session.usuario;

    if (usuario.rol === 'admin') {
      // ── Stats para admin ──────────────────────────────────
      const [
        totalEstudiantes,
        totalRepitentes,
        totalRetirados,
        totalBecados,
        totalPagosPendientes,
        totalEnProyecto,
        totalDocentes,
        totalGrados,
        totalMaterias,
        periodoActivo,
        totalNotas,
      ] = await Promise.all([
        Estudiante.count({ where: { estado_matricula: 'activo' } }),
        Estudiante.count({ where: { estado_matricula: 'repitente' } }),
        Estudiante.count({ where: { estado_matricula: 'retirado' } }),
        Estudiante.count({ where: { tipo_beca: { [Op.in]: ['becado', 'semi_becado'] } } }),
        Estudiante.count({ where: { estado_pago: 'pendiente', estado_matricula: { [Op.in]: ['activo', 'repitente'] } } }),
        Estudiante.count({ where: { en_proyecto: true, estado_matricula: { [Op.in]: ['activo', 'repitente'] } } }),
        Docente.count(),
        Grado.count({ where: { activo: true } }),
        Materia.count({ where: { activo: true } }),
        Periodo.findOne({ where: { activo: true } }),
        Nota.count(),
      ]);

      res.render('dashboard', {
        titulo: 'Dashboard',
        stats: {
          totalEstudiantes,
          totalRepitentes,
          totalRetirados,
          totalBecados,
          totalPagosPendientes,
          totalEnProyecto,
          totalDocentes,
          totalGrados,
          totalMaterias,
          periodoActivo,
          totalNotas,
        },
      });

    } else {
      // ── Stats para docente ────────────────────────────────
      const { Asignacion } = require('../models');
      const docente = await require('../models').Docente.findOne({
        where: { usuario_id: usuario.id },
      });

      let statsDocente = { clases: 0, estudiantes: 0, notasIngresadas: 0, periodoActivo: null };

      if (docente) {
        const periodoActivo = await Periodo.findOne({ where: { activo: true } });

        const asignaciones = await Asignacion.findAll({
          where:   { docente_id: docente.id, activo: true },
          include: [{ model: require('../models').Grado, as: 'gradoAsignacion', attributes: ['id'] }],
        });

        const gradoIds = [...new Set(asignaciones.map(a => a.gradoAsignacion?.id).filter(Boolean))];
        const materiaIds = asignaciones.map(a => a.materia_id).filter(Boolean);

        const [estudiantes, notasIngresadas] = await Promise.all([
          gradoIds.length > 0
            ? Estudiante.count({ where: { grado_id: { [Op.in]: gradoIds }, estado_matricula: { [Op.in]: ['activo', 'repitente'] } } })
            : 0,
          materiaIds.length > 0 && periodoActivo
            ? Nota.count({ where: { materia_id: { [Op.in]: materiaIds }, periodo_id: periodoActivo.id } })
            : 0,
        ]);

        statsDocente = {
          clases:          asignaciones.length,
          estudiantes,
          notasIngresadas,
          periodoActivo,
        };
      }

      res.render('dashboard', {
        titulo: 'Dashboard',
        stats:  statsDocente,
      });
    }

  } catch (error) {
    console.error('Error en dashboard:', error);
    res.render('dashboard', {
      titulo: 'Dashboard',
      stats:  {},
    });
  }
};

module.exports = { mostrarDashboard };
