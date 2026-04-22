// =============================================================
//  src/controllers/reportes.controller.js
//  Genera los 3 reportes estadísticos del MINED en un solo Excel:
//  1. Estadísticas de Permanencia y Aprobación (Nota Final)
//  2. Estadística Nota Final por materia
//  3. F30 — Listado de Reprobados
// =============================================================

const ExcelJS  = require('exceljs');
const { Estudiante, Nota, Materia, Grado, Periodo } = require('../models');
const { Op }   = require('sequelize');

// ── Colores ───────────────────────────────────────────────────
const C = {
  navy:   '0D2B55', blue:   '1A4A8A', accent: 'C8A84B',
  green:  '1E7E4A', red:    'C0392B', yellow: 'D4870A',
  gray:   'F2F3F4', white:  'FFFFFF', muted:  '64748B',
  bgAA:   'DCFCE7', bgAS:   'DBEAFE', bgAF:   'FFF8E6', bgAI:   'FEE2E2',
};

function calcCoef(n) {
  if (n >= 90) return 'AA';
  if (n >= 76) return 'AS';
  if (n >= 60) return 'AF';
  return 'AI';
}

const hdrStyle = (bg = C.navy) => ({
  font:      { bold: true, color: { argb: C.white }, size: 10 },
  fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  border:    { top: bdr(), bottom: bdr(), left: bdr(), right: bdr() },
});

function bdr(c = '000000') { return { style: 'thin', color: { argb: c } }; }
function borders() { return { top: bdr(), bottom: bdr(), left: bdr(), right: bdr() }; }

function dataCell(value, { bg = C.white, bold = false, align = 'center', color = '000000' } = {}) {
  return {
    value,
    style: {
      fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
      font:      { bold, color: { argb: color }, size: 9 },
      alignment: { horizontal: align, vertical: 'middle', wrapText: true },
      border:    borders(),
    },
  };
}

// ── GET /admin/reportes ───────────────────────────────────────
const mostrarReportes = async (req, res) => {
  try {
    const anio     = new Date().getFullYear();
    const periodos = await Periodo.findAll({ where: { anio }, order: [['corte', 'ASC']] });

    res.render('admin/reportes', {
      titulo:  'Reportes MINED',
      anio,
      periodos,
      mensaje: req.query.mensaje || null,
      error:   req.query.error   || null,
    });
  } catch (error) {
    console.error('Error en mostrarReportes:', error);
    res.redirect('/dashboard');
  }
};

// ── GET /admin/reportes/generar ───────────────────────────────
const generarReportes = async (req, res) => {
  try {
    const anio = parseInt(req.query.anio) || new Date().getFullYear();

    // ── Cargar datos base ────────────────────────────────────
    const periodos = await Periodo.findAll({ where: { anio }, order: [['corte', 'ASC']] });
    const periodoIds = periodos.map(p => p.id);

    const grados = await Grado.findAll({
      where:   { activo: true },
      order:   [['orden', 'ASC']],
      include: [{
        model:    Materia,
        as:       'materias',
        where:    { activo: true },
        required: false,
        order:    [['nombre', 'ASC']],
      }],
    });

    const gradosPre  = grados.filter(g => g.nivel === 'preescolar');
    const gradosPrim = grados.filter(g => g.nivel === 'primaria');
    const gradosSec  = grados.filter(g => g.nivel === 'secundaria');

    // Cargar todos los estudiantes
    const estudiantes = await Estudiante.findAll({
      include: [{ model: Grado, as: 'grado', attributes: ['id', 'nombre', 'nivel', 'orden'] }],
    });

    // Cargar todas las notas del año
    const notas = periodoIds.length > 0 ? await Nota.findAll({
      where:   { periodo_id: { [Op.in]: periodoIds } },
      include: [{ model: Materia, as: 'materia', attributes: ['id', 'nombre', 'grado_id'] }],
    }) : [];

    // ── Mapas de ayuda ───────────────────────────────────────
    // notasPorEst: estudiante_id → materia_id → [notas]
    const notasPorEst = {};
    notas.forEach(n => {
      if (!notasPorEst[n.estudiante_id]) notasPorEst[n.estudiante_id] = {};
      if (!notasPorEst[n.estudiante_id][n.materia_id]) notasPorEst[n.estudiante_id][n.materia_id] = [];
      notasPorEst[n.estudiante_id][n.materia_id].push(parseFloat(n.nota_numerica));
    });

    // Promedio final por estudiante por materia
    function promedioFinal(estId, matId) {
      const ns = notasPorEst[estId]?.[matId] || [];
      if (ns.length === 0) return null;
      return ns.reduce((a, b) => a + b, 0) / ns.length;
    }

    // Estadísticas por grado
    function statsGrado(grado) {
      const ests = estudiantes.filter(e => e.grado_id === grado.id);
      const matriculaInicial = {
        AS: ests.length,
        F:  ests.filter(e => e.genero === 'femenino').length,
      };
      const activos = ests.filter(e => ['activo', 'repitente'].includes(e.estado_matricula));
      const retirados = ests.filter(e => e.estado_matricula === 'retirado');
      const matriculaActual = {
        AS: activos.length,
        F:  activos.filter(e => e.genero === 'femenino').length,
      };
      const permanencia = {
        AS: matriculaInicial.AS > 0 ? ((matriculaActual.AS / matriculaInicial.AS) * 100).toFixed(1) : 0,
        F:  matriculaInicial.F  > 0 ? ((matriculaActual.F  / matriculaInicial.F)  * 100).toFixed(1) : 0,
      };

      // Evaluados = estudiantes con al menos una nota
      const evaluados = activos.filter(e => Object.keys(notasPorEst[e.id] || {}).length > 0);
      const noEvaluados = activos.filter(e => Object.keys(notasPorEst[e.id] || {}).length === 0);

      // Aprobados = sin materias con promedio < 60
      const aprobados = activos.filter(e => {
        const materias = grado.materias || [];
        const perdidas = materias.filter(m => {
          const prom = promedioFinal(e.id, m.id);
          return prom !== null && prom < 60;
        });
        return perdidas.length === 0 && Object.keys(notasPorEst[e.id] || {}).length > 0;
      });

      // Aplazados
      const aplazados1a2 = activos.filter(e => {
        const materias = grado.materias || [];
        const perdidas = materias.filter(m => {
          const prom = promedioFinal(e.id, m.id);
          return prom !== null && prom < 60;
        }).length;
        return perdidas >= 1 && perdidas <= 2;
      });
      const aplazados3mas = activos.filter(e => {
        const materias = grado.materias || [];
        const perdidas = materias.filter(m => {
          const prom = promedioFinal(e.id, m.id);
          return prom !== null && prom < 60;
        }).length;
        return perdidas >= 3;
      });

      const pctAprobados = {
        AS: evaluados.length > 0 ? ((aprobados.filter(e=>e.genero!=='femenino').length + aprobados.filter(e=>e.genero==='femenino').length) / evaluados.length * 100).toFixed(1) : 0,
        F:  evaluados.filter(e=>e.genero==='femenino').length > 0
              ? (aprobados.filter(e=>e.genero==='femenino').length / evaluados.filter(e=>e.genero==='femenino').length * 100).toFixed(1) : 0,
      };

      return {
        nombre: grado.nombre,
        matriculaInicial, matriculaActual, permanencia,
        evaluados:   { AS: evaluados.length,   F: evaluados.filter(e=>e.genero==='femenino').length },
        noEvaluados: { AS: noEvaluados.length, F: noEvaluados.filter(e=>e.genero==='femenino').length },
        aprobados:   { AS: aprobados.length,   F: aprobados.filter(e=>e.genero==='femenino').length },
        pctAprobados,
        aplazados1a2:  { AS: aplazados1a2.length,  F: aplazados1a2.filter(e=>e.genero==='femenino').length },
        aplazados3mas: { AS: aplazados3mas.length, F: aplazados3mas.filter(e=>e.genero==='femenino').length },
        activos,
      };
    }

    // ── Crear workbook ───────────────────────────────────────
    const wb = new ExcelJS.Workbook();

    // ==========================================================
    // HOJA 1 — PERMANENCIA Y APROBACIÓN (PREESCOLAR)
    // ==========================================================
    if (gradosPre.length > 0) {
      const hoja = wb.addWorksheet('Preescolar - Permanencia');
      await crearHojaPermanenciaPreescolar(hoja, gradosPre, estudiantes, anio);
    }

    // ==========================================================
    // HOJA 2 — PERMANENCIA Y APROBACIÓN (PRIMARIA)
    // ==========================================================
    {
      const hoja = wb.addWorksheet('Primaria - Permanencia');
      await crearHojaPermanencia(hoja, 'EDUCACIÓN PRIMARIA', gradosPrim, statsGrado, anio);
    }

    // ==========================================================
    // HOJA 3 — PERMANENCIA Y APROBACIÓN (SECUNDARIA)
    // ==========================================================
    {
      const hoja = wb.addWorksheet('Secundaria - Permanencia');
      await crearHojaPermanencia(hoja, 'EDUCACIÓN SECUNDARIA', gradosSec, statsGrado, anio);
    }

    // ==========================================================
    // HOJA 4 — NOTA FINAL POR MATERIA (PRIMARIA)
    // ==========================================================
    {
      const hoja = wb.addWorksheet('Primaria - Nota Final');
      await crearHojaNotaFinal(hoja, 'EDUCACIÓN PRIMARIA', gradosPrim, estudiantes, promedioFinal, anio);
    }

    // ==========================================================
    // HOJA 5 — NOTA FINAL POR MATERIA (SECUNDARIA)
    // ==========================================================
    {
      const hoja = wb.addWorksheet('Secundaria - Nota Final');
      await crearHojaNotaFinal(hoja, 'EDUCACIÓN SECUNDARIA', gradosSec, estudiantes, promedioFinal, anio);
    }

    // ==========================================================
    // HOJA 6 — F30 REPROBADOS
    // ==========================================================
    {
      const hoja = wb.addWorksheet('F30 - Reprobados');
      await crearHojaF30(hoja, [...gradosPrim, ...gradosSec], estudiantes, promedioFinal, anio);
    }

    // ── Enviar archivo ───────────────────────────────────────
    const fecha    = new Date().toISOString().split('T')[0];
    const filename = `Reportes_MINED_${anio}_${fecha}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error en generarReportes:', error);
    res.redirect('/admin/reportes?error=Error al generar los reportes');
  }
};

// =============================================================
//  HOJA DE PERMANENCIA — PREESCOLAR
// =============================================================
async function crearHojaPermanenciaPreescolar(hoja, grados, estudiantes, anio) {
  let r = 1;

  // Encabezado
  hoja.mergeCells(`A${r}:F${r}`);
  setCell(hoja, `A${r}`, `DIRECCIÓN DE EDUCACIÓN INICIAL — PREESCOLAR`, hdrStyle(C.navy));
  hoja.getRow(r).height = 22; r++;

  hoja.mergeCells(`A${r}:F${r}`);
  setCell(hoja, `A${r}`, `NOMBRE DEL CENTRO: CENTRO EDUCATIVO MONTE HERMÓN`, hdrStyle(C.blue));
  r++;

  hoja.mergeCells(`A${r}:F${r}`);
  setCell(hoja, `A${r}`, `TURNO: MATUTINO  |  MUNICIPIO: MANAGUA  |  AÑO LECTIVO: ${anio}  |  NOTA FINAL`, hdrStyle(C.blue));
  hoja.getRow(r).height = 18; r++;

  r++; // espacio

  // Sub-sección: PREESCOLAR FORMAL PURO
  hoja.mergeCells(`A${r}:F${r}`);
  setCell(hoja, `A${r}`, 'PREESCOLAR FORMAL PURO', hdrStyle(C.accent));
  r++;

  // Headers
  ['NIVELES', 'MATR. INICIAL AS', 'MATR. INICIAL F', 'MATR. ACTUAL AS', 'MATR. ACTUAL F', '% APROBACIÓN'].forEach((h, i) => {
    setCell(hoja, `${col(i)}${r}`, h, hdrStyle(C.blue));
  });
  hoja.getRow(r).height = 20; r++;

  let totMiAS=0, totMiF=0, totMaAS=0, totMaF=0;

  grados.forEach((g, gi) => {
    const ests    = estudiantes.filter(e => e.grado_id === g.id);
    const miAS    = ests.length;
    const miF     = ests.filter(e => e.genero === 'femenino').length;
    const activos = ests.filter(e => ['activo','repitente'].includes(e.estado_matricula));
    const maAS    = activos.length;
    const maF     = activos.filter(e => e.genero === 'femenino').length;
    const pct     = maAS > 0 ? 100 : 0;
    const bg      = gi % 2 === 0 ? C.gray : C.white;

    [g.nombre, miAS, miF, maAS, maF, `${pct}%`].forEach((v, i) => {
      setCell(hoja, `${col(i)}${r}`, v, { fill: { type:'pattern', pattern:'solid', fgColor:{argb:bg} }, font:{size:9}, alignment:{horizontal: i===0?'left':'center', vertical:'middle'}, border: borders() });
    });
    totMiAS+=miAS; totMiF+=miF; totMaAS+=maAS; totMaF+=maF;
    r++;
  });

  // Total
  ['TOTAL', totMiAS, totMiF, totMaAS, totMaF, totMaAS > 0 ? '100%' : '0%'].forEach((v, i) => {
    setCell(hoja, `${col(i)}${r}`, v, hdrStyle(C.navy));
  });
  r++;

  hoja.columns = [{width:18},{width:16},{width:16},{width:16},{width:16},{width:14}];
}

// =============================================================
//  HOJA DE PERMANENCIA — PRIMARIA / SECUNDARIA
// =============================================================
async function crearHojaPermanencia(hoja, titulo, grados, statsGrado, anio) {
  let r = 1;

  hoja.mergeCells(`A${r}:S${r}`);
  setCell(hoja, `A${r}`, titulo, hdrStyle(C.navy));
  hoja.getRow(r).height = 22; r++;

  hoja.mergeCells(`A${r}:S${r}`);
  setCell(hoja, `A${r}`, `NOMBRE DEL CENTRO: CENTRO EDUCATIVO MONTE HERMÓN  |  TURNO: MATUTINO  |  MUNICIPIO: MANAGUA  |  INFORME NOTA FINAL`, hdrStyle(C.blue));
  hoja.getRow(r).height = 18; r++;

  r++; // espacio

  // Fila de grupos de columnas
  const grupos = [
    ['GRADO', 1], ['MATRÍCULA INICIAL', 2], ['MATRÍCULA ACTUAL', 2],
    ['% DE PERMANENCIA', 2], ['EVALUADOS', 2], ['NO EVALUADOS', 2],
    ['APROBADOS', 2], ['% DE APROBADOS', 2], ['APLAZADOS 1-2', 2], ['APLAZADOS 3+', 2],
  ];
  let colIdx = 0;
  grupos.forEach(([label, span]) => {
    const startCol = col(colIdx);
    if (span > 1) {
      const endCol = col(colIdx + span - 1);
      hoja.mergeCells(`${startCol}${r}:${endCol}${r}`);
    }
    setCell(hoja, `${startCol}${r}`, label, hdrStyle(C.blue));
    colIdx += span;
  });
  hoja.getRow(r).height = 30; r++;

  // Sub-headers AS/F
  setCell(hoja, `A${r}`, '', hdrStyle(C.navy));
  for (let i = 1; i < 19; i++) {
    setCell(hoja, `${col(i)}${r}`, i % 2 === 1 ? 'AS' : 'F', hdrStyle('374151'));
  }
  hoja.getRow(r).height = 16; r++;

  // Totales acumulados
  let tots = Array(18).fill(0);

  grados.forEach((g, gi) => {
    const s  = statsGrado(g);
    const bg = gi % 2 === 0 ? C.gray : C.white;
    const vals = [
      g.nombre,
      s.matriculaInicial.AS, s.matriculaInicial.F,
      s.matriculaActual.AS,  s.matriculaActual.F,
      s.permanencia.AS,      s.permanencia.F,
      s.evaluados.AS,        s.evaluados.F,
      s.noEvaluados.AS,      s.noEvaluados.F,
      s.aprobados.AS,        s.aprobados.F,
      s.pctAprobados.AS,     s.pctAprobados.F,
      s.aplazados1a2.AS,     s.aplazados1a2.F,
      s.aplazados3mas.AS,    s.aplazados3mas.F,
    ];
    vals.forEach((v, i) => {
      setCell(hoja, `${col(i)}${r}`, v, {
        fill: {type:'pattern',pattern:'solid',fgColor:{argb:bg}},
        font: {size:9, bold: i===0},
        alignment: {horizontal: i===0?'left':'center', vertical:'middle'},
        border: borders(),
      });
      if (i > 0 && typeof v === 'number') tots[i-1] += v;
    });
    r++;
  });

  // Fila de totales
  const totVals = ['TOTAL', ...tots.map((v,i) => {
    // Los % no se suman
    if ([4,5,12,13].includes(i)) return '—';
    return v;
  })];
  totVals.forEach((v, i) => {
    setCell(hoja, `${col(i)}${r}`, v, hdrStyle(C.navy));
  });

  hoja.columns = [
    {width:16},
    ...Array(18).fill({width:8}),
  ];
}

// =============================================================
//  HOJA DE NOTA FINAL POR MATERIA
// =============================================================
async function crearHojaNotaFinal(hoja, titulo, grados, estudiantes, promedioFinal, anio) {
  let r = 1;

  // Recopilar todas las materias únicas del nivel
  const todasMaterias = [];
  const nombresVistos = new Set();
  grados.forEach(g => {
    (g.materias || []).forEach(m => {
      if (!nombresVistos.has(m.nombre)) {
        nombresVistos.add(m.nombre);
        todasMaterias.push(m.nombre);
      }
    });
  });

  const totalCols = 5 + todasMaterias.length * 2; // grado + matr.ini + matr.act + aprobLimpios + materias
  const lastCol   = col(totalCols - 1);

  hoja.mergeCells(`A${r}:${lastCol}${r}`);
  setCell(hoja, `A${r}`, titulo, hdrStyle(C.navy));
  hoja.getRow(r).height = 22; r++;

  hoja.mergeCells(`A${r}:${lastCol}${r}`);
  setCell(hoja, `A${r}`, `NOMBRE DEL CENTRO: CENTRO EDUCATIVO MONTE HERMÓN  |  TURNO: MATUTINO  |  INFORME NOTA FINAL  |  AÑO: ${anio}`, hdrStyle(C.blue));
  r++;
  r++; // espacio

  // Row 1 de headers: grupos
  setCell(hoja, `A${r}`, 'GRADO', hdrStyle(C.navy));
  setCell(hoja, `B${r}`, 'MATR. INICIAL', hdrStyle(C.blue));
  hoja.mergeCells(`B${r}:C${r}`);
  setCell(hoja, `D${r}`, 'MATR. ACTUAL', hdrStyle(C.blue));
  hoja.mergeCells(`D${r}:E${r}`);
  let ci = 5;
  todasMaterias.forEach(nombre => {
    hoja.mergeCells(`${col(ci)}${r}:${col(ci+1)}${r}`);
    setCell(hoja, `${col(ci)}${r}`, nombre, hdrStyle(C.blue));
    ci += 2;
  });
  hoja.getRow(r).height = 40; r++;

  // Row 2: AS/F sub-headers
  ['GRADO','AS','F','AS','F'].forEach((h,i) => {
    setCell(hoja, `${col(i)}${r}`, h, hdrStyle('374151'));
  });
  ci = 5;
  todasMaterias.forEach(() => {
    setCell(hoja, `${col(ci)}${r}`,   'AS', hdrStyle('374151'));
    setCell(hoja, `${col(ci+1)}${r}`, 'F',  hdrStyle('374151'));
    ci += 2;
  });
  hoja.getRow(r).height = 16; r++;

  // Filas por grado
  grados.forEach((g, gi) => {
    const ests    = estudiantes.filter(e => e.grado_id === g.id);
    const activos = ests.filter(e => ['activo','repitente'].includes(e.estado_matricula));
    const bg      = gi % 2 === 0 ? C.gray : C.white;

    const miAS = ests.length;
    const miF  = ests.filter(e => e.genero === 'femenino').length;
    const maAS = activos.length;
    const maF  = activos.filter(e => e.genero === 'femenino').length;

    const rowVals = [g.nombre, miAS, miF, maAS, maF];

    todasMaterias.forEach(nombre => {
      // Buscar la materia en este grado
      const mat = (g.materias || []).find(m => m.nombre === nombre);
      if (!mat) { rowVals.push('—', '—'); return; }

      const aprobAS = activos.filter(e => {
        const p = promedioFinal(e.id, mat.id);
        return p !== null && p >= 60;
      }).length;
      const aprobF = activos.filter(e => {
        const p = promedioFinal(e.id, mat.id);
        return p !== null && p >= 60 && e.genero === 'femenino';
      }).length;
      rowVals.push(aprobAS, aprobF);
    });

    rowVals.forEach((v, i) => {
      setCell(hoja, `${col(i)}${r}`, v, {
        fill: {type:'pattern',pattern:'solid',fgColor:{argb:bg}},
        font: {size:9, bold: i===0},
        alignment: {horizontal: i===0?'left':'center', vertical:'middle'},
        border: borders(),
      });
    });
    r++;
  });

  hoja.columns = [
    {width:16}, {width:8}, {width:8}, {width:8}, {width:8},
    ...Array(todasMaterias.length * 2).fill({width:10}),
  ];

  hoja.views = [{ state: 'frozen', xSplit: 1, ySplit: r - grados.length - 1 }];
}

// =============================================================
//  HOJA F30 — REPROBADOS
// =============================================================
async function crearHojaF30(hoja, grados, estudiantes, promedioFinal, anio) {
  let r = 1;

  // Encabezado
  const headers = [
    'No.', 'Modalidad', 'Dependencia', 'Turno', 'Sección', 'Grado/Ciclo/Nivel',
    'Apellidos y Nombres', 'Sexo', 'Cédula',
    'Reprobado en 1 asignatura', 'Reprobado en 2 asignaturas', 'Reprobado en 3+ asignaturas',
    'Materias reprobadas',
  ];

  hoja.mergeCells(`A${r}:M${r}`);
  setCell(hoja, `A${r}`, 'MINISTERIO DE EDUCACIÓN — ESTADÍSTICAS EDUCATIVAS', hdrStyle(C.navy));
  hoja.getRow(r).height = 20; r++;

  hoja.mergeCells(`A${r}:M${r}`);
  setCell(hoja, `A${r}`, `FORME30 — NOTA FINAL, LISTADO DE ESTUDIANTES REPROBADOS EN 1, 2, 3 O MÁS ASIGNATURAS`, hdrStyle(C.blue));
  r++;

  hoja.mergeCells(`A${r}:M${r}`);
  setCell(hoja, `A${r}`, `Departamento: Managua  |  Municipio: Distrito III  |  CodUnico: 22531  |  Cód_Centro: 21137  |  Centro: Monte Hermón  |  Año: ${anio}`, hdrStyle('374151'));
  hoja.getRow(r).height = 16; r++;

  r++; // espacio

  headers.forEach((h, i) => {
    setCell(hoja, `${col(i)}${r}`, h, hdrStyle(C.blue));
  });
  hoja.getRow(r).height = 30; r++;

  let num = 1;

  grados.forEach(g => {
    const ests    = estudiantes.filter(e => e.grado_id === g.id);
    const activos = ests.filter(e => ['activo','repitente'].includes(e.estado_matricula));

    activos.forEach(est => {
      const mats    = g.materias || [];
      const perdidas = mats.filter(m => {
        const p = promedioFinal(est.id, m.id);
        return p !== null && p < 60;
      });

      if (perdidas.length === 0) return;

      const bg = num % 2 === 0 ? C.gray : C.white;
      const modalidad = g.nivel === 'primaria' ? 'PRIMARIA' : 'SECUNDARIA';

      const vals = [
        num,
        modalidad,
        'CHIQUILISTAGUA',
        'MATUTINO',
        'A',
        g.nombre,
        `${est.apellido1}${est.apellido2 ? ' ' + est.apellido2 : ''}, ${est.nombre1}${est.nombre2 ? ' ' + est.nombre2 : ''}`,
        est.genero === 'femenino' ? 'F' : 'M',
        est.cedula_madre || est.cedula_padre || '',
        perdidas.length === 1 ? 'SI' : 'NO',
        perdidas.length === 2 ? 'SI' : 'NO',
        perdidas.length >= 3 ? 'SI' : 'NO',
        perdidas.map(m => m.nombre).join(', '),
      ];

      vals.forEach((v, i) => {
        const cellBg = i === 9 && v === 'SI' ? C.bgAF
                     : i === 10 && v === 'SI' ? C.bgAF
                     : i === 11 && v === 'SI' ? C.bgAI
                     : bg;
        setCell(hoja, `${col(i)}${r}`, v, {
          fill: {type:'pattern',pattern:'solid',fgColor:{argb:cellBg}},
          font: {size:9, bold: [9,10,11].includes(i) && v==='SI'},
          alignment: {horizontal: i===6||i===12?'left':'center', vertical:'middle', wrapText:true},
          border: borders(),
        });
      });
      r++;
      num++;
    });
  });

  if (num === 1) {
    hoja.mergeCells(`A${r}:M${r}`);
    setCell(hoja, `A${r}`, 'Sin estudiantes reprobados', {
      fill: {type:'pattern',pattern:'solid',fgColor:{argb:C.gray}},
      font: {italic:true, color:{argb:C.muted}, size:9},
      alignment: {horizontal:'center', vertical:'middle'},
    });
  }

  hoja.columns = [
    {width:5},{width:12},{width:16},{width:10},{width:8},{width:14},
    {width:28},{width:6},{width:14},{width:12},{width:12},{width:12},{width:40},
  ];

  hoja.views = [{ state: 'frozen', ySplit: r - (num-1) }];
}

// ── Helpers ───────────────────────────────────────────────────
function col(i) {
  if (i < 26) return String.fromCharCode(65 + i);
  return String.fromCharCode(64 + Math.floor(i/26)) + String.fromCharCode(65 + (i%26));
}

function setCell(hoja, addr, value, style) {
  const cell  = hoja.getCell(addr);
  cell.value  = value;
  if (style.font)      cell.font      = style.font;
  if (style.fill)      cell.fill      = style.fill;
  if (style.alignment) cell.alignment = style.alignment;
  if (style.border)    cell.border    = style.border;
}

module.exports = { mostrarReportes, generarReportes };
