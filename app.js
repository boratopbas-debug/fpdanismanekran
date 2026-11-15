/* ===================== Hesaplama motoru (Bölüm 5-9) ===================== */

function round1(n) { return Math.round(n * 10) / 10; }

function kural1(tolerans, kapasite, davranissal) {
  const vals = [tolerans, kapasite, davranissal].slice().sort((a, b) => a - b);
  const small = vals[0], l1 = vals[1], l2 = vals[2];
  const raw = Math.min(tolerans, kapasite, davranissal);
  if ((l1 - small) >= 3 && (l2 - small) >= 3) return raw + 1;
  return raw;
}

function vadeBandi(years) {
  if (years <= 1) return 1;
  if (years <= 3) return 2;
  if (years <= 5) return 3;
  if (years <= 10) return 4;
  return 5;
}

function kural2(riskBandi, vb) {
  const fark = riskBandi - vb;
  if (fark >= 3) return vb + 1;
  return riskBandi;
}

const BAND_RANGE = { 1: [0, 20], 2: [20, 35], 3: [35, 50], 4: [50, 65], 5: [65, 80] };

function computeAllocation(finalBandi, vadeYears, hisseOverride) {
  const [lo, hi] = BAND_RANGE[finalBandi];
  const hisse = (hisseOverride !== undefined) ? hisseOverride : lo + Math.min(vadeYears / 10, 1) * (hi - lo);
  const altin = 3 + 9 * (1 - Math.abs(finalBandi - 3) / 2);
  const savunma = 100 - hisse - altin;
  const guven = 6 - finalBandi;
  const pos = { dibs: 5, mevduat: 3, ost: 1 };
  const w = k => Math.max(0, 1 - Math.abs(guven - pos[k]) / 4);
  const wD = w('dibs'), wM = w('mevduat'), wO = w('ost');
  const wSum = wD + wM + wO;
  return {
    hisse: round1(hisse), altin: round1(altin),
    dibs: round1(savunma * wD / wSum), mevduat: round1(savunma * wM / wSum), ost: round1(savunma * wO / wSum)
  };
}

function personalRiskBandi(client) {
  if (client.tolerans === null || client.tolerans === undefined) return null;
  return kural1(client.tolerans, client.kapasite, client.davranissal);
}

function goalResult(client, goal) {
  if (goal.override) {
    return { finalBandi: goal.override.finalBandi, alloc: computeAllocation(goal.override.finalBandi, goal.vadeYears || 0, goal.isAcil ? 5 : undefined), overridden: true };
  }
  const riskBandi = personalRiskBandi(client);
  if (goal.isAcil) {
    return { finalBandi: 1, alloc: computeAllocation(1, 0, 5) };
  }
  if (riskBandi === null) return { finalBandi: null, alloc: null };
  const vb = vadeBandi(goal.vadeYears);
  const finalBandi = kural2(riskBandi, vb);
  return { finalBandi, alloc: computeAllocation(finalBandi, goal.vadeYears) };
}

function beklenenGetiri(hissePct) {
  /* Bölüm 8 Örnek 6'daki tek veri noktasından (Final=3, hisse=%50 → %3 reel) türetilmiş basit doğrusal tahmin */
  return 0.01 + 0.04 * (hissePct / 100);
}

function katkiYeterlilik(hedefTutar, mevcutKatki, vadeYears, hissePct) {
  const r = beklenenGetiri(hissePct);
  const yillikMevcut = mevcutKatki * 12;
  const fvFactor = (Math.pow(1 + r, vadeYears) - 1) / r;
  const fv = yillikMevcut * fvFactor;
  const yeterli = fv >= hedefTutar;
  const gerekenYillik = hedefTutar * r / (Math.pow(1 + r, vadeYears) - 1);
  const gerekenAylik = gerekenYillik / 12;
  return { r, fv: Math.round(fv), yeterli, gerekenAylik: Math.round(gerekenAylik) };
}

/* Bölüm 6.2 — portföy bazlı risk skoru (revealed preference) */
function portfolioRiskScore(mevcutPortfoy) {
  const b = 1 + Math.round((mevcutPortfoy.hisse / 100) * 4);
  return Math.max(1, Math.min(5, b));
}

/* Bölüm 13.4.2 — hane seviyesinde min() */
function haneFinalBandi(household) {
  const bands = household.memberIds.map(id => personalRiskBandi(getClient(id))).filter(b => b !== null);
  if (bands.length === 0) return null;
  return Math.min(...bands);
}

function haneGoalResult(household, goal) {
  if (goal.isAcil) return { finalBandi: 1, alloc: computeAllocation(1, 0, 5) };
  const hb = haneFinalBandi(household);
  if (hb === null) return { finalBandi: null, alloc: null };
  const vb = vadeBandi(goal.vadeYears);
  const finalBandi = kural2(hb, vb);
  return { finalBandi, alloc: computeAllocation(finalBandi, goal.vadeYears) };
}

/* ===================== Grable & Lytton 13 soru (Bölüm 3) ===================== */

const GL_QUESTIONS = [
  { id: 1, text: 'Genel olarak, en yakın arkadaşınız sizi bir risk alıcı olarak nasıl tanımlardı?',
    options: [['Gerçek bir kumarbaz', 4], ['Yeterli araştırma sonrası risk almaya istekli', 3], ['Temkinli', 2], ['Gerçek bir risk kaçınıcısı', 1]] },
  { id: 2, text: 'Bir TV yarışma programındasınız; hangisini alırsınız?',
    options: [['1.000$ nakit', 1], ['%50 ihtimalle 5.000$', 2], ['%25 ihtimalle 10.000$', 3], ['%5 ihtimalle 100.000$', 4]] },
  { id: 3, text: '"Hayatta bir kez" tatil için biriktirdiniz. 3 hafta önce işinizi kaybettiniz. Ne yaparsınız?',
    options: [['İptal ederim', 1], ['Daha mütevazı yaparım', 2], ['Planlandığı gibi giderim', 3], ['Tatilimi uzatırım', 4]] },
  { id: 4, text: 'Beklenmedik 20.000$ aldınız, ne yaparsınız?',
    options: [['Banka/para piyasası hesabı', 1], ['Güvenli tahvil/tahvil fonu', 2], ['Hisse senedi/hisse fonu', 3]] },
  { id: 5, text: 'Hisse senedine yatırım yapmak konusunda ne kadar rahatsınız?',
    options: [['Hiç rahat değilim', 1], ['Biraz rahatım', 2], ['Çok rahatım', 3]] },
  { id: 6, text: '"Risk" kelimesini düşününce aklınıza ilk ne geliyor?',
    options: [['Kayıp', 1], ['Belirsizlik', 2], ['Fırsat', 3], ['Heyecan', 4]] },
  { id: 7, text: 'Varlıklarınızın çoğu yüksek faizli devlet tahvillerinde; sert varlık fiyatları artıyor, ne yaparsınız?',
    options: [['Tahvilleri elde tutarım', 1], ['Yarısını sert varlığa aktarırım', 2], ['Tümünü aktarırım', 3], ['Tümünü aktarır, ek borçlanırım', 4]] },
  { id: 8, text: 'Dört yatırım seçeneğinin en iyi/en kötü getirisi arasında hangisini tercih edersiniz?',
    options: [['+200$ / 0$', 1], ['+800$ / -200$', 2], ['+2.600$ / -800$', 3], ['+4.800$ / -2.400$', 4]] },
  { id: 9, text: 'Ek olarak 1.000$ verildi; hangisini seçersiniz?',
    options: [['Kesin 500$ kazanç', 1], ['%50 ihtimalle 1.000$, %50 ihtimalle 0$', 3]] },
  { id: 10, text: 'Ek olarak 2.000$ verildi; hangisini seçersiniz?',
    options: [['Kesin 500$ kayıp', 1], ['%50 ihtimalle 1.000$ kayıp, %50 ihtimalle 0$ kayıp', 3]] },
  { id: 11, text: '100.000$ miras — TAMAMINI tek bir seçeneğe yatırma şartı var. Hangisi?',
    options: [['Tasarruf/para piyasası', 1], ['Hisse+tahvil fonu', 2], ['15 hisseden portföy', 3], ['Emtia (altın, gümüş, petrol)', 4]] },
  { id: 12, text: '20.000$ yatıracaksınız; hangisi size en çekici gelir?',
    options: [['%60 düşük / %30 orta / %10 yüksek riskli', 1], ['%30 düşük / %40 orta / %30 yüksek riskli', 2], ['%10 düşük / %40 orta / %50 yüksek riskli', 3]] },
  { id: 13, text: 'Arkadaşınız jeolog, %20 başarı şansı olan bir altın madeni girişimi kuruyor (50-100 kat getiri potansiyeli). Ne kadar yatırırdınız?',
    options: [['Hiçbir şey', 1], ['1 aylık maaş', 2], ['3 aylık maaş', 3], ['6 aylık maaş', 4]] },
];

function glBandFromScore(score) {
  if (score >= 33) return 5;
  if (score >= 29) return 4;
  if (score >= 23) return 3;
  if (score >= 19) return 2;
  return 1;
}

/* ===================== Veri ===================== */

const CLIENTS = [
  { id: 'ayse-yilmaz', name: 'Ayşe Yılmaz', initials: 'AY', tolerans: 5, kapasite: 4, davranissal: 2, lastReview: '3 ay önce',
    mevcutPortfoy: { hisse: 62, altin: 8, dibs: 10, mevduat: 12, ost: 8 },
    pending: { type: 'davranissal_sapma', label: 'Davranışsal sapma onayı bekliyor', oldScore: 2, newScore: 4 },
    goals: [
      { name: 'Acil durum fonu', isAcil: true, vadeLabel: 'Sürekli (tampon)' },
      { name: 'Ev peşinatı', vadeYears: 3, vadeLabel: '3 yıl' },
      { name: 'Emeklilik', vadeYears: 22, vadeLabel: '22 yıl' },
    ] },
  { id: 'mehmet-kaya', name: 'Mehmet Kaya', initials: 'MK', tolerans: 3, kapasite: 3, davranissal: 3, lastReview: '6 ay önce',
    mevcutPortfoy: { hisse: 58, altin: 10, dibs: 8, mevduat: 16, ost: 8 },
    pending: { type: 'portfoy_sapma', label: 'Hisse ağırlığı bandın %8 üzerinde' },
    goals: [{ name: 'Emeklilik', vadeYears: 18, vadeLabel: '18 yıl' }] },
  { id: 'can-ozturk', name: 'Can Öztürk', initials: 'CÖ', tolerans: 4, kapasite: 2, davranissal: 3, lastReview: '4 ay önce',
    pending: { type: 'yetersiz_getiri', label: 'Hedef getiri yetersiz, katkı artırımı öneriliyor' },
    goals: [{ name: 'Ev peşinatı', vadeYears: 5, vadeLabel: '5 yıl', hedefTutar: 1500000, mevcutKatki: 18000 }] },
  { id: 'elif-sahin', name: 'Elif Şahin', initials: 'EŞ', tolerans: null, kapasite: null, davranissal: null, lastReview: '—',
    pending: { type: 'yeni_musteri', label: 'Anket tamamlanmadı' }, goals: [] },
  { id: 'zeynep-demir', name: 'Zeynep Demir', initials: 'ZD', tolerans: 2, kapasite: 3, davranissal: 2, lastReview: '12 ay önce',
    pending: { type: 'yillik_gozden_gecirme', label: 'Yıllık gözden geçirme zamanı geldi' },
    goals: [{ name: 'Emeklilik', vadeYears: 15, vadeLabel: '15 yıl' }] },
  { id: 'emre-aydin', name: 'Emre Aydın', initials: 'EA', tolerans: 5, kapasite: 5, davranissal: 5, lastReview: '2 ay önce',
    goals: [{ name: 'Emeklilik', vadeYears: 25, vadeLabel: '25 yıl' }] },
  { id: 'selin-arslan', name: 'Selin Arslan', initials: 'SA', tolerans: 2, kapasite: 1, davranissal: 2, lastReview: '5 ay önce',
    goals: [{ name: 'Acil durum fonu', isAcil: true, vadeLabel: 'Sürekli (tampon)' }] },
  { id: 'burak-celik', name: 'Burak Çelik', initials: 'BÇ', tolerans: 4, kapasite: 4, davranissal: 4, lastReview: '1 ay önce',
    mevcutPortfoy: { hisse: 35, altin: 10, dibs: 20, mevduat: 25, ost: 10 },
    goals: [{ name: 'Çocuk eğitimi', vadeYears: 10, vadeLabel: '10 yıl' }] },
];

let NEXT_CLIENT_SEQ = 1;

const HOUSEHOLDS = [
  { id: 'yilmaz-aydin-hane', name: 'Yılmaz — Aydın Hanesi', memberIds: ['ayse-yilmaz', 'emre-aydin'],
    sharedGoals: [{ name: 'Ortak ev fonu', vadeYears: 4, vadeLabel: '4 yıl' }, { name: 'Ortak acil fon', isAcil: true, vadeLabel: 'Sürekli (tampon)' }] },
];

const MODEL_PORTFOLIOS = [
  { name: 'Kısa vade modeli', count: 1204, hisse: 20, altin: 5, dibs: 40, mevduat: 30, ost: 5, drift: 0 },
  { name: 'Orta vade modeli', count: 2618, hisse: 50, altin: 12, dibs: 12, mevduat: 19, ost: 7, drift: 12 },
  { name: 'Uzun vade modeli', count: 1936, hisse: 75, altin: 5, dibs: 5, mevduat: 8, ost: 7, drift: 3 },
];

const REPORT_TYPES = [
  { key: 'baslangic', title: 'Başlangıç yatırım önerisi', desc: 'Risk sonuçları, hesaplama zinciri, önerilen portföy', scope: 'musteri' },
  { key: 'ceyreklik', title: 'Çeyreklik durum raporu', desc: 'Önceki döneme göre değişenler', scope: 'musteri' },
  { key: 'denetim', title: 'Denetim izi raporu', desc: 'Tetiklenen kurallar, tam hesaplama dökümü', scope: 'musteri' },
  { key: 'sapma', title: 'Portföy sapma raporu', desc: 'Model bandının dışına çıkan hesaplar', scope: 'genel' },
];

/* Bölüm 13.3 — çeyreklik rapor için basit "önceki çeyrek" referans noktası.
   Gerçek bir veritabanında bu, geçmiş HesaplamaSonucu kayıtlarından gelirdi. */
const PREVIOUS_QUARTER = {
  'ayse-yilmaz': { davranissal: 2 },
  'mehmet-kaya': { mevcutPortfoyHisse: 50 },
  'can-ozturk': { mevcutKatki: 18000 },
};

function ceyreklikDegisenler(client) {
  const prev = PREVIOUS_QUARTER[client.id];
  const changes = [];
  if (!prev) return changes;
  if (prev.davranissal !== undefined && prev.davranissal !== client.davranissal) {
    changes.push(`Davranışsal skor ${prev.davranissal}'ten ${client.davranissal}'e güncellendi.`);
  }
  if (prev.mevcutPortfoyHisse !== undefined && client.mevcutPortfoy && prev.mevcutPortfoyHisse !== client.mevcutPortfoy.hisse) {
    changes.push(`Mevcut portföydeki hisse ağırlığı %${prev.mevcutPortfoyHisse}'ten %${client.mevcutPortfoy.hisse}'e değişti.`);
  }
  const kg = client.goals.find(x => x.mevcutKatki !== undefined);
  if (prev.mevcutKatki !== undefined && kg && prev.mevcutKatki !== kg.mevcutKatki) {
    changes.push(`${kg.name} hedefi için aylık katkı ${prev.mevcutKatki.toLocaleString('tr-TR')} TL'den ${kg.mevcutKatki.toLocaleString('tr-TR')} TL'ye çıkarıldı.`);
  }
  return changes;
}

let RECENT_REPORTS = [
  { client: 'ayse-yilmaz', clientName: 'Ayşe Yılmaz', type: 'Denetim izi raporu', typeKey: 'denetim', when: 'Bugün, 09:14' },
  { client: null, clientName: 'Tüm müşteriler', type: 'Portföy sapma raporu', typeKey: 'sapma', when: 'Dün, 16:40' },
  { client: 'zeynep-demir', clientName: 'Zeynep Demir', type: 'Çeyreklik durum raporu', typeKey: 'ceyreklik', when: 'Dün, 11:02' },
];

const ASSET_COLORS = { hisse: '#7F77DD', altin: '#EF9F27', dibs: '#5DCAA5', mevduat: '#B4B2A9', ost: '#F0997B' };

/* Risk sınıfı renk kodlaması — Osmanlı BYF ailesinin kendi ürün renklerinden ödünç alındı.
   Soğuktan sıcağa: muhafazakâr (nane/teal) → agresif (mercan). */
const RISK_COLORS = {
  1: { bg: '#DDF3EC', text: '#0F766E', bar: '#009486' },
  2: { bg: '#E3EEEC', text: '#386D68', bar: '#386D68' },
  3: { bg: '#FDF3E0', text: '#97701F', bar: '#C68A1F' },
  4: { bg: '#FFEFE5', text: '#B5652E', bar: '#E38A4E' },
  5: { bg: '#FDE7E4', text: '#B5402E', bar: '#E5533D' },
};
function riskColor(n) { return RISK_COLORS[n] || RISK_COLORS[3]; }
function riskBadge(n, extra) {
  const c = riskColor(n);
  return `<span class="badge" style="background:${c.bg}; color:${c.text};">Sınıf ${n}${extra ? ' · ' + extra : ''}</span>`;
}
const ASSET_LABELS = { hisse: 'Hisse', altin: 'Kıymetli maden', dibs: 'DİBS', mevduat: 'Mevduat', ost: 'ÖST' };

const PENDING_BADGE = {
  davranissal_sapma: 'badge-amber', portfoy_sapma: 'badge-amber', yetersiz_getiri: 'badge-amber',
  yeni_musteri: 'badge-neutral', yillik_gozden_gecirme: 'badge-neutral'
};
const AMBER_TYPES = ['davranissal_sapma', 'portfoy_sapma', 'yetersiz_getiri'];

/* ===================== Yardımcılar ===================== */

function getClient(id) { return CLIENTS.find(c => c.id === id); }
function getHousehold(id) { return HOUSEHOLDS.find(h => h.id === id); }
function householdOf(clientId) { return HOUSEHOLDS.find(h => h.memberIds.includes(clientId)); }

function legendHTML() {
  return Object.keys(ASSET_LABELS).map(k =>
    `<span class="legend-item"><span class="legend-swatch" style="background:${ASSET_COLORS[k]}"></span>${ASSET_LABELS[k]}</span>`
  ).join('');
}

function stackedBarHTML(alloc) {
  return `<div class="stacked-bar">` + Object.keys(ASSET_COLORS).map(k =>
    `<div style="width:${alloc[k]}%;background:${ASSET_COLORS[k]}"></div>`
  ).join('') + `</div>`;
}

function allocTableHTML(alloc) {
  return `<div class="alloc-row">` + Object.keys(ASSET_COLORS).map(k =>
    `<div class="alloc-cell"><p class="alloc-pct">%${alloc[k]}</p><p class="alloc-label">${ASSET_LABELS[k]}</p></div>`
  ).join('') + `</div>`;
}

function scoreOrDash(v) { return (v === null || v === undefined) ? '—' : v; }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/* ===================== Görünümler ===================== */

function viewAnaPanel() {
  const amberClients = CLIENTS.filter(c => c.pending && AMBER_TYPES.includes(c.pending.type));
  const otherPending = CLIENTS.filter(c => c.pending && !AMBER_TYPES.includes(c.pending.type));
  const priorityList = amberClients.concat(otherPending);
  const totalDrift = MODEL_PORTFOLIOS.reduce((s, m) => s + m.drift, 0);
  const yillikCount = CLIENTS.filter(c => c.pending && c.pending.type === 'yillik_gozden_gecirme').length;

  return `
    <p class="page-title">Günaydın, Bora</p>
    <p class="page-sub">31 Ağustos 2026 pazartesi</p>

    <div class="stat-grid">
      <div class="stat-card"><p class="stat-label">Toplam müşteri</p><p class="stat-value">${CLIENTS.length}</p></div>
      <div class="stat-card"><p class="stat-label">Bekleyen onay</p><p class="stat-value">${amberClients.length}</p></div>
      <div class="stat-card"><p class="stat-label">Drift uyarısı</p><p class="stat-value">${totalDrift}</p></div>
      <div class="stat-card"><p class="stat-label">Bu hafta gözden geçirme</p><p class="stat-value">${yillikCount}</p></div>
    </div>

    <p class="section-label">Bugün dikkat gerektirenler</p>
    <div class="row-list">
      ${priorityList.length ? priorityList.map(c => `
        <div class="row-item" onclick="navigate('musteri/${c.id}')">
          <div class="row-left">
            <div class="avatar">${c.initials}</div>
            <p class="row-name">${c.name}</p>
          </div>
          <span class="badge ${PENDING_BADGE[c.pending.type]}">${c.pending.label}</span>
        </div>
      `).join('') : `<p class="note-box">Bekleyen bir işlem yok.</p>`}
    </div>
  `;
}

function viewMusteriler(query) {
  const q = (query || '').toLocaleLowerCase('tr-TR');
  const filtered = q ? CLIENTS.filter(c => c.name.toLocaleLowerCase('tr-TR').includes(q)) : CLIENTS;
  return `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
      <p class="page-title" style="margin-bottom:0;">Müşterilerim</p>
      <button class="btn btn-primary" onclick="navigate('yeni-musteri')">Yeni müşteri ekle</button>
    </div>
    <p class="page-sub">${CLIENTS.length} müşteri</p>

    <input class="search-input" type="text" placeholder="Müşteri ara" value="${escapeHtml(query || '')}"
      oninput="onSearchInput(this.value)" />

    <div class="row-list" style="margin-top:14px;">
      ${filtered.length ? filtered.map(c => {
        const rb = personalRiskBandi(c);
        const hane = householdOf(c.id);
        const bandBadge = rb === null ? `<span class="badge badge-neutral">Anket bekleniyor</span>` : riskBadge(rb);
        return `
        <div class="row-item" onclick="navigate('musteri/${c.id}')">
          <div class="row-left">
            <div class="avatar">${c.initials}</div>
            <div>
              <p class="row-name">${c.name}${hane ? ' <span class="row-hane-tag">· ' + hane.name + '</span>' : ''}</p>
              <p class="row-meta">Son gözden geçirme: ${c.lastReview}</p>
            </div>
          </div>
          ${bandBadge}
        </div>`;
      }).join('') : `<p class="note-box">"${escapeHtml(query)}" ile eşleşen müşteri yok.</p>`}
    </div>
  `;
}

function viewOnayKuyrugu() {
  const list = CLIENTS.filter(c => c.pending);
  return `
    <p class="page-title">Onay kuyruğu</p>
    <p class="page-sub">${list.length} kayıt bekliyor</p>
    <div class="row-list">
      ${list.map(c => `
        <div class="row-item" onclick="navigate('musteri/${c.id}')">
          <div class="row-left">
            <div class="avatar">${c.initials}</div>
            <p class="row-name">${c.name}</p>
          </div>
          <span class="badge ${PENDING_BADGE[c.pending.type]}">${c.pending.label}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function goalRowHTML(client, goal, index) {
  const r = goalResult(client, goal);
  if (r.finalBandi === null) {
    return `<div class="detail-row"><div><p class="detail-row-title">${goal.name}</p><p class="detail-row-sub">Risk profili bekleniyor</p></div></div>`;
  }
  return `
    <div class="detail-row" style="border-left-color:${riskColor(r.finalBandi).bar};">
      <div>
        <p class="detail-row-title">${goal.name} ${r.overridden ? '<span class="badge badge-amber" style="margin-left:6px;">Elle geçersiz kılındı</span>' : ''}</p>
        <p class="detail-row-sub">${goal.isAcil ? 'Sürekli tampon' : 'Vade ' + goal.vadeLabel} · sınıf ${r.finalBandi}</p>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="detail-row-value">%${r.alloc.hisse} hisse</span>
        <button class="btn btn-tiny" onclick="navigate('musteri/${client.id}/override/${index}')">Geçersiz kıl</button>
      </div>
    </div>`;
}

function viewMusteri360(id) {
  const c = getClient(id);
  const rb = personalRiskBandi(c);
  const hane = householdOf(id);

  const pendingHTML = c.pending ? `
    <div class="callout">
      <div class="callout-text">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2L18 16H2L10 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 8V11.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="10" cy="13.7" r="0.9" fill="currentColor"/></svg>
        <span>${c.pending.label}</span>
      </div>
      ${c.pending.type === 'davranissal_sapma' ? `<button class="btn" onclick="navigate('musteri/${id}/sapma')">İncele</button>`
        : c.pending.type === 'yeni_musteri' ? `<button class="btn" onclick="navigate('musteri/${id}/anket')">Anketi başlat</button>`
        : c.pending.type === 'yetersiz_getiri' ? `<button class="btn" onclick="navigate('musteri/${id}/getiri')">İncele</button>`
        : c.pending.type === 'portfoy_sapma' ? `<button class="btn" onclick="navigate('musteri/${id}/sapma-portfoy')">İncele</button>`
        : c.pending.type === 'yillik_gozden_gecirme' ? `<button class="btn" onclick="navigate('musteri/${id}/yillik')">Gözden geçir</button>` : ''}
    </div>` : '';

  const goalsHTML = c.goals.length ? c.goals.map((g, i) => goalRowHTML(c, g, i)).join('') : `<p class="note-box">Henüz hedef tanımlanmadı.</p>`;

  const portfoyHTML = c.mevcutPortfoy ? `
    <p class="section-label">Mevcut portföy</p>
    <div class="panel" style="margin-bottom:20px;">
      ${stackedBarHTML(c.mevcutPortfoy)}
      ${allocTableHTML(c.mevcutPortfoy)}
      <p class="note-box" style="margin-top:12px; margin-bottom:0;">
        Bu dağılımdan türeyen portföy bazlı risk skoru: <strong style="color:var(--text-primary)">Sınıf ${portfolioRiskScore(c.mevcutPortfoy)}</strong>
        ${rb !== null ? ` — hesaplanan risk bandı (Sınıf ${rb}) ile ${portfolioRiskScore(c.mevcutPortfoy) === rb ? 'tutarlı' : 'farklı'}.` : '.'}
        ${rb !== null && portfolioRiskScore(c.mevcutPortfoy) !== rb ? ' Fark varsa, ilgili hedefi "Geçersiz kıl" ile mevcut portföye göre ayarlayabilirsin.' : ''}
      </p>
    </div>` : '';

  return `
    <div class="breadcrumb"><a onclick="navigate('ana-panel')">Ana panel</a> <span>›</span> <span>${c.name}</span></div>
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="avatar" style="width:44px;height:44px;font-size:14px;">${c.initials}</div>
        <div>
          <p style="font-weight:500; font-size:16px; margin:0;">${c.name}</p>
          <p style="font-size:13px; color:var(--text-secondary); margin:0;">Son gözden geçirme ${c.lastReview}
          ${hane ? ` · <a onclick="navigate('hane/${hane.id}')" style="color:var(--teal); cursor:pointer;">${hane.name}</a>` : ''}</p>
        </div>
      </div>
      ${rb !== null ? `<span class="badge" style="font-size:13px; background:${riskColor(rb).bg}; color:${riskColor(rb).text};">Risk bandı ${rb}</span>` : `<button class="btn btn-primary" onclick="navigate('musteri/${id}/anket')">Anketi başlat</button>`}
    </div>

    <div class="stat-grid">
      <div class="stat-card"><p class="stat-label">Tolerans</p><p class="stat-value">${scoreOrDash(c.tolerans)}</p></div>
      <div class="stat-card"><p class="stat-label">Kapasite</p><p class="stat-value">${scoreOrDash(c.kapasite)}</p></div>
      <div class="stat-card"><p class="stat-label">Davranışsal</p><p class="stat-value">${scoreOrDash(c.davranissal)}</p></div>
      <div class="stat-card accent"><p class="stat-label">Risk bandı</p><p class="stat-value">${rb === null ? '—' : rb}</p></div>
    </div>

    ${pendingHTML}
    ${portfoyHTML}

    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
      <p class="section-label" style="margin:0;">Hedefler</p>
      <button class="btn" onclick="navigate('musteri/${id}/yeni-hedef')">Hedef ekle</button>
    </div>
    <div style="margin-bottom:20px;">${goalsHTML}</div>

    <div class="btn-row">
      <button class="btn btn-primary" onclick="navigate('raporlar')">Rapor oluştur</button>
      <button class="btn" onclick="navigate('portfoy')">Portföyü gör</button>
    </div>
  `;
}

function viewSapmaInceleme(id) {
  const c = getClient(id);
  const p = c.pending;
  const riskBandiOnce = kural1(c.tolerans, c.kapasite, p.oldScore);
  const riskBandiSonra = kural1(c.tolerans, c.kapasite, p.newScore);

  return `
    <div class="breadcrumb"><a onclick="navigate('ana-panel')">Ana panel</a> <span>›</span> <a onclick="navigate('musteri/${id}')">${c.name}</a></div>
    <div class="panel">
      <p class="page-title" style="font-size:15px;">Sapma eşiği aşıldı, onayın gerekiyor</p>

      <div class="compare-row">
        <div class="compare-box"><p class="compare-label">Önceki kayıtlı skor</p><p class="compare-value">${p.oldScore}</p></div>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10H17M17 10L12 5M17 10L12 15" stroke="var(--text-muted)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div class="compare-box warn"><p class="compare-label">Yeni hesaplanan</p><p class="compare-value">${p.newScore}</p></div>
      </div>

      <p class="section-label">Gözlemler (zaman ağırlıklı ortalama)</p>
      <table class="data-table">
        <tr><th>Dönem</th><th>Kaynak</th><th style="text-align:center">Skor</th><th style="text-align:right">Ağırlık</th></tr>
        <tr><td>Yıl 1</td><td style="color:var(--text-muted)">Simülasyon</td><td style="text-align:center">2</td><td class="num">1 oy</td></tr>
        <tr><td>Yıl 2</td><td style="color:var(--text-muted)">Simülasyon</td><td style="text-align:center">3</td><td class="num">2 oy</td></tr>
        <tr><td>Yıl 3</td><td style="color:var(--text-muted)">Gerçek kriz</td><td style="text-align:center">4</td><td class="num">6 oy</td></tr>
      </table>

      <p class="note-box">Ağırlıklı ortalama (2×1 + 3×2 + 4×6) / 9 = 3,6 → 4'e yuvarlandı. Yıl 3 gerçek bir kriz anında gözlemlendiği için hem en yeni hem de simülasyona göre iki kat ağırlıklı sayıldı.<br><br>
      Bu onay uygulanırsa risk bandı ${riskBandiOnce} → <strong style="color:var(--text-primary)">${riskBandiSonra}</strong> olarak güncellenecek ve bağlı hedeflerin portföyü yeniden hesaplanacak.</p>

      <div class="btn-row">
        <button class="btn btn-primary" onclick="approveDavranissal('${id}')">Yeni skoru onayla</button>
        <button class="btn" onclick="rejectDavranissal('${id}')">Eski skoru koru</button>
        <button class="btn" onclick="navigate('musteri/${id}')">Daha fazla veri bekle</button>
      </div>
    </div>
  `;
}

function viewYetersizGetiri(id) {
  const c = getClient(id);
  const idx = c.goals.findIndex(g => g.hedefTutar !== undefined);
  const g = c.goals[idx];
  const r = goalResult(c, g);
  const k = katkiYeterlilik(g.hedefTutar, g.mevcutKatki, g.vadeYears, r.alloc.hisse);
  const fmt = n => n.toLocaleString('tr-TR');

  return `
    <div class="breadcrumb"><a onclick="navigate('ana-panel')">Ana panel</a> <span>›</span> <a onclick="navigate('musteri/${id}')">${c.name}</a></div>
    <div class="panel">
      <p class="page-title" style="font-size:15px;">${g.name} — hedef getiri yetersiz</p>
      <p class="note-box">Sınıf ${r.finalBandi} (%${r.alloc.hisse} hisse) için beklenen reel getiri yıllık %${round1(k.r * 100)}. Bölüm 8'deki ilke: yetersizlik durumunda risk artırılmaz, gereken ek getiri katkı artırılarak kapatılır.</p>

      <div class="compare-row">
        <div class="compare-box"><p class="compare-label">Hedef tutar</p><p class="compare-value" style="font-size:20px;">${fmt(g.hedefTutar)} TL</p></div>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10H17M17 10L12 5M17 10L12 15" stroke="var(--text-muted)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div class="compare-box warn"><p class="compare-label">Mevcut katkıyla ulaşılan</p><p class="compare-value" style="font-size:20px; color:var(--danger);">${fmt(k.fv)} TL</p></div>
      </div>

      <table class="data-table">
        <tr><th>Girdi</th><th style="text-align:right">Değer</th></tr>
        <tr><td>Vade</td><td class="num">${g.vadeYears} yıl</td></tr>
        <tr><td>Beklenen reel getiri (yıllık)</td><td class="num">%${round1(k.r * 100)}</td></tr>
        <tr><td>Mevcut aylık katkı</td><td class="num">${fmt(g.mevcutKatki)} TL</td></tr>
        <tr><td>Gereken aylık katkı</td><td class="num" style="color:var(--teal); font-weight:500;">${fmt(k.gerekenAylik)} TL</td></tr>
      </table>

      <p class="note-box">PMT(Hedef, Beklenen_Getiri, Kalan_Vade) formülüyle geriye hesaplandı — risk sınıfı (${r.finalBandi}) değiştirilmeden.</p>

      <div class="btn-row">
        <button class="btn btn-primary" onclick="approveKatkiArtirimi('${id}', ${idx})">Katkı artırımını onayla</button>
        <button class="btn" onclick="rejectKatkiArtirimi('${id}')">Müşteriyle görüş, beklet</button>
      </div>
    </div>
  `;
}


function viewPortfoySapma(id) {
  const c = getClient(id);
  const g = c.goals[0];
  const r = goalResult(c, g);
  const target = r.alloc;
  const actual = c.mevcutPortfoy;
  const fark = round1(actual.hisse - target.hisse);

  return `
    <div class="breadcrumb"><a onclick="navigate('ana-panel')">Ana panel</a> <span>›</span> <a onclick="navigate('musteri/${id}')">${c.name}</a></div>
    <div class="panel">
      <p class="page-title" style="font-size:15px;">Portföy sapması — model bandının dışında</p>
      <p class="note-box">Hisse ağırlığı hedef modelin ${fark > 0 ? fark + ' puan üzerinde' : Math.abs(fark) + ' puan altında'}. Bölüm 7'deki gece batch akışı bu farkı ±5 puanlık eşikte tespit edip işaretler.</p>

      <p class="section-label">Hedef (model)</p>
      ${stackedBarHTML(target)}
      ${allocTableHTML(target)}

      <p class="section-label" style="margin-top:18px;">Mevcut</p>
      ${stackedBarHTML(actual)}
      ${allocTableHTML(actual)}

      <div class="btn-row" style="margin-top:18px;">
        <button class="btn btn-primary" onclick="approvePortfoySapma('${id}')">Rebalancing uygula</button>
        <button class="btn" onclick="acceptPortfoySapma('${id}')">Sapmayı kabul et, izlemeye devam et</button>
      </div>
    </div>
  `;
}


function viewYillikGozdenGecirme(id) {
  const c = getClient(id);
  const rb = personalRiskBandi(c);
  const goalsHTML = c.goals.length ? c.goals.map((g, i) => goalRowHTML(c, g, i)).join('') : `<p class="note-box">Henüz hedef tanımlanmadı.</p>`;

  return `
    <div class="breadcrumb"><a onclick="navigate('ana-panel')">Ana panel</a> <span>›</span> <a onclick="navigate('musteri/${id}')">${c.name}</a></div>
    <div class="panel">
      <p class="page-title" style="font-size:15px;">Yıllık gözden geçirme</p>
      <p class="note-box">Son gözden geçirmeden bu yana bir yıl geçti. Kontrol edilecekler: hayatında büyük bir değişiklik oldu mu (gelir, medeni durum, yeni hedef), risk toleransı hâlâ geçerli mi, hedeflerin vadesi kısaldıkça bant otomatik kayıyor mu.</p>

      <p class="section-label">Mevcut profil</p>
      <div class="stat-grid">
        <div class="stat-card"><p class="stat-label">Tolerans</p><p class="stat-value">${scoreOrDash(c.tolerans)}</p></div>
        <div class="stat-card"><p class="stat-label">Kapasite</p><p class="stat-value">${scoreOrDash(c.kapasite)}</p></div>
        <div class="stat-card"><p class="stat-label">Davranışsal</p><p class="stat-value">${scoreOrDash(c.davranissal)}</p></div>
        <div class="stat-card accent"><p class="stat-label">Risk bandı</p><p class="stat-value">${rb === null ? '—' : rb}</p></div>
      </div>

      <p class="section-label">Hedefler (güncel sınıf ve hisse ağırlığı)</p>
      <div style="margin-bottom:20px;">${goalsHTML}</div>

      <div class="btn-row">
        <button class="btn btn-primary" onclick="confirmYillikGozdenGecirme('${id}')">Değişiklik yok, onayla</button>
        <button class="btn" onclick="navigate('musteri/${id}/anket')">Anketi yeniden başlat</button>
      </div>
    </div>
  `;
}

function viewAnket(id) {
  const c = getClient(id);
  return `
    <div class="breadcrumb"><a onclick="navigate('ana-panel')">Ana panel</a> <span>›</span> <a onclick="navigate('musteri/${id}')">${c.name}</a></div>
    <p class="page-title">Risk toleransı anketi</p>
    <p class="page-sub">Grable & Lytton, 13 soru — ${c.name}</p>

    <form id="gl-form" class="panel" onsubmit="return false;">
      ${GL_QUESTIONS.map(q => `
        <div class="gl-question">
          <p class="gl-question-text">${q.id}. ${q.text}</p>
          ${q.options.map((opt) => `
            <label class="gl-option">
              <input type="radio" name="q${q.id}" value="${opt[1]}">
              <span>${opt[0]}</span>
            </label>
          `).join('')}
        </div>
      `).join('')}
      <p id="gl-error" class="form-error" style="display:none;">Devam etmeden önce tüm soruları cevapla.</p>
      <div class="btn-row">
        <button class="btn btn-primary" type="button" onclick="submitAnket('${id}')">Anketi tamamla</button>
        <button class="btn" type="button" onclick="navigate('musteri/${id}')">Vazgeç</button>
      </div>
    </form>
  `;
}

function viewYeniMusteri() {
  return `
    <div class="breadcrumb"><a onclick="navigate('musteriler')">Müşterilerim</a> <span>›</span> <span>Yeni müşteri</span></div>
    <p class="page-title">Yeni müşteri ekle</p>
    <div class="panel">
      <label class="form-label">Ad soyad</label>
      <input class="form-input" id="nm-name" type="text" placeholder="Ör. Deniz Korkmaz" />
      <p id="nm-error" class="form-error" style="display:none;">Bir ad soyad gir.</p>
      <p class="note-box" style="margin-top:14px;">Kayıt oluşturulduktan sonra risk anketini başlatabilirsin — yeni müşterilerde anket (stated preference) tek elde olan girdi olduğu için birincil kaynak.</p>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="submitYeniMusteri()">Müşteriyi ekle</button>
        <button class="btn" onclick="navigate('musteriler')">Vazgeç</button>
      </div>
    </div>
  `;
}

function viewYeniHedef(id) {
  const c = getClient(id);
  return `
    <div class="breadcrumb"><a onclick="navigate('ana-panel')">Ana panel</a> <span>›</span> <a onclick="navigate('musteri/${id}')">${c.name}</a></div>
    <p class="page-title">Hedef ekle</p>
    <div class="panel">
      <label class="form-label">Hedef adı</label>
      <input class="form-input" id="nh-name" type="text" placeholder="Ör. Yurt dışı eğitim" />

      <label class="form-label" style="margin-top:14px;">Hedef tipi</label>
      <label class="gl-option"><input type="radio" name="nh-type" value="normal" checked onclick="document.getElementById('nh-vade-wrap').style.display='block'"> <span>Hedef-tarihli (belirli bir vadesi var)</span></label>
      <label class="gl-option"><input type="radio" name="nh-type" value="acil" onclick="document.getElementById('nh-vade-wrap').style.display='none'"> <span>Sürekli tampon (acil durum fonu — her zaman sınıf 1)</span></label>

      <div id="nh-vade-wrap">
        <label class="form-label" style="margin-top:14px;">Vade (yıl)</label>
        <input class="form-input" id="nh-vade" type="number" min="0.5" step="0.5" placeholder="Ör. 5" />
      </div>

      <p id="nh-error" class="form-error" style="display:none;">Hedef adını ve (tampon değilse) vadeyi gir.</p>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="submitYeniHedef('${id}')">Hedefi ekle</button>
        <button class="btn" onclick="navigate('musteri/${id}')">Vazgeç</button>
      </div>
    </div>
  `;
}

function viewOverride(id, goalIndex) {
  const c = getClient(id);
  const g = c.goals[goalIndex];
  const r = goalResult(c, g);
  return `
    <div class="breadcrumb"><a onclick="navigate('ana-panel')">Ana panel</a> <span>›</span> <a onclick="navigate('musteri/${id}')">${c.name}</a></div>
    <p class="page-title">Elle geçersiz kıl — ${g.name}</p>
    <div class="panel">
      <p class="note-box">Sistemin hesapladığı sınıf: <strong style="color:var(--text-primary)">Sınıf ${r.finalBandi}</strong> (%${r.alloc.hisse} hisse). Bu, otomatik bir sinyal değil — gerekçe zorunludur ve denetim izinde saklanır.</p>

      <label class="form-label">Yeni risk sınıfı</label>
      <select class="form-input" id="ov-bandi">
        ${[1,2,3,4,5].map(n => `<option value="${n}" ${n===r.finalBandi?'selected':''}>Sınıf ${n}</option>`).join('')}
      </select>

      <label class="form-label" style="margin-top:14px;">Gerekçe (zorunlu)</label>
      <textarea class="form-input" id="ov-reason" rows="3" placeholder="Ör. Müşteri mevcut portföyünde uzun süredir daha yüksek hisse ağırlığı taşıyor, revealed preference esas alındı."></textarea>

      <p id="ov-error" class="form-error" style="display:none;">Gerekçe alanı boş bırakılamaz.</p>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="submitOverride('${id}', ${goalIndex})">Geçersiz kılmayı uygula</button>
        ${g.override ? `<button class="btn" onclick="removeOverride('${id}', ${goalIndex})">Geçersiz kılmayı kaldır</button>` : ''}
        <button class="btn" onclick="navigate('musteri/${id}')">Vazgeç</button>
      </div>
    </div>
  `;
}

function viewHaneler() {
  return `
    <p class="page-title">Haneler</p>
    <p class="page-sub">${HOUSEHOLDS.length} hane</p>
    <div class="row-list">
      ${HOUSEHOLDS.map(h => {
        const hb = haneFinalBandi(h);
        return `
        <div class="row-item" style="border-left-color:${hb === null ? 'var(--border)' : riskColor(hb).bar};" onclick="navigate('hane/${h.id}')">
          <div>
            <p class="row-name">${h.name}</p>
            <p class="row-meta">${h.memberIds.map(id => getClient(id).name).join(' · ')}</p>
          </div>
          ${hb === null ? `<span class="badge badge-neutral">Hane sınıfı —</span>` : riskBadge(hb, 'hane')}
        </div>`;
      }).join('')}
    </div>
  `;
}

function viewHaneDetay(hid) {
  const h = getHousehold(hid);
  const hb = haneFinalBandi(h);
  return `
    <div class="breadcrumb"><a onclick="navigate('haneler')">Haneler</a> <span>›</span> <span>${h.name}</span></div>
    <p class="page-title">${h.name}</p>
    <p class="page-sub">Hane sınıfı = min(üyelerin risk bandı) — sadece ortak hedeflerde geçerli</p>

    <p class="section-label">Üyeler</p>
    <div class="row-list">
      ${h.memberIds.map(id => {
        const m = getClient(id);
        const rb = personalRiskBandi(m);
        return `
        <div class="row-item" style="border-left-color:${rb === null ? 'var(--border)' : riskColor(rb).bar};" onclick="navigate('musteri/${id}')">
          <div class="row-left"><div class="avatar">${m.initials}</div><p class="row-name">${m.name}</p></div>
          ${rb === null ? `<span class="badge badge-neutral">Sınıf —</span>` : riskBadge(rb)}
        </div>`;
      }).join('')}
    </div>

    <p class="section-label">Ortak hedefler</p>
    <div class="row-list">
      ${h.sharedGoals.map(g => {
        const r = haneGoalResult(h, g);
        return `
        <div class="detail-row" style="border-left-color:${riskColor(r.finalBandi).bar};">
          <div>
            <p class="detail-row-title">${g.name}</p>
            <p class="detail-row-sub">${g.isAcil ? 'Sürekli tampon' : 'Vade ' + g.vadeLabel} · sınıf ${r.finalBandi}</p>
          </div>
          <span class="detail-row-value">%${r.alloc.hisse} hisse</span>
        </div>`;
      }).join('')}
    </div>
    <p class="note-box">Hane sınıfı ${hb}, üyelerin en muhafazakâr olanına yaslanıyor — bireysel hedeflerinde her üye kendi risk bandını kullanmaya devam ediyor.</p>
  `;
}

function reportContentHTML(client, typeKey) {
  if (typeKey === 'baslangic') {
    const rb = personalRiskBandi(client);
    return `
      <h3 class="report-h">Başlangıç yatırım önerisi — ${client.name}</h3>
      <p class="note-box">Risk toleransı ${scoreOrDash(client.tolerans)}, kapasite ${scoreOrDash(client.kapasite)}, davranışsal ${scoreOrDash(client.davranissal)} — sonuç risk bandı <strong style="color:var(--text-primary)">${rb === null ? '—' : rb}</strong>.</p>
      ${client.goals.map(g => {
        const r = goalResult(client, g);
        if (r.finalBandi === null) return '';
        return `<h4 class="report-h4">${g.name} — sınıf ${r.finalBandi}</h4>${allocTableHTML(r.alloc)}`;
      }).join('')}
    `;
  }
  if (typeKey === 'denetim') {
    const rb = personalRiskBandi(client);
    return `
      <h3 class="report-h">Denetim izi raporu — ${client.name}</h3>
      <table class="data-table">
        <tr><th>Girdi</th><th style="text-align:right">Değer</th></tr>
        <tr><td>Tolerans</td><td class="num">${scoreOrDash(client.tolerans)}</td></tr>
        <tr><td>Kapasite</td><td class="num">${scoreOrDash(client.kapasite)}</td></tr>
        <tr><td>Davranışsal</td><td class="num">${scoreOrDash(client.davranissal)}</td></tr>
        <tr><td>Kural 1 sonrası risk bandı</td><td class="num">${rb === null ? '—' : rb}</td></tr>
      </table>
      ${client.goals.map(g => {
        const r = goalResult(client, g);
        if (r.finalBandi === null) return '';
        return `<p class="note-box"><strong style="color:var(--text-primary)">${g.name}:</strong> Kural 2 sonrası sınıf ${r.finalBandi}${r.overridden ? ' (elle geçersiz kılındı: "' + escapeHtml(g.override.reason) + '")' : ''}, %${r.alloc.hisse} hisse.</p>`;
      }).join('')}
    `;
  }
  if (typeKey === 'ceyreklik') {
    const changes = ceyreklikDegisenler(client);
    const rb = personalRiskBandi(client);
    return `
      <h3 class="report-h">Çeyreklik durum raporu — ${client.name}</h3>
      ${changes.length ? `
        <p class="section-label">Bu çeyrekte değişenler</p>
        ${changes.map(c => `<p class="note-box">• ${c}</p>`).join('')}
      ` : `<p class="note-box">Bu çeyrekte kayıtlı bir değişiklik yok — önceki dönemle aynı durumda.</p>`}
      <p class="section-label" style="margin-top:14px;">Sabit kalanlar</p>
      <p class="note-box">Risk bandı: Sınıf ${rb === null ? '—' : rb}. Hedef sayısı: ${client.goals.length}.</p>
    `;
  }
  return `<h3 class="report-h">${REPORT_TYPES.find(r => r.key === typeKey).title} — ${client.name}</h3><p class="note-box">Bu rapor türü için içerik önizlemesi henüz eklenmedi.</p>`;
}

function viewRaporMusteriSec(typeKey) {
  const rt = REPORT_TYPES.find(r => r.key === typeKey);
  return `
    <div class="breadcrumb"><a onclick="navigate('raporlar')">Raporlar</a> <span>›</span> <span>${rt.title}</span></div>
    <p class="page-title">${rt.title}</p>
    <p class="page-sub">Rapor oluşturmak için müşteri seç</p>
    <div class="row-list">
      ${CLIENTS.map(c => `
        <div class="row-item" onclick="generateReport('${c.id}', '${typeKey}')">
          <div class="row-left"><div class="avatar">${c.initials}</div><p class="row-name">${c.name}</p></div>
          <span class="badge badge-neutral">Seç</span>
        </div>
      `).join('')}
    </div>
  `;
}

function viewRaporGenel(typeKey) {
  const DRIFT_THRESHOLD = 5;
  const relevantGoal = c => c.goals.find(x => !x.isAcil) || c.goals[0];
  const sapanlar = CLIENTS.filter(c => {
    if (!c.mevcutPortfoy || !c.goals.length) return false;
    const g = relevantGoal(c);
    const r = goalResult(c, g);
    if (r.finalBandi === null) return false;
    return Math.abs(c.mevcutPortfoy.hisse - r.alloc.hisse) > DRIFT_THRESHOLD;
  });
  return `
    <div class="breadcrumb"><a onclick="navigate('raporlar')">Raporlar</a> <span>›</span> <span>Portföy sapma raporu</span></div>
    <div class="panel">
      <h3 class="report-h">Portföy sapma raporu — tüm müşteriler</h3>
      <p class="note-box">±${DRIFT_THRESHOLD} puanlık eşiği aşan ${sapanlar.length} hesap bulundu (mevcut portföyü kayıtlı ${CLIENTS.filter(c => c.mevcutPortfoy).length} hesap tarandı, acil durum fonu hariç asıl hedefle karşılaştırıldı).</p>
      ${sapanlar.length ? sapanlar.map(c => {
        const g = relevantGoal(c);
        const r = goalResult(c, g);
        const fark = round1(c.mevcutPortfoy.hisse - r.alloc.hisse);
        return `
        <div class="detail-row" style="border-left-color:${fark > 0 ? 'var(--coral-bright)' : 'var(--teal)'};">
          <div>
            <p class="detail-row-title">${c.name}</p>
            <p class="detail-row-sub">${g.name} hedefi %${r.alloc.hisse} hisse → Mevcut %${c.mevcutPortfoy.hisse} hisse</p>
          </div>
          <span class="detail-row-value" style="color:${fark > 0 ? 'var(--danger)' : 'var(--teal)'};">${fark > 0 ? '+' : ''}${fark} puan</span>
        </div>`;
      }).join('') : `<p class="note-box">Şu anda eşiği aşan hesap yok.</p>`}
      <div class="btn-row" style="margin-top:14px;"><button class="btn" onclick="navigate('raporlar')">Rapor listesine dön</button></div>
    </div>
  `;
}

function viewRaporGoruntule(clientId, typeKey) {
  const c = getClient(clientId);
  return `
    <div class="breadcrumb"><a onclick="navigate('raporlar')">Raporlar</a> <span>›</span> <span>${c.name}</span></div>
    <div class="panel">
      ${reportContentHTML(c, typeKey)}
      <div class="btn-row" style="margin-top:10px;">
        <button class="btn" onclick="navigate('raporlar')">Rapor listesine dön</button>
      </div>
    </div>
  `;
}

function viewPortfoy() {
  return `
    <p class="page-title">Model portföyler</p>
    <p class="page-sub">Vadeye göre üç model</p>
    <div class="legend-row">${legendHTML()}</div>
    ${MODEL_PORTFOLIOS.map(m => `
      <div class="model-card">
        <div class="model-header">
          <p class="model-name">${m.name}</p>
          <span class="model-count">${m.count.toLocaleString('tr-TR')} hesap</span>
        </div>
        ${stackedBarHTML(m)}
        ${m.drift > 0
          ? `<span class="drift-link" onclick="navigate('musteriler')">${m.drift} hesap bandın dışında, incele</span>`
          : `<span class="badge badge-success" style="padding:0; background:none;">Sapma yok</span>`}
      </div>
    `).join('')}
  `;
}

function viewRaporlar() {
  return `
    <p class="page-title">Rapor oluştur</p>
    <p class="page-sub">Rapor merkezi</p>
    <div class="card-grid">
      ${REPORT_TYPES.map(r => `
        <div class="report-card">
          <p class="report-card-title">${r.title}</p>
          <p class="report-card-desc">${r.desc}</p>
          ${r.scope === 'genel'
            ? `<button class="btn" onclick="generateGenelRapor('${r.key}')">Raporu oluştur</button>`
            : `<button class="btn" onclick="navigate('rapor-sec/${r.key}')">Müşteri seç</button>`}
        </div>
      `).join('')}
    </div>
    <p class="section-label">Son oluşturulanlar</p>
    <div class="row-list">
      ${RECENT_REPORTS.map(r => `
        <div class="row-item" onclick="navigate('${r.client ? 'rapor/' + r.client + '/' + r.typeKey : 'rapor-genel/' + r.typeKey}')">
          <div>
            <p class="row-name">${r.clientName} · ${r.type}</p>
            <p class="row-meta">${r.when}</p>
          </div>
          <span class="badge badge-success">Hazır</span>
        </div>
      `).join('')}
    </div>
  `;
}

/* ===================== Aksiyonlar ===================== */

function navigate(route) { window.location.hash = '#/' + route; }

function approveDavranissal(id) {
  const c = getClient(id);
  c.davranissal = c.pending.newScore;
  c.pending = null;
  navigate('musteri/' + id);
}

function rejectDavranissal(id) {
  const c = getClient(id);
  c.pending = null;
  navigate('musteri/' + id);
}

function approveKatkiArtirimi(id, goalIndex) {
  const c = getClient(id);
  const g = c.goals[goalIndex];
  const r = goalResult(c, g);
  const k = katkiYeterlilik(g.hedefTutar, g.mevcutKatki, g.vadeYears, r.alloc.hisse);
  g.mevcutKatki = k.gerekenAylik;
  c.pending = null;
  navigate('musteri/' + id);
}

function rejectKatkiArtirimi(id) {
  const c = getClient(id);
  c.pending = null;
  navigate('musteri/' + id);
}

function approvePortfoySapma(id) {
  const c = getClient(id);
  const g = c.goals[0];
  const r = goalResult(c, g);
  c.mevcutPortfoy = Object.assign({}, r.alloc);
  c.pending = null;
  navigate('musteri/' + id);
}

function acceptPortfoySapma(id) {
  const c = getClient(id);
  c.pending = null;
  navigate('musteri/' + id);
}

function confirmYillikGozdenGecirme(id) {
  const c = getClient(id);
  c.pending = null;
  c.lastReview = 'Bugün';
  navigate('musteri/' + id);
}

function generateReport(clientId, typeKey) {
  const c = getClient(clientId);
  const rt = REPORT_TYPES.find(r => r.key === typeKey);
  RECENT_REPORTS.unshift({ client: clientId, clientName: c.name, type: rt.title, typeKey, when: 'Az önce' });
  navigate('rapor/' + clientId + '/' + typeKey);
}

function generateGenelRapor(typeKey) {
  const rt = REPORT_TYPES.find(r => r.key === typeKey);
  RECENT_REPORTS.unshift({ client: null, clientName: 'Tüm müşteriler', type: rt.title, typeKey, when: 'Az önce' });
  navigate('rapor-genel/' + typeKey);
}

function submitAnket(id) {
  const answers = {};
  let missing = false;
  GL_QUESTIONS.forEach(q => {
    const el = document.querySelector(`input[name="q${q.id}"]:checked`);
    if (!el) missing = true; else answers[q.id] = parseInt(el.value, 10);
  });
  if (missing) {
    document.getElementById('gl-error').style.display = 'block';
    return;
  }
  const total = Object.values(answers).reduce((s, v) => s + v, 0);
  const band = glBandFromScore(total);
  const c = getClient(id);
  c.tolerans = band;
  if (c.kapasite === null) c.kapasite = band;
  if (c.davranissal === null) c.davranissal = band;
  if (c.pending && (c.pending.type === 'yeni_musteri' || c.pending.type === 'yillik_gozden_gecirme')) {
    c.pending = null;
    c.lastReview = 'Bugün';
  }
  navigate('musteri/' + id);
}

function submitYeniMusteri() {
  const name = document.getElementById('nm-name').value.trim();
  if (!name) { document.getElementById('nm-error').style.display = 'block'; return; }
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toLocaleUpperCase('tr-TR')).join('');
  const id = 'yeni-' + (NEXT_CLIENT_SEQ++) + '-' + name.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9şçğüöı]/g, '');
  CLIENTS.push({
    id, name, initials, tolerans: null, kapasite: null, davranissal: null, lastReview: '—',
    pending: { type: 'yeni_musteri', label: 'Anket tamamlanmadı' }, goals: []
  });
  navigate('musteri/' + id);
}

function submitYeniHedef(id) {
  const name = document.getElementById('nh-name').value.trim();
  const type = document.querySelector('input[name="nh-type"]:checked').value;
  const vadeStr = document.getElementById('nh-vade').value;
  if (!name || (type === 'normal' && !vadeStr)) {
    document.getElementById('nh-error').style.display = 'block';
    return;
  }
  const c = getClient(id);
  if (type === 'acil') {
    c.goals.push({ name, isAcil: true, vadeLabel: 'Sürekli (tampon)' });
  } else {
    const years = parseFloat(vadeStr);
    c.goals.push({ name, vadeYears: years, vadeLabel: years + ' yıl' });
  }
  navigate('musteri/' + id);
}

function submitOverride(id, goalIndex) {
  const reason = document.getElementById('ov-reason').value.trim();
  if (!reason) { document.getElementById('ov-error').style.display = 'block'; return; }
  const bandi = parseInt(document.getElementById('ov-bandi').value, 10);
  const c = getClient(id);
  c.goals[goalIndex].override = { finalBandi: bandi, reason, date: '31 Ağustos 2026', by: 'Bora K.' };
  navigate('musteri/' + id);
}

function removeOverride(id, goalIndex) {
  const c = getClient(id);
  delete c.goals[goalIndex].override;
  navigate('musteri/' + id);
}

function onSearchInput(value) {
  navigate('musteriler?q=' + encodeURIComponent(value));
}

function toggleMobileNav() {
  document.querySelector('.sidebar').classList.toggle('open');
}

/* ===================== Router ===================== */

function render() {
  const hash = window.location.hash.replace('#/', '') || 'ana-panel';
  const [pathPart, queryPart] = hash.split('?');
  const parts = pathPart.split('/');
  const root = parts[0];
  const content = document.getElementById('content');
  document.querySelector('.sidebar').classList.remove('open');

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === root);
  });

  if (root === 'musteri' && parts[1] && parts[2] === 'sapma') {
    content.innerHTML = viewSapmaInceleme(parts[1]);
  } else if (root === 'musteri' && parts[1] && parts[2] === 'getiri') {
    content.innerHTML = viewYetersizGetiri(parts[1]);
  } else if (root === 'musteri' && parts[1] && parts[2] === 'sapma-portfoy') {
    content.innerHTML = viewPortfoySapma(parts[1]);
  } else if (root === 'musteri' && parts[1] && parts[2] === 'yillik') {
    content.innerHTML = viewYillikGozdenGecirme(parts[1]);
  } else if (root === 'musteri' && parts[1] && parts[2] === 'anket') {
    content.innerHTML = viewAnket(parts[1]);
  } else if (root === 'musteri' && parts[1] && parts[2] === 'yeni-hedef') {
    content.innerHTML = viewYeniHedef(parts[1]);
  } else if (root === 'musteri' && parts[1] && parts[2] === 'override' && parts[3] !== undefined) {
    content.innerHTML = viewOverride(parts[1], parseInt(parts[3], 10));
  } else if (root === 'musteri' && parts[1]) {
    content.innerHTML = viewMusteri360(parts[1]);
  } else if (root === 'yeni-musteri') {
    content.innerHTML = viewYeniMusteri();
  } else if (root === 'musteriler') {
    const q = queryPart ? decodeURIComponent(queryPart.replace('q=', '')) : '';
    content.innerHTML = viewMusteriler(q);
  } else if (root === 'onay-kuyrugu') {
    content.innerHTML = viewOnayKuyrugu();
  } else if (root === 'portfoy') {
    content.innerHTML = viewPortfoy();
  } else if (root === 'raporlar') {
    content.innerHTML = viewRaporlar();
  } else if (root === 'rapor-sec' && parts[1]) {
    content.innerHTML = viewRaporMusteriSec(parts[1]);
  } else if (root === 'rapor-genel' && parts[1]) {
    content.innerHTML = viewRaporGenel(parts[1]);
  } else if (root === 'rapor' && parts[1] && parts[2]) {
    content.innerHTML = viewRaporGoruntule(parts[1], parts[2]);
  } else if (root === 'haneler') {
    content.innerHTML = viewHaneler();
  } else if (root === 'hane' && parts[1]) {
    content.innerHTML = viewHaneDetay(parts[1]);
  } else {
    content.innerHTML = viewAnaPanel();
  }

  if (root === 'musteriler') {
    const inp = document.querySelector('.search-input');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }

  const approvalCountEl = document.getElementById('approval-count');
  if (approvalCountEl) {
    approvalCountEl.textContent = CLIENTS.filter(c => c.pending && AMBER_TYPES.includes(c.pending.type)).length;
  }
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.route));
});
const hamburgerBtn = document.getElementById('hamburger');
if (hamburgerBtn) hamburgerBtn.addEventListener('click', toggleMobileNav);

window.addEventListener('hashchange', render);
render();
