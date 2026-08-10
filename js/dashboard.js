// ============================================================
// CONFIGURACIÓN — cambia esto por la URL real de tu servidor EC2
// Ejemplo: 'https://appmovilisaac.duckdns.org/api/sensores'
// ============================================================
const API_URL = 'https://atlanweb.duckdns.org/api/sensores';
const REFRESH_MS = 3000;
const UMBRAL_TURBIDEZ_CLARA = 600; // mismo valor que UMBRAL_TURBIDEZ_CLARA en el firmware
const dot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const nivelAgua = document.getElementById('nivelAgua');
const ola1 = document.getElementById('ola1');

let chart;
function initChart(){
  const ctx = document.getElementById('historialChart').getContext('2d');
  chart = new Chart(ctx, {
    type:'line',
    data:{ labels:[], datasets:[
      { label:'Temperatura (°C)', data:[], borderColor:'#E4A94A', backgroundColor:'transparent', tension:0.35, pointRadius:0, borderWidth:2 },
      { label:'Turbidez (raw)', data:[], borderColor:'#6FC3D1', backgroundColor:'transparent', tension:0.35, pointRadius:0, borderWidth:2, yAxisID:'y1' },
      { label:'Umbral clara/turbia', data:[], borderColor:'rgba(237,230,214,0.5)', backgroundColor:'transparent', borderDash:[6,4], tension:0, pointRadius:0, borderWidth:1.5, yAxisID:'y1' }
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ labels:{ color:'#EDE6D6', font:{ family:'Inter', size:11 } } } },
      scales:{
        x:{ ticks:{ color:'rgba(237,230,214,0.45)', maxTicksLimit:6 }, grid:{ color:'rgba(237,230,214,0.06)' } },
        y:{
          ticks:{ color:'rgba(237,230,214,0.45)', precision:0 }, grid:{ color:'rgba(237,230,214,0.06)' },
          title:{ display:true, text:'Temperatura (°C)', color:'#E4A94A', font:{ family:'IBM Plex Mono', size:11 } }
        },
        y1:{
          position:'right', min:0, max:4095, grace:'5%',
          ticks:{ color:'rgba(237,230,214,0.45)', precision:0 }, grid:{ display:false },
          title:{ display:true, text:'Turbidez (raw, 0–4095)', color:'#6FC3D1', font:{ family:'IBM Plex Mono', size:11 } }
        }
      }
    }
  });
}

function pintarClaridad(turbiezValor, turbiezEstado){
  // Rango de referencia calibrado: agua clara ~670, aire libre ~578, café/turbio ~508
  const pct = Math.max(0, Math.min(1, (turbiezValor - 500) / (680 - 500)));
  const alturaLlenado = 184 * pct;
  const y = 110 + (92 - alturaLlenado * 0.5);
  nivelAgua.setAttribute('y', 300 - alturaLlenado);
  nivelAgua.setAttribute('height', alturaLlenado);
  ola1.setAttribute('d', `M18,${300-alturaLlenado} Q 55,${300-alturaLlenado-8} 110,${300-alturaLlenado} T 202,${300-alturaLlenado} V 300 H18 Z`);
  document.getElementById('claridadValor').textContent = turbiezEstado === 0 ? 'agua clara' : 'agua turbia';
}

function actualizarUI(lectura){
  document.getElementById('tempValor').textContent = Math.round(Number(lectura.temperatura));
  document.getElementById('nivelValor').textContent = Math.round(Number(lectura.nivel_agua));
  document.getElementById('turbiezEstado').textContent = lectura.turbidez_estado === 0 ? 'Clara' : 'Turbia';
  const note = document.getElementById('turbiezNote');
  note.textContent = `raw: ${lectura.turbidez_valor}`;
  note.className = 'stat-note' + (lectura.turbidez_estado === 0 ? '' : ' turbio');
  pintarClaridad(lectura.turbidez_valor, lectura.turbidez_estado);
  const fecha = lectura.fecha_hora ? new Date(lectura.fecha_hora) : new Date();
  document.getElementById('ultimaActualizacion').textContent = 'última lectura: ' + fecha.toLocaleTimeString('es-MX');
}

function actualizarChart(historial){
  chart.data.labels = historial.map(r => new Date(r.fecha_hora || Date.now()).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'}));
  chart.data.datasets[0].data = historial.map(r => r.temperatura);
  chart.data.datasets[1].data = historial.map(r => r.turbidez_valor);
  chart.data.datasets[2].data = historial.map(() => UMBRAL_TURBIDEZ_CLARA);
  chart.update();
}

let g_ultimaFechaVista = null; // guarda la fecha de la última lectura ya mostrada
let g_ultimoCambioReal = Date.now(); // cuándo fue la última vez que SÍ llegó un dato nuevo
const UMBRAL_SIN_DATOS_NUEVOS_MS = 90 * 1000; // 90s ≈ 3 ciclos de 30s del ESP32

async function ciclo(){
  try{
    const [ultimaRes, histRes] = await Promise.all([
      fetch(`${API_URL}/ultima`),
      fetch(`${API_URL}/historial?limit=30`)
    ]);
    if(!ultimaRes.ok) throw new Error('sin datos');
    const ultima = await ultimaRes.json();
    const historial = await histRes.json();

    const fechaLectura = ultima.fecha_hora;
    const esLecturaNueva = fechaLectura !== g_ultimaFechaVista;

    if (esLecturaNueva) {
      g_ultimaFechaVista = fechaLectura;
      g_ultimoCambioReal = Date.now();
    }

    const msSinDatosNuevos = Date.now() - g_ultimoCambioReal;

    if (esLecturaNueva || msSinDatosNuevos < UMBRAL_SIN_DATOS_NUEVOS_MS) {
      dot.className = 'dot viva' + (esLecturaNueva ? ' dot-pulso' : '');
      statusText.textContent = 'en vivo';
    } else {
      dot.className = 'dot dot-advertencia';
      const minutos = Math.floor(msSinDatosNuevos / 60000);
      statusText.textContent = `conectado, sin lecturas nuevas hace ${minutos} min`;
    }

    actualizarUI(ultima);
    actualizarChart(historial);
  }catch(err){
    dot.className = 'dot';
    statusText.textContent = 'sin conexión al servidor';
    console.error(err);
  }
}

initChart();
ciclo();
setInterval(ciclo, REFRESH_MS);

// ============================================================
// CLIMA — Open-Meteo (gratuita, sin API key), Mazatlán, Sinaloa
// ============================================================
const MAZATLAN_LAT = 23.2494;
const MAZATLAN_LON = -106.4111;

const CODIGOS_CLIMA = {
  0:['☀️','Despejado'], 1:['🌤️','Mayormente despejado'], 2:['⛅','Parcialmente nublado'], 3:['☁️','Nublado'],
  45:['🌫️','Neblina'], 48:['🌫️','Neblina helada'],
  51:['🌦️','Llovizna ligera'], 53:['🌦️','Llovizna'], 55:['🌧️','Llovizna densa'],
  61:['🌧️','Lluvia ligera'], 63:['🌧️','Lluvia'], 65:['🌧️','Lluvia intensa'],
  80:['🌦️','Chubascos'], 81:['🌧️','Chubascos fuertes'], 82:['⛈️','Chubascos muy fuertes'],
  95:['⛈️','Tormenta'], 96:['⛈️','Tormenta con granizo'], 99:['⛈️','Tormenta severa']
};

async function cargarClima(){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${MAZATLAN_LAT}&longitude=${MAZATLAN_LON}&current=temperature_2m,weather_code&timezone=America%2FMazatlan`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('clima no disponible');
    const data = await res.json();
    const temp = Math.round(data.current.temperature_2m);
    const [icono, desc] = CODIGOS_CLIMA[data.current.weather_code] || ['🌡️','Mazatlán'];
    document.getElementById('climaTemp').textContent = temp;
    document.getElementById('climaIcono').textContent = icono;
    document.getElementById('climaDesc').textContent = `${desc} · Mazatlán`;
  }catch(err){
    document.getElementById('climaDesc').textContent = 'Clima no disponible';
    console.error(err);
  }
}
cargarClima();
setInterval(cargarClima, 15 * 60 * 1000); // se actualiza cada 15 min