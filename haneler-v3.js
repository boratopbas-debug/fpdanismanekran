/* ===================== Haneler — Finansal Planlama Metodolojisi v3 =====================
   app.js'ten sonra yüklenir; viewHaneler / viewHaneDetay fonksiyonlarını v3 ile değiştirir.
   Motor müşteri portalındaki engine.js ile birebir aynıdır; app.js'teki eski (1–5) fonksiyonlarla
   çakışmasın diye V3 adı altında tutulur.
   Hane kuralı: her üye kendi zincirini çalıştırır; ortak hedefte üyelerin Final_Skoru'larının min()'i alınır.
   Acil durum fonu v3'te hedef değildir; her üyenin kapasitesine likidite tamponu olarak girer. */

const V3 = (() => {
  const PARAM = {
    surum: 'v3', T1: 2.95, T2: 4.15,
    KAP_W: { likidite: 0.25, gelir: 0.25, yukum: 0.20, netvarlik: 0.30 },
    DAVRANIS_K: 1,
    PORT: {
      P1: { hisse: 25.00, altin: 7.50, dibs: 27.00, mevduat: 27.00, ost: 13.50 },
      P2: { hisse: 40.00, altin: 12.00, dibs: 13.09, mevduat: 21.82, ost: 13.09 },
      P3: { hisse: 55.00, altin: 7.50, dibs: 7.50, mevduat: 15.00, ost: 15.00 },
    },
    PORT_AD: { P1: 'Temkinli', P2: 'Dengeli', P3: 'Atak' },
    KOMITE: { donem: '2026 4. çeyrek', karar: { P1: 30, P2: 45, P3: 60 } },
    VARSAYIM: { P1: { r: 0.015, s: 0.05 }, P2: { r: 0.0309, s: 0.1188 }, P3: { r: 0.045, s: 0.16 } },
    GUARD: { altGiris: 0.70, hedef: 0.80, ustGiris: 0.95 },
    REBALANS_ESIK: 5,
  };
  const likiditeBileseni = ay => ay < 3 ? 1 : ay < 6 ? 2 : ay < 12 ? 3 : ay < 24 ? 4 : 5;
  function kapasiteSkoru(k) { const W = PARAM.KAP_W; const k5 = W.likidite * likiditeBileseni(k.tamponAy) + W.gelir * k.gelir + W.yukum * k.yukum + W.netvarlik * k.netvarlik; return { k5, k7: 1 + (k5 - 1) * 1.5 }; }
  const likiditeTavani = ay => ay < 1 ? 2.5 : Math.min(7, 2.5 + (ay - 1) / 5 * 4.5);
  function davranisSkoru(anket, kap7, olcumler) { let d = Math.min(anket, kap7), kaynak = 'varsayılan'; for (const o of olcumler) { d = Math.min(7, Math.max(1, d + PARAM.DAVRANIS_K * o.M)); kaynak = 'gözlem'; } return { deger: d, kaynak }; }
  function kural1(a, b, c) { const [mn, md, mx] = [a, b, c].sort((x, y) => x - y); return mn + (md - mn) / 3 + (mx - md) / 6; }
  function riskProfili(c) {
    const kap = kapasiteSkoru(c.kapasite), dav = davranisSkoru(c.anket, kap.k7, c.davranisOlcumleri);
    const k1 = kural1(c.anket, kap.k7, dav.deger), lt = likiditeTavani(c.kapasite.tamponAy);
    return { anket: c.anket, kap7: kap.k7, davranis: dav.deger, davranisKaynak: dav.kaynak, kural1: k1, likiditeTavani: lt, likiditeBagliyor: lt < k1, risk: Math.min(k1, lt) };
  }
  const vadeBandi = v => v <= 1 ? 1 : v <= 3 ? 2 : v <= 5 ? 3 : v <= 10 ? 4 : 5;
  const vadeTavani = v => Math.min(7, 1 + 1.5 * vadeBandi(v));
  const hedefVadesi = g => g.tip === 'harcama_akisi' ? (g.baslangicaYil > 0 ? g.baslangicaYil + g.akisYil / 2 : g.kalanAkisYil / 2) : g.kalanAy / 12;
  const portfoySec = f => f < PARAM.T1 ? 'P1' : f < PARAM.T2 ? 'P2' : 'P3';
  const overlayAgirligi = v => Math.min(1, Math.max(0, (v - 2) / 2));
  const rampaCarpani = kalanAy => Math.min(Math.ceil(kalanAy / 3) / 4, 1);
  function lrm(vals) { const raw = vals.map(v => v * 100), fl = raw.map(Math.floor); let rem = 10000 - fl.reduce((a, b) => a + b, 0); raw.map((x, i) => [x - fl[i], i]).sort((a, b) => b[0] - a[0]).slice(0, rem).forEach(([, i]) => fl[i]++); return fl.map(x => x / 100); }
  function allocation(p, hisse, rampa = 1) {
    const b = PARAM.PORT[p]; if (hisse === undefined) hisse = b.hisse;
    const pool0 = b.dibs + b.mevduat + b.ost, pool = 100 - hisse - b.altin;
    const d = { dibs: b.dibs * pool / pool0, mevduat: b.mevduat * pool / pool0, ost: b.ost * pool / pool0 };
    const h = hisse * rampa; d.mevduat += hisse - h;
    const [H, A, D, M, O] = lrm([h, b.altin, d.dibs, d.mevduat, d.ost]); return { hisse: H, altin: A, dibs: D, mevduat: M, ost: O };
  }
  function goalResult(rp, g, finalOverride) {
    const v = hedefVadesi(g), vt = vadeTavani(v);
    const final = finalOverride !== undefined ? finalOverride : Math.min(rp.risk, vt, g.ihtiyacTavani || 7);
    const p = g.donukPortfoy || portfoySec(final), notr = PARAM.PORT[p].hisse;
    const teslim = g.tip === 'toplu_odeme' && g.kalanAy <= 12;
    let hisse, ov = 0, rampa = 1;
    if (teslim) { rampa = rampaCarpani(g.kalanAy); hisse = notr; } else { ov = overlayAgirligi(v); hisse = notr + (PARAM.KOMITE.karar[p] - notr) * ov; }
    return { vade: v, vadeBandi: vadeBandi(v), vadeTavani: vt, final, portfoy: p, overlay: ov, teslim, rampa, alloc: allocation(p, hisse, rampa) };
  }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function normalSeri(n, seed) { const r = mulberry32(seed), z = new Float64Array(n); for (let i = 0; i < n; i += 2) { const u1 = Math.max(r(), 1e-12), u2 = r(), m = Math.sqrt(-2 * Math.log(u1)); z[i] = m * Math.cos(2 * Math.PI * u2); if (i + 1 < n) z[i + 1] = m * Math.sin(2 * Math.PI * u2); } return z; }
  const _Z = {};
  function pBasari(p, birikim, katkiAy, hedef, yil, N = 4000) {
    const { r, s } = PARAM.VARSAYIM[p]; const sig2 = Math.log(1 + (s * s) / ((1 + r) * (1 + r))), mu = Math.log(1 + r) - sig2 / 2, sig = Math.sqrt(sig2);
    const adim = Math.max(1, Math.round(yil)), key = N * adim, z = _Z[key] || (_Z[key] = normalSeri(key, 20261113));
    let ok = 0; for (let i = 0; i < N; i++) { let B = birikim; for (let t = 0; t < adim; t++) { const g = Math.exp(mu + sig * z[i * adim + t]); B = B * g + 12 * katkiAy * Math.sqrt(g); } if (B >= hedef) ok++; } return ok / N;
  }
  function birikimEsigi(p, katkiAy, hedef, yil, hedefP) { let lo = 0, hi = hedef; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (pBasari(p, m, katkiAy, hedef, yil) < hedefP) lo = m; else hi = m; } return hi; }
  function guardrail(g, gr) {
    if (g.hedefTutar === undefined || !g.aylikKatki) return null;
    const P = pBasari(gr.portfoy, g.birikenTutar, g.aylikKatki, g.hedefTutar, gr.vade);
    const alt = birikimEsigi(gr.portfoy, g.aylikKatki, g.hedefTutar, gr.vade, PARAM.GUARD.altGiris);
    const ust = birikimEsigi(gr.portfoy, g.aylikKatki, g.hedefTutar, gr.vade, PARAM.GUARD.ustGiris);
    return { durum: P < PARAM.GUARD.altGiris ? 'alt' : P > PARAM.GUARD.ustGiris ? 'ust' : 'yolunda', altEsik: alt, ustEsik: ust, _p: P };
  }
  /* B.9.6 — üst eşikte: mevcut katkıyla P ≥ %95 veren daha düşük model portföy (yalnızca öneri) */
  function ihtiyacTavaniOnerisi(g, gr) {
    const sira = ['P1', 'P2', 'P3'], i = sira.indexOf(gr.portfoy);
    for (let j = 0; j < i; j++) if (pBasari(sira[j], g.birikenTutar, g.aylikKatki, g.hedefTutar, gr.vade) >= PARAM.GUARD.ustGiris) return sira[j];
    return null;
  }
  return { PARAM, riskProfili, goalResult, guardrail, ihtiyacTavaniOnerisi, portfoySec, hedefVadesi, vadeTavani };
})();

/* ===================== v3 hane verisi =====================
   Üyelerin v3 profil girdileri (anket 1–7, kapasite bileşenleri 1–5, likidite tamponu ay, yıllık davranış ölçümleri)
   ve hedefleri. Ayşe'nin değerleri müşteri portalıyla ve metodolojideki C.1 örneğiyle aynıdır. */
const HANE_V3 = {
  'yilmaz-aydin-hane': {
    sonGozden: '12 Kas 2026',
    uyeler: {
      'ayse-yilmaz': { rol: 'Hane temsilcisi', anket: 4, kapasite: { tamponAy: 14, gelir: 3, yukum: 3, netvarlik: 3 },
        davranisOlcumleri: [{ tarih: 'Kas 2026', M: 0 }], sonrakiOlcum: 'Kas 2027', varlik: 850000,
        hedefler: [
          { name: 'Ev peşinatı', tip: 'toplu_odeme', kalanAy: 36, vadeLabel: '3 yıl', hedefTutar: 800000, birikenTutar: 340000, aylikKatki: 14500 },
          { name: 'Emeklilik', tip: 'harcama_akisi', baslangicaYil: 22, akisYil: 25, vadeLabel: '22 yıl sonra başlıyor', birikenTutar: 510000 },
        ] },
      'emre-aydin': { rol: 'Eş', anket: 6, kapasite: { tamponAy: 2, gelir: 4, yukum: 2, netvarlik: 3 },
        davranisOlcumleri: [], sonrakiOlcum: 'Mar 2027', varlik: 410000,
        hedefler: [
          { name: 'Emeklilik', tip: 'harcama_akisi', baslangicaYil: 25, akisYil: 20, vadeLabel: '25 yıl sonra başlıyor', birikenTutar: 220000 },
        ] },
    },
    ortak: [
      { name: 'Ortak ev fonu', tip: 'toplu_odeme', kalanAy: 48, vadeLabel: '4 yıl', hedefTutar: 1500000, birikenTutar: 600000, aylikKatki: 18000 },
    ],
    kaldirilan: ['Ortak acil fon'],
  },
};

/* ===================== Hesap ===================== */
function haneV3(h) {
  const d = HANE_V3[h.id];
  if (!d) return null;
  if (d._c) return d._c;
  const uyeler = h.memberIds.map(id => { const c = getClient(id), u = d.uyeler[id]; return { id, c, u, rp: V3.riskProfili(u) }; });
  const ortak = d.ortak.map(g => {
    const v = V3.hedefVadesi(g), vt = V3.vadeTavani(v);
    const uf = uyeler.map(m => ({ m, risk: m.rp.risk, vt, final: Math.min(m.rp.risk, vt, g.ihtiyacTavani || 7) }));
    const haneFinal = Math.min(...uf.map(x => x.final));
    const baglayan = uf.filter(x => x.final === haneFinal).map(x => x.m);
    const gr = V3.goalResult(null, g, haneFinal), gd = V3.guardrail(g, gr);
    let nedeni = 'risk';
    if (vt <= Math.min(...uf.map(x => x.risk))) nedeni = 'vade';
    else if (baglayan.some(m => m.rp.likiditeBagliyor)) nedeni = 'likidite';
    return { g, gr, uf, haneFinal, baglayan, gd, nedeni, ihtiyac: gd && gd.durum === 'ust' ? V3.ihtiyacTavaniOnerisi(g, gr) : null };
  });
  const bireysel = [];
  uyeler.forEach(m => (m.u.hedefler || []).forEach(g => {
    const gr = V3.goalResult(m.rp, g), gd = V3.guardrail(g, gr);
    bireysel.push({ m, g, gr, gd, ihtiyac: gd && gd.durum === 'ust' ? V3.ihtiyacTavaniOnerisi(g, gr) : null });
  }));
  const aksiyon = [...ortak, ...bireysel].filter(x => x.gd && x.gd.durum !== 'yolunda').length + uyeler.filter(m => m.rp.likiditeBagliyor).length;
  return d._c = { d, uyeler, ortak, bireysel, aksiyon };
}

/* ===================== Biçim ===================== */
const v3f2 = n => n.toFixed(2).replace('.', ',');
const v3TL = n => Math.round(n).toLocaleString('tr-TR') + ' TL';
const v3Bin = n => (Math.round(n / 1000) * 1000).toLocaleString('tr-TR') + ' TL';
const v3Mn = n => n >= 1e6 ? (n / 1e6).toFixed(2).replace('.', ',') + ' mn TL' : Math.round(n / 1000).toLocaleString('tr-TR') + ' bin TL';
const v3Pct = n => '%' + (Math.round(n * 100) / 100).toString().replace('.', ',');
const V3_PC = { P1: { bg: '#DDF3EC', text: '#0F766E', bar: '#009486' }, P2: { bg: '#FDF3E0', text: '#97701F', bar: '#C68A1F' }, P3: { bg: '#FDE7E4', text: '#B5402E', bar: '#E5533D' } };
const v3Badge = (p, extra) => `<span class="badge" style="background:${V3_PC[p].bg};color:${V3_PC[p].text}">${p} ${V3.PARAM.PORT_AD[p]}${extra ? ' · ' + extra : ''}</span>`;
const v3Ilk = m => m.c.name.split(' ')[0];

function v3RiskStrip(markers) {
  const x = v => (v - 1) / 6 * 100, P = V3.PARAM;
  const zones = [['P1', 1, P.T1], ['P2', P.T1, P.T2], ['P3', P.T2, 7]];
  return `<div class="v3-strip">${zones.map(([p, a, b]) => `<div class="v3-zone" style="left:${x(a)}%;width:${x(b) - x(a)}%;background:${V3_PC[p].bg};color:${V3_PC[p].text}">${p} ${P.PORT_AD[p]}</div>`).join('')}
    ${markers.map(m => `<div class="v3-mark ${m.alt ? 'alt' : ''}" style="left:${x(m.v)}%"><span>${m.label}</span></div>`).join('')}</div>
    <div class="v3-axis">${[1, 2, 3, 4, 5, 6, 7].map(n => `<span style="left:${x(n)}%">${n}</span>`).join('')}</div>`;
}

function v3Komite(gr) {
  if (gr.teslim) return `teslim rampası (hisse ×${v3f2(gr.rampa)})`;
  if (gr.overlay === 0) return 'Komite görüşü yansımaz (vade < 2 yıl)';
  if (gr.overlay < 1) return `Komite görüşü %${Math.round(gr.overlay * 100)} yansıdı`;
  return 'Komite görüşü tam yansıdı';
}

function v3Guard(g, gd, ihtiyac, kim) {
  if (!gd) return `<p class="v3-small">Harcama akışı hedefi; tutar ve katkı tanımlanınca alt/üst eşikler hesaplanır.</p>`;
  const pct = Math.min(100, g.birikenTutar / g.hedefTutar * 100), aX = gd.altEsik / g.hedefTutar * 100, uX = gd.ustEsik / g.hedefTutar * 100;
  const D = { yolunda: ['badge-teal', 'Plan yolunda'], alt: ['badge-amber', 'Alt eşiğin altında'], ust: ['badge-teal', 'Üst eşiğin üstünde'] }[gd.durum];
  let act = '';
  if (gd.durum === 'alt') act = `<div class="v3-action amber"><div><p class="v3-at">Katkı artışı önerisi</p>Birikim alt eşiğin (${v3Bin(gd.altEsik)}) altında. ${kim} ile görüşülüp aylık katkının artırılması önerilir; risk otomatik yükseltilmez (B.9).</div></div>`;
  if (gd.durum === 'ust') act = `<div class="v3-action teal"><div><p class="v3-at">Hedefin önünde · katkı düşürülmez (B.9.6)</p>${ihtiyac ? `Mevcut katkıyla ${v3Badge(ihtiyac)} da %95 eşiğini karşılıyor; danışman ve müşteri onayıyla risk tavanı düşürülebilir.` : 'Daha düşük bir model portföy %95 eşiğini karşılamıyor; yalnızca raporlanır.'} Katkı ancak müşteri isterse ve P %90'ın altına inmeyecek şekilde azaltılır.</div></div>`;
  return `<div class="v3-gtrack"><div class="v3-gband" style="left:${aX}%;width:${uX - aX}%"></div><div class="v3-gfill" style="width:${pct}%"></div></div>
    <div class="v3-grow"><span><span class="v3-mono">${v3TL(g.birikenTutar)}</span> / <span class="v3-mono">${v3TL(g.hedefTutar)}</span> · aylık katkı <span class="v3-mono">${v3TL(g.aylikKatki)}</span></span>
      <span class="v3-grow-r"><span class="v3-muted" title="Yalnızca danışman ekranında; müşteriye olasılık gösterilmez (B.9.2)">iç P(başarı) <span class="v3-mono">%${Math.round(gd._p * 100)}</span></span><span class="badge ${D[0]}">${D[1]}</span></span></div>
    <p class="v3-small">Alt eşik <strong class="v3-mono">${v3Bin(gd.altEsik)}</strong> (P %70) · üst eşik <strong class="v3-mono">${v3Bin(gd.ustEsik)}</strong> (P %95). Müşteri portalında yalnızca bu TL eşikleri görünür.</p>${act}`;
}

/* ===================== Görünümler (app.js'tekileri değiştirir) ===================== */
function viewHaneler() {
  const rows = HOUSEHOLDS.map(h => ({ h, c: haneV3(h) }));
  const uyeSay = HOUSEHOLDS.reduce((s, h) => s + h.memberIds.length, 0);
  const ortakSay = rows.reduce((s, r) => s + (r.c ? r.c.ortak.length : 0), 0);
  const varlik = rows.reduce((s, r) => s + (r.c ? r.c.uyeler.reduce((a, m) => a + m.u.varlik, 0) : 0), 0);
  return `
    <p class="page-title">Haneler</p>
    <p class="page-sub">Metodoloji ${V3.PARAM.surum} · ortak hedeflerde her üye kendi zincirini çalıştırır, en düşük Final_Skoru bağlar</p>
    <div class="stat-grid">
      <div class="stat-card"><p class="stat-label">Hane</p><p class="stat-value">${HOUSEHOLDS.length}</p></div>
      <div class="stat-card"><p class="stat-label">Üye</p><p class="stat-value">${uyeSay}</p></div>
      <div class="stat-card"><p class="stat-label">Ortak hedef</p><p class="stat-value">${ortakSay}</p></div>
      <div class="stat-card"><p class="stat-label">Hane varlığı</p><p class="stat-value">${v3Mn(varlik)}</p></div>
    </div>
    <p class="section-label">Hane listesi</p>
    <div class="row-list">
      ${rows.map(({ h, c }) => {
        if (!c) return `<div class="row-item" onclick="navigate('hane/${h.id}')"><div><p class="row-name">${h.name}</p><p class="row-meta">v3 girdileri eksik</p></div><span class="badge badge-neutral">—</span></div>`;
        const ps = [...new Set(c.ortak.map(o => o.gr.portfoy))];
        return `
        <div class="row-item" style="border-left-color:${V3_PC[ps[0] || 'P2'].bar};" onclick="navigate('hane/${h.id}')">
          <div>
            <p class="row-name">${h.name}</p>
            <p class="row-meta">${c.uyeler.map(m => `${m.c.name} <span class="v3-mono">${v3f2(m.rp.risk)}</span>`).join(' · ')} · son gözden geçirme ${c.d.sonGozden}</p>
          </div>
          <div class="v3-badges">${c.ortak.map(o => v3Badge(o.gr.portfoy, o.g.name)).join(' ')}${c.aksiyon ? `<span class="badge badge-amber">${c.aksiyon} konu</span>` : `<span class="badge badge-teal">Yolunda</span>`}</div>
        </div>`;
      }).join('')}
    </div>`;
}

function viewHaneDetay(hid) {
  const h = getHousehold(hid);
  if (!h) return `<p class="page-title">Hane bulunamadı</p>`;
  const c = haneV3(h);
  const crumb = `<div class="breadcrumb"><a onclick="navigate('haneler')">Haneler</a> <span>›</span> <span>${h.name}</span></div>`;
  if (!c) return `${crumb}<p class="page-title">${h.name}</p><p class="note-box">Bu hane için v3 profil girdileri (anket 1–7, kapasite bileşenleri, likidite tamponu) henüz girilmedi.</p>`;
  const P = V3.PARAM;

  const uyeKart = m => {
    const r = m.rp, u = m.u, son = u.davranisOlcumleri[u.davranisOlcumleri.length - 1];
    const gerekAy = 1 + (r.kural1 - 2.5) / 4.5 * 5;
    return `<div class="panel v3-member">
      <div class="v3-head"><div><p class="v3-name"><a onclick="navigate('musteri/${m.id}')">${m.c.name}</a></p><p class="v3-meta">${u.rol} · Osmanlı varlığı ${v3Mn(u.varlik)}</p></div>${v3Badge(V3.portfoySec(r.risk), 'risk ' + v3f2(r.risk))}</div>
      <div class="v3-pgrid">
        <div><p class="k">Anket</p><p class="v">${v3f2(r.anket)}</p></div>
        <div><p class="k">Kapasite</p><p class="v">${v3f2(r.kap7)}</p></div>
        <div><p class="k">Davranış</p><p class="v">${v3f2(r.davranis)}</p></div>
        <div><p class="k">Kural 1</p><p class="v">${v3f2(r.kural1)}</p></div>
        <div class="${r.likiditeBagliyor ? 'bind' : ''}"><p class="k">Likidite tavanı</p><p class="v">${v3f2(r.likiditeTavani)}</p></div>
      </div>
      <p class="v3-small">Tampon <strong class="v3-mono">${String(u.kapasite.tamponAy).replace('.', ',')} ay</strong> · davranış ${r.davranisKaynak === 'gözlem' ? `son ölçüm ${son.tarih} (M = ${v3f2(son.M)})` : `henüz ölçülmedi, min(anket, kapasite) = ${v3f2(Math.min(r.anket, r.kap7))}`} · sıradaki yıllık ölçüm ${u.sonrakiOlcum}</p>
      ${r.likiditeBagliyor ? `<div class="v3-action coral"><div><p class="v3-at">Likidite tavanı risk skorunu sınırlıyor</p>Kural 1 ${v3f2(r.kural1)} çıkıyor, tampon ${u.kapasite.tamponAy} ay olduğu için skor ${v3f2(r.likiditeTavani)}'de kalıyor. Tavanın bağlamaması için yaklaşık <strong class="v3-mono">${String(Math.ceil(gerekAy * 10) / 10).replace('.', ',')} ay</strong> tampon gerekiyor.</div></div>` : ''}
    </div>`;
  };

  const ortakKart = o => {
    const g = o.g, gr = o.gr;
    const neden = { vade: `Vade tavanı (${v3f2(gr.vadeTavani)}) üyelerin risk skorlarından düşük; hane skoru vadeden geliyor.`,
      likidite: `Bağlayan üye ${o.baglayan.map(v3Ilk).join(', ')}; skoru likidite tavanıyla sınırlı.`,
      risk: `Bağlayan üye ${o.baglayan.map(v3Ilk).join(', ')}.` }[o.nedeni];
    const farkli = o.uf.filter(x => V3.portfoySec(x.final) !== gr.portfoy);
    return `<div class="panel v3-goal" style="border-left-color:${V3_PC[gr.portfoy].bar}">
      <div class="v3-head"><div><p class="v3-name">${g.name} <span class="badge badge-neutral">Ortak</span></p>
        <p class="v3-meta">${g.tip === 'harcama_akisi' ? 'Harcama akışı' : 'Toplu ödeme'} · ${g.vadeLabel} · vade bandı ${gr.vadeBandi} · ${v3Komite(gr)}</p></div>
        ${v3Badge(gr.portfoy, v3Pct(gr.alloc.hisse) + ' hisse')}</div>
      <div class="v3-chain">
        <div class="h">Üye</div><div class="h">Risk skoru</div><div class="h">Vade tavanı</div><div class="h">Final_Skoru</div><div class="h">Tek başına</div>
        ${o.uf.map(x => { const mn = x.final === o.haneFinal; return `<div>${v3Ilk(x.m)}</div><div class="n">${v3f2(x.risk)}</div><div class="n">${v3f2(x.vt)}</div><div class="n ${mn ? 'min' : ''}">${v3f2(x.final)}${mn ? ' ◂' : ''}</div><div>${v3Badge(V3.portfoySec(x.final))}</div>`; }).join('')}
        <div class="t">Hane (min)</div><div class="t"></div><div class="t"></div><div class="t n">${v3f2(o.haneFinal)}</div><div class="t">${v3Badge(gr.portfoy)}</div>
      </div>
      <p class="v3-small" style="margin-bottom:10px">${neden}${farkli.length ? ` ${farkli.map(x => v3Ilk(x.m)).join(', ')} tek başına ${farkli.map(x => V3.portfoySec(x.final)).join('/')} alırdı; ortak hedefte ihtiyatlı üye bağlar.` : ''}</p>
      ${stackedBarHTML(gr.alloc)}${allocTableHTML(gr.alloc)}
      ${v3Guard(g, o.gd, o.ihtiyac, 'Hane üyeleri')}
    </div>`;
  };

  const bireyKart = b => `<div class="panel v3-goal" style="border-left-color:${V3_PC[b.gr.portfoy].bar}">
      <div class="v3-head"><div><p class="v3-name">${b.g.name} <span class="badge badge-neutral">${v3Ilk(b.m)}</span></p>
        <p class="v3-meta">${b.g.tip === 'harcama_akisi' ? 'Harcama akışı' : 'Toplu ödeme'} · ${b.g.vadeLabel} · Final_Skoru ${v3f2(b.gr.final)}${b.gr.vadeTavani < b.m.rp.risk ? ` (vade tavanı ${v3f2(b.gr.vadeTavani)})` : ''} · ${v3Komite(b.gr)}</p></div>
        ${v3Badge(b.gr.portfoy, v3Pct(b.gr.alloc.hisse) + ' hisse')}</div>
      ${stackedBarHTML(b.gr.alloc)}
      ${v3Guard(b.g, b.gd, b.ihtiyac, v3Ilk(b.m))}
    </div>`;

  return `
    ${crumb}
    <p class="page-title">${h.name}</p>
    <p class="page-sub">Ortak hedefte hane Final_Skoru = min(üyelerin hedef bazlı Final_Skoru) · bireysel hedeflerde her üye kendi skorunu kullanır · son gözden geçirme ${c.d.sonGozden}</p>

    <p class="section-label">Üyeler</p>
    <div class="panel" style="margin-bottom:12px">
      ${v3RiskStrip(c.uyeler.map((m, i) => ({ v: m.rp.risk, label: v3Ilk(m) + ' ' + v3f2(m.rp.risk), alt: i % 2 === 1 })))}
      <p class="note-box" style="margin:8px 0 0">Risk skoru = min(Kural 1, likidite tavanı). Kural 1 = en düşük girdi + (orta − en düşük)/3 + (en yüksek − orta)/6. Eşikler ${v3f2(P.T1)} / ${v3f2(P.T2)}.</p>
    </div>
    <div class="v3-members">${c.uyeler.map(uyeKart).join('')}</div>

    <p class="section-label">Ortak hedefler</p>
    <div class="legend-row">${legendHTML()}</div>
    ${c.ortak.map(ortakKart).join('')}
    ${c.d.kaldirilan && c.d.kaldirilan.length ? `<p class="note-box">${c.d.kaldirilan.join(', ')} v3'te ayrı bir hedef değil. Acil durum parası her üyenin kapasitesine likidite tamponu olarak giriyor ve hane min() işleminin dışında kalıyor.</p>` : ''}

    <p class="section-label">Bireysel hedefler</p>
    ${c.bireysel.map(bireyKart).join('')}

    <p class="section-label">Bu çeyrek</p>
    <div class="panel">
      <div class="v3-ind"><span>Yatırım Komitesi kararı · ${P.KOMITE.donem}</span><span class="v3-mono">${['P1', 'P2', 'P3'].map(p => `${p} %${P.PORT[p].hisse}→<strong>%${P.KOMITE.karar[p]}</strong>`).join(' · ')}</span></div>
      <div class="v3-ind"><span>Yeniden dengeleme eşiği</span><span class="v3-mono">${P.REBALANS_ESIK} puan · hedef bazında</span></div>
      ${c.uyeler.map(m => `<div class="v3-ind"><span>${m.c.name} · yıllık davranış ölçümü</span><span>${m.rp.davranisKaynak === 'gözlem' ? `<span class="badge badge-teal">Son: ${m.u.davranisOlcumleri[m.u.davranisOlcumleri.length - 1].tarih}</span>` : '<span class="badge badge-neutral">İlk ölçüm bekleniyor</span>'} <span class="v3-muted">sıradaki ${m.u.sonrakiOlcum}</span></span></div>`).join('')}
    </div>`;
}

/* app.js ilk render'ı bu dosya yüklenmeden yaptığı için yeniden çiz */
render();
