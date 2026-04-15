// =============================================================
//  src/controllers/exportarNotas.controller.js
//  Exportación de notas en Excel — dos tipos:
//  1. General: 4 tablas por corte + semestres + promedio final
//  2. Por corte: una sola tabla del corte seleccionado
// =============================================================

const ExcelJS = require('exceljs');
const { Nota, Estudiante, Materia, Grado, Periodo, Asignacion, Docente } = require('../models');
const { Op }  = require('sequelize');

// ── Colores institucionales ──────────────────────────────────
const C = {
  navy:    '0D2B55',
  accent:  'C8A84B',
  blue:    '1A4A8A',
  green:   '1E7E4A',
  yellow:  'D4870A',
  red:     'C0392B',
  gray:    'F0F4F9',
  white:   'FFFFFF',
  bgAA:    'DCFCE7',
  bgAS:    'DBEAFE',
  bgAF:    'FFF8E6',
  bgAI:    'FEE2E2',
};

function coefColor(coef) {
  const map = { AA: C.bgAA, AS: C.bgAS, AF: C.bgAF, AI: C.bgAI };
  return map[coef] || 'F1EFE8';
}

function calcCoef(nota) {
  if (nota >= 90) return 'AA';
  if (nota >= 76) return 'AS';
  if (nota >= 60) return 'AF';
  return 'AI';
}

// Helper — verificar acceso del docente a la materia
async function verificarAcceso(usuario, materia_id) {
  if (usuario.rol === 'admin') return true;
  const docente = await Docente.findOne({ where: { usuario_id: usuario.id } });
  if (!docente) return false;
  const asig = await Asignacion.findOne({
    where: { docente_id: docente.id, materia_id, activo: true },
  });
  return !!asig;
}

// ── GET /notas/exportar/general ──────────────────────────────
// Reporte completo: 4 cortes separados + semestres + promedio final
const exportarGeneral = async (req, res) => {
  const { grado_id, materia_id } = req.query;

  if (!grado_id || !materia_id) {
    return res.redirect('/notas?error=Selecciona grado y materia para exportar');
  }

  try {
    // Verificar acceso
    if (!await verificarAcceso(req.session.usuario, materia_id)) {
      return res.redirect('/notas?error=No tienes acceso a esta materia');
    }

    const anio = new Date().getFullYear();

    const [grado, materia, periodos, estudiantes] = await Promise.all([
      Grado.findByPk(grado_id),
      Materia.findByPk(materia_id),
      Periodo.findAll({ where: { anio }, order: [['corte', 'ASC']] }),
      Estudiante.findAll({
        where: {
          grado_id,
          estado_matricula: { [Op.in]: ['activo', 'repitente'] },
        },
        order: [['apellido1', 'ASC'], ['nombre1', 'ASC']],
      }),
    ]);

    // Cargar todas las notas de esa materia en el año
    const notas = await Nota.findAll({
      where:   { materia_id },
      include: [{ model: Periodo, as: 'periodo', where: { anio }, required: true }],
    });

    // Mapa: estudiante_id → corte → nota
    const notasMap = {};
    notas.forEach(n => {
      if (!notasMap[n.estudiante_id]) notasMap[n.estudiante_id] = {};
      notasMap[n.estudiante_id][n.periodo.corte] = n;
    });

    // ── Crear workbook ──────────────────────────────────────
    const wb   = new ExcelJS.Workbook();
    const hoja = wb.addWorksheet('Notas General');

    // Estilos reutilizables
    const hdrStyle = {
      font:      { bold: true, color: { argb: C.white }, size: 11 },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };
    const subHdrStyle = (color) => ({
      font:      { bold: true, color: { argb: C.white }, size: 10 },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: color } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });

    // ── Encabezado del reporte ──────────────────────────────
    hoja.mergeCells('A1:P1');
    const titulo = hoja.getCell('A1');
    titulo.value = `REPORTE GENERAL DE NOTAS — ${materia?.nombre?.toUpperCase()} — ${grado?.nombre?.toUpperCase()} — ${anio}`;
    titulo.style = { ...hdrStyle, font: { ...hdrStyle.font, size: 13 } };
    hoja.getRow(1).height = 30;

    // ── Fila de secciones de semestres ──────────────────────
    const row2 = hoja.getRow(2);
    hoja.mergeCells('A2:A3'); row2.getCell(1).value = 'Código';
    hoja.mergeCells('B2:B3'); row2.getCell(2).value = 'Apellidos y Nombres';

    // I Semestre (C1 + C2)
    hoja.mergeCells('C2:F2');
    row2.getCell(3).value = 'I SEMESTRE';
    row2.getCell(3).style = subHdrStyle('1A5276');

    // II Semestre (C3 + C4)
    hoja.mergeCells('G2:J2');
    row2.getCell(7).value = 'II SEMESTRE';
    row2.getCell(7).style = subHdrStyle('1A5276');

    // Promedios semestres
    hoja.mergeCells('K2:L2');
    row2.getCell(11).value = 'PROMEDIOS';
    row2.getCell(11).style = subHdrStyle(C.accent);

    // Promedio final
    hoja.mergeCells('M2:N2');
    row2.getCell(13).value = 'FINAL';
    row2.getCell(13).style = subHdrStyle('6D28D9');

    row2.eachCell(c => { if (!c.style?.fill) c.style = { ...hdrStyle, font: { ...hdrStyle.font, size: 10 } }; });
    hoja.getRow(2).height = 22;

    // ── Fila de sub-encabezados de cortes ───────────────────
    const row3 = hoja.getRow(3);
    ['Código', 'Apellidos y Nombres',
     'C1 Nota', 'C1 Nivel', 'C2 Nota', 'C2 Nivel',
     'C3 Nota', 'C3 Nivel', 'C4 Nota', 'C4 Nivel',
     'Sem.1', 'Sem.2',
     'Prom. Final', 'Nivel Final',
    ].forEach((h, i) => {
      const cell = row3.getCell(i + 1);
      cell.value = h;
      cell.style = {
        font:      { bold: true, color: { argb: C.white }, size: 9 },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: '374151' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
      };
    });
    hoja.getRow(3).height = 20;

    // Anchos de columnas
    hoja.columns = [
      { width: 22 }, { width: 28 },
      { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
      { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
      { width: 9 }, { width: 9 },
      { width: 12 }, { width: 9 },
    ];

    // ── Filas de estudiantes ────────────────────────────────
    estudiantes.forEach((est, idx) => {
      const fila  = hoja.addRow([]);
      const bg    = idx % 2 === 0 ? C.gray : C.white;

      fila.getCell(1).value = est.codigo_estudiante || '';
      fila.getCell(2).value = `${est.apellido1}${est.apellido2 ? ' ' + est.apellido2 : ''}, ${est.nombre1}${est.nombre2 ? ' ' + est.nombre2 : ''}`;

      const notas = notasMap[est.id] || {};
      const vals  = {};

      // Cortes 1-4
      [1, 2, 3, 4].forEach((corte, ci) => {
        const n    = notas[corte];
        const col  = ci * 2 + 3;
        if (n) {
          const nota = parseFloat(n.nota_numerica);
          const coef = n.coeficiente || calcCoef(nota);
          vals[corte] = nota;
          fila.getCell(col).value     = nota;
          fila.getCell(col + 1).value = coef;
          fila.getCell(col).style     = { alignment: { horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } } };
          fila.getCell(col + 1).style = { alignment: { horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: coefColor(coef) } }, font: { bold: true, color: { argb: '000000' }, size: 9 } };
        } else {
          fila.getCell(col).value     = '—';
          fila.getCell(col + 1).value = '—';
          [col, col + 1].forEach(c => fila.getCell(c).style = { alignment: { horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } } });
        }
      });

      // Semestres
      const sem1 = (vals[1] !== undefined && vals[2] !== undefined)
        ? ((vals[1] + vals[2]) / 2).toFixed(1) : '—';
      const sem2 = (vals[3] !== undefined && vals[4] !== undefined)
        ? ((vals[3] + vals[4]) / 2).toFixed(1) : '—';

      fila.getCell(11).value = sem1;
      fila.getCell(12).value = sem2;

      // Promedio final
      const notasValidas = Object.values(vals);
      if (notasValidas.length > 0) {
        const prom = (notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length).toFixed(1);
        const coef = calcCoef(parseFloat(prom));
        fila.getCell(13).value = parseFloat(prom);
        fila.getCell(14).value = coef;
        fila.getCell(14).style = { alignment: { horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: coefColor(coef) } }, font: { bold: true, size: 9 } };
      } else {
        fila.getCell(13).value = '—';
        fila.getCell(14).value = '—';
      }

      // Fondo alternado en celdas sin estilo propio
      [1, 2, 11, 12, 13].forEach(c => {
        if (!fila.getCell(c).style?.fill?.fgColor) {
          fila.getCell(c).style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } } };
        }
      });
      fila.height = 16;
    });

    // Total
    const filaTotal = hoja.addRow([]);
    filaTotal.getCell(1).value = `Total: ${estudiantes.length} estudiantes`;
    filaTotal.getCell(1).style = { font: { bold: true, color: { argb: C.navy } } };

    // Congelar primeras 3 filas y 2 columnas
    hoja.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }];

    // Enviar
    const fecha    = new Date().toISOString().split('T')[0];
    const filename = `notas_general_${grado?.nombre?.replace(/\s/g,'_')}_${materia?.nombre?.replace(/\s/g,'_')}_${fecha}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exportarGeneral:', error);
    res.redirect('/notas?error=Error al generar el reporte');
  }
};

// ── GET /notas/exportar/corte ────────────────────────────────
// Reporte de un corte específico
const exportarCorte = async (req, res) => {
  const { grado_id, materia_id, periodo_id } = req.query;

  if (!grado_id || !materia_id || !periodo_id) {
    return res.redirect('/notas?error=Selecciona grado, materia y corte para exportar');
  }

  try {
    if (!await verificarAcceso(req.session.usuario, materia_id)) {
      return res.redirect('/notas?error=No tienes acceso a esta materia');
    }

    const [grado, materia, periodo, estudiantes] = await Promise.all([
      Grado.findByPk(grado_id),
      Materia.findByPk(materia_id),
      Periodo.findByPk(periodo_id),
      Estudiante.findAll({
        where: {
          grado_id,
          estado_matricula: { [Op.in]: ['activo', 'repitente'] },
        },
        order: [['apellido1', 'ASC'], ['nombre1', 'ASC']],
      }),
    ]);

    const notas = await Nota.findAll({ where: { materia_id, periodo_id } });
    const notasMap = {};
    notas.forEach(n => { notasMap[n.estudiante_id] = n; });

    const wb   = new ExcelJS.Workbook();
    const hoja = wb.addWorksheet(`Corte ${periodo?.corte}`);

    const hdrStyle = {
      font:      { bold: true, color: { argb: C.white }, size: 11 },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };

    // Título
    hoja.mergeCells('A1:F1');
    hoja.getCell('A1').value = `NOTAS — ${materia?.nombre?.toUpperCase()} — ${grado?.nombre?.toUpperCase()} — CORTE ${periodo?.corte}, ${periodo?.anio}`;
    hoja.getCell('A1').style = { ...hdrStyle, font: { ...hdrStyle.font, size: 12 } };
    hoja.getRow(1).height = 28;

    // Headers
    const row2 = hoja.getRow(2);
    ['N°', 'Código', 'Apellidos y Nombres', 'Nota', 'Nivel', 'Observación'].forEach((h, i) => {
      row2.getCell(i + 1).value = h;
      row2.getCell(i + 1).style = hdrStyle;
    });
    hoja.getRow(2).height = 20;

    hoja.columns = [
      { width: 5 }, { width: 22 }, { width: 30 },
      { width: 10 }, { width: 10 }, { width: 30 },
    ];

    // Datos
    estudiantes.forEach((est, idx) => {
      const nota = notasMap[est.id];
      const bg   = idx % 2 === 0 ? C.gray : C.white;
      const fila = hoja.addRow([
        idx + 1,
        est.codigo_estudiante || '',
        `${est.apellido1}${est.apellido2 ? ' ' + est.apellido2 : ''}, ${est.nombre1}${est.nombre2 ? ' ' + est.nombre2 : ''}`,
        nota ? parseFloat(nota.nota_numerica) : '—',
        nota ? (nota.coeficiente || '—') : '—',
        nota ? (nota.observacion || '') : '',
      ]);

      fila.eachCell((cell, i) => {
        cell.style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: { vertical: 'middle' } };
        if (i === 5 && nota) {
          cell.style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: coefColor(nota.coeficiente) } }, alignment: { horizontal: 'center', vertical: 'middle' }, font: { bold: true, size: 10 } };
        }
      });
      fila.height = 16;
    });

    // Total
    const filaTotal = hoja.addRow([]);
    filaTotal.getCell(1).value = `Total: ${estudiantes.length} estudiantes`;
    filaTotal.getCell(1).style = { font: { bold: true, color: { argb: C.navy } } };

    const promedio = notas.length > 0
      ? (notas.reduce((a, n) => a + parseFloat(n.nota_numerica), 0) / notas.length).toFixed(1)
      : '—';
    filaTotal.getCell(4).value = promedio !== '—' ? `Prom: ${promedio}` : '—';
    filaTotal.getCell(4).style = { font: { bold: true, color: { argb: C.navy } }, alignment: { horizontal: 'center' } };

    hoja.views = [{ state: 'frozen', ySplit: 2 }];

    const fecha    = new Date().toISOString().split('T')[0];
    const filename = `notas_corte${periodo?.corte}_${grado?.nombre?.replace(/\s/g,'_')}_${materia?.nombre?.replace(/\s/g,'_')}_${fecha}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exportarCorte:', error);
    res.redirect('/notas?error=Error al generar el reporte');
  }
};

module.exports = { exportarGeneral, exportarCorte, exportarGradoGeneral, exportarGradoCorte };

// ── GET /notas/exportar/grado-general ─────────────────────────
// Reporte general del año — todas las materias del grado en hojas separadas
async function exportarGradoGeneral(req, res) {
  const { grado_id } = req.query;
  if (!grado_id) return res.redirect('/notas?error=Selecciona un grado');

  try {
    const anio = new Date().getFullYear();

    const [grado, materias, estudiantes, periodos] = await Promise.all([
      Grado.findByPk(grado_id),
      Materia.findAll({ where: { grado_id, activo: true }, order: [['nombre', 'ASC']] }),
      Estudiante.findAll({
        where: { grado_id, estado_matricula: { [Op.in]: ['activo', 'repitente'] } },
        order: [['apellido1', 'ASC'], ['nombre1', 'ASC']],
      }),
      Periodo.findAll({ where: { anio }, order: [['corte', 'ASC']] }),
    ]);

    // Cargar todas las notas del grado en el año
    const notas = await Nota.findAll({
      where:   { materia_id: { [Op.in]: materias.map(m => m.id) } },
      include: [{ model: Periodo, as: 'periodo', where: { anio }, required: true }],
    });

    // Mapa: materia_id → estudiante_id → corte → nota
    const notasMap = {};
    notas.forEach(n => {
      if (!notasMap[n.materia_id]) notasMap[n.materia_id] = {};
      if (!notasMap[n.materia_id][n.estudiante_id]) notasMap[n.materia_id][n.estudiante_id] = {};
      notasMap[n.materia_id][n.estudiante_id][n.periodo.corte] = n;
    });

    const wb = new ExcelJS.Workbook();

    // ── Hoja resumen con promedios finales por materia ──
    const hojaResumen = wb.addWorksheet('Resumen General');

    const hdrStyle = {
      font:      { bold: true, color: { argb: C.white }, size: 10 },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };

    // Título
    hojaResumen.mergeCells(`A1:${String.fromCharCode(66 + materias.length)}1`);
    hojaResumen.getCell('A1').value = `REPORTE GENERAL — ${grado?.nombre?.toUpperCase()} — ${anio}`;
    hojaResumen.getCell('A1').style = { ...hdrStyle, font: { ...hdrStyle.font, size: 12 } };
    hojaResumen.getRow(1).height = 28;

    // Headers
    const row2 = hojaResumen.getRow(2);
    row2.getCell(1).value = 'Código';
    row2.getCell(2).value = 'Apellidos y Nombres';
    materias.forEach((m, i) => { row2.getCell(i + 3).value = m.nombre; });
    row2.getCell(materias.length + 3).value = 'Materias perdidas';
    row2.getCell(materias.length + 4).value = 'Estado';
    row2.eachCell(c => { c.style = hdrStyle; });
    hojaResumen.getRow(2).height = 20;

    hojaResumen.columns = [
      { width: 18 }, { width: 28 },
      ...materias.map(() => ({ width: 14 })),
      { width: 16 }, { width: 14 },
    ];

    // Filas de estudiantes
    estudiantes.forEach((est, idx) => {
      const fila = hojaResumen.addRow([]);
      const bg   = idx % 2 === 0 ? C.gray : C.white;

      fila.getCell(1).value = est.codigo_estudiante || '';
      fila.getCell(2).value = `${est.apellido1}${est.apellido2 ? ' ' + est.apellido2 : ''}, ${est.nombre1}${est.nombre2 ? ' ' + est.nombre2 : ''}`;

      let materiasPerdidas = 0;

      materias.forEach((m, i) => {
        const notasEst = notasMap[m.id]?.[est.id] || {};
        const vals     = Object.values(notasEst).map(n => parseFloat(n.nota_numerica)).filter(v => !isNaN(v));
        const cell     = fila.getCell(i + 3);

        if (vals.length > 0) {
          const prom = (vals.reduce((a, b) => a + b, 0) / vals.length);
          const coef = calcCoef(prom);
          if (prom < 60) materiasPerdidas++;
          cell.value = parseFloat(prom.toFixed(1));
          cell.style = {
            alignment: { horizontal: 'center' },
            fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: coefColor(coef) } },
            font:      { bold: true, size: 9 },
          };
        } else {
          cell.value = '—';
          cell.style = { alignment: { horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } } };
        }
      });

      const estado = materiasPerdidas >= 3 ? 'Repitente' : 'Aprobado';
      fila.getCell(materias.length + 3).value = materiasPerdidas;
      fila.getCell(materias.length + 3).style = {
        alignment: { horizontal: 'center' },
        font:      { bold: true, color: { argb: materiasPerdidas >= 3 ? C.warning : C.success } },
      };
      fila.getCell(materias.length + 4).value = estado;
      fila.getCell(materias.length + 4).style = {
        alignment: { horizontal: 'center' },
        fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: materiasPerdidas >= 3 ? C.bgAF : C.bgAA } },
        font:      { bold: true, color: { argb: materiasPerdidas >= 3 ? C.warning : C.success }, size: 9 },
      };
      fila.height = 16;
    });

    hojaResumen.views = [{ state: 'frozen', xSplit: 2, ySplit: 2 }];

    // ── Una hoja por materia con el detalle de 4 cortes ──
    for (const materia of materias) {
      const hoja = wb.addWorksheet(materia.nombre.substring(0, 31));

      hoja.mergeCells('A1:N1');
      hoja.getCell('A1').value = `${materia.nombre.toUpperCase()} — ${grado?.nombre?.toUpperCase()} — ${anio}`;
      hoja.getCell('A1').style = { ...hdrStyle, font: { ...hdrStyle.font, size: 11 } };
      hoja.getRow(1).height = 26;

      // Headers
      const r2 = hoja.getRow(2);
      ['Código', 'Apellidos y Nombres', 'C1', 'Niv', 'C2', 'Niv', 'C3', 'Niv', 'C4', 'Niv', 'Sem1', 'Sem2', 'Prom', 'Nivel'].forEach((h, i) => {
        r2.getCell(i + 1).value = h;
        r2.getCell(i + 1).style = { ...hdrStyle, font: { ...hdrStyle.font, size: 9 } };
      });
      hoja.getRow(2).height = 18;
      hoja.columns = [{ width: 18 }, { width: 26 }, ...Array(12).fill({ width: 8 })];

      estudiantes.forEach((est, idx) => {
        const bg   = idx % 2 === 0 ? C.gray : C.white;
        const fila = hoja.addRow([]);
        fila.getCell(1).value = est.codigo_estudiante || '';
        fila.getCell(2).value = `${est.apellido1}${est.apellido2 ? ' ' + est.apellido2 : ''}, ${est.nombre1}`;

        const notasEst = notasMap[materia.id]?.[est.id] || {};
        const vals = {};

        [1, 2, 3, 4].forEach((corte, ci) => {
          const n   = notasEst[corte];
          const col = ci * 2 + 3;
          if (n) {
            const v = parseFloat(n.nota_numerica);
            const c = n.coeficiente || calcCoef(v);
            vals[corte] = v;
            fila.getCell(col).value     = v;
            fila.getCell(col + 1).value = c;
            fila.getCell(col).style     = { alignment: { horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } } };
            fila.getCell(col + 1).style = { alignment: { horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: coefColor(c) } }, font: { bold: true, size: 8 } };
          } else {
            fila.getCell(col).value = '—'; fila.getCell(col + 1).value = '—';
            [col, col + 1].forEach(c => fila.getCell(c).style = { alignment: { horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } } });
          }
        });

        const sem1 = vals[1] !== undefined && vals[2] !== undefined ? ((vals[1] + vals[2]) / 2).toFixed(1) : '—';
        const sem2 = vals[3] !== undefined && vals[4] !== undefined ? ((vals[3] + vals[4]) / 2).toFixed(1) : '—';
        fila.getCell(11).value = sem1;
        fila.getCell(12).value = sem2;

        const valsArr = Object.values(vals);
        if (valsArr.length > 0) {
          const prom = (valsArr.reduce((a, b) => a + b, 0) / valsArr.length).toFixed(1);
          const coef = calcCoef(parseFloat(prom));
          fila.getCell(13).value = parseFloat(prom);
          fila.getCell(14).value = coef;
          fila.getCell(14).style = { alignment: { horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: coefColor(coef) } }, font: { bold: true, size: 8 } };
        } else {
          fila.getCell(13).value = '—'; fila.getCell(14).value = '—';
        }
        fila.height = 15;
      });

      hoja.views = [{ state: 'frozen', xSplit: 2, ySplit: 2 }];
    }

    const fecha    = new Date().toISOString().split('T')[0];
    const filename = `notas_grado_completo_${grado?.nombre?.replace(/\s/g, '_')}_${anio}_${fecha}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exportarGradoGeneral:', error);
    res.redirect('/notas?error=Error al generar el reporte');
  }
}

// ── GET /notas/exportar/grado-corte ───────────────────────────
// Reporte de un corte — todas las materias del grado en hojas separadas
async function exportarGradoCorte(req, res) {
  const { grado_id, periodo_id } = req.query;
  if (!grado_id || !periodo_id) return res.redirect('/notas?error=Selecciona grado y corte');

  try {
    const [grado, periodo, materias, estudiantes] = await Promise.all([
      Grado.findByPk(grado_id),
      Periodo.findByPk(periodo_id),
      Materia.findAll({ where: { grado_id, activo: true }, order: [['nombre', 'ASC']] }),
      Estudiante.findAll({
        where: { grado_id, estado_matricula: { [Op.in]: ['activo', 'repitente'] } },
        order: [['apellido1', 'ASC'], ['nombre1', 'ASC']],
      }),
    ]);

    const notas = await Nota.findAll({
      where: {
        materia_id: { [Op.in]: materias.map(m => m.id) },
        periodo_id,
      },
    });

    // Mapa: materia_id → estudiante_id → nota
    const notasMap = {};
    notas.forEach(n => {
      if (!notasMap[n.materia_id]) notasMap[n.materia_id] = {};
      notasMap[n.materia_id][n.estudiante_id] = n;
    });

    const wb  = new ExcelJS.Workbook();
    const hdrStyle = {
      font:      { bold: true, color: { argb: C.white }, size: 10 },
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };

    // Una hoja por materia
    for (const materia of materias) {
      const hoja = wb.addWorksheet(materia.nombre.substring(0, 31));

      hoja.mergeCells('A1:F1');
      hoja.getCell('A1').value = `${materia.nombre.toUpperCase()} — ${grado?.nombre?.toUpperCase()} — CORTE ${periodo?.corte}, ${periodo?.anio}`;
      hoja.getCell('A1').style = { ...hdrStyle, font: { ...hdrStyle.font, size: 11 } };
      hoja.getRow(1).height = 26;

      const r2 = hoja.getRow(2);
      ['N°', 'Código', 'Apellidos y Nombres', 'Nota', 'Nivel', 'Observación'].forEach((h, i) => {
        r2.getCell(i + 1).value = h;
        r2.getCell(i + 1).style = hdrStyle;
      });
      hoja.getRow(2).height = 18;
      hoja.columns = [{ width: 5 }, { width: 18 }, { width: 28 }, { width: 10 }, { width: 10 }, { width: 25 }];

      estudiantes.forEach((est, idx) => {
        const nota = notasMap[materia.id]?.[est.id];
        const bg   = idx % 2 === 0 ? C.gray : C.white;
        const fila = hoja.addRow([
          idx + 1,
          est.codigo_estudiante || '',
          `${est.apellido1}${est.apellido2 ? ' ' + est.apellido2 : ''}, ${est.nombre1}`,
          nota ? parseFloat(nota.nota_numerica) : '—',
          nota ? (nota.coeficiente || '—') : '—',
          nota ? (nota.observacion || '') : '',
        ]);

        fila.eachCell((cell, i) => {
          cell.style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }, alignment: { vertical: 'middle' } };
          if (i === 5 && nota) {
            cell.style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: coefColor(nota.coeficiente) } }, alignment: { horizontal: 'center' }, font: { bold: true, size: 9 } };
          }
        });
        fila.height = 15;
      });

      hoja.views = [{ state: 'frozen', ySplit: 2 }];
    }

    const fecha    = new Date().toISOString().split('T')[0];
    const filename = `notas_corte${periodo?.corte}_${grado?.nombre?.replace(/\s/g, '_')}_${fecha}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error exportarGradoCorte:', error);
    res.redirect('/notas?error=Error al generar el reporte');
  }
}
