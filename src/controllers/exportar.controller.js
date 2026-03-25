// =============================================================
//  src/controllers/exportar.controller.js
//  Exporta estudiantes a Excel con exceljs
// =============================================================

const ExcelJS  = require('exceljs');
const { Estudiante, Grado } = require('../models');
const { Op }   = require('sequelize');

const exportarEstudiantes = async (req, res) => {
  try {
    const { grado_id, estado_matricula, tipo_beca, estado_pago, en_proyecto } = req.query;

    // Aplicar los mismos filtros que la lista
    const where = {};
    if (grado_id)         where.grado_id         = grado_id;
    if (estado_matricula) where.estado_matricula  = estado_matricula;
    if (tipo_beca)        where.tipo_beca         = tipo_beca;
    if (estado_pago)      where.estado_pago       = estado_pago;
    if (en_proyecto)      where.en_proyecto       = en_proyecto === 'true';

    const estudiantes = await Estudiante.findAll({
      where,
      include: [{ model: Grado, as: 'grado', attributes: ['nombre'] }],
      order:   [['apellido1', 'ASC'], ['nombre1', 'ASC']],
    });

    // Crear el workbook
    const workbook  = new ExcelJS.Workbook();
    const hoja      = workbook.addWorksheet('Estudiantes');

    // Estilo del encabezado
    const estiloHeader = {
      font:      { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2B55' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        bottom: { style: 'thin', color: { argb: 'FFC8A84B' } },
      },
    };

    // Definir columnas
    hoja.columns = [
      { header: 'Código',            key: 'codigo',          width: 22 },
      { header: 'Primer apellido',   key: 'apellido1',       width: 18 },
      { header: 'Segundo apellido',  key: 'apellido2',       width: 18 },
      { header: 'Primer nombre',     key: 'nombre1',         width: 18 },
      { header: 'Segundo nombre',    key: 'nombre2',         width: 18 },
      { header: 'Grado',             key: 'grado',           width: 20 },
      { header: 'Fecha nacimiento',  key: 'fecha_nac',       width: 18 },
      { header: 'Género',            key: 'genero',          width: 12 },
      { header: 'Estado matrícula',  key: 'estado_matricula',width: 18 },
      { header: 'Estado pago',       key: 'estado_pago',     width: 14 },
      { header: 'Tipo beca',         key: 'tipo_beca',       width: 14 },
      { header: 'En proyecto',       key: 'en_proyecto',     width: 12 },
      { header: 'Departamento',      key: 'departamento',    width: 16 },
      { header: 'Dirección',         key: 'direccion',       width: 30 },
      { header: 'Nombre madre',      key: 'nombre_madre',    width: 25 },
      { header: 'Cédula madre',      key: 'cedula_madre',    width: 18 },
      { header: 'Nombre padre',      key: 'nombre_padre',    width: 25 },
      { header: 'Cédula padre',      key: 'cedula_padre',    width: 18 },
      { header: 'Programa',          key: 'programa',        width: 20 },
      { header: 'Código único',      key: 'codigo_unico',    width: 18 },
      { header: 'Motivo registro',   key: 'motivo',          width: 22 },
    ];

    // Aplicar estilo al encabezado
    hoja.getRow(1).eachCell(cell => {
      cell.style = estiloHeader;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    hoja.getRow(1).height = 28;

    // Agregar datos
    estudiantes.forEach((est, idx) => {
      const fila = hoja.addRow({
        codigo:           est.codigo_estudiante,
        apellido1:        est.apellido1,
        apellido2:        est.apellido2        || '',
        nombre1:          est.nombre1,
        nombre2:          est.nombre2          || '',
        grado:            est.grado?.nombre    || '',
        fecha_nac:        est.fecha_nacimiento
                            ? new Date(est.fecha_nacimiento).toLocaleDateString('es-GT')
                            : '',
        genero:           est.genero           || '',
        estado_matricula: est.estado_matricula || '',
        estado_pago:      est.estado_pago      || '',
        tipo_beca:        est.tipo_beca        || '',
        en_proyecto:      est.en_proyecto ? 'Sí' : 'No',
        departamento:     est.departamento     || '',
        direccion:        est.direccion        || '',
        nombre_madre:     est.nombre_madre     || '',
        cedula_madre:     est.cedula_madre     || '',
        nombre_padre:     est.nombre_padre     || '',
        cedula_padre:     est.cedula_padre     || '',
        programa:         est.programa         || '',
        codigo_unico:     est.codigo_unico     || '',
        motivo:           est.motivo_registro  || '',
      });

      // Filas alternadas
      if (idx % 2 === 0) {
        fila.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F9' } };
        });
      }
      fila.height = 18;
    });

    // Fila de totales al final
    const filaTotal = hoja.addRow({
      codigo: `Total: ${estudiantes.length} estudiantes`,
    });
    filaTotal.getCell(1).font = { bold: true, color: { argb: 'FF0D2B55' } };

    // Congelar primera fila
    hoja.views = [{ state: 'frozen', ySplit: 1 }];

    // Nombre del archivo con fecha
    const fecha    = new Date().toISOString().split('T')[0];
    const filename = `estudiantes_${fecha}.xlsx`;

    // Enviar como descarga
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error al exportar:', error);
    res.redirect('/estudiantes?error=Error al generar el archivo Excel');
  }
};

module.exports = { exportarEstudiantes };
