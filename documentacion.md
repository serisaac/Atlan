# Atlán — Documentación del sitio web

Documentación técnica del sitio web del proyecto **Atlán** (monitoreo de calidad
del agua del Arroyo Jabalines, Mazatlán, Sinaloa). Este archivo se actualiza
conforme avanza el desarrollo.

**Sitio en vivo:** https://atlanweb.duckdns.org
**Repositorio (código del sitio):** https://github.com/serisaac/Atlan

---

## 1. Descripción general

Sitio web informativo + dashboard en tiempo real para el proyecto Atlán.
Presenta la problemática ambiental del arroyo, información del proyecto,
componentes técnicos usados, galería (fotos y videos reales del prototipo
funcionando), al equipo, evidencia periodística, y un panel con las lecturas
reales de los sensores del dispositivo IoT (ESP32), ya validado end-to-end.

## 2. Estado actual — TODO EN PRODUCCIÓN Y FUNCIONANDO

| Pieza | Estado |
|---|---|
| Frontend (sitio web) | Completo, en línea, repositorio en GitHub |
| Backend (API + base de datos) | Completo, protegido con API key |
| Servidor AWS (EC2 + Nginx + HTTPS) | Completo y funcionando |
| Firmware del ESP32 | Completo: OTA, watchdog, reconexión automática de WiFi |
| Dashboard | Conectado a datos reales, indicador de estado inteligente |
| Galería | Completa — 6 fotos/videos reales del prototipo |
| Sobrevivencia a cortes de energía | Probada y confirmada |

## 3. Infraestructura AWS

- **Instancia EC2**: Debian, dedicada exclusivamente a este proyecto.
- **IP elástica**: fija, asignada por AWS.
- **Dominio**: `atlanweb.duckdns.org` (DuckDNS).
- **HTTPS**: certificado Let's Encrypt vía Certbot, auto-renovable (expira 2026-11-07).
- **Base de datos**: MySQL/MariaDB, base `altlan`, usuario dedicado `altlanuser`.
- **Backend**: Node.js + Express, PM2 (proceso `altlan-api`), puerto interno `3000`.
- **CORS**: habilitado para que el navegador consuma la API sin bloqueo de origen.
- **Seguridad del endpoint POST**: protegido con header `x-api-key` — solo el
  ESP32 (que conoce la clave, guardada en `.env` del servidor y en el firmware)
  puede insertar lecturas nuevas. Los `GET` (`/ultima`, `/historial`) siguen
  públicos a propósito, para que el dashboard los consulte libremente.

### Reparto de tráfico en Nginx

- `https://atlanweb.duckdns.org/` → archivos estáticos del sitio, desde `/var/www/altlan/`.
- `https://atlanweb.duckdns.org/api/...` → proxy interno al backend Node.js (puerto 3000).

## 4. Estructura de archivos

**Repositorio del sitio** (GitHub: `serisaac/Atlan`, carpeta local `C:\altlan-web`,
espejo en el servidor `/var/www/altlan/`):
```
altlan-web/
├── index.html
├── css/style.css
├── js/dashboard.js
├── DOCUMENTACION.md
└── img/
    ├── marca/logo-Atlan.png
    ├── arroyo/           → 2 fotos propias del arroyo + 1 de prensa (Noroeste, con crédito)
    ├── equipo/           → 4 fotos del equipo (Sergio, Juan Carlos, Mario, Alexis)
    ├── componentes/      → 4 fotos de referencia (ESP32, DS18B20, turbidez, PCB)
    └── galeria/          → 2 fotos del prototipo + foto dispositivo/dashboard en vivo
                             + foto sensor en agua + 2 videos de prueba (agua turbia/normal)
```

**Backend en el servidor** (`~/altlan-api/`, dueño: `admin`):
```
~/altlan-api/
├── app.js              → Express + CORS + rutas montadas
├── db.js                → pool de conexión a MySQL
├── sensores.routes.js   → POST / (protegido con x-api-key), GET /ultima, GET /historial
├── .env                 → DB_USER, DB_PASSWORD, DB_NAME, PORT, API_KEY
└── create_table.sql     → esquema de lecturas_sensores
```

### 4.1 Estructura de la base de datos

Una sola tabla, `lecturas_sensores`, dentro de la base `altlan`. Cada POST
del ESP32 inserta una fila nueva — nunca se edita ni se borra, solo se
acumula historial:

| Columna | Tipo | Contenido |
|---|---|---|
| `id` | INT, autoincremental | Identificador único de la lectura |
| `temperatura` | DECIMAL(5,2) | Temperatura en °C |
| `nivel_agua` | DECIMAL(6,2) | Distancia medida por el HC-SR04, en cm |
| `turbidez_valor` | INT | Valor crudo del sensor de turbidez (0–4095) |
| `turbidez_estado` | TINYINT | 0 = clara, 1 = turbia (según `UMBRAL_TURBIDEZ_CLARA`) |
| `fecha_hora` | DATETIME | Autogenerada al momento de insertar (`DEFAULT CURRENT_TIMESTAMP`) |

Índice sobre `fecha_hora` para que `GET /historial?limit=N` sea rápido al
ordenar por más reciente.

### 4.2 Estructura de la API

Patrón de separación de responsabilidades, sin framework adicional sobre
Express:

- **`app.js`** — punto de entrada único: configura middleware (CORS,
  `express.json()`) y monta las rutas. No conoce detalles de la base de
  datos ni de las consultas.
- **`db.js`** — únicamente exporta un pool de conexión `mysql2/promise` a
  MySQL. Si cambiara el motor de base de datos, solo este archivo se toca.
- **`sensores.routes.js`** — define los 3 endpoints y su lógica: valida la
  `x-api-key` en el POST, valida que vengan los 4 campos requeridos, y
  arma las consultas SQL. No sabe cómo arrancó el servidor ni cómo se
  configuró CORS.

Beneficio práctico: cada archivo se puede modificar o depurar de forma
aislada sin arriesgar romper las otras dos capas.

## 5. Secciones del sitio (`index.html`)

| Sección | Ancla | Estado |
|---|---|---|
| Inicio / hero | `#inicio` | Completo — logo, clima de Mazatlán (Open-Meteo), gauge de claridad |
| Problemática | `#problematica` | Completo — texto + 2 fotos propias del arroyo |
| El proyecto | `#proyecto` | Completo — incluye subsección de Componentes principales |
| Galería | `#galeria` | Completo — 6 espacios, todos con contenido real |
| Equipo | `#equipo` | Completo — 4 fotos + mensajes |
| Noticias | `#noticias` | Completo — 5 enlaces con fuente y fecha |
| Dashboard en vivo | `#dashboard` | Completo — datos reales, gráfica con umbral, estado inteligente |

### Dashboard — detalles de comportamiento
- Refresco de la página cada 3 segundos.
- Indicador de estado con 3 niveles automáticos (sin botón manual):
  - 🟢 "en vivo" (con pulso si el dato es nuevo)
  - 🟡 "conectado, sin lecturas nuevas hace X min" (si el servidor responde pero
    el dato lleva sin cambiar más de 90s)
  - 🔴 "sin conexión al servidor"
- Números de temperatura y nivel de agua mostrados como enteros.
- Gráfica: eje izquierdo = Temperatura (°C), eje derecho = Turbidez (raw,
  0–4095) con línea punteada de umbral en 600 (mismo valor que usa el firmware
  para decidir clara/turbia).
- Etiqueta de turbidez muestra "raw" en vez de "valor crudo".

## 6. Firmware del ESP32 — `atlan_firmware_completo.ino`

Todo verificado y funcionando en pruebas reales (miles de lecturas guardadas,
turbidez variando con el sensor en agua real):

- **WiFi**: reconexión automática cada 10s si se cae la red (sin bloquear el resto del loop).
- **OTA (ArduinoOTA)**: actualizaciones de firmware por WiFi — ya no requiere
  abrir el contenedor ni usar USB/botón BOOT para cambios futuros, **siempre
  que la computadora esté en la misma red WiFi que el ESP32** en el momento
  de subir.
- **Watchdog (esp_task_wdt)**: 30 segundos — si el programa se traba, el
  ESP32 se reinicia solo, sin intervención humana.
- **Reintento de lectura del DS18B20**: hasta 2 intentos extra si la primera
  lectura sale inválida (mitiga interferencia de WiFi con el timing OneWire).
- **`WiFi.setSleep(false)`**: desactiva el ahorro de energía del WiFi, reduce
  fallas intermitentes de lectura del sensor de temperatura.
- **Intervalo de envío a la API**: 3 segundos (ajustado para presentaciones;
  considerar subirlo a 30-60s para el uso permanente en el arroyo, para no
  saturar la base de datos).
- **Umbral de turbidez**: `UMBRAL_TURBIDEZ_CLARA = 600` (0 = clara si raw ≥ 600,
  1 = turbia si raw < 600) — mismo valor replicado en `dashboard.js`.
- **Probado**: sobrevive apagones/reconexiones de energía sin ayuda humana
  (arranca solo, reconecta WiFi solo, sigue mandando datos).
- **Redes probadas**: WiFi de casa, hotspot Android (ajustado a 2.4GHz +
  WPA2-Personal), red institucional UPSIN (no compatible — es WPA2-Enterprise,
  no soportada por el código actual; no es necesaria para la instalación final).

## 7. Créditos de material usado

- Foto en Noticias (`vista-general.png`): Noroeste / Carlos Zataráin, con crédito visible.
- Resto de fotos y videos (arroyo, equipo, galería): material propio del equipo.
- Texto de Problemática: redactado a partir de notas de Noroeste, Ríodoce y Revista Espejo.

## 8. Pendientes generales

- [ ] Confirmar/editar mensajes del equipo (los actuales son un borrador de Claude)
- [ ] Decidir si se baja el intervalo de envío (3s) para el uso permanente en el arroyo
- [ ] Revisar uso de horas de capa gratuita de AWS si hay otras instancias corriendo 24/7 al mismo tiempo
- [ ] Probar el sitio en celular
- [ ] Definir ubicación e instalación física final en el Arroyo Jabalines