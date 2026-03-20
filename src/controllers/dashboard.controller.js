// =============================================================
//  src/controllers/dashboard.controller.js
// =============================================================

const { Estudiante, Docente, Grado, Periodo } = require('../models');

const mostrarDashboard = async (req, res) => {
  try {
    // Consultas en paralelo para mayor velocidad
    const [totalEstudiantes, totalDocentes, totalGrados, periodoActivo] = await Promise.all([
      Estudiante.count({ where: { estado_matricula: 'activo' } }),
      Docente.count(),
      Grado.count({ where: { activo: true } }),
      Periodo.findOne({ where: { activo: true } }),
    ]);

    res.render('dashboard', {
      titulo: 'Dashboard',
      stats: { totalEstudiantes, totalDocentes, totalGrados, periodoActivo },
    });

  } catch (error) {
    console.error('Error en dashboard:', error);
    res.render('dashboard', {
      titulo: 'Dashboard',
      stats: { totalEstudiantes: 0, totalDocentes: 0, totalGrados: 0, periodoActivo: null },
    });
  }
};

module.exports = { mostrarDashboard };
