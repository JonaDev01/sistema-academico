// =============================================================
//  models/Docente.js
//  Perfil extendido del docente.
//  Siempre ligado a un Usuario con rol = 'docente'.
// =============================================================

const { DataTypes } = require('sequelize');
const { sequelize }  = require('../config/database');

const Docente = sequelize.define('Docente', {

  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },

  // FK a usuarios — relación 1:1
  usuario_id: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    unique:    true,    // Un usuario solo puede ser docente una vez
    references: { model: 'usuarios', key: 'id' },
    onDelete:   'RESTRICT',
  },

  nombre: {
    type:      DataTypes.STRING(80),
    allowNull: false,
    validate:  { notEmpty: { msg: 'El nombre del docente no puede estar vacío' } },
  },

  apellido: {
    type:      DataTypes.STRING(80),
    allowNull: false,
    validate:  { notEmpty: { msg: 'El apellido del docente no puede estar vacío' } },
  },

  telefono: {
    type:      DataTypes.STRING(20),
    allowNull: true,
  },

  especialidad: {
    type:      DataTypes.STRING(100),
    allowNull: true,
  },

}, {
  tableName:  'docentes',
  timestamps: true,
});

// Asociaciones — se definen en index.js
// Docente.belongsTo(Usuario, { foreignKey: 'usuario_id' })
// Docente.hasMany(Asignacion, { foreignKey: 'docente_id' })

module.exports = Docente;
