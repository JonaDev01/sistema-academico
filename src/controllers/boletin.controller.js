// =============================================================
//  src/controllers/boletin.controller.js
//  Genera boletín PDF según el nivel del estudiante
//  Preescolar: solo cualitativo
//  Primaria / Secundaria: cualitativo + cuantitativo
// =============================================================

const puppeteer = require('puppeteer');
const path      = require('path');
const { Estudiante, Nota, Materia, Grado, Periodo, Docente, Asignacion } = require('../models');
const { Op }    = require('sequelize');

// ── Helpers ──────────────────────────────────────────────────
function calcCoef(nota) {
  if (nota >= 90) return 'AA';
  if (nota >= 76) return 'AS';
  if (nota >= 60) return 'AF';
  return 'AI';
}

function nombreCoef(c) {
  return { AA:'Aprendizaje Avanzado', AS:'Aprendizaje Satisfactorio', AF:'Aprendizaje Fundamental', AI:'Aprendizaje Inicial' }[c] || c;
}

// ── GET /boletin ──────────────────────────────────────────────
// Pantalla de selección
const mostrarBoletin = async (req, res) => {
  try {
    const grados = await Grado.findAll({
      where: { activo: true },
      order: [['orden', 'ASC']],
    });

    const anio = new Date().getFullYear();
    const periodos = await Periodo.findAll({
      where: { anio },
      order: [['corte', 'ASC']],
    });

    res.render('boletin/selector', {
      titulo:  'Boletín PDF',
      grados,
      periodos,
      mensaje: req.query.mensaje || null,
      error:   req.query.error   || null,
    });
  } catch (error) {
    console.error('Error en mostrarBoletin:', error);
    res.redirect('/dashboard');
  }
};

// ── GET /boletin/generar ──────────────────────────────────────
const generarBoletin = async (req, res) => {
  const { estudiante_id } = req.query;

  if (!estudiante_id) return res.redirect('/boletin?error=Selecciona un estudiante');

  try {
    const anio = new Date().getFullYear();

    // Cargar estudiante con su grado
    const estudiante = await Estudiante.findByPk(estudiante_id, {
      include: [{ model: Grado, as: 'grado' }],
    });
    if (!estudiante) return res.redirect('/boletin?error=Estudiante no encontrado');

    // Cargar periodos del año
    const periodos = await Periodo.findAll({
      where: { anio },
      order: [['corte', 'ASC']],
    });

    // Cargar materias del grado
    const materias = await Materia.findAll({
      where:  { grado_id: estudiante.grado_id, activo: true },
      order:  [['nombre', 'ASC']],
    });

    // Cargar todas las notas del estudiante en el año
    const notas = await Nota.findAll({
      where:   { estudiante_id },
      include: [
        { model: Materia, as: 'materia'  },
        { model: Periodo, as: 'periodo', where: { anio }, required: true },
      ],
    });

    // Mapa: materia_id → corte → nota
    const notasMap = {};
    notas.forEach(n => {
      if (!notasMap[n.materia_id]) notasMap[n.materia_id] = {};
      notasMap[n.materia_id][n.periodo.corte] = n;
    });

    // Buscar docente principal del grado
    const asignacion = await Asignacion.findOne({
      where:   { grado_id: estudiante.grado_id, activo: true },
      include: [{ model: Docente, as: 'docente' }],
    });
    const docente = asignacion?.docente;

    // Determinar nivel
    const nivel = estudiante.grado?.nivel || 'primaria';

    // Generar HTML del boletín
    const html = generarHTML({
      estudiante,
      grado:    estudiante.grado,
      materias,
      periodos,
      notasMap,
      docente,
      nivel,
      anio,
    });

    // Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format:            'A4',
      printBackground:   true,
      margin:            { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
    });
    await browser.close();

    const nombre = `${estudiante.apellido1}_${estudiante.nombre1}`.replace(/\s/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="boletin_${nombre}_${anio}.pdf"`);
    res.end(pdf);

  } catch (error) {
    console.error('Error en generarBoletin:', error);
    res.redirect('/boletin?error=Error al generar el boletín');
  }
};

// ── GET /boletin/estudiantes ──────────────────────────────────
// AJAX: devuelve estudiantes de un grado para el selector
const estudiantesPorGrado = async (req, res) => {
  try {
    const estudiantes = await Estudiante.findAll({
      where: {
        grado_id:         req.query.grado_id,
        estado_matricula: { [Op.in]: ['activo', 'repitente'] },
      },
      attributes: ['id', 'nombre1', 'nombre2', 'apellido1', 'apellido2', 'codigo_estudiante'],
      order:      [['apellido1', 'ASC'], ['nombre1', 'ASC']],
    });
    res.json(estudiantes);
  } catch (error) {
    res.json([]);
  }
};

// =============================================================
//  GENERADOR DE HTML DEL BOLETÍN
// =============================================================
function generarHTML({ estudiante, grado, materias, periodos, notasMap, docente, nivel, anio }) {
  const esPreescolar = nivel === 'preescolar';
  const esSecundaria = nivel === 'secundaria';

  // Calcular promedio final por materia
  const calcPromedio = (materia_id) => {
    const ns = notasMap[materia_id] || {};
    const vals = Object.values(ns).map(n => parseFloat(n.nota_numerica)).filter(v => !isNaN(v));
    if (vals.length === 0) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  // Colores de coeficiente
  const coefBg = { AA:'#DCFCE7', AS:'#DBEAFE', AF:'#FFF8E6', AI:'#FEE2E2' };
  const coefColor = { AA:'#1E7E4A', AS:'#1A4A8A', AF:'#D4870A', AI:'#C0392B' };

  // Celda de nota para el boletín
  const celdaNota = (materia_id, corte) => {
    const nota = (notasMap[materia_id] || {})[corte];
    if (!nota) return '<td class="vacia">—</td>' + (esPreescolar ? '' : '<td class="vacia">—</td>');
    const val  = parseFloat(nota.nota_numerica);
    const coef = nota.coeficiente || calcCoef(val);
    const bg   = coefBg[coef]    || '#F1EFE8';
    const col  = coefColor[coef] || '#888780';
    if (esPreescolar) {
      return `<td style="background:${bg};color:${col};font-weight:700;text-align:center">${coef}</td>`;
    }
    return `<td style="text-align:center;font-weight:700">${val.toFixed(0)}</td>
            <td style="background:${bg};color:${col};font-weight:700;text-align:center">${coef}</td>`;
  };

  // Celda de valoración final
  const celdaFinal = (materia_id) => {
    const prom = calcPromedio(materia_id);
    if (prom === null) return '<td class="vacia">—</td>' + (esPreescolar ? '' : '<td class="vacia">—</td>');
    const coef = calcCoef(prom);
    const bg   = coefBg[coef];
    const col  = coefColor[coef];
    if (esPreescolar) {
      return `<td style="background:${bg};color:${col};font-weight:700;text-align:center">${coef}</td>`;
    }
    return `<td style="text-align:center;font-weight:700">${prom.toFixed(0)}</td>
            <td style="background:${bg};color:${col};font-weight:700;text-align:center">${coef}</td>`;
  };

  // Headers de corte (1 o 2 columnas según nivel)
  const hCorte = (n) => esPreescolar
    ? `<th colspan="1" class="h-corte">${n}° Corte</th>`
    : `<th colspan="2" class="h-corte">${n}° Corte</th>`;

  const hSub = esPreescolar
    ? '<th class="h-sub">Nivel</th>'
    : '<th class="h-sub">Nota</th><th class="h-sub">Nivel</th>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1E293B; }

  .page { width:100%; padding:4mm; }

  /* Encabezado */
  .header { text-align:center; border-bottom:3px solid #C8A84B; padding-bottom:4mm; margin-bottom:3mm; }
  .header .mined { font-size:18pt; font-weight:900; color:#0D2B55; letter-spacing:2px; }
  .header .subtitulo { font-size:8pt; color:#475569; margin-top:1mm; }
  .header .tipo-boletin { font-size:12pt; font-weight:700; color:#0D2B55; margin-top:2mm; text-transform:uppercase; }
  .header .nivel { font-size:9pt; color:#1A4A8A; }

  /* Datos del estudiante */
  .datos { display:grid; grid-template-columns:1fr 1fr; gap:1mm 4mm; margin-bottom:3mm;
           padding:2mm 3mm; background:#F0F4F9; border-radius:4px; font-size:8pt; }
  .dato-fila { display:flex; gap:2mm; }
  .dato-label { color:#64748B; min-width:80px; font-weight:600; }
  .dato-valor { color:#0D2B55; font-weight:700; }

  /* Tabla de notas */
  table { width:100%; border-collapse:collapse; font-size:8pt; margin-bottom:3mm; }
  th, td { border:1px solid #CBD5E1; padding:1.5mm 2mm; }
  .h-titulo { background:#0D2B55; color:#fff; font-size:8.5pt; padding:2mm; }
  .h-sem { background:#1A4A8A; color:#fff; text-align:center; font-size:7.5pt; }
  .h-corte { background:#374151; color:#fff; text-align:center; font-size:7pt; }
  .h-sub { background:#4B5563; color:#fff; text-align:center; font-size:6.5pt; }
  .h-final { background:#6D28D9; color:#fff; text-align:center; font-size:7pt; }
  .mat-nombre { background:#F8FAFC; font-weight:600; padding-left:3mm; }
  .vacia { text-align:center; color:#94A3B8; }
  tr:nth-child(even) td { background:#F8FAFC; }
  tr:nth-child(even) td.mat-nombre { background:#F1F5F9; }

  /* Observaciones y firmas */
  .obs-firmas { margin-top:2mm; }
  .corte-bloque { margin-bottom:3mm; border:1px solid #E2E8F0; border-radius:4px; padding:2mm 3mm; }
  .corte-titulo { font-weight:700; color:#0D2B55; font-size:8pt; margin-bottom:1mm; border-bottom:1px solid #E2E8F0; padding-bottom:1mm; }
  .obs-area { min-height:10mm; border:1px solid #CBD5E1; border-radius:3px; padding:2mm; margin-bottom:2mm; font-size:7.5pt; color:#475569; }
  .firmas { display:grid; grid-template-columns:1fr 1fr; gap:3mm; margin-top:2mm; }
  .firma-linea { border-top:1px solid #0D2B55; text-align:center; font-size:7pt; color:#475569; padding-top:1mm; margin-top:6mm; }

  /* Escala de valoraciones */
  .escala { display:flex; gap:2mm; margin-bottom:2mm; font-size:7pt; flex-wrap:wrap; }
  .escala-item { padding:1mm 2mm; border-radius:3px; }
</style>
</head>
<body>
<div class="page">

  <!-- Encabezado -->
  <div class="header">
    <div class="mined">MINED</div>
    <div class="subtitulo">Ministerio de Educación — República de Nicaragua</div>
    <div class="tipo-boletin">
      ${esPreescolar ? 'Boletín Escolar de Preescolar' : esSecundaria ? 'Boletín Escolar de Educación Secundaria Regular' : 'Boletín Escolar de Tercero a Sexto Grado — Educación Primaria'}
    </div>
    <div class="nivel">Año Lectivo: ${anio} &nbsp;·&nbsp; Centro Educativo: Monte Hermón</div>
  </div>

  <!-- Datos del estudiante -->
  <div class="datos">
    <div class="dato-fila">
      <span class="dato-label">Estudiante:</span>
      <span class="dato-valor">${estudiante.nombre1} ${estudiante.nombre2 || ''} ${estudiante.apellido1} ${estudiante.apellido2 || ''}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Código:</span>
      <span class="dato-valor">${estudiante.codigo_estudiante || '—'}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Grado:</span>
      <span class="dato-valor">${grado?.nombre || '—'}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Docente:</span>
      <span class="dato-valor">${docente ? docente.nombre + ' ' + docente.apellido : '—'}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Departamento:</span>
      <span class="dato-valor">Managua</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Municipio:</span>
      <span class="dato-valor">Managua</span>
    </div>
  </div>

  <!-- Escala de valoraciones -->
  <div class="escala">
    <strong style="align-self:center;color:#475569">Escala:</strong>
    <span class="escala-item" style="background:#DCFCE7;color:#1E7E4A"><strong>AA</strong> Aprendizaje Avanzado (90–100)</span>
    <span class="escala-item" style="background:#DBEAFE;color:#1A4A8A"><strong>AS</strong> Aprendizaje Satisfactorio (76–89)</span>
    <span class="escala-item" style="background:#FFF8E6;color:#D4870A"><strong>AF</strong> Aprendizaje Fundamental (60–75)</span>
    <span class="escala-item" style="background:#FEE2E2;color:#C0392B"><strong>AI</strong> Aprendizaje Inicial (&lt;60)</span>
    ${!esPreescolar ? '<span style="color:#475569;align-self:center">· Mínimo aprobación: 60</span>' : ''}
  </div>

  <!-- Tabla de notas -->
  <table>
    <thead>
      <tr>
        <th rowspan="3" class="h-titulo" style="width:${esSecundaria ? '28%' : '32%'}">ASIGNATURAS</th>
        <th colspan="${esPreescolar ? '2' : '4'}" class="h-sem">I SEMESTRE</th>
        <th colspan="${esPreescolar ? '2' : '4'}" class="h-sem">II SEMESTRE</th>
        <th colspan="${esPreescolar ? '1' : '2'}" class="h-final" rowspan="2">VALORACIÓN FINAL</th>
      </tr>
      <tr>
        ${hCorte(1)}${hCorte(2)}${hCorte(3)}${hCorte(4)}
      </tr>
      <tr>
        ${hSub}${hSub}${hSub}${hSub}
        ${hSub}
      </tr>
    </thead>
    <tbody>
      ${materias.map(m => `
      <tr>
        <td class="mat-nombre">${m.nombre}</td>
        ${celdaNota(m.id, 1)}
        ${celdaNota(m.id, 2)}
        ${celdaNota(m.id, 3)}
        ${celdaNota(m.id, 4)}
        ${celdaFinal(m.id)}
      </tr>`).join('')}
      ${esSecundaria ? `
      <tr>
        <td class="mat-nombre" style="background:#F0F4F9;font-style:italic">Desempeño Personal</td>
        <td class="vacia" colspan="${esPreescolar ? '8' : '16'}">—</td>
        <td class="vacia"${esPreescolar ? '' : ' colspan="2"'}>—</td>
      </tr>` : ''}
    </tbody>
  </table>

  <!-- Observaciones y firmas por corte -->
  <div class="obs-firmas">
    ${periodos.map(p => `
    <div class="corte-bloque">
      <div class="corte-titulo">${p.corte === 1 || p.corte === 2 ? 'I' : 'II'} Semestre — ${p.corte}° Corte Evaluativo</div>
      <div style="font-size:7pt;color:#64748B;margin-bottom:1mm">Observaciones del docente:</div>
      <div class="obs-area"></div>
      <div class="firmas">
        <div>
          <div class="firma-linea">Firma del Padre, Madre o Tutor(a)</div>
        </div>
        <div>
          <div class="firma-linea">Firma del o la Docente</div>
        </div>
      </div>
    </div>`).join('')}
  </div>

  <!-- Firma del director -->
  <div style="margin-top:4mm;text-align:center">
    <div style="display:inline-block;border-top:1px solid #0D2B55;min-width:60mm;text-align:center;padding-top:1mm;font-size:7pt;color:#475569">
      Firma del Director(a)
    </div>
  </div>

</div>
</body>
</html>`;
}

module.exports = { mostrarBoletin, generarBoletin, estudiantesPorGrado };
