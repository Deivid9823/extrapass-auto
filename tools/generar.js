/* Genera el contenido de Instagram de Extra Pass a partir de las jugadas reales de app/pizarra.html.
   Uso: node tools/generar.js [semanas=4] [inicio=AAAA-MM-DD]
   Semana tipo:  lun carrusel jugada · mar reel · mié carrusel defensa del bloqueo directo · jue reel · vie carrusel lecturas
   Salida: contenido/AAAA-MM-DD_dia_tipo_jugada/ (01.jpg… o reel.mp4, y texto.txt) y contenido/calendario.json
   contenido/usados.json recuerda lo ya generado para no repetir jugadas. */
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path'), {execFileSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'contenido');
const MARCA = path.join(__dirname, 'marca');
const SEMANAS = +(process.argv[2] || 4);
const HORA = '20:00';
const PLAN = {1: ['carrusel', 'jugada'], 2: ['reel', null], 3: ['carrusel', 'cobertura'], 4: ['reel', null], 5: ['carrusel', 'lectura']};
const COV = {show: 'Show', drop: 'Drop', switch: 'Cambio', ice: 'Ice', blitz: '2x1'};
const COV_TXT = {show: 'la bloqueadora sale a cortar el bote', drop: 'la del bloqueo se hunde a proteger el aro', switch: 'cambian en el bloqueo', ice: 'no te dejan usar el bloqueo', blitz: 'te hacen 2x1 al balón'};
const COV_HOOK = {show: ['Te enseñan', 'show al bote.', '¿Y ahora?'], drop: ['Se hunde', 'la del bloqueo.', '¿Y ahora?'], switch: ['Si cambian', 'en el bloqueo…', 'castígalo'], ice: ['No te dejan', 'usar el bloqueo.', '¿Y ahora?'], blitz: ['Te hacen 2x1', 'al balón.', '¿Y ahora?']};
const DIA_TXT = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const TAGS = {'Ataque posicional': '#ataqueposicional', 'Transición': '#transicion #contraataque', 'ATO y saques': '#saquedebanda #saquedefondo', 'Última posesión': '#ultimaposesion', 'Contra zona': '#ataqueazona #defensazonal'};
const BASE_TAGS = '#baloncesto #basket #bàsquet #entrenadordebaloncesto #tacticabaloncesto #baloncestoformativo #coachingbasketball #extrapass';

const usadosF = path.join(OUT, 'usados.json'), calF = path.join(OUT, 'calendario.json');
const usados = Object.assign({jugada: [], cobertura: [], lectura: [], reel: [], ultimo: null}, fs.existsSync(usadosF) ? JSON.parse(fs.readFileSync(usadosF, 'utf8')) : {});
const calendario = fs.existsSync(calF) ? JSON.parse(fs.readFileSync(calF, 'utf8')) : [];

const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const fecha = d => d.toISOString().slice(0, 10);
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const corta = (t, n = 2150) => t.length <= n ? t : t.slice(0, t.lastIndexOf('\n', n - 200)) + '\n\n' + t.slice(t.lastIndexOf('\n') + 1);

function fechas(){
  let d = process.argv[3] ? new Date(process.argv[3] + 'T12:00:00Z') : new Date(fecha(new Date(Date.now() + 864e5)) + 'T12:00:00Z');
  if(!process.argv[3] && usados.ultimo){ const u = new Date(usados.ultimo + 'T12:00:00Z'); if(+u >= +d) d = new Date(+u + 864e5); }
  const out = [], fin = +d + SEMANAS * 7 * 864e5;
  while(+d < fin){ if(PLAN[d.getUTCDay()]) out.push(new Date(d)); d = new Date(+d + 864e5); }
  return out;
}

/* ---------- diseño de los carruseles (1080x1350) ---------- */
const fonts = JSON.parse(fs.readFileSync(path.join(MARCA, 'fonts.json'), 'utf8'));
const css = Object.entries(fonts).map(([w, u]) => `@font-face{font-family:BC;font-weight:${w};src:url(${u})}`).join('');
const ESCUDO = b64(path.join(MARCA, 'escudo.png')), SELLO = b64(path.join(MARCA, 'sello.png'));
const HEAD = `<meta charset="utf-8"><style>${css}
*{box-sizing:border-box;margin:0}body{width:1080px;height:1350px;background:#10161A;color:#F6F2E9;font-family:Inter,'DejaVu Sans',sans-serif;position:relative;overflow:hidden}
.h{font-family:BC;font-weight:800;text-transform:uppercase;transform:skewX(-8deg);line-height:.95;letter-spacing:1px}
.o{color:#F05A24}.tag{font-family:BC;font-weight:700;letter-spacing:6px;font-size:32px;color:#F05A24;text-transform:uppercase}
.court{border-radius:26px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.45);border:6px solid #1B2530;margin:0 auto}.court img{display:block;width:100%}
.foot{position:absolute;left:70px;right:70px;bottom:46px;display:flex;justify-content:space-between;align-items:center;font-family:BC;font-weight:700;font-size:30px;letter-spacing:4px;color:#8A96A3}
.foot img{width:70px;height:70px;border-radius:50%}
.num{display:inline-grid;place-items:center;width:76px;height:76px;border-radius:50%;background:#F05A24;color:#10161A;font-family:BC;font-weight:800;font-size:50px;margin-right:22px;flex:none}
.row{display:flex;align-items:center}.sub{font-size:38px;line-height:1.35;color:#C9D0D6}
.box{border-left:10px solid #F05A24;background:#1B2530;border-radius:0 18px 18px 0;padding:24px 30px}
.box p{font-size:37px;line-height:1.32;margin-top:8px;font-weight:600}
.stripes{position:absolute;inset:0;background:repeating-linear-gradient(-55deg,rgba(255,255,255,.025) 0 40px,transparent 40px 80px)}
.wrap{position:absolute;left:70px;right:70px;top:86px}
.chip{display:inline-block;border:3px solid #3A4654;border-radius:999px;padding:10px 24px;font-family:BC;font-weight:700;font-size:34px;letter-spacing:2px;margin:0 12px 12px 0}
</style><div class="stripes"></div>`;
const foot = (i, n) => `<div class="foot"><span>EXTRA PASS</span><span>${i}/${n}</span><img src="${SELLO}"></div>`;
const tituloDe = n => { let t = String(n || '').split(/[.:;]/)[0].trim(); if(t.length > 44){ t = t.slice(0, 44); t = t.slice(0, t.lastIndexOf(' ')).replace(/[,\s]+(y|e|o|a|de|del|la|el|en|con|por)$/i, '') + '…'; } return t; };
const titleSize = t => t.length > 34 ? 66 : t.length > 22 ? 76 : 88;
function sCover(tag, title, sub, chips, bg){
  return `${HEAD}${bg ? `<div style="position:absolute;inset:0;opacity:.2"><img src="${bg}" style="width:100%;margin-top:380px"></div><div style="position:absolute;inset:0;background:linear-gradient(180deg,#10161A 32%,rgba(16,22,26,.55) 62%,#10161A 96%)"></div>` : ''}
  <div class="wrap" style="top:110px"><div class="tag">${esc(tag)}</div>
  <div class="h" style="font-size:${title.length > 40 ? 104 : 128}px;margin-top:28px">${title}</div>
  <div class="sub" style="margin-top:44px;max-width:860px">${sub}</div>
  <div style="margin-top:36px">${(chips || []).map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div></div>
  <img src="${ESCUDO}" style="position:absolute;right:60px;bottom:150px;width:280px;height:280px;border-radius:50%;box-shadow:0 20px 50px rgba(0,0,0,.5)">
  <div style="position:absolute;left:70px;bottom:190px;font-family:BC;font-weight:800;font-size:46px;letter-spacing:3px;color:#F05A24">DESLIZA →</div>`;
}
function sStep(n, title, sub, img, box){
  if(sub && sub.replace(/[.\s]+$/, '').trim() === title.trim()) sub = null;
  return `${HEAD}<div class="wrap"><div class="row">${n ? `<span class="num">${n}</span>` : ''}<div class="h" style="font-size:${titleSize(title)}px">${esc(title)}</div></div>
  ${sub ? `<div class="sub" style="margin:24px 0 30px">${esc(sub)}</div>` : '<div style="height:30px"></div>'}
  <div class="court" style="width:${box ? 680 : 860}px"><img src="${img}"></div>
  ${box ? `<div class="box" style="margin-top:32px"><div class="tag" style="font-size:28px">${esc(box[0])}</div><p>${esc(box[1])}</p></div>` : ''}</div>`;
}
function sText(tag, title, blocks){
  return `${HEAD}<div class="wrap" style="top:110px"><div class="tag">${esc(tag)}</div><div class="h" style="font-size:96px;margin:22px 0 44px">${title}</div>
  ${blocks.map(([h, t]) => `<div class="box" style="margin-bottom:30px"><div class="tag" style="font-size:28px">${esc(h)}</div><p>${esc(t)}</p></div>`).join('')}</div>`;
}
const sCTA = () => `${HEAD}<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px 120px">
  <img src="${ESCUDO}" style="width:380px;height:380px;border-radius:50%;box-shadow:0 20px 60px rgba(0,0,0,.5)">
  <div class="h" style="font-size:104px;margin-top:46px">Pruébala <span class="o">animada</span></div>
  <div class="sub" style="margin-top:28px;font-size:40px">La pizarra donde la defensa reacciona.<br>100 jugadas con ficha · lecturas · quiz para tus jugadoras.</div>
  <div style="margin-top:52px;background:#F05A24;color:#10161A;font-family:BC;font-weight:800;font-size:50px;letter-spacing:3px;padding:20px 44px;border-radius:999px;transform:skewX(-8deg)">BETA GRATIS · ENLACE EN LA BIO</div></div>`;

/* ---------- la app, con ganchos para sacar los dibujos ---------- */
function appHTML(){
  let html = fs.readFileSync(path.join(ROOT, 'app', 'pizarra.html'), 'utf8').replace('const BETA = false;', 'const BETA = true;');
  const hook = `window.pizarraPost={list:()=>ALL.map((p,i)=>({i,name:p.name,sit:situation(p),fin:finish(p),serie:p.serie||null,branchAt:p.branchAt||null,read:p.read||null,notes:p.steps.map(s=>s.note),ficha:p.ficha||{},pnr:(()=>{const q=clone(p);q.def=true;q.cov='show';return !!counterPlay(q)})()})),
frame:(idx,i)=>{const p=clone(ALL[idx]);p.def=true;const c=document.createElement('canvas');c.width=1080;c.height=Math.round(1080*HH/WW);const g=c.getContext('2d');setView(g,1080);withPlay(p,()=>drawFrame(g,i,1,colors()));return c.toDataURL('image/png')},
counter:(idx,cov)=>{const p=clone(ALL[idx]);p.def=true;p.cov=cov;const q=counterPlay(p);if(!q)return null;const out=[];for(let i=0;i<q.steps.length;i++){const c=document.createElement('canvas');c.width=1080;c.height=Math.round(1080*HH/WW);const g=c.getContext('2d');setView(g,1080);withPlay(q,()=>drawFrame(g,i,1,colors()));out.push([q.steps[i].note,c.toDataURL('image/png')])}return {u:q._cu,frames:out}}};
window.pizarraPDF = {`;
  if(!html.includes('window.pizarraPDF = {')) throw new Error('No encuentro el gancho en app/pizarra.html');
  return html.replace('window.pizarraPDF = {', hook);
}

(async () => {
  const b = await chromium.launch();
  const app = await b.newPage({viewport: {width: 600, height: 900}});
  await app.route('https://fonts.googleapis.com/**', r => r.fulfill({body: '', contentType: 'text/css'}));
  await app.route('https://fonts.gstatic.com/**', r => r.abort());
  await app.setContent('<body>' + appHTML() + '</body>'); await app.waitForTimeout(400);
  const L = await app.evaluate(() => pizarraPost.list());
  const frame = (i, s) => app.evaluate(([i, s]) => pizarraPost.frame(i, s), [i, s]);
  const crop = d => app.evaluate(async u => { const im = new Image(); im.src = u; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = Math.round(im.height * .86); c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL('image/png'); }, d);
  const shot = await b.newPage({viewport: {width: 1080, height: 1350}});
  const render = async (dir, slides) => { slides = slides.slice(0, 10); for(let k = 0; k < slides.length; k++){ await shot.setContent('<html><body>' + slides[k] + foot(k + 1, slides.length) + '</body></html>'); await shot.waitForTimeout(150);
    await shot.screenshot({path: path.join(dir, String(k + 1).padStart(2, '0') + '.jpg'), type: 'jpeg', quality: 92}); } return slides.length; };

  const serieDe = name => (L.find(p => p.name === name) || {}).serie;
  const usado = name => usados.jugada.includes(name) || usados.cobertura.some(u => u.split('|')[0] === name) || usados.lectura.includes(serieDe(name)) || usados.reel.some(u => u.split('|')[0] === name);
  const sitOrder = ['Ataque posicional', 'Transición', 'ATO y saques', 'Contra zona', 'Última posesión'];
  let sitPtr = usados.jugada.length % sitOrder.length;
  const pickJugada = () => { for(let t = 0; t < sitOrder.length; t++){ const sit = sitOrder[(sitPtr + t) % sitOrder.length];
      const c = L.filter(p => p.sit === sit && !p.serie && p.notes.length >= 3 && p.notes.length <= 7 && p.ficha.claves && !usado(p.name));
      if(c.length){ sitPtr = (sitPtr + t + 1) % sitOrder.length; return c[0]; } } return null; };
  const covOrder = Object.keys(COV);
  let covPtr = usados.cobertura.length + usados.reel.length;
  const pickCob = () => { for(let t = 0; t < covOrder.length; t++){ const c = covOrder[(covPtr + t) % covOrder.length];
      const p = L.find(p => p.pnr && !p.serie && !usado(p.name)); if(p){ covPtr = (covPtr + t + 1) % covOrder.length; return [p, c]; } } return null; };
  const series = [...new Set(L.filter(p => p.serie).map(p => p.serie))];
  const pickSerie = () => series.find(s => !usados.lectura.includes(s));

  fs.mkdirSync(OUT, {recursive: true});
  let reelTurn = usados.reel.length;
  for(const d of fechas()){
    const [formato, tipo0] = PLAN[d.getUTCDay()];
    let tipo = tipo0, titulo = '', texto = '', piezas = 0, dir;
    const mk = () => { dir = path.join(OUT, `${fecha(d)}_${DIA_TXT[d.getUTCDay()]}_${formato}_${tipo}_${slug(titulo)}`); fs.mkdirSync(dir, {recursive: true}); };
    if(formato === 'reel'){
      tipo = reelTurn % 2 === 0 ? 'cobertura' : 'lectura'; if(tipo === 'lectura' && !pickSerie()) tipo = 'cobertura';
      let spec;
      if(tipo === 'cobertura'){ const pc = pickCob(); if(!pc) break; const [p, c] = pc; usados.reel.push(p.name + '|' + c); titulo = `${p.name} contra ${COV[c]}`;
        spec = {hook: COV_HOOK[c], segments: [{play: p.name, cov: c}]};
        const k = await app.evaluate(([i, c]) => pizarraPost.counter(i, c), [p.i, c]);
        const notes = k.frames.slice(Math.max(1, k.u)).map(f => f[0]).filter(Boolean);
        texto = `Te defienden el bloqueo directo con ${COV[c].toLowerCase()}: ${COV_TXT[c]}. ¿Qué haces? 👀\n\n` + notes.map((t, j) => `${j + 1}️⃣ ${t}`).join('\n') +
          `\n\nJugada: ${p.name}.\n\nLa pizarra donde la defensa reacciona: beta gratis en la bio 🏀\n\n#pickandroll #bloqueodirecto ${BASE_TAGS}`;
      } else { const s = pickSerie(); usados.lectura.push(s); usados.reel.push('serie:' + s);
        const sib = L.filter(p => p.serie === s).slice(0, 2), p0 = sib[0], bA = p0.branchAt || 1, base = p0.name.split(' · ')[0]; titulo = base + ' dos finales';
        spec = {hook: ['Misma jugada.', 'Dos finales.', '¿Cuál eliges?'], segments: [{play: p0.name, from: 1, to: bA}].concat(sib.map(p => ({play: p.name, from: bA + 1, numStart: bA + 1, title: ('Si ' + (p.read || '').charAt(0).toLowerCase() + (p.read || '').slice(1)).slice(0, 34)})))};
        texto = `${base}: misma jugada, dos finales. ¿Cuál eliges? 🤔\n\n` + sib.map((p, j) => `${j + 1}️⃣ ${p.read} → ${p.name.split(' · ')[1] || p.fin}`).join('\n') +
          (p0.ficha.origen ? `\n\n📚 ${p0.ficha.origen}` : '') + `\n\nEn Extra Pass tus jugadoras practican esta lectura con un quiz. Beta gratis en la bio 🏀\n\n${TAGS[p0.sit] || ''} ${BASE_TAGS}`; }
      reelTurn++; mk();
      const sf = path.join(dir, 'reel.json'); fs.writeFileSync(sf, JSON.stringify(spec));
      execFileSync('node', [path.join(__dirname, 'reel.js'), sf, path.join(dir, 'reel.mp4')], {stdio: 'inherit'}); fs.unlinkSync(sf); piezas = 1;
    } else {
      let slides = [];
      if(tipo === 'lectura' && !pickSerie()) tipo = 'jugada';
      let pc = null; if(tipo === 'cobertura'){ pc = pickCob(); if(!pc) tipo = 'jugada'; }
      if(tipo === 'jugada'){
        const p = pickJugada(); if(!p) break; usados.jugada.push(p.name); titulo = p.name; const f = p.ficha, steps = Math.min(p.notes.length - 1, 6);
        slides.push(sCover(`${p.sit} · ${p.fin}`, esc(p.name), esc(f.busca || ''), [f.defensa && 'vs ' + f.defensa, f.formacion].filter(Boolean), await frame(p.i, Math.min(2, steps))));
        for(let s = 1; s <= steps; s++) slides.push(sStep(s, tituloDe(p.notes[s]), p.notes[s], await frame(p.i, s), null));
        slides.push(sText('Para enseñarla', 'Las <span class="o">claves</span>', (f.claves || []).slice(0, 3).map((c, k) => ['Clave ' + (k + 1), c])));
        slides.push(sText('Y si la defensa la lee', 'La <span class="o">lectura</span>', [['Si la defensa la lee', f.lee], ['Error típico', f.error], ['Origen', f.origen]].filter(x => x[1])));
        slides.push(sCTA());
        texto = `${p.name} 🏀\n\n${f.busca}${f.defensa ? ' · contra ' + f.defensa.toLowerCase() : ''}.\n\n` + p.notes.slice(1).map((t, k) => `${k + 1}️⃣ ${t}`).join('\n') +
          `\n\n🔑 Claves\n` + (f.claves || []).map(c => '• ' + c).join('\n') + (f.lee ? `\n\n👀 Lectura: ${f.lee}` : '') + (f.error ? `\n\n⚠️ Error típico: ${f.error}` : '') +
          (f.origen ? `\n\n📚 ${f.origen}` : '') + `\n\n¿La usáis en vuestro equipo? 👇\n\nÁbrela animada en Extra Pass, beta gratis 👉 enlace en la bio\n\n${TAGS[p.sit] || ''} ${BASE_TAGS}`;
      } else if(tipo === 'cobertura'){
        const [p, c] = pc; usados.cobertura.push(p.name + '|' + c); titulo = `${p.name} contra ${COV[c]}`;
        const k = await app.evaluate(([i, c]) => pizarraPost.counter(i, c), [p.i, c]);
        const fr = k.frames.slice(Math.max(1, k.u - 1)).slice(0, 6);
        slides.push(sCover(`Bloqueo directo · ${COV[c]}`, `Si ${esc(COV_TXT[c])}<br><span class="o">¿Y ahora?</span>`, `La respuesta del ataque en <b style="color:#F6F2E9">${esc(p.name)}</b>, con una defensa que reacciona de verdad.`, ['Defensa: ' + COV[c]], await crop(k.frames[Math.min(k.frames.length - 1, k.u)][1])));
        for(let s = 0; s < fr.length; s++) slides.push(sStep(s + 1, tituloDe(fr[s][0]), fr[s][0], await crop(fr[s][1]), null));
        slides.push(`${HEAD}<div class="wrap" style="top:110px"><div class="tag">Cambia la defensa</div><div class="h" style="font-size:100px;margin:22px 0 40px">Y la jugada <span class="o">responde</span></div><div class="sub" style="margin-bottom:40px">En Extra Pass eliges cómo defienden el bloqueo directo y la defensa se mueve sola. El ataque te enseña la respuesta a cada una.</div>${Object.values(COV).map(x => `<span class="chip" style="${x === COV[c] ? 'border-color:#F05A24;color:#F05A24' : ''}">${x}</span>`).join('')}</div>`);
        slides.push(sCTA());
        texto = `Te defienden el bloqueo directo con ${COV[c].toLowerCase()}: ${COV_TXT[c]}. ¿Qué haces? 🏀\n\n` + fr.map((x, j) => `${j + 1}️⃣ ${x[0]}`).join('\n') +
          `\n\nJugada: ${p.name}.\n\nEn Extra Pass cambias la defensa (drop, show, cambio, ice o 2x1) y la jugada te enseña la respuesta. Beta gratis 👉 enlace en la bio\n\n¿Cómo lo atacáis vosotros? 👇\n\n#pickandroll #bloqueodirecto ${BASE_TAGS}`;
      } else {
        const s = pickSerie(); usados.lectura.push(s);
        const sib = L.filter(p => p.serie === s).slice(0, 4), p0 = sib[0], bA = p0.branchAt || 1, base = p0.name.split(' · ')[0], cl = (p0.ficha.claves || []).filter(c => !/^Cuándo elegir/i.test(c)); titulo = base + ' lecturas';
        slides.push(sCover(`Lectura · ${p0.sit}`, `${esc(base)}<br><span class="o">${sib.length} finales</span>`, `Misma jugada, distinto final: depende de lo que haga la defensa. Aprende a leerlo.`, [...new Set(sib.map(p => p.fin))], await frame(p0.i, bA)));
        slides.push(sStep(null, 'La jugada', p0.notes.slice(1, bA + 1).join(' '), await frame(p0.i, bA), null));
        for(const [k, p] of sib.entries()) slides.push(sStep(k + 1, p.name.split(' · ')[1] || p.fin, p.notes.slice(bA + 1).join(' '), await frame(p.i, p.notes.length - 1), ['Si la defensa…', p.read || '']));
        slides.push(sText('Para enseñarla', 'Las <span class="o">claves</span>', cl.slice(0, 3).map((c, k) => ['Clave ' + (k + 1), c])));
        slides.push(sCTA());
        texto = `${base}: ${sib.length} finales según lo que haga la defensa 🏀\n\n` + sib.map((p, k) => `${k + 1}️⃣ ${p.read} → ${p.name.split(' · ')[1] || p.fin}`).join('\n') +
          `\n\n🔑 Claves\n` + cl.map(c => '• ' + c).join('\n') + (p0.ficha.origen ? `\n\n📚 ${p0.ficha.origen}` : '') +
          `\n\nEn Extra Pass tus jugadoras practican esta lectura con un quiz: la jugada se para y tienen que elegir. Beta gratis 👉 enlace en la bio\n\n¿Qué final sale más en vuestros partidos? 👇\n\n${TAGS[p0.sit] || ''} ${BASE_TAGS}`;
      }
      mk(); piezas = await render(dir, slides);
    }
    fs.writeFileSync(path.join(dir, 'texto.txt'), corta(texto) + '\n');
    calendario.push({fecha: fecha(d), hora: HORA, formato, tipo, titulo, carpeta: path.basename(dir), piezas});
    usados.ultimo = fecha(d);
    fs.writeFileSync(usadosF, JSON.stringify(usados, null, 1)); fs.writeFileSync(calF, JSON.stringify(calendario, null, 1));
    console.log('✓', path.basename(dir));
  }
  await b.close();
})();
