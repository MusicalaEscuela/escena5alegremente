/* script.js (module)
   Plantilla genérica para guías de escenas de AlegreMente.
   Carga la escena desde JSON/JS y renderiza todas las secciones.
*/

/* ====================== Utils ====================== */
const $  = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

/* ====================== Loader ====================== */
async function loadConfig() {
  const setStatus = (msg) => {
    const sub  = $('#sc-subtitle');
    const foot = $('#footer-note');
    if (sub)  sub.textContent  = msg || '';
    if (foot) foot.textContent = msg || '';
  };

  const url = new URL(location.href);
  const id  = url.searchParams.get('scene') || 'escena2';

  // Compat: si ya hay datos globales (por versiones anteriores)
  if (window.__SCENE__ || window.CONFIG_ESCENA) {
    setStatus('');
    return window.__SCENE__ || window.CONFIG_ESCENA;
  }

  // Rutas candidatas (JSON preferido; fallback a JS)
  const candidates = [
    `escenas/${id}.json`,
    `${id}.json`,
    `escenas/${id}.js`,
    `${id}.js`
  ];

  for (const path of candidates) {
    try {
      if (path.endsWith('.json')) {
        const r = await fetch(`${path}?v=${Date.now()}`);
        if (!r.ok) throw 0;
        const data = await r.json();
        setStatus('');
        return data;
      } else {
        await import(`${path}?v=${Date.now()}`);
        const data = window.__SCENE__ || window.CONFIG_ESCENA;
        if (!data) throw new Error('El JS no definió __SCENE__ ni CONFIG_ESCENA');
        setStatus('');
        return data;
      }
    } catch (e) { /* intenta siguiente ruta */ }
  }

  const msg = `⚠ No pude cargar la escena. Verifica el nombre (?scene=...), la ruta del archivo y que no abras como file://`;
  setStatus(msg);
  throw new Error(msg);
}

/* ====================== Builders ====================== */
function makeCard({ title, tag = 'div', attrs = {}, collapsible = true, open = true }) {
  const el = document.createElement('div');
  el.className = 'card';
  Object.entries(attrs).forEach(([k, v]) => { if (v != null) el.dataset[k] = v; });

  const header = document.createElement('header');
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.textContent = open ? 'Contraer' : 'Expandir';
  header.append(h2, caret);

  const content = document.createElement(tag);
  content.className = 'content';
  if (!open) content.style.display = 'none';

  if (collapsible) {
    header.addEventListener('click', () => {
      const vis = content.style.display !== 'none';
      content.style.display = vis ? 'none' : 'block';
      caret.textContent = vis ? 'Expandir' : 'Contraer';
    });
  }

  el.append(header, content);
  return { el, content };
}

function pills(arr) {
  return (arr || []).map(t => `<span class="pill">${t}</span>`).join('');
}

function listFrom(items) {
  const ul = document.createElement('ul');
  (items || []).forEach(t => {
    const li = document.createElement('li');
    li.innerHTML = t;
    ul.appendChild(li);
  });
  return ul;
}

function tableFrom(rows, headers) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const tbody = document.createElement('tbody');
  (rows || []).forEach(r => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.innerHTML = r[h] ?? '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.append(thead, tbody);
  return table;
}

/* ====================== Filtros ====================== */
function buildChipList(containerSelector, values, dataKey) {
  const c = $(containerSelector);
  if (!c) return;
  (values || []).forEach(val => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset[dataKey] = val;
    chip.textContent = val;
    chip.addEventListener('click', () => { chip.classList.toggle('active'); applyFilters(); });
    c.appendChild(chip);
  });
}

function getFilters() {
  const areas   = $$('#chips-areas .chip.active').map(x => x.dataset.area);
  const centros = $$('#chips-centros .chip.active').map(x => x.dataset.centro);
  const logs    = $$('#chips-log .chip.active').map(x => x.dataset.log);
  const q = ($('#q')?.value || '').toLowerCase();
  return { areas, centros, logs, q };
}

function applyFilters() {
  const st = getFilters();
  // Solo filtra el contenido principal
  $$('#col-main .card').forEach(card => {
    const tags    = (card.dataset.tags || '').split(/\s+/).filter(Boolean);
    const centros = (card.dataset.centros || '').split(/\s+/).filter(Boolean);
    const logs    = (card.dataset.log || '').split(/\s+/).filter(Boolean);
    const textOk  = (card.textContent || '').toLowerCase().includes(st.q);
    const areaOk  = !st.areas.length   || st.areas.some(a => tags.includes(a));
    const cenOk   = !st.centros.length || st.centros.some(c => centros.includes(c));
    const logOk   = !st.logs.length    || st.logs.some(l => logs.includes(l));
    card.style.display = (textOk && areaOk && cenOk && logOk) ? '' : 'none';
  });
}

/* ====================== Render: top & audio ====================== */
function renderTop(meta = {}) {
  $('#sc-title').textContent    = meta.title || 'AlegreMente · Guía de Escena';
  $('#sc-subtitle').textContent = meta.subtitle || '';
  const foot = $('#footer-note');
  if (foot) foot.textContent = meta.footer || '';
  const hero = $('#hero-img');
  if (hero && meta.images?.hero) {
    hero.src = meta.images.hero;
    hero.alt = meta.images.heroAlt || 'Imagen de portada';
  }
}

function renderAudio(audio) {
  if (!audio) return;
  const area = $('#player-area');
  const label = $('#audio-label');
  const el = $('#scene-audio');
  const btn = $('#btnPlay');
  if (!area || !el || !btn) return;

  area.hidden = false;
  label.textContent = audio.label || '🎶 Audio';

  const list = Array.isArray(audio.sources) ? audio.sources : [audio.src].filter(Boolean);
  let idx = 0;

  const setSrc = (s) => { el.src = encodeURI(s) + `?v=${Date.now()}`; };
  setSrc(list[idx]);

  const tryNext = () => { if (idx < list.length - 1) { idx++; setSrc(list[idx]); el.play().catch(()=>{}); } };
  el.addEventListener('error', tryNext);

  const updateBtn = () => { btn.textContent = el.paused ? '▶ Reproducir' : '⏸️ Pausar'; };
  btn.addEventListener('click', async () => {
    try { if (el.paused) await el.play(); else el.pause(); } catch {}
    updateBtn();
  });
  el.addEventListener('play', updateBtn);
  el.addEventListener('pause', updateBtn);
}

/* ====================== Render: main cards ====================== */
function addResumen(block) {
  const { el, content } = makeCard({
    title: 'Resumen',
    attrs: { tags: 'teatro musica danza plastica', log: '' }
  });
  if (block?.text) {
    const p = document.createElement('p');
    p.innerHTML = block.text;
    content.appendChild(p);
  }
  const tools = document.createElement('div');
  tools.className = 'tools';
  tools.innerHTML = pills([block?.duration && `Duración: ${block.duration}`, ...(block?.tags || [])].filter(Boolean));
  content.appendChild(tools);
  $('#col-main').appendChild(el);
}

function addProposito(items) {
  const { el, content } = makeCard({
    title: '🎯 Propósito pedagógico',
    attrs: { tags: 'teatro musica danza plastica', log: '' }
  });
  content.appendChild(listFrom(items));
  $('#col-main').appendChild(el);
}

function addPasos(items) {
  const { el, content } = makeCard({
    title: '🎭 Acción paso a paso',
    attrs: { tags: 'teatro', log: '' }
  });
  const ol = document.createElement('ol');
  (items || []).forEach(t => { const li = document.createElement('li'); li.innerHTML = t; ol.appendChild(li); });
  content.appendChild(ol);
  $('#col-main').appendChild(el);
}

function addImagenPlastica(block) {
  const { el, content } = makeCard({
    title: '🎨 Imagen plástica en escena',
    attrs: { tags: 'plastica teatro', log: 'materiales' }
  });
  if (block?.items) content.appendChild(listFrom(block.items));
  if (block?.assets?.length) {
    const grid = document.createElement('div'); grid.className = 'stage-assets';
    block.assets.forEach(a => {
      const c = document.createElement('div'); c.className = 'asset';
      c.innerHTML = `
        <a href="${a.src}" target="_blank" rel="noreferrer">
          <img src="${a.src}" alt="${a.alt || ''}">
        </a>`;
      grid.appendChild(c);
    });
    content.appendChild(grid);
  }
  $('#col-main').appendChild(el);
}

function addLuces(rows) {
  const { el, content } = makeCard({
    title: '🎛️ Luces y transiciones',
    attrs: { tags: 'luces', log: 'luces' }
  });
  content.appendChild(tableFrom(rows, ['Cue', 'Estado', 'Detalle']));
  $('#col-main').appendChild(el);
}

function addSonido(items) {
  const { el, content } = makeCard({
    title: '🔊 Requerimientos de sonido',
    attrs: { tags: 'musica', log: 'sonido amplificacion-coro diademas orquesta proyeccion' }
  });
  content.appendChild(listFrom(items));
  $('#col-main').appendChild(el);
}

function addVestuario(v) {
  const { el, content } = makeCard({
    title: '👗 Vestuario (visual y detalle)',
    attrs: { tags: 'plastica teatro danza', log: 'vestuario' }
  });
  // Solo galería de imágenes (sin tabla ni textos)
  if (v?.images?.length) {
    const grid = document.createElement('div');
    grid.className = 'stage-assets';
    v.images.forEach(a => {
      const c = document.createElement('div');
      c.className = 'asset';
      c.innerHTML = `
        <a href="${a.src}" target="_blank" rel="noreferrer">
          <img src="${a.src}" alt="${a.alt || a.title || ''}">
        </a>`;
      grid.appendChild(c);
    });
    content.appendChild(grid);
  }
  $('#col-main').appendChild(el);
}

/* NEW: Escenario (fotos) */
function addEscenario(block) {
  const { el, content } = makeCard({
    title: '🖼️ Escenario (fotos)',
    attrs: { tags: 'teatro produccion', log: 'proyeccion materiales' }
  });
  if (block?.images?.length) {
    const grid = document.createElement('div');
    grid.className = 'stage-assets';
    block.images.forEach(a => {
      const c = document.createElement('div');
      c.className = 'asset';
      c.innerHTML = `
        <a href="${a.src}" target="_blank" rel="noreferrer">
          <img src="${a.src}" alt="${a.alt || a.title || 'Foto de escenario'}">
        </a>`;
      grid.appendChild(c);
    });
    content.appendChild(grid);
  }
  $('#col-main').appendChild(el);
}

function addChecklist(items) {
  const { el, content } = makeCard({
    title: '✅ Checklist (pre-ensayo y función)',
    attrs: { tags: 'produccion', log: '' }
  });
  const ul = listFrom(items); ul.id = 'checklist';
  const actions = document.createElement('div'); actions.className = 'actions';
  const b1 = document.createElement('button'); b1.className = 'btn'; b1.textContent = '🖨️ Imprimir'; b1.onclick = () => window.print();
  const b2 = document.createElement('button'); b2.className = 'btn'; b2.textContent = '📋 Copiar'; b2.onclick = () => {
    const txt = $$('#checklist li').map(li => li.textContent.trim()).join('\n') || '';
    navigator.clipboard.writeText(txt); alert('Checklist copiada.');
  };
  actions.append(b1, b2);
  content.append(ul, actions);
  $('#col-main').appendChild(el);
}

function addPdfBlock(key, title, file) {
  // etiquetas por tipo de PDF
  const tagMap = {
    guion:  { tags: 'teatro produccion', log: '' },
    part:   { tags: 'musica',            log: '' }
  };
  const meta = tagMap[key] || { tags: '', log: '' };

  const { el, content } = makeCard({ title, attrs: meta });
  const url = encodeURI(file);
  content.innerHTML = `
    <div class="actions">
      <a class="btn" href="${url}" target="_blank" rel="noreferrer">👁️ Ver</a>
      <a class="btn" href="${url}" download>⬇ Descargar</a>
    </div>
    <iframe class="pdf-frame" loading="lazy" title="${title}"></iframe>
    <p class="note" id="fb-${key}" style="display:none">Visor bloqueado. Usa los botones de arriba.</p>`;
  const frame = content.querySelector('iframe');
  fetch(url, { method: 'HEAD' })
    .then(r => { if (!r.ok) throw 0; frame.src = url + '#toolbar=1&navpanes=0&statusbar=0&view=FitH'; })
    .catch(() => { frame.style.display = 'none'; content.querySelector(`#fb-${key}`).style.display = 'block'; });
  $('#col-main').appendChild(el);
}

/* ====================== Render: aside ====================== */
function asideCentros(block) {
  const { el, content } = makeCard({ title: '👥 Centros y responsables' });
  if (block?.items) content.appendChild(listFrom(block.items));
  if (block?.docentesText) {
    const p = document.createElement('p'); p.className = 'muted'; p.textContent = block.docentesText;
    content.appendChild(p);
  }
  $('#col-aside').appendChild(el);
}

function asideMateriales(items) {
  const { el, content } = makeCard({ title: '📦 Materiales clave' });
  content.appendChild(listFrom(items));
  $('#col-aside').appendChild(el);
}

function asideRecursos(items) {
  const { el, content } = makeCard({ title: '📂 Recursos por arte' });
  const ul = document.createElement('ul'); ul.style.listStyle = 'none'; ul.style.paddingLeft = '0';
  (items || []).forEach(r => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${encodeURI(r.href)}" target="_blank" rel="noreferrer">${r.icon || '🔗'} ${r.title}</a> <small class="muted">(${(r.areas || []).join(', ')})</small>`;
    ul.appendChild(li);
  });
  content.appendChild(ul);
  $('#col-aside').appendChild(el);
}

function asideDocentes(block) {
  const { el, content } = makeCard({ title: '👩‍🏫 Docentes' });
  const ul = document.createElement('ul'); ul.style.listStyle = 'none'; ul.style.paddingLeft = '0';
  (block?.items || []).forEach(d => {
    const li = document.createElement('li');
    li.style.display = 'flex'; li.style.justifyContent = 'space-between';
    li.style.borderBottom = '1px solid #eee'; li.style.padding = '6px 0';
    li.innerHTML = `<a href="${d.url}" target="_blank" rel="noreferrer">${d.name}</a><span class="teacher-tags">${(d.areas || []).join(', ')}</span>`;
    ul.appendChild(li);
  });
  content.appendChild(ul);
  $('#col-aside').appendChild(el);
}

function asideGlosario(items) {
  const { el, content } = makeCard({ title: '🧠 Glosario breve' });
  (items || []).forEach(x => {
    const p = document.createElement('p');
    p.innerHTML = `<span class="kbd">${x.term}</span>: ${x.def}`;
    content.appendChild(p);
  });
  $('#col-aside').appendChild(el);
}

/* NEW: Pistas adicionales (aside) */
function asidePistas(items) {
  const { el, content } = makeCard({ title: '🎧 Pistas adicionales' });
  const ul = document.createElement('ul');
  ul.style.listStyle = 'none';
  ul.style.paddingLeft = '0';

  (items || []).forEach(p => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';
    li.style.borderBottom = '1px solid #eee';
    li.style.padding = '6px 0';
    li.innerHTML = `
      <a href="${encodeURI(p.href)}" target="_blank" rel="noreferrer">
        ${p.icon || '🎧'} ${p.title}
      </a>
      ${p.areas ? `<span class="teacher-tags">${(p.areas || []).join(', ')}</span>` : ''}
    `;
    ul.appendChild(li);
  });

  content.appendChild(ul);
  $('#col-aside').appendChild(el);
}

/* ====================== Init ====================== */
(async function init() {
  try {
    const cfg = await loadConfig();

    // Top & portada & audio
    renderTop(cfg.meta || {});
    renderAudio(cfg.audio);

    // Chips
    buildChipList('#chips-areas',   cfg.filters?.areas   || [], 'area');
    buildChipList('#chips-centros', cfg.filters?.centros || [], 'centro');
    buildChipList('#chips-log',     cfg.filters?.log     || [], 'log');
    $('#q')?.addEventListener('input', applyFilters);

    // Main
    if (cfg.resumen)   addResumen(cfg.resumen);
    if (cfg.proposito) addProposito(cfg.proposito);
    if (cfg.pasos)     addPasos(cfg.pasos);
    if (cfg.plastica)  addImagenPlastica(cfg.plastica);
    if (cfg.luces)     addLuces(cfg.luces);
    if (cfg.sonido)    addSonido(cfg.sonido);
    if (cfg.vestuario) addVestuario(cfg.vestuario);
    if (cfg.escenario) addEscenario(cfg.escenario);
    if (cfg.checklist) addChecklist(cfg.checklist);
    if (cfg.pdfs?.guion)     addPdfBlock('guion', '📄 Guión de la escena (PDF)', cfg.pdfs.guion);
    if (cfg.pdfs?.partitura) addPdfBlock('part',  '🎼 Partitura (PDF)',          cfg.pdfs.partitura);

    // Aside
    if (cfg.centros)    asideCentros(cfg.centros);
    if (cfg.materiales) asideMateriales(cfg.materiales);
    if (cfg.recursos)   asideRecursos(cfg.recursos);
    if (cfg.docentes)   asideDocentes(cfg.docentes);
    if (cfg.glosario)   asideGlosario(cfg.glosario);
    if (cfg.pistas)     asidePistas(cfg.pistas); // 👈 NUEVO: debajo del glosario

    // Aplicar filtros (inicial)
    applyFilters();
  } catch (e) {
    console.error(e);
  }
})();
