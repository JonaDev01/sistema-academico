// =============================================================
//  models/Materia.js
//  Materias por grado específico.
//  "Matemática de 1° Primaria" ≠ "Matemática de 3° Secundaria"
// =============================================================

const { DataTypes } = require('sequelize');
const { sequelize }  = require('../config/database');

const Materia = sequelize.define('Materia', {

  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },

  // Cada materia pertenece a UN grado
  grado_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'grados', key: 'id' },
    onDelete:   'RESTRICT',
  },

  nombre: {
    type:      DataTypes.STRING(100),
    allowNull: false,
    validate:  { notEmpty: { msg: 'El nombre de la materia no puede estar vacío' } },
  },

  horas_semanales: {
    type:      DataTypes.INTEGER,
    allowNull: true,
    validate:  { min: { args: 1, msg: 'Las horas semanales deben ser al menos 1' } },
  },

  activo: {
    type:         DataTypes.BOOLEAN,
    allowNull:    false,
    defaultValue: true,
  },

}, {
  tableName:  'materias',
  timestamps: true,

  // No puede haber dos materias con el mismo nombre en el mismo grado
  indexes: [
    { unique: true, fields: ['grado_id', 'nombre'] },
  ],
});

// Asociaciones — se definen en index.js
// Materia.belongsTo(Grado,      { foreignKey: 'grado_id' })
// Materia.hasMany(Asignacion,   { foreignKey: 'materia_id' })
// Materia.hasMany(Nota,         { foreignKey: 'materia_id' })

module.exports = Materia;
