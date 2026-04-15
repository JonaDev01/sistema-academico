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
//  GENERADOR DE HTML — PRIMARIA / SECUNDARIA
// =============================================================
function generarHTML({ estudiante, grado, materias, periodos, notasMap, docente, nivel, anio }) {
  const esPreescolar = nivel === 'preescolar';
  const esSecundaria = nivel === 'secundaria';

  if (esPreescolar) return generarHTMLPreescolar({ estudiante, grado, periodos, notasMap, docente, anio });

  const calcPromedio = (materia_id) => {
    const ns   = notasMap[materia_id] || {};
    const vals = Object.values(ns).map(n => parseFloat(n.nota_numerica)).filter(v => !isNaN(v));
    if (vals.length === 0) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const coefBg    = { AA:'#DCFCE7', AS:'#DBEAFE', AF:'#FFF8E6', AI:'#FEE2E2' };
  const coefColor = { AA:'#1E7E4A', AS:'#1A4A8A', AF:'#D4870A', AI:'#C0392B' };

  const celdaNota = (materia_id, corte) => {
    const nota = (notasMap[materia_id] || {})[corte];
    if (!nota) return '<td class="vacia">—</td><td class="vacia">—</td>';
    const val  = parseFloat(nota.nota_numerica);
    const coef = nota.coeficiente || calcCoef(val);
    const bg   = coefBg[coef] || '#F1EFE8';
    const col  = coefColor[coef] || '#888780';
    return `<td style="text-align:center;font-weight:700">${val.toFixed(0)}</td>
            <td style="background:${bg};color:${col};font-weight:700;text-align:center">${coef}</td>`;
  };

  const celdaFinal = (materia_id) => {
    const prom = calcPromedio(materia_id);
    if (prom === null) return '<td class="vacia">—</td><td class="vacia">—</td>';
    const coef = calcCoef(prom);
    const bg   = coefBg[coef];
    const col  = coefColor[coef];
    return `<td style="text-align:center;font-weight:700">${prom.toFixed(0)}</td>
            <td style="background:${bg};color:${col};font-weight:700;text-align:center">${coef}</td>`;
  };

  const hSub = '<th class="h-sub">Nota</th><th class="h-sub">Nivel</th>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1E293B; }
  .page { width:100%; padding:4mm; }
  .header { text-align:center; border-bottom:3px solid #C8A84B; padding-bottom:3mm; margin-bottom:3mm; }
  .header .mined { font-size:16pt; font-weight:900; color:#0D2B55; letter-spacing:2px; }
  .header .subtitulo { font-size:7.5pt; color:#475569; margin-top:1mm; }
  .header .tipo-boletin { font-size:11pt; font-weight:700; color:#0D2B55; margin-top:2mm; text-transform:uppercase; }
  .datos { display:grid; grid-template-columns:1fr 1fr; gap:1mm 4mm; margin-bottom:2mm;
           padding:2mm 3mm; background:#F0F4F9; border-radius:4px; font-size:7.5pt; }
  .dato-fila { display:flex; gap:2mm; }
  .dato-label { color:#64748B; min-width:90px; font-weight:600; }
  .dato-valor { color:#0D2B55; font-weight:700; }
  table { width:100%; border-collapse:collapse; font-size:7.5pt; margin-bottom:3mm; }
  th, td { border:1px solid #CBD5E1; padding:1.5mm 2mm; }
  .h-titulo { background:#0D2B55; color:#fff; font-size:8pt; padding:2mm; }
  .h-sem    { background:#1A4A8A; color:#fff; text-align:center; font-size:7pt; }
  .h-corte  { background:#374151; color:#fff; text-align:center; font-size:6.5pt; }
  .h-sub    { background:#4B5563; color:#fff; text-align:center; font-size:6pt; }
  .h-final  { background:#6D28D9; color:#fff; text-align:center; font-size:6.5pt; }
  .mat-nombre { background:#F8FAFC; font-weight:600; padding-left:3mm; }
  .vacia { text-align:center; color:#94A3B8; }
  tr:nth-child(even) td { background:#F8FAFC; }
  tr:nth-child(even) td.mat-nombre { background:#F1F5F9; }
  /* Tabla de escala */
  .escala-tabla { width:100%; border-collapse:collapse; font-size:7pt; margin-bottom:3mm; }
  .escala-tabla th { background:#0D2B55; color:#fff; padding:1.5mm 2mm; text-align:center; font-size:7pt; }
  .escala-tabla td { padding:1.5mm 2mm; border:1px solid #CBD5E1; text-align:center; }
  .corte-bloque { margin-bottom:3mm; border:1px solid #E2E8F0; border-radius:4px; padding:2mm 3mm; }
  .corte-titulo { font-weight:700; color:#0D2B55; font-size:7.5pt; margin-bottom:1mm; border-bottom:1px solid #E2E8F0; padding-bottom:1mm; }
  .obs-area { min-height:9mm; border:1px solid #CBD5E1; border-radius:3px; padding:1.5mm; margin-bottom:2mm; font-size:7pt; color:#475569; }
  .firmas { display:grid; grid-template-columns:1fr 1fr; gap:3mm; margin-top:2mm; }
  .firma-linea { border-top:1px solid #0D2B55; text-align:center; font-size:6.5pt; color:#475569; padding-top:1mm; margin-top:6mm; }
</style>
</head>
<body>
<div class="page">

  <!-- Encabezado -->
  <div class="header">
    <div class="mined">MINED</div>
    <div class="subtitulo">Ministerio de Educación — República de Nicaragua</div>
    <div class="tipo-boletin">
      ${esSecundaria ? 'Boletín Escolar de Educación Secundaria Regular' : 'Boletín Escolar de Tercero a Sexto Grado — Educación Primaria'}
    </div>
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
      <span class="dato-label">Grado/Ciclo/Etapa:</span>
      <span class="dato-valor">${grado?.nombre || '—'}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Nombre del Docente:</span>
      <span class="dato-valor">${docente ? docente.nombre + ' ' + docente.apellido : '—'}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Modalidad:</span>
      <span class="dato-valor">Primaria Regular</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Turno:</span>
      <span class="dato-valor">Matutino</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Núcleo Educativo:</span>
      <span class="dato-valor">Chiquilistagua</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Centro Educativo:</span>
      <span class="dato-valor">Monte Hermón</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Departamento:</span>
      <span class="dato-valor">Managua</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Municipio:</span>
      <span class="dato-valor">Managua</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Código del Centro:</span>
      <span class="dato-valor">21137</span>
    </div>
    <div class="dato-fila">
      <span class="dato-label">Año Lectivo:</span>
      <span class="dato-valor">${anio}</span>
    </div>
  </div>

  <!-- Tabla de escala de valoración -->
  <table class="escala-tabla">
    <thead>
      <tr>
        <th>Nivel de Competencias</th>
        <th>Valoración Cualitativa</th>
        <th>Equivalencia Cuantitativa</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td rowspan="2" style="font-weight:600;color:#1E7E4A">Competencias Alcanzadas</td>
        <td style="background:#DCFCE7;color:#1E7E4A;font-weight:700">AA — Aprendizaje Avanzado</td>
        <td style="background:#DCFCE7;color:#1E7E4A;font-weight:700">90 – 100</td>
      </tr>
      <tr>
        <td style="background:#DBEAFE;color:#1A4A8A;font-weight:700">AS — Aprendizaje Satisfactorio</td>
        <td style="background:#DBEAFE;color:#1A4A8A;font-weight:700">76 – 89</td>
      </tr>
      <tr>
        <td rowspan="2" style="font-weight:600;color:#D4870A">Competencias en Proceso</td>
        <td style="background:#FFF8E6;color:#D4870A;font-weight:700">AF — Aprendizaje Fundamental</td>
        <td style="background:#FFF8E6;color:#D4870A;font-weight:700">60 – 75</td>
      </tr>
      <tr>
        <td style="background:#FEE2E2;color:#C0392B;font-weight:700">AI — Aprendizaje Inicial</td>
        <td style="background:#FEE2E2;color:#C0392B;font-weight:700">Menos de 60</td>
      </tr>
    </tbody>
  </table>

  <!-- Tabla de notas -->
  <table>
    <thead>
      <tr>
        <th rowspan="3" class="h-titulo" style="width:30%">ASIGNATURAS</th>
        <th colspan="4" class="h-sem">I SEMESTRE</th>
        <th colspan="4" class="h-sem">II SEMESTRE</th>
        <th colspan="2" class="h-sem">PROMEDIOS</th>
        <th colspan="2" class="h-final" rowspan="2">VALORACIÓN FINAL</th>
      </tr>
      <tr>
        <th colspan="2" class="h-corte">1° Corte</th>
        <th colspan="2" class="h-corte">2° Corte</th>
        <th colspan="2" class="h-corte">3° Corte</th>
        <th colspan="2" class="h-corte">4° Corte</th>
        <th class="h-corte">Sem.1</th>
        <th class="h-corte">Sem.2</th>
      </tr>
      <tr>
        ${hSub}${hSub}${hSub}${hSub}
        <th class="h-sub">Prom</th><th class="h-sub">Prom</th>
        ${hSub}
      </tr>
    </thead>
    <tbody>
      ${materias.map(m => {
        const prom1 = (() => {
          const v1 = (notasMap[m.id]||{})[1] ? parseFloat((notasMap[m.id]||{})[1].nota_numerica) : null;
          const v2 = (notasMap[m.id]||{})[2] ? parseFloat((notasMap[m.id]||{})[2].nota_numerica) : null;
          if (v1 !== null && v2 !== null) return ((v1+v2)/2).toFixed(0);
          return null;
        })();
        const prom2 = (() => {
          const v3 = (notasMap[m.id]||{})[3] ? parseFloat((notasMap[m.id]||{})[3].nota_numerica) : null;
          const v4 = (notasMap[m.id]||{})[4] ? parseFloat((notasMap[m.id]||{})[4].nota_numerica) : null;
          if (v3 !== null && v4 !== null) return ((v3+v4)/2).toFixed(0);
          return null;
        })();
        return `<tr>
          <td class="mat-nombre">${m.nombre}</td>
          ${celdaNota(m.id,1)}${celdaNota(m.id,2)}
          ${celdaNota(m.id,3)}${celdaNota(m.id,4)}
          <td style="text-align:center">${prom1 || '—'}</td>
          <td style="text-align:center">${prom2 || '—'}</td>
          ${celdaFinal(m.id)}
        </tr>`;
      }).join('')}
      ${esSecundaria ? `<tr>
        <td class="mat-nombre" style="font-style:italic">Desempeño Personal</td>
        <td class="vacia" colspan="12">—</td>
        <td class="vacia" colspan="2">—</td>
      </tr>` : ''}
    </tbody>
  </table>

  <!-- Observaciones y firmas por corte -->
  ${periodos.map(p => `
  <div class="corte-bloque">
    <div class="corte-titulo">${p.corte <= 2 ? 'I' : 'II'} Semestre — ${p.corte}° Corte Evaluativo</div>
    <div style="font-size:6.5pt;color:#64748B;margin-bottom:1mm">Observaciones del docente:</div>
    <div class="obs-area"></div>
    <div class="firmas">
      <div><div class="firma-linea">Firma del Padre, Madre o Tutor(a)</div></div>
      <div><div class="firma-linea">Firma del o la Docente</div></div>
    </div>
  </div>`).join('')}

  <!-- Firma del director -->
  <div style="margin-top:4mm;text-align:center">
    <div style="display:inline-block;border-top:1px solid #0D2B55;min-width:60mm;text-align:center;padding-top:1mm;font-size:6.5pt;color:#475569">
      Firma del Director(a)
    </div>
  </div>

</div>
</body>
</html>`;
}

// =============================================================
//  GENERADOR DE HTML — PREESCOLAR (I / II / III NIVEL)
// =============================================================
function generarHTMLPreescolar({ estudiante, grado, periodos, notasMap, docente, anio }) {
  const nivelNombre = grado?.nombre || 'I Nivel';

  // Evidencias por nivel y bimestre
  const EVIDENCIAS = {
    'I Nivel': [
      { // Bimestre 1
        Social:    ['Se integra de forma libre y espontánea en las actividades diarias.','Desarrolla autonomía, independencia creatividad y sentido crítico en las actividades realizadas.','Expresa respeto a las mujeres de la familia.','Conoce las dependencias de su preescolar.'],
        Emocional: ['Experimenta una serie de emociones al participar en distintas actividades.','Practica valores para establecer una convivencia sana y armoniosa.','Muestra empatía al comprender diferentes situaciones que ocurren en su entorno. (Desapego corporal)'],
        Física:    ['Practica hábitos de higiene personal para la protección de la salud. (lavados de manos)','Participa en actividades de promoción de los huertos escolares para una nutrición sana.'],
        Cognitiva: ['Conoce las diferentes dependencias de mi escuela.','Forma grupos de cuantificadores. (mucho - poco, todo, ninguno)','Hace uso de los sentidos y partes de su cuerpo reconociendo su entorno.','Expresa lo que más le gustó de los cuentos y poesías presentadas.','Conoce las nociones espaciales (arriba - abajo - dentro - fuera - abierto - cerrado - cerca - lejos.)','Expresa actividades que realiza en la mañana y tarde empleando los términos temporales. (día y noche)'],
      },
      { // Bimestre 2
        Social:    ['Aprecia su vida personal, familiar y se identifica como integrante de la familia.','Expresa sus talentos habilidades y pensamientos creativos en actividades de conservación y preservación del medio ambiente.','Comenta la importancia de promover el amor y respeto hacia las mujeres de la familia.'],
        Emocional: ['Muestra seguridad y confianza en sí mismo al realizar actividades de autocuido.','Practica valores para una convivencia armoniosa al expresar actividades familiares.','Expresa sus emociones acordes a las situaciones vividas. (alegría, tristeza y enojo)'],
        Física:    ['Conoce movimientos corporales al participar en las actividades de danza y música.','Participa en diferentes actividades de forma autónoma con confianza y responsabilidad.','Se integra de forma gradual al trabajo en equipo al realizar actividades de juegos libres.'],
        Cognitiva: ['Identifica el lado izquierdo y derecho de su cuerpo.','Resuelve situaciones sencillas al diferenciar concepto de: lleno, vacío - igual cantidad.','Conoce de forma oral números del 1 al 5 de manera creativa.','Conoce los colores primarios en objetos de su entorno.','Descubre formas (Círculo y cuadrados) tamaños (grande y pequeños).','Escucha sonidos y ruidos del entorno.'],
      },
      { // Bimestre 3
        Social:    ['Expresa sentimientos de respeto, responsabilidad a los demás.','Practica actitudes de respeto, cuido y valoración del ciclo de vida al hablar de los animales de su entorno.'],
        Emocional: ['Reconoce sentimientos y emociones experimentadas al hablar de uso diferentes fenómenos naturales acontecidos en la comunidad.','Descubre sus cualidades personales a fin de valorarse así mismo positivamente.'],
        Física:    ['Realiza diferentes ejercicios de equilibrio.','Explora diferentes posturas corporales.','Conoce los alimentos nutritivos y la importancia de consumirlos para conservar la salud del cuerpo.'],
        Cognitiva: ['Identifica algunos símbolos convencionales que conoce.','Conoce las características de algunos elementos para su agrupación.','Conoce las características y ciclo de vida de los animales de su comunidad.','Escucha las estaciones del año.','Menciona algunos medios de transporte de su comunidad.'],
      },
      { // Bimestre 4
        Social:    ['Muestra una actitud de amor y respeto a nuestras Fiestas Patrias.','Participa en diversas actividades que forman parte de su identidad nacional.','Participa en diversas actividades colectivas utilizando instrumentos musicales.'],
        Emocional: ['Comenta con una actitud positiva y afectiva al hablar de derechos y deberes.','Participa con emoción en las distintas actividades de fiestas navideñas para el cierre del año escolar.','Interactúa con algunos compañeros de clase en las diferentes actividades propuestas.'],
        Física:    ['Identifica partes de su cuerpo para medir objetos de su entorno.','Utiliza sus manos, dedos y pies para pintar libremente.'],
        Cognitiva: ['Menciona las Características de Objetos y los relaciona con los elementos de su entorno.','Conoce algunas señales de tránsito.','Muestra interés al escuchar cuentos, fábula y leyendas.','Muestra interés al usar la moneda nacional.','Conoce las figuras geométricas (círculo - cuadrado).','Nombra un recurso tecnológico y su utilidad.'],
      },
    ],
    'II Nivel': [
      { // Bimestre 1
        Social:    ['Muestra respeto al relacionarse de forma libre y espontáneamente a las actividades diarias.','Practica la autonomía, independencia y sentido crítico en las actividades.','Reconoce a la mujer como persona de respeto en la familia y la comunidad.'],
        Emocional: ['Reconoce diferentes estados de ánimo al enfrentarse a diferentes situaciones.','Demuestra empatía al comprender diferentes situaciones que ocurren en su entorno. (Desapego corporal)'],
        Física:    ['Participa en actividades que promueven la cooperación destacando la importancia de la salud en actividades de orden, limpieza.','Se integra en actividades manifestando las características y partes de su cuerpo.','Se incorpora en actividades de promoción de los huertos escolares para una nutrición sana.'],
        Cognitiva: ['Utiliza las diferentes dependencias de la escuela.','Forma grupos de cuantificadores. (mucho - poco, todo, ninguno, más o menos)','Conoce la importancia de los sentidos y de los órganos que lo componen, utilizando su cuerpo.','Representa de lo que más le gustó de los cuentos y poesías presentadas.','Utiliza las nociones espaciales (arriba - abajo - dentro - fuera - adentro, afuera, adelante, atrás, abierto - cerrado - separado, en medio, junto, cerca - lejos, alrededor, en el centro.)','Representa actividades que realiza en la mañana y tarde empleando los términos temporales. (día y noche, antes, durante y después)'],
      },
      { // Bimestre 2
        Social:    ['Manifiesta sus talentos habilidades y pensamientos creativos en actividades de conservación y preservación del medio ambiente.','Demuestra relaciones interpersonales y respetuosa desde la familia, escuela y comunidad.'],
        Emocional: ['Manifiesta seguridad y confianza en sí mismo al realizar actividades.','Muestra seguridad en el manejo de las emociones acordes a las situaciones vividas. (alegría, tristeza, enojo, miedo)','Manifiesta valores de respeto y tolerancia al manifestar sus gustos y preferencias.'],
        Física:    ['Representa la familia haciendo uso de materiales de su entorno.','Realiza movimientos corporales al participar en las actividades de danza y música.','Promueve el trabajo en equipo al realizar actividades de juegos libres.'],
        Cognitiva: ['Reconoce el lado izquierdo y derecho de su cuerpo.','Resuelve problemas sencillos al diferenciar concepto de: lleno, vacío, igual cantidad, más lleno qué, más vacío qué.','Identifica objetos de su entorno al realizar conteo oral del 1 al 10.','Identifica los colores primarios en objetos de su entorno.','Identifica formas (Círculos y cuadrados, triángulos) tamaños (grande y pequeños).','Diferencia sonidos y ruidos del entorno.'],
      },
      { // Bimestre 3
        Social:    ['Ilustra narraciones y respeta opiniones de los demás.','Demuestra autonomía e independiente en el trabajo colectivo.','Menciona algunas acciones que se pueden implementar para promover el trabajo colaborativo en la familia.'],
        Emocional: ['Identifica sentimientos y emociones experimentadas al hablar del uso diferentes fenómenos naturales acontecidos en la comunidad.','Representa en diversas situaciones cómo se siente al abordar diferentes medios de transportes.','Conoce sus cualidades personales a fin de valorarse así mismo positivamente.','Participa en diferentes juegos dramáticos y controla sus emociones.'],
        Física:    ['Conoce diferentes posturas corporales con y sin movimientos.','Participa en diferentes equipos, grupos y juegos.','Hace uso de su cuerpo para representar sonido iniciales en palabras.','Reconoce los alimentos nutritivos y la importancia de consumirlos para conservar la salud del cuerpo.'],
        Cognitiva: ['Identifica algunos símbolos convencionales.','Construye series de hasta cinco elementos tomando en cuenta las características para su agrupación.','Identifica las características y ciclo de vida de los animales de su comunidad.','Identifica las estaciones del año.','Identifica medios de transporte de su comunidad.'],
      },
      { // Bimestre 4
        Social:    ['Demuestra respeto y afecto por los símbolos Patrios y nacionales.','Practica valores de patriotismo en las diversas Celebraciones del mes patrio.','Se integra en diversas actividades que forman parte de su identidad nacional.'],
        Emocional: ['Manifiesta actitud positiva y afectiva hacia las personas al hablar de derechos y deberes.','Participa con emoción en las distintas actividades de fiestas navideñas para el cierre del año escolar.','Exterioriza sus emociones en diferentes situaciones de la vida Cotidiana.'],
        Física:    ['Demuestra habilidades para medir cualquier objeto con materiales de su entorno.','Aplica movimientos de coordinación y equilibrio.'],
        Cognitiva: ['Compara las Características de los Objetos y relaciona con los elementos de su entorno.','Identifica las señales de tránsito.','Distingue palabras con sonidos finales iguales.','Expresa sus ideas relacionadas a cuentos, fábula y leyendas.','Identifica las vocales y consonantes (m,p).','Muestra interés por reconocer el uso de la moneda nacional.','Ordena diferentes elementos utilizando los números ordinales del 1° al 3°.','Menciona dos características de las figuras geométricas (círculo, triángulo, Cuadrado).','Menciona algunas utilidades de los recursos tecnológicos.'],
      },
    ],
    'III Nivel': [
      { // Bimestre 1
        Social:    ['Demuestra respeto al relacionarse de forma libre y espontáneamente a las actividades diarias.','Practica normas de convivencia en la Escuela y Comunidad.','Establece comunicación con la educadora o docente en todas las actividades.','Representa a través de dibujos la infraestructura-espacio dependencias de su escuela.'],
        Emocional: ['Reconoce estados de ánimo de sí mismo y de otras personas.','Muestra interés por aplicar valores para establecer una convivencia sana y armoniosa.','Representa con esquemas gráficos los estados de ánimos.'],
        Física:    ['Reconoce la importancia de practicar hábitos de higiene personal y alimentación sana.','Menciona sus cualidades y características y la de otros.','Representa gráficamente su figura corporal y respeta el de otras personas.','Promueve la participación en el cuido del huerto escolar para una nutrición sana.'],
        Cognitiva: ['Forma grupos de cuantificadores. (mucho - poco, todo, ninguno, algunos, más, menos, un, uno, par, igual)','Discrimina los atributos de elementos de su entorno haciendo uso de su cuerpo y los sentidos.','Comenta y representa lo que más le gustó de la poesía o cuento presentado.','Aplica nociones espaciales (arriba - abajo - dentro - fuera - adentro, afuera, adelante, atrás, abierto - cerrado - separado, en medio, junto, cerca - lejos, alrededor en el centro, Primero, último.)','Comunica experiencias cotidianas empleando nociones de tiempo. (día, noche, mañana tarde, antes, durante, después, ayer, hoy y mañana)'],
      },
      { // Bimestre 2
        Social:    ['Promueve actividades de cuido, conservación y preservación del medio ambiente.','Establece relaciones de convivencias basadas en la equidad de género e igualdad en la familia, escuela y comunidad.'],
        Emocional: ['Demuestra seguridad y confianza en sí mismo al realizar actividades.','Externa diferentes emociones al distinguir los sonidos agradables y desagradables del entorno.','Demuestra valores de respeto y tolerancia al manifestar su gusto y preferencias.'],
        Física:    ['Realiza movimientos corporales al participar en las actividades de danza y música.','Se desplaza libremente atendiendo orientaciones.'],
        Cognitiva: ['Reconoce el lado izquierdo y derecho de su cuerpo.','Resuelve problemas sencillos al diferenciar concepto de: lleno, vacío, igual cantidad, más lleno qué, más vacío qué.','Identifica objetos de su entorno al realizar conteo oral del 1 al 10.','Identifica los colores primarios en objetos de su entorno.','Identifica formas (Círculos y cuadrados, triángulos) tamaños (grande y pequeños).','Diferencia sonidos y ruidos del entorno.'],
      },
      { // Bimestre 3
        Social:    ['Representa con los miembros de su equipo acerca de los medios de transporte de su comunidad.','Demuestra actitudes de respeto, cuido y valoración del ciclo de vida al hablar de los animales de su entorno.','Menciona algunas acciones que se pueden implementar para promover el trabajo colaborativo en la familia.'],
        Emocional: ['Identifica sentimientos y emociones experimentadas al hablar de uso de diferentes fenómenos naturales acontecidos en la comunidad.','Conoce sus cualidades personales a fin de valorarse así mismo positivamente.','Manifiesta sus emociones mediante cuentos, historietas, películas u otros.'],
        Física:    ['Aplica diferentes posturas corporales con y sin movimientos.','Propone juegos y procura mantener su equilibrio. (saltar, caminar, correr)','Menciona los alimentos nutritivos y la importancia de consumirlos para conservar la salud del cuerpo.'],
        Cognitiva: ['Representa a través de gráficos los símbolos convencionales.','Representa series de hasta 10 elementos tomando en cuenta las características para su agrupación.','Representa las características y ciclo de vida de los animales de su comunidad.','Representa con diferentes actividades las estaciones del año y los asocia con fenómenos naturales.','Representa los medios de transporte de su comunidad.'],
      },
      { // Bimestre 4
        Social:    ['Establece diferencias de los símbolos patrios y nacionales.','Demuestra sus habilidades artísticas al representar hechos históricos relacionados con la Batalla de San Jacinto, Independencia de Centroamérica.','Demuestra sus habilidades para representar acontecimientos que forman parte de su identidad nacional.'],
        Emocional: ['Representa de forma creativa los derechos y deberes de las personas.','Participa con emoción en las distintas actividades de fiestas navideñas para el cierre del año escolar.','Representa sus emociones en diferentes situaciones de la vida Cotidiana.'],
        Física:    ['Promueve actividades física y juegos y mantiene equilibrio.','Demuestra control muscular al pintar libremente con sus manos, dedos y pies.'],
        Cognitiva: ['Clasifica objetos de su entorno y los compara por sus semejanzas y diferencias.','Valora la importancia del uso correcto de las señales de tránsito.','Representa palabras con sonidos finales iguales que riman.','Representa lo que más le gusta de los cuentos, fábula y leyendas.','Identifica las vocales y consonantes (m,p,s,l).','Reconoce la moneda nacional y sus denominaciones.','Usa los números ordinales para indicar orden de posición del 1° al 5°.','Menciona tres o más características de las figuras geométricas (círculo, triángulo, Cuadrado).','Explica las utilidades de los recursos tecnológicos.','Expresa la importancia de los impuestos.'],
      },
    ],
  };

  // Buscar evidencias del nivel — fallback a I Nivel
  const evidencias = EVIDENCIAS[nivelNombre] || EVIDENCIAS['I Nivel'];
  const dimNames   = ['Social', 'Emocional', 'Física', 'Cognitiva'];

  // Clave AA/AP para preescolar — no hay notas numéricas, usar el coeficiente guardado
  // Si hay nota >= 60 → AA, si hay nota < 60 → AP, si no hay → vacío
  const getValoracion = (bimestre) => {
    // En preescolar no hay materia específica — usar la primera materia disponible
    // o mostrar vacío para que el docente llene a mano
    return '';
  };

  const bimestres = ['I BIMESTRE', 'II BIMESTRE', 'III BIMESTRE', 'IV BIMESTRE'];

  const tablasBimestre = bimestres.map((bimNombre, bi) => {
    const evs = evidencias[bi] || {};
    const rows = dimNames.map(dim => {
      const lista = evs[dim] || [];
      if (lista.length === 0) return '';
      return lista.map((ev, i) => `
        <tr>
          ${i === 0 ? `<td class="dim-cell" rowspan="${lista.length}">${dim}</td>` : ''}
          <td class="ev-cell">${ev}</td>
          <td class="val-cell"></td>
        </tr>`).join('');
    }).join('');

    return `
      <table class="bim-tabla">
        <thead>
          <tr><th colspan="3" class="bim-header">${bimNombre}</th></tr>
          <tr>
            <th class="col-dim">Dimensión</th>
            <th class="col-ev">Evidencias de Aprendizaje</th>
            <th class="col-val">Valoración</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="2" style="font-weight:600;font-size:6.5pt;padding:1mm 2mm;background:#F8FAFC">Valoración del Bimestre</td><td class="val-cell"></td></tr>
          <tr><td colspan="3" style="font-size:6pt;padding:1mm 2mm;height:10mm;vertical-align:top;color:#64748B">Comentarios de la docente o educadora</td></tr>
        </tfoot>
      </table>`;
  }).join('');

  // Observaciones de padres por bimestre
  const obsPadres = bimestres.map(b => `
    <div class="obs-bloque">
      <div class="obs-titulo">${b} — Observaciones de la Madre, Padre o Tutor</div>
      <div class="obs-espacio"></div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 7.5pt; color: #1E293B; }
  .page { width:100%; padding:3mm; }

  /* Encabezado */
  .header { text-align:right; margin-bottom:3mm; }
  .header .dir { font-size:8pt; font-weight:700; color:#1A4A8A; }
  .header .titulo { font-size:7pt; color:#1A4A8A; font-weight:600; max-width:60mm; margin-left:auto; line-height:1.3; }
  .nivel-badge { display:inline-block; background:#0D2B55; color:#fff; font-size:10pt; font-weight:900; padding:1mm 3mm; border-radius:4px; margin-top:1mm; }

  /* Claves valoración */
  .claves { border:1px solid #CBD5E1; padding:2mm; margin-bottom:3mm; display:inline-block; font-size:7pt; }
  .claves .clave-row { display:flex; gap:3mm; align-items:center; margin-bottom:1mm; }
  .clave-tag { font-weight:700; padding:0.5mm 2mm; border-radius:2px; }

  /* Datos del estudiante */
  .datos-est { display:grid; grid-template-columns:1fr 1fr; gap:1mm 4mm; margin-bottom:3mm;
               padding:2mm 3mm; background:#F0F4F9; border-radius:4px; font-size:7pt; }
  .dato-fila { display:flex; gap:2mm; }
  .dato-lbl  { color:#64748B; min-width:80px; font-weight:600; }
  .dato-val  { color:#0D2B55; font-weight:700; }

  /* Tablas de bimestres */
  .bim-tabla { width:100%; border-collapse:collapse; font-size:6.5pt; margin-bottom:3mm; }
  .bim-header { background:#1A4A8A; color:#fff; text-align:center; font-size:8pt; padding:1.5mm; }
  .bim-tabla th { background:#374151; color:#fff; padding:1.5mm 2mm; font-size:6pt; }
  .bim-tabla td { border:1px solid #CBD5E1; padding:1mm 2mm; vertical-align:middle; }
  .dim-cell  { background:#F0F4F9; font-weight:700; text-align:center; color:#0D2B55; font-size:6.5pt; width:10%; }
  .ev-cell   { width:78%; }
  .val-cell  { width:12%; text-align:center; min-height:5mm; }
  .col-dim   { width:10%; }
  .col-ev    { width:78%; }
  .col-val   { width:12%; text-align:center; }

  /* Firmas y observaciones */
  .obs-bloque  { border:1px solid #CBD5E1; border-radius:3px; padding:2mm; margin-bottom:2mm; }
  .obs-titulo  { font-weight:600; font-size:7pt; color:#0D2B55; margin-bottom:1mm; }
  .obs-espacio { min-height:12mm; }

  .firmas-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:2mm; margin-top:3mm; }
  .firma-col   { text-align:center; }
  .firma-linea { border-top:1px solid #0D2B55; padding-top:1mm; font-size:6pt; color:#475569; margin-top:6mm; }
  .firma-sub   { font-size:5.5pt; color:#94A3B8; }
</style>
</head>
<body>
<div class="page">

  <!-- Claves + Encabezado -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3mm">
    <div>
      <div class="claves">
        <div style="font-weight:700;font-size:7pt;margin-bottom:1mm;color:#0D2B55">Claves para la valoración cualitativa</div>
        <div class="clave-row">
          <span class="clave-tag" style="background:#DCFCE7;color:#1E7E4A">AA</span>
          <span>Aprendizaje Alcanzado</span>
        </div>
        <div class="clave-row">
          <span class="clave-tag" style="background:#DBEAFE;color:#1A4A8A">AP</span>
          <span>Aprendizaje en Proceso</span>
        </div>
      </div>
    </div>
    <div class="header">
      <div class="dir">DIRECCIÓN DE EDUCACIÓN INICIAL</div>
      <div class="titulo">REGISTRO INFORMATIVO DE VALORACIÓN CUALITATIVA DE LAS EVIDENCIAS DEL DESARROLLO DE LAS COMPETENCIAS DE LA NIÑA Y EL NIÑO</div>
      <div><span class="nivel-badge">${nivelNombre.toUpperCase()}</span></div>
    </div>
  </div>

  <!-- Datos del estudiante -->
  <div class="datos-est">
    <div class="dato-fila">
      <span class="dato-lbl">Nombre de la niña, niño:</span>
      <span class="dato-val">${estudiante.nombre1} ${estudiante.nombre2 || ''} ${estudiante.apellido1} ${estudiante.apellido2 || ''}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-lbl">Código del estudiante:</span>
      <span class="dato-val">${estudiante.codigo_estudiante || '—'}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-lbl">Nivel:</span>
      <span class="dato-val">${nivelNombre}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-lbl">Docente/Educadora:</span>
      <span class="dato-val">${docente ? docente.nombre + ' ' + docente.apellido : '—'}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-lbl">Centro Escolar:</span>
      <span class="dato-val">Monte Hermón</span>
    </div>
    <div class="dato-fila">
      <span class="dato-lbl">Año lectivo:</span>
      <span class="dato-val">${anio}</span>
    </div>
    <div class="dato-fila">
      <span class="dato-lbl">Departamento/Región:</span>
      <span class="dato-val">Managua</span>
    </div>
    <div class="dato-fila">
      <span class="dato-lbl">Municipio/Distrito:</span>
      <span class="dato-val">Managua</span>
    </div>
  </div>

  <!-- Tablas de los 4 bimestres -->
  ${tablasBimestre}

  <!-- Observaciones de padres -->
  <div style="margin-bottom:3mm">
    <div style="font-weight:700;font-size:7.5pt;color:#0D2B55;margin-bottom:1mm">Observaciones de la Madre, Padre o Tutor por Bimestre</div>
    ${obsPadres}
  </div>

  <!-- Firmas -->
  <div class="firmas-grid">
    ${bimestres.map(b => `
    <div class="firma-col">
      <div class="firma-linea">${b}<br><span class="firma-sub">Firma del Padre, Madre o Tutor</span></div>
    </div>`).join('')}
  </div>

  <div style="display:flex;justify-content:space-between;margin-top:6mm">
    <div style="text-align:center;min-width:70mm">
      <div style="border-top:1px solid #0D2B55;padding-top:1mm;font-size:6.5pt;color:#475569">
        Firma de la Docente o Educadora
      </div>
    </div>
    <div style="text-align:center;min-width:70mm">
      <div style="border-top:1px solid #0D2B55;padding-top:1mm;font-size:6.5pt;color:#475569">
        Firma del Director(a)
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

module.exports = { mostrarBoletin, generarBoletin, estudiantesPorGrado };
