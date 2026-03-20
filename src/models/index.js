// =============================================================
//  models/index.js
//  Punto central de todos los modelos.
//  Define TODAS las asociaciones entre tablas.
//  Importar desde aquí en controllers y seeders:
//    const { Usuario, Docente, Grado, ... } = require('../models');
// =============================================================

const Usuario    = require('./Usuario');
const Docente    = require('./Docente');
const Grado      = require('./Grado');
const Materia    = require('./Materia');
const Asignacion = require('./Asignacion');
const Estudiante = require('./Estudiante');
const Periodo    = require('./Periodo');
const Nota       = require('./Nota');


// =============================================================
//  ASOCIACIONES
//  Regla: siempre definir ambos lados (hasOne/hasMany + belongsTo)
// =============================================================

// ── usuarios ↔ docentes (1:1) ───────────────────────────
// Un usuario admin NO tiene docente asociado
// Un usuario docente SIEMPRE tiene un perfil en docentes
Usuario.hasOne(Docente, {
  foreignKey: 'usuario_id',
  as:         'perfil',           // usuario.getPerfil()
});
Docente.belongsTo(Usuario, {
  foreignKey: 'usuario_id',
  as:         'usuario',          // docente.getUsuario()
});

// ── grados ↔ materias (1:N) ─────────────────────────────
// Un grado tiene muchas materias
// Una materia pertenece a un solo grado
Grado.hasMany(Materia, {
  foreignKey: 'grado_id',
  as:         'materias',         // grado.getMaterias()
});
Materia.belongsTo(Grado, {
  foreignKey: 'grado_id',
  as:         'grado',            // materia.getGrado()
});

// ── grados ↔ estudiantes (1:N) ──────────────────────────
Grado.hasMany(Estudiante, {
  foreignKey: 'grado_id',
  as:         'estudiantes',      // grado.getEstudiantes()
});
Estudiante.belongsTo(Grado, {
  foreignKey: 'grado_id',
  as:         'grado',            // estudiante.getGrado()
});

// ── docentes ↔ asignaciones (1:N) ───────────────────────
Docente.hasMany(Asignacion, {
  foreignKey: 'docente_id',
  as:         'asignaciones',     // docente.getAsignaciones()
});
Asignacion.belongsTo(Docente, {
  foreignKey: 'docente_id',
  as:         'docente',
});

// ── materias ↔ asignaciones (1:N) ───────────────────────
Materia.hasMany(Asignacion, {
  foreignKey: 'materia_id',
  as:         'asignaciones',
});
Asignacion.belongsTo(Materia, {
  foreignKey: 'materia_id',
  as:         'materia',
});

// ── grados ↔ asignaciones (1:N) ─────────────────────────
Grado.hasMany(Asignacion, {
  foreignKey: 'grado_id',
  as:         'asignaciones',
});
Asignacion.belongsTo(Grado, {
  foreignKey: 'grado_id',
  as:         'gradoAsignacion',  // Alias distinto para evitar conflicto con estudiantes
});

// ── estudiantes ↔ notas (1:N) ───────────────────────────
Estudiante.hasMany(Nota, {
  foreignKey: 'estudiante_id',
  as:         'notas',            // estudiante.getNotas()
});
Nota.belongsTo(Estudiante, {
  foreignKey: 'estudiante_id',
  as:         'estudiante',
});

// ── materias ↔ notas (1:N) ──────────────────────────────
Materia.hasMany(Nota, {
  foreignKey: 'materia_id',
  as:         'notas',
});
Nota.belongsTo(Materia, {
  foreignKey: 'materia_id',
  as:         'materia',
});

// ── periodos ↔ notas (1:N) ──────────────────────────────
Periodo.hasMany(Nota, {
  foreignKey: 'periodo_id',
  as:         'notas',
});
Nota.belongsTo(Periodo, {
  foreignKey: 'periodo_id',
  as:         'periodo',
});


// =============================================================
//  EXPORTAR TODOS LOS MODELOS
//  Uso: const { Estudiante, Nota } = require('../models');
// =============================================================

module.exports = {
  Usuario,
  Docente,
  Grado,
  Materia,
  Asignacion,
  Estudiante,
  Periodo,
  Nota,
};
