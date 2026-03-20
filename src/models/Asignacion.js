// =============================================================
//  models/Asignacion.js
//  Tabla puente: Docente ↔ Materia ↔ Grado por año.
//
//  DOBLE FUNCIÓN:
//  1. Define qué docente imparte qué materia en qué grado
//  2. Es la fuente de permisos — verificarClaseDocente()
//     consulta esta tabla en cada request del docente
// =============================================================

const { DataTypes } = require('sequelize');
const { sequelize }  = require('../config/database');

const Asignacion = sequelize.define('Asignacion', {

  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },

  docente_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'docentes', key: 'id' },
    onDelete:   'RESTRICT',
  },

  materia_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'materias', key: 'id' },
    onDelete:   'RESTRICT',
  },

  grado_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'grados', key: 'id' },
    onDelete:   'RESTRICT',
  },

  // Año escolar — permite reasignar docentes cada año sin perder historial
  anio: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    validate:  { min: { args: 2020, msg: 'El año no parece válido' } },
  },

  activo: {
    type:         DataTypes.BOOLEAN,
    allowNull:    false,
    defaultValue: true,
  },

}, {
  tableName:  'asignaciones',
  timestamps: true,

  // Un docente no puede tener la misma materia/grado dos veces en el mismo año
  indexes: [
    { unique: true, fields: ['docente_id', 'materia_id', 'grado_id', 'anio'] },
  ],
});

// Asociaciones — se definen en index.js
// Asignacion.belongsTo(Docente,  { foreignKey: 'docente_id' })
// Asignacion.belongsTo(Materia,  { foreignKey: 'materia_id' })
// Asignacion.belongsTo(Grado,    { foreignKey: 'grado_id'   })

module.exports = Asignacion;
