// =============================================================
//  models/Periodo.js
//  Los 4 cortes del año escolar.
//  Nomenclatura del colegio: "Corte 1" a "Corte 4"
// =============================================================

const { DataTypes } = require('sequelize');
const { sequelize }  = require('../config/database');

const Periodo = sequelize.define('Periodo', {

  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },

  // Número del corte: 1, 2, 3 o 4
  corte: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    validate:  {
      min: { args: 1, msg: 'El corte mínimo es 1' },
      max: { args: 4, msg: 'El corte máximo es 4' },
    },
  },

  anio: {
    type:      DataTypes.INTEGER,
    allowNull: false,
    validate:  { min: { args: 2020, msg: 'El año no parece válido' } },
  },

  // Solo un periodo puede estar activo a la vez
  // El sistema lo usa como periodo por defecto al registrar notas
  activo: {
    type:         DataTypes.BOOLEAN,
    allowNull:    false,
    defaultValue: false,
  },

}, {
  tableName:  'periodos',
  timestamps: true,

  // No puede haber dos "Corte 2 del 2025"
  indexes: [
    { unique: true, fields: ['corte', 'anio'] },
  ],
});

// ── MÉTODO DE INSTANCIA: nombre legible ──────────────────
// Devuelve "Corte 1 — 2025" para mostrar en la UI
Periodo.prototype.nombreCompleto = function () {
  return `Corte ${this.corte} — ${this.anio}`;
};

// ── MÉTODO ESTÁTICO: obtener el periodo activo ───────────
Periodo.obtenerActivo = async function () {
  return await Periodo.findOne({ where: { activo: true } });
};

// Asociaciones — se definen en index.js
// Periodo.hasMany(Nota, { foreignKey: 'periodo_id' })

module.exports = Periodo;
