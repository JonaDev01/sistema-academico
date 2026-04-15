// generar_qr.js — genera QR localmente sin necesitar internet
const os      = require('os');
const fs      = require('fs');
const path    = require('path');
const QRCode  = require('qrcode');

function obtenerIP() {
  const interfaces = os.networkInterfaces();
  for (const nombre of Object.keys(interfaces)) {
    for (const iface of interfaces[nombre]) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        !iface.address.startsWith('169.254') &&
        !iface.address.startsWith('192.168.56')
      ) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function main() {
  const ip  = obtenerIP();
  const url = `http://${ip}:3000`;

  // Generar QR como imagen base64 — no necesita internet
  const qrDataUrl = await QRCode.toDataURL(url, {
    width:           220,
    margin:          2,
    color: {
      dark:  '#0D2B55',
      light: '#FFFFFF',
    },
  });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Acceso Movil - Sistema Academico</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; background:#0D2B55; display:flex; align-items:center; justify-content:center; min-height:100vh; }
  .card { background:#fff; border-radius:14px; padding:2rem; text-align:center; max-width:320px; box-shadow:0 10px 40px rgba(0,0,0,0.3); }
  h2 { color:#0D2B55; font-size:1.3rem; margin-bottom:4px; }
  .sub { color:#64748B; font-size:0.85rem; margin-bottom:1.25rem; }
  .qr-img { border:3px solid #0D2B55; border-radius:8px; display:block; margin:0 auto; }
  .url { background:#F0F4F9; border-radius:8px; padding:0.65rem 1rem; font-family:monospace; font-size:0.95rem; color:#0D2B55; font-weight:700; margin-top:1rem; word-break:break-all; }
  .tip { color:#64748B; font-size:0.78rem; margin-top:0.75rem; line-height:1.6; text-align:left; }
  .badge { display:inline-block; background:#C8A84B; color:#fff; border-radius:20px; padding:0.25rem 0.85rem; font-size:0.75rem; font-weight:600; margin-top:0.75rem; }
  hr { border:none; border-top:1px solid #E2E8F0; margin:1rem 0; }
</style>
</head>
<body>
<div class="card">
  <h2>Sistema Academico</h2>
  <p class="sub">Colegio Monte Hermon</p>
  <img class="qr-img" src="${qrDataUrl}" width="220" height="220" alt="Codigo QR">
  <div class="url">${url}</div>
  <hr>
  <div class="tip">
    <strong>Desde el telefono:</strong><br>
    1. Conectarse al WiFi del colegio<br>
    2. Abrir la camara y apuntar al QR<br>
    3. Tocar el enlace que aparece<br><br>
    <strong>O escribir en el navegador:</strong><br>
    ${url}
  </div>
  <span class="badge">Red WiFi del colegio</span>
</div>
</body>
</html>`;

  const archivo = path.join(__dirname, 'acceso_movil.html');
  fs.writeFileSync(archivo, html, 'utf8');
  console.log(ip);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
