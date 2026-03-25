// =============================================================
//  src/controllers/importar.controller.js
// =============================================================

const path  = require('path');
const fs    = require('fs');
const { importarEstudiantes } = require('../services/importador.service');

// ── GET /estudiantes/importar ────────────────────────────────
const mostrarImportar = (req, res) => {
  res.render('estudiantes/importar', {
    titulo:    'Importar estudiantes desde Excel',
    resultado: null,
  });
};

// ── POST /estudiantes/importar ───────────────────────────────
const procesarImportar = async (req, res) => {
  if (!req.file) {
    return res.render('estudiantes/importar', {
      titulo:    'Importar estudiantes desde Excel',
      resultado: { errores: ['No se subió ningún archivo'] },
    });
  }

  try {
    const rutaArchivo = req.file.path;
    const resultado   = await importarEstudiantes(rutaArchivo);

    // Borrar el archivo temporal después de procesar
    fs.unlink(rutaArchivo, () => {});

    res.render('estudiantes/importar', {
      titulo: 'Importar estudiantes desde Excel',
      resultado,
    });

  } catch (error) {
    console.error('Error al importar:', error);
    res.render('estudiantes/importar', {
      titulo:    'Importar estudiantes desde Excel',
      resultado: { errores: [`Error al procesar el archivo: ${error.message}`] },
    });
  }
};

module.exports = { mostrarImportar, procesarImportar };
