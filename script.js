/****************************************************
 * ALEGREMENTE 2025 – GUIA DE ESCENA (GENÉRICO)
 * script.js (completo)
 * - Plegables
 * - Audio robusto con múltiples pistas (data-audio)
 * - Visor de Guion (PDF)
 * - Partituras (carpeta única)
 * - Filtros + búsqueda con persistencia por escena
 * - Recursos dinámicos por filtro
 * - Vista previa de imágenes (overlay)
 * - Accesibilidad y atajos
 ****************************************************/

/* Utilidades cortas */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* =====================================================================================
   0) CONTEXTO DE ESCENA
   - Detecta el ID del <body> (scene1, scene2, ..., sceneN)
   - Genera un storage key por escena
===================================================================================== */
const BODY          = document.body;
const SCENE_ID      = BODY?.id || 'scene';
const STORAGE_KEY   = `filters_${SCENE_ID}_v1`;

/* =====================================================================================
   1) PLEGABLES (cards)
===================================================================================== */
function toggle(h){
  const card = h.parentElement;
  const content = card.querySelector('.content');
  const caret = h.querySelector('.caret');
  const open = content.style.display !== 'none';
  content.style.display = open ? 'none' : 'block';
  if (caret) caret.textContent = open ? 'Expandir' : 'Contraer';

  // Accesibilidad: mover el foco al header para lectores de pantalla
  h.setAttribute('tabindex', '0');
  h.focus({ preventScroll: true });
}

/* Mostrar todo abierto por defecto */
document.addEventListener('DOMContentLoaded', () => {
  $$('.card .content').forEach(c => (c.style.display = 'block'));
});

/* =====================================================================================
   2) AUDIO ROBUSTO (múltiples fuentes + autoplay-friendly)
   - Lee data-audio del <body id="sceneX">
   - Botón play/pausa, barra espaciadora, fallback si bloquea el autoplay
===================================================================================== */
(function initAudio(){
  if (!BODY) return;

  const audio = $('#sceneAudio');
  const btn   = $('#btnPlay');
  const label = $('#audioLabel');
  if (!audio || !btn) return;

  // Pistas declaradas en data-audio (separadas por coma)
  const raw = (BODY.dataset.audio || '').split(',').map(s => s.trim()).filter(Boolean);
  const sources = raw.length ? raw : ['Pista.mp3'];

  let idx = 0;
  function setSrc(i){
    // cache-buster opcional para desarrollo (comenta si no lo necesitas)
    const q = `?v=${Date.now()}`;
    audio.src = encodeURI(sources[i]) + q;
    if (label) label.textContent = `🎶 Audio: ${sources[i].replace(/\.(mp3|wav|m4a)$/i,'')}`;
  }
  setSrc(idx);

  function updateBtn(){ btn.textContent = audio.paused ? '▶ Reproducir' : '⏸️ Pausar'; }
  function markBlocked(){
    btn.style.borderColor = 'var(--ok)';
    btn.style.boxShadow = '0 0 0 3px rgba(217,119,6,.25)';
    btn.title = 'El navegador bloqueó el autoplay. Haz clic para iniciar.';
  }

  async function tryPlay(){
    try{
      await audio.play();
      updateBtn();
    }catch{
      markBlocked(); updateBtn();
    }
  }

  document.addEventListener('DOMContentLoaded', tryPlay);

  const playOnInteract = () => { audio.play().then(updateBtn).catch(()=>{}); };
  // La primera interacción habilita reproducción si fue bloqueada
  window.addEventListener('pointerdown', playOnInteract, { once:true, capture:true });
  window.addEventListener('keydown',     playOnInteract, { once:true, capture:true });
  window.addEventListener('touchstart',  playOnInteract, { once:true, capture:true });

  btn.addEventListener('click', async () => {
    try{
      if (audio.paused) await audio.play(); else audio.pause();
    }catch(e){}
    updateBtn();
  });

  // Cambiar de pista si hay error al cargar
  audio.addEventListener('error', () => {
    if (idx < sources.length - 1){
      idx++; setSrc(idx); tryPlay();
    }else{
      alert('No se pudo cargar ninguna pista de audio. Verifica los archivos.');
    }
  });

  // Atajo: barra espaciadora (si no estás escribiendo en un input)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/input|textarea|select/i.test(e.target.tagName)) {
      e.preventDefault();
      if (audio.paused) audio.play().catch(()=>{}); else audio.pause();
      updateBtn();
    }
  });

  // Pausa cuando se cambia de pestaña
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !audio.paused) audio.pause();
  });
})();

/* =====================================================================================
   3) GUION (PDF) y PARTITURAS (carpeta)
   - Guion desde data-guion
   - Link de partituras desde data-scores-url
===================================================================================== */
(function initDocs(){
  if (!BODY) return;

  const guion = BODY.dataset.guion ? BODY.dataset.guion.trim() : 'Guión Escena.pdf';
  const pdfFrame    = $('.pdf-frame');
  const pdfView     = $('#pdfView');
  const pdfDownload = $('#pdfDownload');

  const encoded = encodeURI(guion);
  if (pdfView)     pdfView.href = encoded;
  if (pdfDownload) pdfDownload.href = encoded;

  if (pdfFrame){
    // Intento rápido: verificar si existe; si no, ocultar frame
    fetch(encoded, { method:'HEAD' })
      .then(r => {
        if (!r.ok) throw new Error('No disponible');
        pdfFrame.src = encoded + '#toolbar=1&navpanes=0&statusbar=0&view=FitH';
      })
      .catch(() => { pdfFrame.style.display = 'none'; });
  }

  // Partituras (carpeta)
  const scoresUrl = (BODY.dataset.scoresUrl || '').trim();
  const link = $('#allScoresLink');
  if (link){
    link.href = scoresUrl || '#';
    if (!scoresUrl){
      link.setAttribute('aria-disabled','true');
      link.classList.add('disabled');
      link.textContent = '📂 Carpeta de partituras (pendiente)';
      link.addEventListener('click', (e)=> e.preventDefault());
    }
  }
})();

/* =====================================================================================
   4) FILTROS + BÚSQUEDA + RECURSOS
   - Filtra .card por data-tags, data-centros, data-log y el texto
   - Persiste estado en localStorage por escena
   - Renderiza recursos de escena según filtros activos
===================================================================================== */
(function initFilters(){
  const chips = $$('.chip');
  const cards = $$('.card');
  const q     = $('#q');

  // Cargar estado previo
  let saved = null;
  try{ saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }catch{}

  if (saved){
    chips.forEach(ch => {
      const t = ch.dataset.type;
      if (t === 'area'   && saved.areas?.includes(ch.dataset.area))     ch.classList.add('active');
      if (t === 'centro' && saved.centros?.includes(ch.dataset.centro)) ch.classList.add('active');
      if (t === 'log'    && saved.logs?.includes(ch.dataset.log))       ch.classList.add('active');
    });
    if (q && typeof saved.query === 'string') q.value = saved.query;
  }

  // Recursos base de la escena (para la tarjeta dinámica)
  const RESOURCES = [
    { title: 'Guion de la escena (PDF)', href: encodeURI(BODY.dataset.guion || 'Guión Escena.pdf'), areas: ['teatro','produccion'], type: 'pdf' },
    { title: 'Carpeta de Partituras',    href: (BODY.dataset.scoresUrl || '#'),                     areas: ['musica'],            type: 'link' },
    { title: 'Fondo proyectado (JPG)',   href: encodeURI(BODY.dataset.fondo  || 'Fondo.jpg'),       areas: ['plastica','luces'],  type: 'link' },
    { title: 'Imagen guía de escena',    href: encodeURI(BODY.dataset.hero   || 'Escena.jpg'),      areas: ['produccion'],        type: 'link' }
  ];
  const ICON = { pdf:'📄', audio:'🎵', sheet:'📊', doc:'📝', link:'🔗' };

  function getState(){
    const areas = chips.filter(c => c.dataset.type==='area'   && c.classList.contains('active')).map(c => c.dataset.area);
    const centros = chips.filter(c => c.dataset.type==='centro' && c.classList.contains('active')).map(c => c.dataset.centro);
    const logs = chips.filter(c => c.dataset.type==='log'    && c.classList.contains('active')).map(c => c.dataset.log);
    return { areas, centros, logs, query: (q && q.value ? q.value.trim() : '') };
  }

  function cardMatches(card, state){
    const tags = (card.dataset.tags || 'general').split(/\s+/);
    const areaOk = (state.areas.length === 0) || state.areas.some(a => tags.includes(a));

    const centrosCard = (card.dataset.centros || '').split(/\s+/).filter(Boolean);
    const centroOk = (state.centros.length === 0) || state.centros.some(c => centrosCard.includes(c));

    const logsCard = (card.dataset.log || '').split(/\s+/).filter(Boolean);
    const logOk = (state.logs.length === 0) || state.logs.some(l => logsCard.includes(l));

    const textOk = (card.textContent||'').toLowerCase().includes(state.query.toLowerCase());
    return areaOk && centroOk && logOk && textOk;
  }

  function ensureResourcesCard(){
    // Si ya existe una tarjeta de recursos en esta escena, la reusa
    let ul = $('#res-list');
    if (!ul){
      const section = document.querySelector('main section');
      if (!section) return null;
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-tags','produccion general');
      card.innerHTML = `
        <header onclick="toggle(this)"><h2>🔗 Recursos de esta escena</h2><span class="caret">Contraer</span></header>
        <div class="content"><ul id="res-list" class="asset-grid"></ul></div>`;
      section.appendChild(card);
      ul = $('#res-list');
    }
    return ul;
  }

  function renderResources(state){
    const ul = ensureResourcesCard();
    if (!ul) return;

    const items = RESOURCES
      .filter(r => (!state.areas.length || r.areas.some(a => state.areas.includes(a))))
      .map(r => {
        const target = r.href && r.href !== '#' ? `target="_blank" rel="noreferrer"` : '';
        return `<li>
          <a href="${r.href}" ${target}>${ICON[r.type]||ICON.link} ${r.title}</a>
          <small class="muted"> (${r.areas.join(', ')})</small>
        </li>`;
      });

    ul.innerHTML = items.join('') || `<li class="muted">No hay recursos para este filtro.</li>`;
  }

  function applyFilters(){
    const state = getState();
    cards.forEach(card => {
      const show = cardMatches(card, state);
      card.style.display = show ? '' : 'none';
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderResources(state);
  }

  chips.forEach(chip => chip.addEventListener('click', () => { chip.classList.toggle('active'); applyFilters(); }));
  if (q) q.addEventListener('input', applyFilters);

  document.addEventListener('DOMContentLoaded', applyFilters);
})();

/* =====================================================================================
   5) VISTA PREVIA DE IMÁGENES (overlay)
   - Para <a href="img.jpg" data-preview>
===================================================================================== */
(function initImagePreview(){
  function ensureOverlay(){
    let o = $('#imgPreviewOverlay');
    if (!o){
      o = document.createElement('div');
      o.id = 'imgPreviewOverlay';
      Object.assign(o.style, {
        position:'fixed', inset:'0', display:'none', zIndex:'9999',
        background:'rgba(0,0,0,.85)', alignItems:'center', justifyContent:'center'
      });
      const img = document.createElement('img');
      img.alt = 'Vista previa';
      Object.assign(img.style, {
        maxWidth:'90vw', maxHeight:'90vh', borderRadius:'12px',
        boxShadow:'0 10px 30px rgba(0,0,0,.5)'
      });
      o.appendChild(img);
      document.body.appendChild(o);

      // Cerrar con click o tecla ESC
      o.addEventListener('click', () => (o.style.display='none'));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') o.style.display='none'; });
    }
    return o;
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-preview]');
    if (!a) return;
    e.preventDefault();
    const overlay = ensureOverlay();
    overlay.querySelector('img').src = a.getAttribute('href');
    overlay.style.display = 'flex';
  });
})();

/* =====================================================================================
   6) EXTRAS UX
   - Enlaces deshabilitados visibles
   - Foco accesible a headers de card
===================================================================================== */
(function enhanceUX(){
  // Marcar enlaces "disabled" visualmente si tienen aria-disabled
  $$('a[aria-disabled="true"]').forEach(a => {
    a.style.opacity = '0.6';
    a.style.cursor = 'not-allowed';
  });

  // Hacer headers focusables y accionables con teclado
  $$('.card > header').forEach(h => {
    h.setAttribute('role','button');
    h.setAttribute('tabindex','0');
    h.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(h); }
    });
  });
})();
