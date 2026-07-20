// ============================================================
// app.js — caricamento dati, rendering tabelle, form di gestione
// ============================================================

let STATE = { persone: [], spese: [], rimborsi: [], cene: [], config: {} };

const euro = v => (Math.round(v * 100) / 100).toFixed(2) + " €";
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
function safeScrollIntoView(elx) {
  try { if (elx && typeof elx.scrollIntoView === "function") elx.scrollIntoView({ behavior: "smooth", block: "center" }); }
  catch (e) { /* non bloccante: se il browser non supporta lo scroll animato, si ignora */ }
}

// ---------- CARICAMENTO DATI (lettura statica, nessun bisogno di token) ----------
async function loadAllData() {
  const bust = "?t=" + Date.now();
  const [persone, spese, rimborsi, cene, config] = await Promise.all([
    fetch("data/persone.json" + bust).then(r => r.json()),
    fetch("data/spese.json" + bust).then(r => r.json()),
    fetch("data/rimborsi.json" + bust).then(r => r.json()),
    fetch("data/cene.json" + bust).then(r => r.json()),
    fetch("data/config.json" + bust).then(r => r.json())
  ]);
  STATE = { persone, spese, rimborsi, cene, config };
}

function ricalcola() {
  STATE.stato = calcolaStatoGlobale(STATE.persone, STATE.spese, STATE.rimborsi, STATE.cene);
}

// ---------- RENDER: SEZIONE PRINCIPALE ----------
function renderRegistroSpese() {
  const tbody = document.querySelector("#tbl-registro tbody");
  tbody.innerHTML = "";
  // Usa l'elenco calcolato (STATE.stato.spese), che include anche le voci [NE] generate
  // automaticamente da ogni cena — non il solo STATE.spese "grezzo" da spese.json.
  const tutte = STATE.stato.spese;
  const ordinate = [...tutte].sort((a, b) => {
    const an = a.nome.toLowerCase(), bn = b.nome.toLowerCase();
    if (an === bn) return a.descrizione.toLowerCase().localeCompare(b.descrizione.toLowerCase());
    return an.localeCompare(bn);
  });
  ordinate.forEach((s, i) => {
    const part = (s.partecipanti && s.partecipanti.length) ? [...s.partecipanti].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).join(", ") : "Tutti";
    const tr = el("tr", null, `<td>${i + 1}</td><td>${s.nome}</td><td>${s.descrizione}</td><td class="num">${euro(s.importo)}</td><td>${part}</td>`);
    tbody.appendChild(tr);
  });
}

function renderRimborsiEffettuati() {
  const tbody = document.querySelector("#tbl-rimborsi tbody");
  tbody.innerHTML = "";
  if (STATE.rimborsi.length === 0) {
    tbody.appendChild(el("tr", null, `<td colspan="4"><em>Nessun rimborso ancora effettuato.</em></td>`));
    return;
  }
  STATE.rimborsi.forEach((r, i) => {
    tbody.appendChild(el("tr", null, `<td>${i + 1}</td><td>${r.da}</td><td>${r.a}</td><td class="num">${euro(r.importo)}</td>`));
  });
}

function renderTotaliPersona() {
  const tbody = document.querySelector("#tbl-totali tbody");
  tbody.innerHTML = "";
  const { nomi, totaliPersona, spesaEffettiva, rimborsatoDA, rimborsatoA, saldi } = STATE.stato;
  nomi.forEach((nome, i) => {
    const saldo = saldi[nome];
    const cls = saldo < -0.01 ? "row-red" : saldo > 0.01 ? "row-green" : "row-gray";
    const tr = el("tr", cls, `<td>${i + 1}</td><td>${nome}</td><td class="num">${euro(totaliPersona[nome])}</td>
      <td class="num">${euro(spesaEffettiva[nome])}</td><td class="num">${euro(rimborsatoDA[nome])}</td>
      <td class="num">${euro(rimborsatoA[nome])}</td><td class="num"><strong>${euro(saldo)}</strong></td>`);
    tbody.appendChild(tr);
  });
}

function renderTransazioni() {
  const tbody = document.querySelector("#tbl-transazioni tbody");
  tbody.innerHTML = "";
  const trans = STATE.stato.transazioni;
  if (trans.length === 0) {
    tbody.appendChild(el("tr", null, `<td colspan="4"><em>Nessuna transazione necessaria!</em></td>`));
    return;
  }
  let colorIndex = 0, ultimoDA = "";
  trans.forEach((t, i) => {
    if (t.da !== ultimoDA) { ultimoDA = t.da; colorIndex++; }
    const cls = colorIndex % 2 === 0 ? "row-stripe" : "";
    tbody.appendChild(el("tr", cls, `<td>${i + 1}.</td><td>${t.da}</td><td>${t.a}</td><td class="num">${euro(t.importo)}</td>`));
  });
}

function renderTitolo() {
  const t = STATE.config.titolo;
  if (!t) return;
  document.title = t;
  const h1 = document.querySelector("#page-title");
  if (h1) h1.textContent = t;
}

function renderHomeLink() {
  const btn = document.querySelector("#btn-home-link");
  if (!btn) return;
  if (CONFIG.homeUrl && CONFIG.homeUrl !== "URL-HOME-POTESPLIT") {
    btn.href = CONFIG.homeUrl;
  } else {
    btn.style.display = "none"; // non configurato: nascondi invece di puntare a un link rotto
  }
}

function renderCredenziali() {
  const box = document.querySelector("#credenziali-list");
  box.innerHTML = "";
  const elenco = STATE.config.credenziali || [];
  if (elenco.length === 0) {
    box.innerHTML = `<li><em>Nessuna credenziale di rimborso inserita.</em></li>`;
    return;
  }
  elenco.forEach(c => {
    let dettaglio;
    if (c.tipo === "iban") {
      dettaglio = `IBAN: <strong>${c.iban}</strong> — Intestatario: <strong>${c.intestatario}</strong>`;
    } else {
      dettaglio = `Link PayPal: <a href="${c.paypal}" target="_blank" rel="noopener">${c.paypal}</a>`;
    }
    box.appendChild(el("li", null, `<strong>${c.nome}</strong> — ${dettaglio}`));
  });
}

// ---------- RENDER: CENE ----------
function fmtVal(v, cat, sconti) {
  if (!v) return "";
  const s = applicaSconto(v, cat, sconti);
  if ((sconti[cat] || 0) > 0) {
    return `<span class="disc">${s.toFixed(2)}</span> <span class="orig">(${v.toFixed(2)})</span>`;
  }
  return s.toFixed(2);
}
function fmtCellCondivisa(vInd, vCond, cat, sconti) {
  const ind = vInd > 0 ? fmtVal(vInd, cat, sconti) : "";
  const cond = vCond > 0 ? fmtVal(vCond, cat, sconti) : "";
  if (ind && cond) return ind + " + " + cond;
  return ind || cond || "";
}

function renderCategoriaTabella(container, cena, categorie, header) {
  header = header || CAT_LABELS;
  const { quoteColonna } = calcolaQuoteComplete(cena);
  let html = `<div class="table-wrap"><table class="cena-table"><thead><tr><th>Persona</th>${categorie.map(c => `<th>${header[c] || c}</th>`).join("")}<th>Parziale</th></tr></thead><tbody>`;
  const totCol = {}, totColOrig = {};
  categorie.forEach(c => { totCol[c] = 0; totColOrig[c] = 0; });
  let totRiga = 0, totRigaOrig = 0;

  cena.persone.forEach(p => {
    const qc = quoteColonna[p.nome] || {};
    let rigaTot = 0, rigaTotOrig = 0;
    const celle = categorie.map(cat => {
      const vInd = p[cat] || 0, vCond = qc[cat] || 0;
      const sInd = applicaSconto(vInd, cat, cena.sconti), sCond = applicaSconto(vCond, cat, cena.sconti);
      rigaTot += sInd + sCond; rigaTotOrig += vInd + vCond;
      totCol[cat] += sInd + sCond; totColOrig[cat] += vInd + vCond;
      return `<td>${fmtCellCondivisa(vInd, vCond, cat, cena.sconti)}</td>`;
    });
    totRiga += rigaTot; totRigaOrig += rigaTotOrig;
    const hasSc = Math.abs(rigaTot - rigaTotOrig) > 0.001;
    const totStr = hasSc ? `<span class="disc">${rigaTot.toFixed(2)}</span> <span class="orig">(${rigaTotOrig.toFixed(2)})</span>` : rigaTot.toFixed(2);
    html += `<tr><td>${p.nome}</td>${celle.join("")}<td class="tot-cell">${totStr}</td></tr>`;
  });

  const cellsTot = categorie.map(cat => {
    if (totColOrig[cat] === 0) return `<td class="tot-cell"></td>`;
    const hasSc = Math.abs(totCol[cat] - totColOrig[cat]) > 0.001;
    return hasSc
      ? `<td class="tot-cell"><span class="disc">${totCol[cat].toFixed(2)}</span> <span class="orig">(${totColOrig[cat].toFixed(2)})</span></td>`
      : `<td class="tot-cell">${totCol[cat].toFixed(2)}</td>`;
  });
  const hasScTot = Math.abs(totRiga - totRigaOrig) > 0.001;
  const totFinale = hasScTot
    ? `<span class="disc">${totRiga.toFixed(2)}</span> <span class="orig">(${totRigaOrig.toFixed(2)})</span>`
    : totRiga.toFixed(2);
  html += `<tr class="tot-row"><td><strong>Totale</strong></td>${cellsTot.join("")}<td class="tot-cell"><strong>${totFinale}</strong></td></tr>`;
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function renderCondivise(container, cena) {
  const separate = (cena.speseCondivise || []).filter(s => !s.colonna);
  if (separate.length === 0) { container.innerHTML = "<p><em>Nessuna spesa condivisa separata.</em></p>"; return; }
  const { quoteSeparate } = calcolaQuoteCondivise(cena.persone, cena.speseCondivise, cena.sconti);
  let html = `<div class="table-wrap"><table class="cena-table"><thead><tr><th>Persona</th>${separate.map(s => `<th>${s.descrizione}</th>`).join("")}</tr></thead><tbody>`;
  cena.persone.forEach(p => {
    const qs = quoteSeparate[p.nome] || {};
    const cells = separate.map(s => `<td>${qs[s.descrizione] !== undefined ? qs[s.descrizione].toFixed(2) : ""}</td>`);
    html += `<tr><td>${p.nome}</td>${cells.join("")}</tr>`;
  });
  html += "</tbody></table></div>";
  container.innerHTML = html;
}

function renderTotaliECena(container, cena) {
  const d = calcolaDettaglioCena(cena);
  let html = `<div class="table-wrap"><table class="cena-table"><thead><tr><th>Persona</th><th>Dovuto</th><th>Pagato</th><th>Saldo pasto</th></tr></thead><tbody>`;
  d.righe.forEach(r => {
    const cls = r.saldo > 0.01 ? "row-green" : r.saldo < -0.01 ? "row-red" : "";
    html += `<tr class="${cls}"><td>${r.nome}</td><td class="num">${euro(r.dovuto)}</td><td class="num">${euro(r.pagato)}</td><td class="num">${euro(r.saldo)}</td></tr>`;
  });
  if (d.hasSconti) {
    html += `<tr class="tot-row"><td><strong>TOTALE (senza sconti)</strong></td><td class="num">${euro(d.totgenSenzaSconti)}</td><td class="num">${euro(d.totpagato)}</td><td class="num">${euro(d.totgenSenzaSconti - d.totpagato)}</td></tr>`;
    html += `<tr class="tot-row"><td><strong>TOTALE (con sconti)</strong></td><td class="num">${euro(d.totgen)}</td><td class="num">${euro(d.totpagato)}</td><td class="num">${euro(d.totpagato - d.totgen)}</td></tr>`;
  } else {
    html += `<tr class="tot-row"><td><strong>TOTALE GENERALE</strong></td><td class="num">${euro(d.totgen)}</td><td class="num">${euro(d.totpagato)}</td><td class="num">${euro(d.totpagato - d.totgen)}</td></tr>`;
  }
  html += "</tbody></table></div>";

  html += `<h5>Transazioni per pareggiare i conti di questa cena</h5>`;
  if (d.transazioniCena.length === 0) {
    html += "<p><em>Nessun rimborso necessario</em></p>";
  } else {
    html += `<div class="table-wrap"><table class="cena-table"><thead><tr><th>Da</th><th>A</th><th>Importo</th></tr></thead><tbody>`;
    d.transazioniCena.forEach(t => html += `<tr><td>${t.da}</td><td>${t.a}</td><td class="num">${euro(t.importo)}</td></tr>`);
    html += "</tbody></table></div>";
  }
  container.innerHTML = html;
}

function renderCene() {
  const container = document.querySelector("#cene-container");
  container.innerHTML = "";
  STATE.cene.forEach((cena, idx) => {
    const hasSconti = Object.values(cena.sconti).some(v => v > 0);
    const wrap = el("details", "cena-block");
    wrap.innerHTML = `<summary>${cena.titolo}</summary>
      <div class="cena-body">
        ${hasSconti ? `<p class="sconti-info"><strong>Sconti applicati:</strong> ${Object.entries(cena.sconti).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}%`).join(", ")}</p>` : `<p class="sconti-info"><em>Nessuno sconto applicato</em></p>`}
        <h5>Cibo</h5><div class="tbl-cibo"></div>
        <h5>Bevande</h5><div class="tbl-bevande"></div>
        <h5>Altro</h5><div class="tbl-altro"></div>
        <h5>Spese condivise</h5><div class="tbl-condivise"></div>
        <h5>Totali per persona</h5><div class="tbl-totali-cena"></div>
      </div>`;
    container.appendChild(wrap);
    renderCategoriaTabella(wrap.querySelector(".tbl-cibo"), cena, CAT_CIBO);
    renderCategoriaTabella(wrap.querySelector(".tbl-bevande"), cena, CAT_BEVANDE);
    renderCategoriaTabella(wrap.querySelector(".tbl-altro"), cena, CAT_ALTRO);
    renderCondivise(wrap.querySelector(".tbl-condivise"), cena);
    renderTotaliECena(wrap.querySelector(".tbl-totali-cena"), cena);
  });
}

// ---------- RENDER TUTTO ----------
function renderAll() {
  ricalcola();
  renderTitolo();
  renderRegistroSpese();
  renderRimborsiEffettuati();
  renderTotaliPersona();
  renderTransazioni();
  renderCredenziali();
  renderCene();
  populateFormSelects();
  refreshCenaPersoneCheckboxes();
  renderListaPersone();
  renderListaSpese();
  renderListaRimborsi();
  renderListaCene();
  renderListaCredenziali();
}

// ============================================================
// GESTIONE (form -> GitHub API)
// ============================================================

function populateFormSelects() {
  const persone = [...STATE.persone].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const selects = document.querySelectorAll("select.persona-select");
  selects.forEach(sel => {
    const current = sel.value;
    sel.innerHTML = persone.map(p => `<option value="${p}">${p}</option>`).join("");
    if (current) sel.value = current;
  });
  const checkboxContainers = document.querySelectorAll(".persona-checkboxes");
  checkboxContainers.forEach(box => {
    const checked = new Set(getCheckedValues(box)); // preserva selezioni già fatte
    box.innerHTML = persone.map(p =>
      `<label class="chk"><input type="checkbox" value="${p}" ${checked.has(p) ? "checked" : ""}> ${p}</label>`).join("");
  });
}

function showToast(msg, isError) {
  let box = document.querySelector("#toast-box");
  if (!box) {
    box = el("div", "toast-box");
    box.id = "toast-box";
    document.body.appendChild(box);
  }
  const toast = el("div", "toast " + (isError ? "toast-error" : "toast-ok"), msg);
  box.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, isError ? 6000 : 3500);
}

function setStatus(elId, msg, isError) {
  const box = document.querySelector(elId);
  box.textContent = msg;
  box.className = "status " + (isError ? "status-error" : "status-ok");
  showToast(msg, isError);
}

function getCheckedValues(container) {
  return Array.from(container.querySelectorAll("input[type=checkbox]:checked")).map(i => i.value);
}

// ---------- STATO DI MODIFICA (edit in corso) ----------
let editingSpesaIndex = null;
let editingRimborsoIndex = null;
let editingCenaIndex = null;
let editingCredenzialeIndex = null;

// ---------- ELENCHI MODIFICABILI ----------
function contaUtilizziPersona(nome) {
  let n = 0;
  STATE.spese.forEach(s => {
    if (s.nome === nome) n++;
    if (s.partecipanti && s.partecipanti.includes(nome)) n++;
  });
  STATE.rimborsi.forEach(r => { if (r.da === nome || r.a === nome) n++; });
  STATE.cene.forEach(c => {
    if (c.persone.some(p => p.nome === nome)) n++;
    (c.speseCondivise || []).forEach(s => { if (s.partecipanti && s.partecipanti.includes(nome)) n++; });
  });
  return n;
}

function renderListaPersone() {
  const box = document.querySelector("#lista-persone");
  box.innerHTML = "";
  if (STATE.persone.length === 0) { box.innerHTML = `<div class="empty-note">Nessuna persona inserita.</div>`; return; }
  [...STATE.persone].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).forEach(nome => {
    const row = el("div", "list-row");
    row.innerHTML = `
      <div class="rename-box">
        <input type="text" class="rename-input" value="${nome.replace(/"/g, "&quot;")}">
      </div>
      <div class="list-actions">
        <button class="btn-icon edit" type="button">Rinomina</button>
        <button class="btn-icon delete" type="button">Elimina</button>
      </div>`;
    const input = row.querySelector(".rename-input");
    row.querySelector(".edit").addEventListener("click", async () => {
      const nuovo = input.value.trim();
      if (!nuovo || nuovo === nome) return;
      if (STATE.persone.includes(nuovo)) { alert("Esiste già una persona con questo nome."); return; }
      if (!confirm(`Rinominare "${nome}" in "${nuovo}"? Verranno aggiornati anche i riferimenti in spese, rimborsi e cene.`)) return;
      await rinominaPersona(nome, nuovo);
    });
    row.querySelector(".delete").addEventListener("click", async () => {
      const usi = contaUtilizziPersona(nome);
      const msg = usi > 0
        ? `"${nome}" compare ${usi} volte tra spese/rimborsi/cene. Se la elimini, quei riferimenti resteranno con il vecchio nome e non verranno più conteggiati nei totali. Vuoi procedere comunque?`
        : `Eliminare "${nome}"?`;
      if (!confirm(msg)) return;
      try {
        const nuovoElenco = STATE.persone.filter(p => p !== nome);
        await GH.writeJSON("data/persone.json", nuovoElenco, `Rimuove persona: ${nome}`);
        await loadAllData(); renderAll();
      } catch (err) { alert(err.message); }
    });
    box.appendChild(row);
  });
}

async function rinominaPersona(vecchio, nuovo) {
  try {
    const nuovePersone = STATE.persone.map(p => p === vecchio ? nuovo : p);
    const nuoveSpese = STATE.spese.map(s => ({
      ...s,
      nome: s.nome === vecchio ? nuovo : s.nome,
      partecipanti: (s.partecipanti || []).map(p => p === vecchio ? nuovo : p)
    }));
    const nuoviRimborsi = STATE.rimborsi.map(r => ({
      ...r,
      da: r.da === vecchio ? nuovo : r.da,
      a: r.a === vecchio ? nuovo : r.a
    }));
    const nuoveCene = STATE.cene.map(c => ({
      ...c,
      persone: c.persone.map(p => p.nome === vecchio ? { ...p, nome: nuovo } : p),
      speseCondivise: (c.speseCondivise || []).map(s => ({
        ...s,
        partecipanti: (s.partecipanti || []).map(p => p === vecchio ? nuovo : p)
      }))
    }));

    await GH.writeJSON("data/persone.json", nuovePersone, `Rinomina persona: ${vecchio} -> ${nuovo}`);
    await GH.writeJSON("data/spese.json", nuoveSpese, `Aggiorna riferimenti a ${vecchio} in spese`);
    await GH.writeJSON("data/rimborsi.json", nuoviRimborsi, `Aggiorna riferimenti a ${vecchio} in rimborsi`);
    await GH.writeJSON("data/cene.json", nuoveCene, `Aggiorna riferimenti a ${vecchio} in cene`);
    await loadAllData(); renderAll();
  } catch (err) { alert(err.message); }
}

function renderListaSpese() {
  const box = document.querySelector("#lista-spese");
  box.innerHTML = "";
  if (STATE.spese.length === 0) { box.innerHTML = `<div class="empty-note">Nessuna spesa inserita.</div>`; return; }
  STATE.spese.forEach((s, i) => {
    const part = (s.partecipanti && s.partecipanti.length) ? s.partecipanti.join(", ") : "Tutti";
    const row = el("div", "list-row" + (editingSpesaIndex === i ? " editing" : ""));
    row.innerHTML = `
      <div class="list-main">${s.nome} — ${s.descrizione} <strong>${euro(s.importo)}</strong><br><span class="list-sub">Partecipanti: ${part}</span></div>
      <div class="list-actions">
        <button class="btn-icon edit" type="button">Modifica</button>
        <button class="btn-icon delete" type="button">Elimina</button>
      </div>`;
    row.querySelector(".edit").addEventListener("click", () => modificaSpesa(i));
    row.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm(`Eliminare la spesa "${s.descrizione}" (${euro(s.importo)})?`)) return;
      try {
        const nuovoElenco = STATE.spese.filter((_, idx) => idx !== i);
        await GH.writeJSON("data/spese.json", nuovoElenco, `Rimuove spesa: ${s.descrizione}`);
        await loadAllData(); renderAll();
      } catch (err) { alert(err.message); }
    });
    box.appendChild(row);
  });
}

function modificaSpesa(i) {
  const s = STATE.spese[i];
  editingSpesaIndex = i;
  document.querySelector("#f-spesa-chi").value = s.nome;
  document.querySelector("#f-spesa-desc").value = s.descrizione;
  document.querySelector("#f-spesa-importo").value = s.importo;
  const box = document.querySelector("#f-spesa-partecipanti");
  Array.from(box.querySelectorAll("input[type=checkbox]")).forEach(cb => {
    cb.checked = (s.partecipanti || []).includes(cb.value);
  });
  document.querySelector("#btn-spesa-submit").textContent = "Salva modifiche";
  document.querySelector("#btn-spesa-annulla").style.display = "inline-block";
  safeScrollIntoView(document.querySelector("#f-spesa-form"));
  renderListaSpese();
}

function annullaModificaSpesa() {
  editingSpesaIndex = null;
  document.querySelector("#f-spesa-form").reset();
  document.querySelector("#btn-spesa-submit").textContent = "Aggiungi spesa";
  document.querySelector("#btn-spesa-annulla").style.display = "none";
  renderListaSpese();
}

function renderListaRimborsi() {
  const box = document.querySelector("#lista-rimborsi");
  box.innerHTML = "";
  if (STATE.rimborsi.length === 0) { box.innerHTML = `<div class="empty-note">Nessun rimborso inserito.</div>`; return; }
  STATE.rimborsi.forEach((r, i) => {
    const row = el("div", "list-row" + (editingRimborsoIndex === i ? " editing" : ""));
    row.innerHTML = `
      <div class="list-main">${r.da} → ${r.a}: <strong>${euro(r.importo)}</strong></div>
      <div class="list-actions">
        <button class="btn-icon edit" type="button">Modifica</button>
        <button class="btn-icon delete" type="button">Elimina</button>
      </div>`;
    row.querySelector(".edit").addEventListener("click", () => modificaRimborso(i));
    row.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm(`Eliminare il rimborso ${r.da} → ${r.a} (${euro(r.importo)})?`)) return;
      try {
        const nuovoElenco = STATE.rimborsi.filter((_, idx) => idx !== i);
        await GH.writeJSON("data/rimborsi.json", nuovoElenco, `Rimuove rimborso: ${r.da} -> ${r.a}`);
        await loadAllData(); renderAll();
      } catch (err) { alert(err.message); }
    });
    box.appendChild(row);
  });
}

function modificaRimborso(i) {
  const r = STATE.rimborsi[i];
  editingRimborsoIndex = i;
  document.querySelector("#f-rimb-da").value = r.da;
  document.querySelector("#f-rimb-a").value = r.a;
  document.querySelector("#f-rimb-importo").value = r.importo;
  document.querySelector("#btn-rimborso-submit").textContent = "Salva modifiche";
  document.querySelector("#btn-rimborso-annulla").style.display = "inline-block";
  safeScrollIntoView(document.querySelector("#f-rimborso-form"));
  renderListaRimborsi();
}

function annullaModificaRimborso() {
  editingRimborsoIndex = null;
  document.querySelector("#f-rimborso-form").reset();
  document.querySelector("#btn-rimborso-submit").textContent = "Aggiungi rimborso";
  document.querySelector("#btn-rimborso-annulla").style.display = "none";
  renderListaRimborsi();
}

function renderListaCene() {
  const box = document.querySelector("#lista-cene");
  box.innerHTML = "";
  if (STATE.cene.length === 0) { box.innerHTML = `<div class="empty-note">Nessuna cena inserita.</div>`; return; }
  STATE.cene.forEach((c, i) => {
    const row = el("div", "list-row" + (editingCenaIndex === i ? " editing" : ""));
    row.innerHTML = `
      <div class="list-main">${c.titolo} <span class="list-sub">(${c.persone.length} persone)</span></div>
      <div class="list-actions">
        <button class="btn-icon edit" type="button">Modifica</button>
        <button class="btn-icon delete" type="button">Elimina</button>
      </div>`;
    row.querySelector(".edit").addEventListener("click", () => modificaCena(i));
    row.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm(`Eliminare la cena "${c.titolo}"? Verranno rimosse anche le relative voci [NE] dal registro spese generale.`)) return;
      try {
        const nuovoElenco = STATE.cene.filter((_, idx) => idx !== i);
        await GH.writeJSON("data/cene.json", nuovoElenco, `Rimuove cena: ${c.titolo}`);
        await loadAllData(); renderAll();
      } catch (err) { alert(err.message); }
    });
    box.appendChild(row);
  });
}

function modificaCena(i) {
  const c = STATE.cene[i];
  editingCenaIndex = i;
  document.querySelector("#f-cena-titolo").value = c.titolo;

  cenaPersoneDati = {};
  c.persone.forEach(p => {
    const dati = {};
    CAT_INPUT.forEach(cat => dati[cat] = p[cat] || 0);
    dati.pagato = p.pagato || 0;
    cenaPersoneDati[p.nome] = dati;
  });
  setCenaPersoneSelezionate(c.persone.map(p => p.nome));
  const dettagli = document.querySelector("#cena-persone-details");
  if (dettagli) dettagli.classList.remove("collapsed");

  CAT_INPUT.forEach(cat => {
    const inp = document.querySelector(`#f-sconto-${cat}`);
    if (inp) inp.value = (c.sconti && c.sconti[cat]) || 0;
  });

  document.querySelector("#cena-spese-rows").innerHTML = "";
  cenaSpeseRows = [];
  (c.speseCondivise || []).forEach(s => addCenaSpesaRow(s));

  document.querySelector("#btn-cena-submit").textContent = "Salva modifiche";
  document.querySelector("#btn-cena-annulla").style.display = "inline-block";
  safeScrollIntoView(document.querySelector("#f-cena-form"));
  renderListaCene();
}

function annullaModificaCena() {
  editingCenaIndex = null;
  document.querySelector("#f-cena-form").reset();
  cenaPersoneDati = {};
  document.querySelectorAll("#cena-persone-checkboxes input[type=checkbox]").forEach(cb => cb.checked = true);
  renderCenaPersoneRows();
  const dettagli = document.querySelector("#cena-persone-details");
  if (dettagli) dettagli.classList.add("collapsed");
  document.querySelector("#cena-spese-rows").innerHTML = "";
  cenaSpeseRows = [];
  document.querySelector("#btn-cena-submit").textContent = "Salva cena";
  document.querySelector("#btn-cena-annulla").style.display = "none";
  renderListaCene();
}

// --- Aggiungi persona/e ---
function buildPersonaNomiInputs(n) {
  const box = document.querySelector("#f-persona-nomi-container");
  const existing = Array.from(box.querySelectorAll("input.f-persona-nome-input")).map(i => i.value);
  box.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "f-persona-nome-input";
    inp.placeholder = "Es. Mario Rossi";
    inp.required = true;
    if (existing[i]) inp.value = existing[i];
    box.appendChild(inp);
  }
}

async function submitPersona(e) {
  e.preventDefault();
  const nomi = Array.from(document.querySelectorAll("#f-persona-nomi-container .f-persona-nome-input"))
    .map(i => i.value.trim())
    .filter(v => v);
  if (nomi.length === 0) { setStatus("#status-persona", "Inserisci almeno un nome.", true); return; }

  const setNomiLower = new Set(nomi.map(n => n.toLowerCase()));
  if (setNomiLower.size !== nomi.length) { setStatus("#status-persona", "Hai inserito lo stesso nome più di una volta.", true); return; }

  const giaEsistenti = nomi.filter(n => STATE.persone.includes(n));
  if (giaEsistenti.length > 0) { setStatus("#status-persona", `Esistono già: ${giaEsistenti.join(", ")}.`, true); return; }

  try {
    const nuovoElenco = [...STATE.persone, ...nomi];
    const msg = nomi.length > 1 ? `Aggiunge ${nomi.length} persone: ${nomi.join(", ")}` : `Aggiunge persona: ${nomi[0]}`;
    await GH.writeJSON("data/persone.json", nuovoElenco, msg);
    setStatus("#status-persona", (nomi.length > 1 ? "Persone aggiunte!" : "Persona aggiunta!") + " Ricarico i dati…", false);
    document.querySelector("#f-persona-quante").value = "1";
    buildPersonaNomiInputs(1);
    await loadAllData(); renderAll();
  } catch (err) { setStatus("#status-persona", err.message, true); }
}

// --- Aggiungi spesa ---
async function submitSpesa(e) {
  e.preventDefault();
  const nome = document.querySelector("#f-spesa-chi").value;
  const descrizione = document.querySelector("#f-spesa-desc").value.trim();
  const importo = parseFloat(document.querySelector("#f-spesa-importo").value);
  const partecipanti = getCheckedValues(document.querySelector("#f-spesa-partecipanti"));
  if (!nome || !descrizione || !importo) { setStatus("#status-spesa", "Compila tutti i campi.", true); return; }
  try {
    const nuova = { nome, descrizione, importo, partecipanti };
    let nuovoElenco;
    let msg;
    if (editingSpesaIndex !== null) {
      nuovoElenco = STATE.spese.map((s, i) => i === editingSpesaIndex ? nuova : s);
      msg = `Modifica spesa: ${descrizione}`;
    } else {
      nuovoElenco = [...STATE.spese, nuova];
      msg = `Aggiunge spesa: ${descrizione}`;
    }
    await GH.writeJSON("data/spese.json", nuovoElenco, msg);
    setStatus("#status-spesa", (editingSpesaIndex !== null ? "Spesa modificata!" : "Spesa aggiunta!") + " Ricarico i dati…", false);
    editingSpesaIndex = null;
    document.querySelector("#f-spesa-form").reset();
    document.querySelector("#btn-spesa-submit").textContent = "Aggiungi spesa";
    document.querySelector("#btn-spesa-annulla").style.display = "none";
    await loadAllData(); renderAll();
  } catch (err) { setStatus("#status-spesa", err.message, true); }
}

// --- Aggiungi rimborso ---
async function submitRimborso(e) {
  e.preventDefault();
  const da = document.querySelector("#f-rimb-da").value;
  const a = document.querySelector("#f-rimb-a").value;
  const importo = parseFloat(document.querySelector("#f-rimb-importo").value);
  if (!da || !a || !importo || da === a) { setStatus("#status-rimborso", "Controlla i campi (da / a devono essere diversi).", true); return; }
  try {
    const nuovo = { da, a, importo };
    let nuovoElenco;
    let msg;
    if (editingRimborsoIndex !== null) {
      nuovoElenco = STATE.rimborsi.map((r, i) => i === editingRimborsoIndex ? nuovo : r);
      msg = `Modifica rimborso: ${da} -> ${a}`;
    } else {
      nuovoElenco = [...STATE.rimborsi, nuovo];
      msg = `Aggiunge rimborso: ${da} -> ${a}`;
    }
    await GH.writeJSON("data/rimborsi.json", nuovoElenco, msg);
    setStatus("#status-rimborso", (editingRimborsoIndex !== null ? "Rimborso modificato!" : "Rimborso aggiunto!") + " Ricarico i dati…", false);
    editingRimborsoIndex = null;
    document.querySelector("#f-rimborso-form").reset();
    document.querySelector("#btn-rimborso-submit").textContent = "Aggiungi rimborso";
    document.querySelector("#btn-rimborso-annulla").style.display = "none";
    await loadAllData(); renderAll();
  } catch (err) { setStatus("#status-rimborso", err.message, true); }
}

// --- Aggiungi cena (form dinamico) ---
// Le persone della cena non si aggiungono più una per una: si spuntano dalla lista di
// tutte le persone esistenti (di default tutte spuntate). Le righe di inserimento delle
// spese individuali vengono generate/rimosse automaticamente in base a chi è spuntato,
// sempre in ordine alfabetico, e i valori già inseriti vengono preservati quando si
// spunta/rimuove una persona (finché non si ricarica la pagina o si annulla la modifica).
let cenaPersoneDati = {}; // nome -> {categoria: valore, pagato: valore}
let cenaCheckboxKnownNames = new Set(); // usato per capire quali persone sono "nuove" (mai viste) sulla checkbox-list

function catturaCenaPersoneDati() {
  document.querySelectorAll("#cena-persone-rows .cena-persona-row").forEach(row => {
    const nome = row.dataset.nome;
    if (!nome) return;
    const dati = {};
    CAT_INPUT.forEach(c => dati[c] = parseFloat(row.querySelector(`.cp-${c}`).value) || 0);
    dati.pagato = parseFloat(row.querySelector(".cp-pagato").value) || 0;
    cenaPersoneDati[nome] = dati;
  });
}

function buildCenaPersoneRow(nome, dati) {
  const box = document.querySelector("#cena-persone-rows");
  const row = el("div", "cena-persona-row");
  row.dataset.nome = nome;
  row.innerHTML = `
    <div class="cp-field cp-field-nome"><label>Persona</label><div style="padding:.45rem 0; font-weight:600;">${nome}</div></div>
    ${CAT_INPUT.map(c => `<div class="cp-field"><label>${CAT_LABELS[c]}</label><input type="number" step="0.01" class="cp-${c}" value="${(dati && dati[c]) || 0}"></div>`).join("")}
    <div class="cp-field"><label>Pagato</label><input type="number" step="0.01" class="cp-pagato" value="${(dati && dati.pagato) || 0}"></div>`;
  box.appendChild(row);
}

function renderCenaPersoneRows() {
  const box = document.querySelector("#cena-persone-rows");
  box.innerHTML = "";
  const checkboxBox = document.querySelector("#cena-persone-checkboxes");
  const checked = getCheckedValues(checkboxBox).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  checked.forEach(nome => buildCenaPersoneRow(nome, cenaPersoneDati[nome]));
}

function onCenaPersoneCheckboxChange() {
  catturaCenaPersoneDati();
  renderCenaPersoneRows();
  syncCsPartCheckboxes();
}

// Elenco (ordinato alfabeticamente) delle persone attualmente spuntate come partecipanti alla cena
function personePartecipantiCena() {
  const box = document.querySelector("#cena-persone-checkboxes");
  return box ? getCheckedValues(box).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())) : [];
}

// Sincronizza i checkbox "partecipanti" di ogni spesa condivisa già inserita con l'elenco
// attuale dei partecipanti alla cena: chi non partecipa più alla cena sparisce dalla lista,
// chi ci partecipa compare (mantenendo lo stato di spunta di chi era già presente).
function syncCsPartCheckboxes() {
  const partecipanti = personePartecipantiCena();
  document.querySelectorAll("#cena-spese-rows .cs-part").forEach(box => {
    const checked = new Set(getCheckedValues(box));
    box.innerHTML = partecipanti.map(p =>
      `<label class="chk"><input type="checkbox" value="${p}" ${checked.has(p) ? "checked" : ""}> ${p}</label>`).join("");
  });
}

// Ricostruisce la checkbox-list delle persone alla cena. Le persone già viste in
// precedenza mantengono lo stato di spunta attuale; le persone nuove (mai comparse
// prima nella lista, es. appena aggiunte altrove) vengono spuntate di default.
function refreshCenaPersoneCheckboxes() {
  const box = document.querySelector("#cena-persone-checkboxes");
  if (!box) return;
  catturaCenaPersoneDati();
  const attuali = new Set(getCheckedValues(box));
  const ordinati = [...STATE.persone].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  box.innerHTML = ordinati.map(p => {
    const spuntata = cenaCheckboxKnownNames.has(p) ? attuali.has(p) : true;
    return `<label class="chk"><input type="checkbox" value="${p}" ${spuntata ? "checked" : ""}> ${p}</label>`;
  }).join("");
  cenaCheckboxKnownNames = new Set(ordinati);
  box.querySelectorAll("input[type=checkbox]").forEach(cb => cb.addEventListener("change", onCenaPersoneCheckboxChange));
  renderCenaPersoneRows();
  syncCsPartCheckboxes();
}

// Imposta esplicitamente quali persone sono spuntate (usato in modifica di una cena esistente)
function setCenaPersoneSelezionate(nomi) {
  const box = document.querySelector("#cena-persone-checkboxes");
  const set = new Set(nomi);
  box.querySelectorAll("input[type=checkbox]").forEach(cb => { cb.checked = set.has(cb.value); });
  renderCenaPersoneRows();
  syncCsPartCheckboxes();
}

let cenaSpeseRows = [];
function addCenaSpesaRow(initial) {
  const idx = cenaSpeseRows.length;
  cenaSpeseRows.push(idx);
  const box = document.querySelector("#cena-spese-rows");
  const row = el("div", "cena-spesa-row");
  row.dataset.idx = idx;
  row.innerHTML = `
    <input type="text" placeholder="descrizione" class="cs-desc">
    <select class="cs-colonna">
      <option value="">(nessuna colonna / spesa separata)</option>
      ${CAT_INPUT.map(c => `<option value="${c}">${CAT_LABELS[c]}</option>`).join("")}
    </select>
    <select class="cs-tipo"><option value="divisa">divisa</option><option value="persona">a persona</option></select>
    <input type="number" step="0.01" placeholder="importo" class="cs-importo">
    <div class="cena-spesa-partecipanti cs-part"></div>
    <button type="button" class="btn-remove-row">✕</button>`;
  box.appendChild(row);
  syncCsPartCheckboxes();
  if (initial) {
    row.querySelector(".cs-desc").value = initial.descrizione || "";
    row.querySelector(".cs-colonna").value = initial.colonna || "";
    row.querySelector(".cs-tipo").value = initial.tipo || "divisa";
    row.querySelector(".cs-importo").value = initial.importo || 0;
    const part = new Set(initial.partecipanti || []);
    Array.from(row.querySelectorAll(".cs-part input[type=checkbox]")).forEach(cb => {
      cb.checked = part.has(cb.value);
    });
  }
  row.querySelector(".btn-remove-row").addEventListener("click", () => {
    row.remove();
    cenaSpeseRows = cenaSpeseRows.filter(i => i !== idx);
  });
}

async function submitCena(e) {
  e.preventDefault();
  const titolo = document.querySelector("#f-cena-titolo").value.trim();
  if (!titolo) { setStatus("#status-cena", "Inserisci un titolo.", true); return; }

  const sconti = {};
  CAT_INPUT.forEach(c => {
    const inp = document.querySelector(`#f-sconto-${c}`);
    sconti[c] = inp ? (parseFloat(inp.value) || 0) : 0;
  });

  const persone = Array.from(document.querySelectorAll("#cena-persone-rows .cena-persona-row")).map(row => {
    const p = { nome: row.dataset.nome };
    CAT_INPUT.forEach(c => p[c] = parseFloat(row.querySelector(`.cp-${c}`).value) || 0);
    p.pagato = parseFloat(row.querySelector(".cp-pagato").value) || 0;
    return p;
  });
  if (persone.length === 0) { setStatus("#status-cena", "Seleziona almeno una persona alla cena.", true); return; }

  const speseCondivise = Array.from(document.querySelectorAll("#cena-spese-rows .cena-spesa-row")).map(row => {
    const s = {
      descrizione: row.querySelector(".cs-desc").value.trim(),
      tipo: row.querySelector(".cs-tipo").value,
      importo: parseFloat(row.querySelector(".cs-importo").value) || 0,
      partecipanti: getCheckedValues(row.querySelector(".cs-part"))
    };
    const colonna = row.querySelector(".cs-colonna").value;
    if (colonna) s.colonna = colonna;
    return s;
  }).filter(s => s.descrizione);

  const nuovaCena = { titolo, sconti, persone, speseCondivise };
  try {
    let nuovoElenco;
    let msg;
    if (editingCenaIndex !== null) {
      nuovoElenco = STATE.cene.map((c, i) => i === editingCenaIndex ? nuovaCena : c);
      msg = `Modifica cena: ${titolo}`;
    } else {
      nuovoElenco = [...STATE.cene, nuovaCena];
      msg = `Aggiunge cena: ${titolo}`;
    }
    await GH.writeJSON("data/cene.json", nuovoElenco, msg);
    setStatus("#status-cena", (editingCenaIndex !== null ? "Cena modificata!" : "Cena aggiunta!") + " Ricarico i dati…", false);
    editingCenaIndex = null;
    document.querySelector("#f-cena-form").reset();
    cenaPersoneDati = {};
    document.querySelectorAll("#cena-persone-checkboxes input[type=checkbox]").forEach(cb => cb.checked = true);
    renderCenaPersoneRows();
    const dettagli = document.querySelector("#cena-persone-details");
    if (dettagli) dettagli.classList.add("collapsed");
    document.querySelector("#cena-spese-rows").innerHTML = "";
    cenaSpeseRows = [];
    document.querySelector("#btn-cena-submit").textContent = "Salva cena";
    document.querySelector("#btn-cena-annulla").style.display = "none";
    await loadAllData(); renderAll();
  } catch (err) { setStatus("#status-cena", err.message, true); }
}

function renderListaCredenziali() {
  const box = document.querySelector("#lista-credenziali");
  box.innerHTML = "";
  const elenco = STATE.config.credenziali || [];
  if (elenco.length === 0) { box.innerHTML = `<div class="empty-note">Nessuna credenziale inserita.</div>`; return; }
  elenco.forEach((c, i) => {
    const dettaglio = c.tipo === "iban"
      ? `IBAN: ${c.iban} — Intestatario: ${c.intestatario}`
      : `PayPal: ${c.paypal}`;
    const row = el("div", "list-row" + (editingCredenzialeIndex === i ? " editing" : ""));
    row.innerHTML = `
      <div class="list-main">${c.nome}<br><span class="list-sub">${dettaglio}</span></div>
      <div class="list-actions">
        <button class="btn-icon edit" type="button">Modifica</button>
        <button class="btn-icon delete" type="button">Elimina</button>
      </div>`;
    row.querySelector(".edit").addEventListener("click", () => modificaCredenziale(i));
    row.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm(`Eliminare le credenziali di "${c.nome}"?`)) return;
      try {
        const nuovoElenco = elenco.filter((_, idx) => idx !== i);
        await GH.writeJSON("data/config.json", { ...STATE.config, credenziali: nuovoElenco }, `Rimuove credenziali: ${c.nome}`);
        await loadAllData(); renderAll();
      } catch (err) { alert(err.message); }
    });
    box.appendChild(row);
  });
}

function aggiornaCampiCredenziale() {
  const tipo = document.querySelector("#f-cred-tipo").value;
  document.querySelector("#f-cred-campi-paypal").style.display = tipo === "paypal" ? "" : "none";
  document.querySelector("#f-cred-campi-iban").style.display = tipo === "iban" ? "" : "none";
}

function modificaCredenziale(i) {
  const c = (STATE.config.credenziali || [])[i];
  editingCredenzialeIndex = i;
  document.querySelector("#f-cred-persona").value = c.nome;
  document.querySelector("#f-cred-tipo").value = c.tipo;
  document.querySelector("#f-cred-paypal").value = c.paypal || "";
  document.querySelector("#f-cred-iban").value = c.iban || "";
  document.querySelector("#f-cred-intestatario").value = c.intestatario || "";
  aggiornaCampiCredenziale();
  document.querySelector("#btn-cred-submit").textContent = "Salva modifiche";
  document.querySelector("#btn-cred-annulla").style.display = "inline-block";
  safeScrollIntoView(document.querySelector("#f-credenziale-form"));
  renderListaCredenziali();
}

function annullaModificaCredenziale() {
  editingCredenzialeIndex = null;
  document.querySelector("#f-credenziale-form").reset();
  aggiornaCampiCredenziale();
  document.querySelector("#btn-cred-submit").textContent = "Salva credenziali";
  document.querySelector("#btn-cred-annulla").style.display = "none";
  renderListaCredenziali();
}

async function submitCredenziale(e) {
  e.preventDefault();
  const nome = document.querySelector("#f-cred-persona").value;
  const tipo = document.querySelector("#f-cred-tipo").value;
  if (!nome) { setStatus("#status-cred", "Seleziona una persona.", true); return; }

  const nuovaCredenziale = { nome, tipo };
  if (tipo === "paypal") {
    const paypal = document.querySelector("#f-cred-paypal").value.trim();
    if (!paypal) { setStatus("#status-cred", "Inserisci il link PayPal.", true); return; }
    nuovaCredenziale.paypal = paypal;
  } else {
    const iban = document.querySelector("#f-cred-iban").value.trim();
    const intestatario = document.querySelector("#f-cred-intestatario").value.trim();
    if (!iban || !intestatario) { setStatus("#status-cred", "Inserisci IBAN e intestatario.", true); return; }
    nuovaCredenziale.iban = iban;
    nuovaCredenziale.intestatario = intestatario;
  }

  const elenco = STATE.config.credenziali || [];
  let nuovoElenco;
  if (editingCredenzialeIndex !== null) {
    nuovoElenco = elenco.map((c, i) => i === editingCredenzialeIndex ? nuovaCredenziale : c);
  } else {
    // se la persona ha già una credenziale, la sostituisce invece di duplicarla
    const idxEsistente = elenco.findIndex(c => c.nome === nome);
    nuovoElenco = idxEsistente >= 0
      ? elenco.map((c, i) => i === idxEsistente ? nuovaCredenziale : c)
      : [...elenco, nuovaCredenziale];
  }

  try {
    await GH.writeJSON("data/config.json", { ...STATE.config, credenziali: nuovoElenco }, `Aggiorna credenziali: ${nome}`);
    setStatus("#status-cred", "Credenziali salvate! Ricarico i dati…", false);
    annullaModificaCredenziale();
    await loadAllData(); renderAll();
  } catch (err) { setStatus("#status-cred", err.message, true); }
}

function updateTokenStatus() {
  const box = document.querySelector("#status-token");
  if (GH.getToken()) {
    box.textContent = "✅ Token impostato e salvato in modo permanente su questo browser.";
    box.className = "status status-ok";
  } else {
    box.textContent = "Nessun token impostato: puoi solo visualizzare i dati, non modificarli.";
    box.className = "status status-error";
  }
}

function buildScontiGrid() {
  const box = document.querySelector("#sconti-grid-container");
  box.innerHTML = CAT_INPUT.map(c =>
    `<label>${CAT_LABELS[c]} <input type="number" id="f-sconto-${c}" value="0" style="width:60px"></label>`
  ).join("");
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", async () => {
  buildScontiGrid();
  buildPersonaNomiInputs(1);
  renderHomeLink();
  await loadAllData();
  renderAll();

  document.querySelector("#f-persona-quante").addEventListener("change", (e) => {
    buildPersonaNomiInputs(parseInt(e.target.value, 10) || 1);
  });
  document.querySelector("#f-persona-form").addEventListener("submit", submitPersona);
  document.querySelector("#f-spesa-form").addEventListener("submit", submitSpesa);
  document.querySelector("#f-rimborso-form").addEventListener("submit", submitRimborso);
  document.querySelector("#f-cena-form").addEventListener("submit", submitCena);
  document.querySelector("#f-credenziale-form").addEventListener("submit", submitCredenziale);
  document.querySelector("#f-cred-tipo").addEventListener("change", aggiornaCampiCredenziale);
  document.querySelector("#btn-cred-annulla").addEventListener("click", annullaModificaCredenziale);
  aggiornaCampiCredenziale();
  document.querySelector("#btn-add-cena-spesa").addEventListener("click", () => addCenaSpesaRow());
  document.querySelector("#btn-spesa-annulla").addEventListener("click", annullaModificaSpesa);
  document.querySelector("#btn-rimborso-annulla").addEventListener("click", annullaModificaRimborso);
  document.querySelector("#btn-cena-annulla").addEventListener("click", annullaModificaCena);
  document.querySelector("#cena-persone-details-toggle").addEventListener("click", () => {
    document.querySelector("#cena-persone-details").classList.toggle("collapsed");
  });

  const tokenInput = document.querySelector("#gh-token");
  tokenInput.value = GH.getToken();
  updateTokenStatus();
  const tokenBox = document.querySelector("#token-box");
  document.querySelector("#token-box-toggle").addEventListener("click", () => {
    tokenBox.classList.toggle("collapsed");
  });
  document.querySelector("#btn-toggle-token").addEventListener("click", () => {
    tokenInput.type = tokenInput.type === "password" ? "text" : "password";
  });
  document.querySelector("#btn-copy-token").addEventListener("click", async () => {
    if (!tokenInput.value) { showToast("Nessun token da copiare.", true); return; }
    try {
      await navigator.clipboard.writeText(tokenInput.value);
    } catch (e) {
      tokenInput.select();
      document.execCommand("copy");
    }
    showToast("Token copiato negli appunti.", false);
  });
  document.querySelector("#btn-save-token").addEventListener("click", () => {
    GH.setToken(tokenInput.value.trim());
    updateTokenStatus();
    showToast(GH.getToken() ? "Token salvato in modo permanente su questo browser." : "Token rimosso.", false);
  });
  document.querySelector("#btn-clear-token").addEventListener("click", () => {
    GH.setToken("");
    tokenInput.value = "";
    updateTokenStatus();
    showToast("Token rimosso.", false);
  });

  if (CONFIG.owner === "TUO-USERNAME-GITHUB" || CONFIG.repo === "TUO-REPO") {
    document.querySelector("#config-warning").style.display = "block";
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector("#" + btn.dataset.tab).classList.add("active");
    });
  });
});
