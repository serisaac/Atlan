# Altlan — Documentación del sitio web

Documentación técnica del sitio web del proyecto **Altlan** (monitoreo de calidad
del agua del Arroyo Jabalines, Mazatlán, Sinaloa). Este archivo se actualiza
conforme avanza el desarrollo.

**Sitio en vivo:** https://atlanweb.duckdns.org

---

## 1. Descripción general

Sitio web informativo + dashboard en tiempo real para el proyecto Altlan.
Presenta la problemática ambiental del arroyo, información del proyecto, al
equipo, evidencia periodística, y un panel con las lecturas de los sensores
del dispositivo IoT (ESP32).

## 2. Estado actual (resumen)

| Pieza | Estado |
|---|---|
| Frontend (sitio web) | Completo y en línea en `https://atlanweb.duckdns.org` |
| Backend (API + base de datos) | Completo, probado con Postman |
| Servidor AWS (EC2 + Nginx + HTTPS) | Completo y funcionando |
| Firmware del ESP32 | Escrito, con la URL real ya puesta — falta ajustarlo a tu cableado y subirlo al dispositivo físico |
| Fotos de Galería, foto de Alexis, 2da foto del arroyo | Pendiente |

## 3. Infraestructura AWS

- **Instancia EC2**: Debian, nueva y separada de `appmovilremote` (esa quedó
  para el proyecto `appMovil`, esta es exclusiva de Altlan).
- **IP elástica**: `54.156.10.32`
- **Dominio**: `atlanweb.duckdns.org` (DuckDNS), apuntando a esa IP.
- **HTTPS**: certificado Let's Encrypt vía Certbot, auto-renovable, expira
  2026-11-07.
- **Base de datos**: MySQL/MariaDB, base `altlan`, usuario dedicado
  `altlanuser` (no root) con permisos solo sobre esa base.
- **Backend**: Node.js + Express, corriendo con **PM2** bajo el nombre de
  proceso `altlan-api`, puerto interno `3000` (no expuesto al público —
  Nginx hace el proxy).
- **CORS**: habilitado en el backend (paquete `cors`) para que el navegador
  pueda pedir datos a la API sin bloqueo de origen cruzado.

### Cómo está repartido el tráfico en Nginx

`atlanweb.duckdns.org` sirve **dos cosas desde el mismo dominio**:

- `https://atlanweb.duckdns.org/` → archivos estáticos del sitio, servidos
  directo por Nginx desde `/var/www/altlan/` (el HTML/CSS/JS del sitio).
- `https://atlanweb.duckdns.org/api/...` → redirigido internamente (proxy)
  al backend Node.js en el puerto 3000.

Config real usada en `/etc/nginx/sites-available/altlan`:

```nginx
server {
    listen 80;
    server_name atlanweb.duckdns.org;

    root /var/www/altlan;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

(Certbot agrega automáticamente el bloque `listen 443 ssl` encima de este
cuando corres `sudo certbot --nginx -d atlanweb.duckdns.org` — si algún día
se edita este archivo a mano, hay que volver a correr Certbot con la opción
"reinstall" para que el HTTPS no se pierda.)

## 4. Estructura de archivos

**En el servidor** (`/var/www/altlan/` — el sitio):
```
/var/www/altlan/
├── index.html
├── css/style.css
├── js/dashboard.js
└── img/
    ├── arroyo/basura-cauce.png, vista-general.png
    └── equipo/sergio.png, juan-carlos.png, mario.png
```

**En el servidor** (`~/altlan-api/` — el backend, dueño: `admin`):
```
~/altlan-api/
├── app.js              → arranca el servidor, monta CORS y las rutas
├── db.js                → pool de conexión a MySQL
├── sensores.routes.js   → POST /, GET /ultima, GET /historial
├── .env                 → credenciales (DB_USER, DB_PASSWORD, DB_NAME, PORT)
└── create_table.sql     → esquema de la tabla lecturas_sensores
```

## 5. Secciones del sitio (`index.html`)

| Sección | Ancla | Estado |
|---|---|---|
| Inicio / hero | `#inicio` | Completo (incluye widget de clima de Mazatlán vía Open-Meteo) |
| Problemática | `#problematica` | Texto completo — falta 1 foto propia adicional |
| El proyecto | `#proyecto` | Completo |
| Galería | `#galeria` | Pendiente — 6 fotos por agregar |
| Equipo | `#equipo` | Completo, falta solo foto de Alexis |
| Noticias | `#noticias` | Completo — 5 enlaces con fuente y fecha |
| Dashboard en vivo | `#dashboard` | Conectado a datos reales, con botón de modo demo opcional |

## 6. Firmware del ESP32

Archivo: `altlan_firmware.ino`. Ya tiene la URL real de la API
(`https://atlanweb.duckdns.org/api/sensores`). Falta:
- Ajustar los pines (`PIN_DS18B20`, `PIN_TRIG_HCSR04`, etc.) a tu cableado real.
- Poner tu WiFi real (`WIFI_SSID`, `WIFI_PASSWORD`).
- Instalar las librerías `OneWire`, `DallasTemperature`, `ArduinoJson` en el
  Arduino IDE.
- Subirlo al ESP32 físico y confirmar en el Monitor Serial.

## 7. Créditos de material usado

- Foto en sección Noticias (`vista-general.png`): Noroeste / Carlos Zataráin,
  usada junto a su nota original con crédito visible.
- Resto de fotos (arroyo, equipo): material propio del equipo.
- Texto de la Problemática: redactado a partir de notas de Noroeste, Ríodoce
  y Revista Espejo (ver enlaces en la sección Noticias).

## 8. Pendientes generales

- [ ] Foto de Alexis Sebastián Escalera Ibarra
- [ ] 1 foto propia adicional del arroyo (Problemática)
- [ ] 6 fotos de Galería (dispositivo, cableado, instalación, equipo trabajando)
- [ ] Confirmar/editar mensajes del equipo (los actuales son un borrador)
- [ ] Ajustar pines y WiFi del firmware, subirlo al ESP32 real
- [ ] Probar el sitio en celular
- [ ] Revisar uso de horas de capa gratuita de AWS si appMovil y altlan-api corren ambas 24/7 en el mismo mes