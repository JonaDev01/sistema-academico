// =============================================================
//  models/Grado.js
//  Niveles educativos del colegio (sin secciones).
//  Gestionados dinámicamente por el administrador.
// =============================================================

const { DataTypes } = require('sequelize');
const { sequelize }  = require('../config/database');

const Grado = sequelize.define('Grado', {

  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },

  // Ej: "1° Primaria", "3° Secundaria"
  nombre: {
    type:      DataTypes.STRING(80),
    allowNull: false,
    unique:    true,
    validate:  { notEmpty: { msg: 'El nombre del grado no puede estar vacío' } },
  },

  nivel: {
    type:      DataTypes.ENUM('preescolar', 'primaria', 'secundaria'),
    allowNull: false,
  },

  // Para mostrar la lista en el orden correcto (1°, 2°, 3°...)
  // independientemente del orden de creación en BD
  orden: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    validate:  { min: { args: 1, msg: 'El orden debe ser mayor a 0' } },
  },

  activo: {
    type:         DataTypes.BOOLEAN,
    allowNull:    false,
    defaultValue: true,
  },

  // Clave de mapeo para el importador de Excel.
  // Junto con modalidad_importacion forma la combinación única
  // que identifica exactamente a qué grado pertenece cada estudiante del Excel.
  nivel_importacion: {
    type:      DataTypes.STRING(30),
    allowNull: true,
  },

  // Modalidad del Excel: PREESCOLAR FORMAL, PRIMARIA REGULAR, SECUNDARIA REGULAR
  // Necesario para distinguir "Primero Preescolar" de "Primero Primaria"
  modalidad_importacion: {
    type:      DataTypes.STRING(30),
    allowNull: true,
  },

}, {
  tableName:  'grados',
  timestamps: true,
});

// Asociaciones — se definen en index.js
// Grado.hasMany(Materia,     { foreignKey: 'grado_id' })
// Grado.hasMany(Estudiante,  { foreignKey: 'grado_id' })
// Grado.hasMany(Asignacion,  { foreignKey: 'grado_id' })

module.exports = Grado;
