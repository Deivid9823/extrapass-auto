/* Genera un reel vertical (1080x1920, MP4) animando jugadas reales de Extra Pass.
   node reel.js spec.json salida.mp4 */
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path'), {execFileSync} = require('child_process');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUTF = process.argv[3];
const FPS = 30, W = 1080, H = 1920;
const MARCA = path.join(__dirname, 'marca');
const fonts = JSON.parse(fs.readFileSync(path.join(MARCA, 'fonts.json'), 'utf8'));
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(MARCA, f)).toString('base64');

let html = fs.readFileSync(process.env.PIZARRA || path.join(__dirname, '..', 'app', 'pizarra.html'), 'utf8').replace('const BETA = false;', 'const BETA = true;');
const hook = `window.__reel = {
 find:(name)=>ALL.findIndex(p=>p.name===name),
 seg:(name,cov,from,to)=>{const i=ALL.findIndex(p=>p.name===name); if(i<0) throw new Error('No existe '+name); let p=clone(ALL[i]); p.def=true; if(cov){p.cov=cov; const q=counterPlay(p); if(!q) throw new Error('Sin respuesta '+name+' '+cov); p=q;}
   const n=p.steps.length; from=from??1; to=to??n-1; const out=[]; for(let k=from;k<=to;k++) out.push({k,dur:withPlay(p,()=>stepDur(k)),note:p.steps[k].note||'',ctr:p._cu!=null&&k>p._cu});
   window.__plays=window.__plays||[]; window.__plays.push(p); return {pid:window.__plays.length-1,steps:out};},
 draw:(g,pid,k,t)=>{const p=window.__plays[pid]; withPlay(p,()=>drawFrame(g,k,t,colors()));},
 WW:WW,HH:HH,setView:(g,w)=>setView(g,w)};
window.pizarraPDF = {`;
html = html.replace('window.pizarraPDF = {', hook);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport: {width: 600, height: 900}});
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({body: '', contentType: 'text/css'}));
  await p.setContent('<body>' + html + '</body>'); await p.waitForTimeout(400);
  const tl = await p.evaluate(async ({spec, fonts, escudo, sello, FPS, W, H}) => {
    for(const [w, u] of Object.entries(fonts)){ const f = new FontFace('BC', `url(${u})`, {weight: w}); await f.load(); document.fonts.add(f); }
    const img = async u => { const i = new Image(); i.src = u; await i.decode(); return i; };
    const ESC = await img(escudo), SEL = await img(sello);
    // línea de tiempo
    const items = []; let t = 0;
    const add = (o, d) => { items.push({...o, t0: t, d}); t += d; };
    let first = null;
    for(const s of spec.segments){
      const r = window.__reel.seg(s.play, s.cov, s.from, s.to); if(!first) first = {pid: r.pid, k: r.steps[0].k};
      if(s.title) add({type: 'title', text: s.title, pid: r.pid, k: r.steps[0].k}, s.titleDur || 1400);
      r.steps.forEach((st, j) => add({type: 'step', pid: r.pid, k: st.k, note: (s.notes && s.notes[j]) || st.note, ctr: st.ctr, n: (s.numStart || 1) + j}, Math.round(st.dur * (spec.speed || 1.15) + 650)));
    }
    add({type: 'end'}, 2800);
    const intro = spec.introDur || 1500;
    window.__tl = {items, intro, total: intro + t};
    // dibujo
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const cw = 1000, chFull = Math.round(cw * window.__reel.HH / window.__reel.WW), crop = .86;
    const court = document.createElement('canvas'); court.width = cw; court.height = chFull; const cg = court.getContext('2d');
    const O = '#F05A24', D = '#10161A', L = '#F6F2E9', G = '#8A96A3', P = '#1B2530';
    const wrap = (txt, maxW, font) => { g.font = font; const words = txt.split(' '); const lines = []; let cur = ''; for(const w of words){ const tt = cur ? cur + ' ' + w : w; if(g.measureText(tt).width > maxW && cur){ lines.push(cur); cur = w; } else cur = tt; } if(cur) lines.push(cur); return lines; };
    const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    const bg = () => { g.fillStyle = D; g.fillRect(0, 0, W, H); g.save(); g.globalAlpha = .035; g.strokeStyle = '#fff'; g.lineWidth = 40; for(let x = -H; x < W + H; x += 110){ g.beginPath(); g.moveTo(x, 0); g.lineTo(x - H * .7, H); g.stroke(); } g.restore(); };
    const hookText = (a) => { // título de arriba
      const lines = spec.hook; g.save(); g.globalAlpha = a; g.textAlign = 'center';
      lines.forEach((ln, j) => { const y = 300 + j * 120; g.font = '800 116px BC'; g.save(); g.translate(W / 2, y); g.transform(1, 0, -.14, 1, 0, 0); g.font = '800 116px BC';
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillText(ln.toUpperCase(), 6, 8); g.fillStyle = j === lines.length - 1 ? O : L; g.fillText(ln.toUpperCase(), 0, 0); g.restore(); });
      g.restore(); };
    const drawCourt = (pid, k, tt, ctr, y0) => { cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, cw, chFull); window.__reel.setView(cg, cw); window.__reel.draw(cg, pid, k, tt);
      const ch = Math.round(chFull * crop); g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 50; g.shadowOffsetY = 20; g.fillStyle = P; g.beginPath(); g.roundRect(40 - 8, y0 - 8, cw + 16, ch + 16, 34); g.fill(); g.restore();
      g.save(); g.beginPath(); g.roundRect(40, y0, cw, ch, 28); g.clip(); g.drawImage(court, 0, 0, cw, ch, 40, y0, cw, ch); g.restore(); return ch; };
    const caption = (n, note, a) => { if(!note) return; g.save(); g.globalAlpha = a; const x = 60, y = 1385, maxW = 860;
      const lines = wrap(note, maxW, '600 44px Inter, sans-serif').slice(0, 3); const hh = 40 + lines.length * 58;
      g.fillStyle = P; g.beginPath(); g.roundRect(x, y, W - 2 * x, hh, 22); g.fill(); g.fillStyle = O; g.fillRect(x, y, 12, hh);
      g.beginPath(); g.arc(x + 70, y + hh / 2, 38, 0, 7); g.fill(); g.fillStyle = D; g.font = '800 52px BC'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), x + 70, y + hh / 2 + 3);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = L; g.font = '600 44px Inter, sans-serif'; lines.forEach((ln, j) => g.fillText(ln, x + 130, y + 62 + j * 58)); g.restore(); };
    const footer = () => { g.save(); g.drawImage(SEL, 60, 1700, 76, 76); g.fillStyle = G; g.font = '700 38px BC'; g.letterSpacing = '6px'; g.fillText('EXTRA PASS', 152, 1752); g.restore(); };
    window.__frame = (f) => {
      const ms = f * 1000 / FPS, T = window.__tl; bg();
      if(ms < T.intro){ const a = ease(ms / 500); hookText(a); drawCourt(first.pid, first.k, 0, false, 560); return cv.toDataURL('image/jpeg', .9); }
      const m = ms - T.intro; const it = T.items.find(x => m >= x.t0 && m < x.t0 + x.d) || T.items[T.items.length - 1];
      const lt = m - it.t0;
      if(it.type === 'end'){ const a = ease(lt / 450); g.save(); g.globalAlpha = a; const s = 520; g.drawImage(ESC, (W - s) / 2, 380, s, s);
        g.textAlign = 'center'; g.save(); g.translate(W / 2, 1080); g.transform(1, 0, -.14, 1, 0, 0); g.font = '800 120px BC'; g.fillStyle = L; g.fillText('BETA ', -110, 0); g.fillStyle = O; g.fillText('GRATIS', 150, 0); g.restore();
        g.font = '500 44px Inter, sans-serif'; g.fillStyle = '#C9D0D6'; g.fillText('La pizarra donde la defensa reacciona', W / 2, 1180);
        g.fillStyle = O; g.beginPath(); g.roundRect(W / 2 - 330, 1250, 660, 110, 55); g.fill(); g.fillStyle = D; g.font = '800 60px BC'; g.fillText('ENLACE EN LA BIO', W / 2, 1327);
        g.fillStyle = G; g.font = '700 40px BC'; g.fillText((spec.handle || '@EXTRAPASS.HOOP').toUpperCase(), W / 2, 1440); g.restore(); return cv.toDataURL('image/jpeg', .9); }
      hookText(1);
      if(it.type === 'title'){ drawCourt(it.pid, it.k, 0, false, 560); const a = ease(lt / 300);
        g.save(); g.globalAlpha = a * .82; g.fillStyle = D; g.fillRect(0, 560, W, 800); g.globalAlpha = a; g.textAlign = 'center'; g.save(); g.translate(W / 2, 1020); g.transform(1, 0, -.14, 1, 0, 0); g.font = '800 104px BC'; g.fillStyle = O; g.fillText(it.text.toUpperCase(), 0, 0); g.restore(); g.restore(); footer(); return cv.toDataURL('image/jpeg', .9); }
      const tt = Math.min(1, lt / Math.max(1, it.d - 650));
      drawCourt(it.pid, it.k, tt, it.ctr, 560); caption(it.n, it.note, ease(lt / 250));
      return cv.toDataURL('image/jpeg', .9);
    };
    return window.__tl.total;
  }, {spec, fonts, escudo: b64('escudo.png'), sello: b64('sello.png'), FPS, W, H});
  const N = Math.ceil(tl / 1000 * FPS);
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'reelf_'));
  for(let f = 0; f < N; f++){ const d = await p.evaluate(f => window.__frame(f), f); fs.writeFileSync(path.join(dir, String(f).padStart(5, '0') + '.jpg'), Buffer.from(d.split(',')[1], 'base64')); }
  await b.close();
  const args = ['-y', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg')];
  if(spec.music && fs.existsSync(spec.music)) args.push('-i', spec.music, '-shortest');
  else args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-shortest');
  args.push('-c:a', 'aac', '-b:a', '128k', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-crf', '19', '-movflags', '+faststart', OUTF);
  execFileSync('ffmpeg', args, {stdio: 'ignore'});
  fs.rmSync(dir, {recursive: true});
  console.log('OK', OUTF, (N / FPS).toFixed(1) + ' s');
})();
