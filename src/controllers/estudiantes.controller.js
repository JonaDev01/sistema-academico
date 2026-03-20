// =============================================================
//  src/controllers/estudiantes.controller.js
// =============================================================

const { Estudiante, Nota, Materia, Periodo, Grado, Asignacion } = require('../models');
const { Op } = require('sequelize');

// ── GET /estudiantes/:id/notas ───────────────────────────────
// Muestra todas las notas de un estudiante organizadas por corte.
// Acceso: admin siempre. Docente solo si tiene alguna materia
// asignada en el mismo grado del estudiante.
const verNotas = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = req.session.usuario;

    // 1. Cargar el estudiante con su grado
    const estudiante = await Estudiante.findByPk(id, {
      include: [{ model: Grado, as: 'grado' }],
    });

    if (!estudiante) {
      return res.status(404).render('404', { titulo: 'Estudiante no encontrado' });
    }

    // 2. Si es docente, verificar que tenga al menos una materia
    //    asignada en el mismo grado del estudiante
    if (usuario.rol === 'docente') {
      const tieneAcceso = await Asignacion.findOne({
        where: {
          docente_id: usuario.docente_id,
          grado_id:   estudiante.grado_id,
          activo:     true,
        },
      });

      if (!tieneAcceso) {
        return res.status(403).render('403', { titulo: 'Acceso denegado' });
      }
    }

    // 3. Cargar todos los periodos del año actual ordenados por corte
    const anioActual = new Date().getFullYear();
    const periodos = await Periodo.findAll({
      where:  { anio: anioActual },
      order:  [['corte', 'ASC']],
    });

    // 4. Cargar todas las notas del estudiante con materia y periodo
    const notas = await Nota.findAll({
      where: { estudiante_id: id },
      include: [
        { model: Materia, as: 'materia' },
        { model: Periodo, as: 'periodo' },
      ],
      order: [
        ['periodo', 'corte', 'ASC'],
        ['materia', 'nombre', 'ASC'],
      ],
    });

    // 5. Agrupar notas por corte para facilitar el renderizado
    // Estructura: { 1: [nota, nota...], 2: [nota...], ... }
    const notasPorCorte = {};
    periodos.forEach(p => { notasPorCorte[p.corte] = []; });

    notas.forEach(nota => {
      const corte = nota.periodo.corte;
      if (notasPorCorte[corte] !== undefined) {
        notasPorCorte[corte].push(nota);
      }
    });

    // 6. Calcular promedio general del estudiante (solo notas existentes)
    let promedioGeneral = null;
    if (notas.length > 0) {
      const suma = notas.reduce((acc, n) => acc + parseFloat(n.nota_numerica), 0);
      promedioGeneral = (suma / notas.length).toFixed(2);
    }

    // 7. Calcular promedio por corte
    const promediosPorCorte = {};
    periodos.forEach(p => {
      const notasDelCorte = notasPorCorte[p.corte];
      if (notasDelCorte.length > 0) {
        const suma = notasDelCorte.reduce((acc, n) => acc + parseFloat(n.nota_numerica), 0);
        promediosPorCorte[p.corte] = (suma / notasDelCorte.length).toFixed(2);
      } else {
        promediosPorCorte[p.corte] = null;
      }
    });

    res.render('estudiantes/notas', {
      titulo:           `Notas — ${estudiante.nombre1} ${estudiante.apellido1}`,
      estudiante,
      periodos,
      notasPorCorte,
      promediosPorCorte,
      promedioGeneral,
      totalNotas:       notas.length,
    });

  } catch (error) {
    console.error('Error en verNotas:', error);
    res.status(500).render('404', { titulo: 'Error del servidor' });
  }
};

module.exports = { verNotas };
