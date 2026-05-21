# 🎓 Sistema Web de Gestión Académica
### Colegio Monte Hermón — Nicaragua

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)
![Sequelize](https://img.shields.io/badge/Sequelize-ORM-52B0E7?style=for-the-badge&logo=sequelize&logoColor=white)

**Sistema full-stack de gestión académica desarrollado para una institución educativa real.**  
Gestiona estudiantes, docentes, notas, boletines PDF y reportes estadísticos del MINED.

[Características](#-características) · [Tecnologías](#-tecnologías) · [Instalación](#-instalación) · [Capturas](#-capturas-de-pantalla) · [Arquitectura](#-arquitectura)

</div>

---

## 📋 Descripción

Sistema web completo desarrollado como proyecto de ingeniería para el **Colegio Monte Hermón** en Managua, Nicaragua. La institución manejaba registros académicos en papel y hojas de cálculo manuales; este sistema digitaliza y automatiza el flujo completo desde el registro de estudiantes hasta la generación de reportes oficiales para el Ministerio de Educación (MINED).

El sistema opera en red local (LAN) sin depender de internet, accesible desde cualquier dispositivo conectado al WiFi del colegio mediante código QR generado automáticamente.

---

## ✨ Características

### Gestión académica
- **CRUD completo** de estudiantes, docentes, grados y materias
- **Importación masiva** desde los formatos Excel oficiales del MINED
- **Registro de notas** por corte evaluativo con cálculo automático del coeficiente de aprendizaje (AA / AS / AF / AI)
- **Criterio de repitente automático** — promedio por materia de 4 cortes, 3+ materias perdidas = repitente
- **Gestión del corte activo** — control de qué período evalúan los docentes
- **Fin de año** — cálculo masivo de repitentes y promoción automática al grado siguiente

### Control de acceso por roles
| Rol | Acceso |
|---|---|
| **Administrador** | Acceso total — CRUD, reportes, configuración |
| **Docente** | Solo sus clases asignadas — notas, estudiantes, boletines |

### Exportaciones
- **Excel por materia** — reporte del corte o del año completo con colores por coeficiente
- **Excel por grado completo** — todas las materias en un archivo (hoja resumen + hoja por materia)
- **Reportes MINED** — 6 hojas en un clic: Permanencia y Aprobación, Estadística Nota Final, F30 Reprobados

### Boletines PDF
- **Preescolar I, II y III Nivel** — formato MINED con evidencias por dimensión (Social, Emocional, Física, Cognitiva). Valoración cualitativa AA/AP
- **Primaria** — nota numérica + coeficiente, tabla de escala, datos del colegio, promedios por semestre
- **Secundaria** — igual que primaria con sección de Desempeño Personal

### Accesibilidad
- Generación de **código QR** local (sin internet) para acceso desde teléfonos
- Configuración de **dominio local** `colegio.local` para PCs adicionales
- Scripts `.bat` para iniciar el sistema y configurar nuevos dispositivos con un doble clic

---

## 🛠 Tecnologías

| Capa | Tecnología | Uso |
|---|---|---|
| **Backend** | Node.js + Express | Servidor web y API REST |
| **Base de datos** | PostgreSQL 16 | Persistencia de datos |
| **ORM** | Sequelize | Modelos, migraciones y consultas |
| **Autenticación** | bcryptjs + express-session | Hash de contraseñas y sesiones |
| **Frontend** | EJS + Bootstrap 5 | Plantillas y UI responsiva |
| **Excel** | ExcelJS | Generación de reportes y exportaciones |
| **PDF** | Puppeteer | Generación de boletines con HTML/CSS |
| **QR** | qrcode (npm) | Generación local sin internet |

---

## 🗄 Arquitectura

```
sistema-academico/
├── src/
│   ├── controllers/          # Lógica de negocio
│   │   ├── admin.controller.js       # Corte activo, fin de año, papelera
│   │   ├── boletin.controller.js     # Generación PDF por nivel
│   │   ├── docentes.controller.js    # CRUD docentes + asignaciones
│   │   ├── estudiantes.controller.js # CRUD + importación + notas
│   │   ├── exportarNotas.controller.js # Excel por materia y por grado
│   │   ├── notas.controller.js       # Registro de calificaciones
│   │   └── reportes.controller.js    # Reportes estadísticos MINED
│   ├── models/               # Modelos Sequelize
│   │   ├── Estudiante.js
│   │   ├── Docente.js + Usuario.js
│   │   ├── Grado.js + Materia.js
│   │   ├── Nota.js + Periodo.js
│   │   ├── Asignacion.js
│   │   └── index.js          # Asociaciones entre modelos
│   ├── routes/               # Definición de rutas
│   ├── middlewares/          # Autenticación y autorización
│   └── seeders/              # Datos iniciales (admin + períodos)
├── views/                    # Plantillas EJS
│   ├── admin/                # Corte activo, fin de año, papelera, reportes
│   ├── docentes/             # Lista, perfil, asignaciones, estudiantes
│   ├── estudiantes/          # Lista, perfil, notas, importar
│   ├── notas/                # Registro de calificaciones
│   ├── boletin/              # Selector de boletín
│   └── partials/             # Sidebar y head compartidos
├── migrations/
│   ├── schema.sql            # Esquema completo de la BD (v2.0)
│   ├── setup_grados.sql      # 14 grados con nombres oficiales MINED
│   └── insertar_materias.sql # Materias por grado según currículo MINED
├── INICIAR_SISTEMA.bat       # Inicia el servidor + genera QR
├── CONFIGURACION_INICIAL.bat # Configura firewall y dominio local
├── AGREGAR_DISPOSITIVO.bat   # Configura nuevos dispositivos Windows
└── generar_qr.js             # Genera QR localmente (sin internet)
```

### Modelo de base de datos

```
usuarios ──────── docentes (1:1)
grados ─────────┬─ materias (1:N)
                └─ estudiantes (1:N)
docentes ─────── asignaciones ─── materias  (N:M)
asignaciones ─── grados
estudiantes ───── notas (1:N)
materias ──────── notas (1:N)
periodos ──────── notas (1:N)
```

---

## 🚀 Instalación

### Requisitos
- [Node.js](https://nodejs.org) LTS (18+)
- [PostgreSQL](https://www.postgresql.org/download/) 16
- [Git](https://git-scm.com)

### Pasos

**1. Clonar el repositorio**
```bash
git clone https://github.com/JonaDev01/sistema-academico.git
cd sistema-academico
npm install
```

**2. Configurar variables de entorno**

Crear el archivo `.env` en la raíz:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gestion_academica
DB_USER=postgres
DB_PASSWORD=tu_contraseña
SESSION_SECRET=un_secreto_seguro
```

**3. Crear la base de datos**

En pgAdmin, crear la base de datos `gestion_academica` y ejecutar en orden:
```sql
-- 1. Esquema completo
\i schema.sql

-- 2. Grados oficiales del MINED
\i migrations/setup_grados.sql

-- 3. Materias por grado
\i migrations/insertar_materias.sql
```

**4. Crear carpeta de uploads y seeders**
```bash
mkdir uploads
npm run seed:todo
```

**5. Iniciar**
```bash
# Desarrollo
npm run dev

# O usar el script de Windows
INICIAR_SISTEMA.bat
```

### Configuración de red (primera vez)
```bash
# Ejecutar como administrador en Windows
CONFIGURACION_INICIAL.bat
```
Esto configura el firewall y el dominio local `colegio.local` para acceso desde la red.

---

## 📸 Capturas de pantalla

<details>
<summary>Dashboard del administrador</summary>

> 8 estadísticas en tiempo real: estudiantes activos, docentes, grados, corte activo, repitentes, pagos pendientes, becados y notas registradas.
<img width="1862" height="888" alt="image" src="https://github.com/user-attachments/assets/a3c7934d-194b-4f8c-ba2a-95f8e5ae687e" />


</details>

<details>
<summary>Registro de notas</summary>

> Selector dinámico de grado/materia/corte. El coeficiente AA/AS/AF/AI se actualiza en tiempo real mientras el docente escribe. Guardado masivo en un clic.
<img width="1544" height="832" alt="image" src="https://github.com/user-attachments/assets/d94e8002-ab02-4d0c-867f-c2370472a54b" />


</details>

<details>
<summary>Boletín PDF — Preescolar</summary>

> Formato oficial del MINED con las evidencias de aprendizaje por dimensión (Social, Emocional, Física, Cognitiva) para I, II y III Nivel.
<img width="1436" height="693" alt="image" src="https://github.com/user-attachments/assets/7acc10f2-bc34-4cdb-be15-c3e6431f3204" />



</details>

<details>
<summary>Reportes MINED</summary>

> Archivo Excel con 6 hojas: Permanencia y Aprobación (Preescolar, Primaria, Secundaria), Estadística Nota Final por materia y F30 Reprobados. Generado en un clic.
<img width="987" height="698" alt="image" src="https://github.com/user-attachments/assets/a53ccfce-c460-4834-9096-1a4913c62727" />



</details>

---

## 🔑 Credenciales por defecto

```
Email:      admin@colegio.edu
Contraseña: Admin1234!
```
> ⚠️ Cambiar las credenciales después de la primera instalación.

---

## 📐 Decisiones técnicas destacadas

**Coeficiente calculado con hooks de Sequelize**  
El coeficiente AA/AS/AF/AI se calcula en `beforeCreate` y `beforeUpdate` del modelo `Nota`. Sequelize valida antes de ejecutar los hooks, por lo que el campo es `allowNull: true` en el modelo aunque nunca queda nulo en la BD.

**Alias en asociaciones N:M**  
La tabla `asignaciones` conecta `Docente ↔ Materia ↔ Grado`. Como `Grado` se asocia con `Asignacion` Y con `Estudiante`, se usan aliases distintos (`gradoAsignacion` vs `grado`) para evitar conflictos de Sequelize.

**Orden de rutas en Express**  
Las rutas con parámetros dinámicos (`/estudiantes/:id`) deben registrarse después de las rutas estáticas (`/estudiantes/importar`) para evitar que Express interprete `importar` como un ID.

**Generación de QR sin internet**  
Se usa la librería `qrcode` de npm para generar el código QR como base64 y embebido en un HTML local, eliminando dependencia de APIs externas.

---

## 👨‍💻 Autor

**David Aragón**  
Carné: 21053  
Universidad del Valle de Guatemala

[![GitHub](https://img.shields.io/badge/GitHub-JonaDev01-181717?style=flat&logo=github)](https://github.com/JonaDev01)

---

## 📄 Licencia

Este proyecto fue desarrollado como trabajo académico para la Universidad del Valle de Guatemala. El código es para fines educativos.

---

<div align="center">
<sub>Desarrollado con ❤️ para el Colegio Monte Hermón — Managua, Nicaragua</sub>
</div>
