// =============================================================
//  src/services/importador.service.js
//  Importa estudiantes desde el Excel real del colegio
//  Monte Hermón — estructura confirmada 25/06/25
// =============================================================

const XLSX    = require('xlsx');
const { Estudiante, Grado } = require('../models');

// ── Mapa: Nivel del Excel → nombre del grado en la BD ────────
// El importador busca el grado por nombre (case-insensitive)
// Si el grado no existe en la BD, la fila se omite con aviso
const NIVEL_MAP = {
  'PRIMERO':   'primero',
  'SEGUNDO':   'segundo',
  'TERCERO':   'tercero',
  'CUARTO':    'cuarto',
  'QUINTO':    'quinto',
  'SEXTO':     'sexto',
  'SEPTIMO':   'séptimo',
  'OCTAVO':    'octavo',
  'NOVENO':    'noveno',
  'DECIMO':    'décimo',
  'UNDECIMO':  'undécimo',
};

// ── Mapa: Sexo del Excel → género en la BD ───────────────────
const SEXO_MAP = {
  'F': 'femenino',
  'M': 'masculino',
};

// ── Mapa: Modalidad del Excel → nivel en la BD ───────────────
const MODALIDAD_MAP = {
  'PREESCOLAR FORMAL':  'preescolar',
  'PRIMARIA REGULAR':   'primaria',
  'SECUNDARIA REGULAR': 'secundaria',
};

// ── Mapa: Estado Matrícula del Excel → estado en la BD ───────
const ESTADO_MAP = {
  'APROBADO': 'activo',
  'REPITENTE': 'activo',
};

// =============================================================
//  FUNCIÓN PRINCIPAL
// =============================================================
async function importarEstudiantes(rutaArchivo) {
  const resultado = {
    importados: 0,
    actualizados: 0,
    omitidos: 0,
    errores: [],
    advertencias: [],
  };

  // 1. Leer el archivo Excel
  const workbook = XLSX.readFile(rutaArchivo);
  const hoja     = workbook.Sheets[workbook.SheetNames[0]];

  // El Excel tiene una fila de título en la fila 1 y headers en la fila 2
  // XLSX.utils.sheet_to_json con header:1 devuelve arrays
  // Usamos defval:null para tener nulls en lugar de undefined
  const filas = XLSX.utils.sheet_to_json(hoja, {
    header:  1,
    defval:  null,
    range:   1,    // empezar desde la fila 2 (índice 1) donde están los headers
  });

  if (filas.length < 2) {
    resultado.errores.push('El archivo no tiene datos válidos');
    return resultado;
  }

  // 2. Extraer headers (primera fila del rango)
  const headers = filas[0];
  const datos   = filas.slice(1);

  // 3. Cargar todos los grados de la BD una sola vez
  const grados = await Grado.findAll({ where: { activo: true } });

  // Helper: buscar grado por nivel_importacion + modalidad_importacion
  // La combinación es única: "PRIMERO + PREESCOLAR FORMAL" ≠ "PRIMERO + PRIMARIA REGULAR"
  const buscarGrado = (nivelExcel, modalidadExcel) => {
    if (!nivelExcel) return null;
    const nivel    = String(nivelExcel).trim().toUpperCase();
    const modalidad = modalidadExcel ? String(modalidadExcel).trim().toUpperCase() : null;

    return grados.find(g => {
      const nivelOk    = g.nivel_importacion?.trim().toUpperCase() === nivel;
      const modalidadOk = modalidad
        ? g.modalidad_importacion?.trim().toUpperCase() === modalidad
        : true;
      return nivelOk && modalidadOk;
    }) || null;
  };

  // Helper: limpiar texto
  const limpiar = (val) => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    return str === '' || str === 'NINGUNA' || str === 'N/A' ? null : str;
  };

  // Helper: obtener índice de columna por nombre de header
  const col = (nombre) => headers.indexOf(nombre);

  // 4. Procesar cada fila
  for (let i = 0; i < datos.length; i++) {
    const fila    = datos[i];
    const numFila = i + 3; // número real en el Excel (fila 1=título, 2=headers)

    // Saltar filas vacías (sin nombre)
    const nombre1   = limpiar(fila[col('Nombre1')]);
    const apellido1 = limpiar(fila[col('Apellido1')]);
    if (!nombre1 || !apellido1) continue;

    try {
      // Buscar grado por nivel + modalidad
      const nivelExcel    = fila[col('Nivel')];
      const modalidadExcel = fila[col('Modalidad')];
      const grado          = buscarGrado(nivelExcel, modalidadExcel);

      if (!grado) {
        resultado.advertencias.push(
          `Fila ${numFila} — ${nombre1} ${apellido1}: nivel "${nivelExcel}" / modalidad "${modalidadExcel}" no encontrado en BD. Se importa sin grado.`
        );
      }

      // Generar código único si no tiene
      // El Excel tiene muchos registros sin Código Estudiante
      let codigoEstudiante = limpiar(fila[col('Código Estudiante')]);
      if (!codigoEstudiante) {
        // Generar uno temporal basado en nombre + fila
        const ini1 = (nombre1[0] || 'X').toUpperCase();
        const ini2 = (limpiar(fila[col('Nombre2')])?.[0] || 'X').toUpperCase();
        const ini3 = (apellido1[0] || 'X').toUpperCase();
        const ini4 = (limpiar(fila[col('Apellido2')])?.[0] || 'X').toUpperCase();
        codigoEstudiante = `GEN-${ini1}${ini2}${ini3}${ini4}-${numFila}`;
        resultado.advertencias.push(
          `Fila ${numFila} — ${nombre1} ${apellido1}: sin código, se asignó "${codigoEstudiante}"`
        );
      }

      // Fecha de nacimiento — puede venir como fecha, número serial o fórmula
      let fechaNac = fila[col('Fecha de Nac')];
      if (fechaNac) {
        try {
          if (typeof fechaNac === 'number') {
            // Número serial de Excel → fecha JS
            const fecha = XLSX.SSF.parse_date_code(fechaNac);
            fechaNac    = new Date(fecha.y, fecha.m - 1, fecha.d);
          } else if (typeof fechaNac === 'string') {
            // Puede ser una fórmula como "=(TODAY()-X3)/365" — descartar
            if (fechaNac.startsWith('=') || isNaN(Date.parse(fechaNac))) {
              fechaNac = null;
            } else {
              fechaNac = new Date(fechaNac);
            }
          } else if (fechaNac instanceof Date) {
            // Ya es fecha — verificar que sea válida
            if (isNaN(fechaNac.getTime())) fechaNac = null;
          } else {
            fechaNac = null;
          }
        } catch {
          fechaNac = null;
        }
      }

      // Avisar si no hay fecha pero no bloquear la importación
      if (!fechaNac) {
        resultado.advertencias.push(
          `Fila ${numFila} — ${nombre1} ${apellido1}: sin fecha de nacimiento, se importa sin ella.`
        );
      }

      // Preparar datos del estudiante
      const datosEstudiante = {
        grado_id:           grado?.id || null,
        codigo_estudiante:  codigoEstudiante,
        codigo_unico:       limpiar(fila[col('Cod Único Per')]),
        id_externo:         fila[col('Id Estudiante')] ? String(fila[col('Id Estudiante')]).trim() : null,
        nombre1,
        nombre2:            limpiar(fila[col('Nombre2')]),
        apellido1,
        apellido2:          limpiar(fila[col('Apellido2')]),
        fecha_nacimiento:   fechaNac || null,
        genero:             SEXO_MAP[limpiar(fila[col('Sexo')])] || 'masculino',
        nivel:              MODALIDAD_MAP[limpiar(fila[col('Modalidad')])] || 'primaria',
        estado_matricula:   ESTADO_MAP[limpiar(fila[col('Estado Matricula')])] || 'activo',
        en_proyecto:        limpiar(fila[col('PART.NAC.')]) === 'SI',
        tipo_beca:          'ninguna',   // Excel no tiene este campo
        estado_pago:        'al_dia',    // Excel no tiene este campo
        direccion:          limpiar(fila[col('Dirección Alumno')]),
        nombre_madre:       limpiar(fila[col('Madre')]),
        cedula_madre:       limpiar(fila[col('Ced Madre')]),
        nombre_padre:       limpiar(fila[col('Padre')]),
        cedula_padre:       limpiar(fila[col('Ced Padre')]),
        departamento:       limpiar(fila[col('Departamento')]),
        programa:           limpiar(fila[col('Programa')]),
        modalidad:          'presencial',
        motivo_registro:    limpiar(fila[col('Motivo del Registro')]),
        descripcion_retiro: limpiar(fila[col('Descripcion Retiro')]),
      };

      // Buscar si ya existe por código para no duplicar
      const existente = await Estudiante.findOne({
        where: { codigo_estudiante: codigoEstudiante }
      });

      if (existente) {
        await existente.update(datosEstudiante);
        resultado.actualizados++;
      } else {
        await Estudiante.create(datosEstudiante);
        resultado.importados++;
      }

    } catch (error) {
      resultado.omitidos++;
      resultado.errores.push(
        `Fila ${numFila} — ${nombre1} ${apellido1}: ${error.message}`
      );
    }
  }

  return resultado;
}

module.exports = { importarEstudiantes };
