document.addEventListener("DOMContentLoaded", () => {
    caricaStatoLocale();
    renderAll();
});

// Passaggio tra le schede TAB
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('d-none'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.remove('d-none');
    event.target.classList.add('active');

    renderAll();
}

function salvaStatoLocale() {
    localStorage.setItem('potesplit_state', JSON.stringify(state));
}

function caricaStatoLocale() {
    const saved = localStorage.getItem('potesplit_state');
    if (saved) {
        try { state = JSON.parse(saved); } catch(e){}
    }
}

function renderAll() {
    renderPartecipanti();
    renderFormSpesaGenerica();
    renderFormCena();
    renderDettaglioSpese();
    renderRiepilogoGlobal();
}

// -------------------------------------------------------------
// 1. PARTECIPANTI
// -------------------------------------------------------------
function aggiungiPartecipante() {
    const input = document.getElementById('nuovoNome');
    const nome = input.value.trim();
    if (!nome) return;
    
    if (state.partecipanti.map(p => p.toLowerCase()).includes(nome.toLowerCase())) {
        alert("Questo partecipante è già presente!");
        return;
    }

    state.partecipanti.push(nome);
    input.value = '';
    salvaStatoLocale();
    renderAll();
}

function rimuoviPartecipante(nome) {
    if (confirm(`Rimuovere ${nome}?`)) {
        state.partecipanti = state.partecipanti.filter(p => p !== nome);
        salvaStatoLocale();
        renderAll();
    }
}

function renderPartecipanti() {
    const lista = document.getElementById('listaPartecipanti');
    lista.innerHTML = '';
    state.partecipanti.forEach(p => {
        lista.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                ${p}
                <button class="btn btn-sm btn-outline-danger" onclick="rimuoviPartecipante('${p}')">Elimina</button>
            </li>
        `;
    });
}

// -------------------------------------------------------------
// 2. AGGIUNGI SPESA (Ex Spese non eque + eque unificate)
// -------------------------------------------------------------
function renderFormSpesaGenerica() {
    const chkPart = document.getElementById('chkPartecipantiSpesa');
    const chkPag = document.getElementById('chkPagatoriSpesa');
    
    chkPart.innerHTML = '';
    chkPag.innerHTML = '';

    state.partecipanti.forEach((p, idx) => {
        // Partecipanti alla spesa (Tutti spuntati di default)
        chkPart.innerHTML += `
            <div class="form-check form-check-inline">
                <input class="form-check-input chk-part-spesa" type="checkbox" id="part_spesa_${idx}" value="${p}" checked onchange="updateSpesaGenericaInputs()">
                <label class="form-check-label" for="part_spesa_${idx}">${p}</label>
            </div>
        `;

        // Chi ha anticipato i soldi (Tutti spuntati di default)
        chkPag.innerHTML += `
            <div class="form-check form-check-inline">
                <input class="form-check-input chk-pag-spesa" type="checkbox" id="pag_spesa_${idx}" value="${p}" checked onchange="updateSpesaGenericaInputs()">
                <label class="form-check-label" for="pag_spesa_${idx}">${p}</label>
            </div>
        `;
    });

    updateSpesaGenericaInputs();
}

function toggleMetodoDivisione() {
    updateSpesaGenericaInputs();
}

function updateSpesaGenericaInputs() {
    const isCustom = document.getElementById('divCustom').checked;
    const sezCustom = document.getElementById('sezioneQuoteCustom');
    const containerQuote = document.getElementById('inputQuoteSpesa');
    const containerPagatori = document.getElementById('inputPagatoriSpesa');

    if (isCustom) {
        sezCustom.classList.remove('d-none');
    } else {
        sezCustom.classList.add('d-none');
    }

    // Aggiorna campi quote custom solo per i partecipanti selezionati
    containerQuote.innerHTML = '';
    document.querySelectorAll('.chk-part-spesa:checked').forEach(chk => {
        const p = chk.value;
        containerQuote.innerHTML += `
            <div class="row align-items-center mb-2">
                <div class="col-4"><label>${p}:</label></div>
                <div class="col-8">
                    <input type="number" step="0.01" class="form-control input-quota-custom" data-nome="${p}" placeholder="Quanto ha speso €">
                </div>
            </div>
        `;
    });

    // Aggiorna campi anticipo pagatori solo per i pagatori selezionati
    containerPagatori.innerHTML = '';
    document.querySelectorAll('.chk-pag-spesa:checked').forEach(chk => {
        const p = chk.value;
        containerPagatori.innerHTML += `
            <div class="row align-items-center mb-2">
                <div class="col-4"><label>${p} ha anticipato:</label></div>
                <div class="col-8">
                    <input type="number" step="0.01" class="form-control input-pagato-spesa" data-nome="${p}" placeholder="Importo €">
                </div>
            </div>
        `;
    });
}

function salvaSpesaGenerica() {
    const titolo = document.getElementById('titoloSpesa').value.trim();
    if (!titolo) return alert("Inserisci il Titolo spesa!");

    if (titoloGiaEsistente(titolo)) {
        return alert("Errore: Esiste già una spesa o cena con questo nome!");
    }

    const partecipantiValidi = Array.from(document.querySelectorAll('.chk-part-spesa:checked')).map(c => c.value);
    if (partecipantiValidi.length === 0) return alert("Seleziona almeno un partecipante alla spesa!");

    const isCustom = document.getElementById('divCustom').checked;
    let quoteCustom = {};

    if (isCustom) {
        document.querySelectorAll('.input-quota-custom').forEach(input => {
            quoteCustom[input.dataset.nome] = Number(input.value) || 0;
        });
    }

    let pagatori = {};
    document.querySelectorAll('.input-pagato-spesa').forEach(input => {
        pagatori[input.dataset.nome] = Number(input.value) || 0;
    });

    const nuovaSpesa = {
        id: generateId(),
        tipo: 'spesa',
        titolo: titolo,
        metodoDivisione: isCustom ? 'custom' : 'equa',
        partecipantiCoinvolti: partecipantiValidi,
        quoteCustom: quoteCustom,
        pagatori: pagatori
    };

    state.spese.push(nuovaSpesa);
    salvaStatoLocale();
    document.getElementById('titoloSpesa').value = '';
    renderAll();
    alert("Spesa salvata con successo!");
}

// -------------------------------------------------------------
// 3. CENE
// -------------------------------------------------------------
function renderFormCena() {
    const containerPart = document.getElementById('formCenaPartecipanti');
    const chkPag = document.getElementById('chkPagatoriCena');

    containerPart.innerHTML = '';
    chkPag.innerHTML = '';

    state.partecipanti.forEach((p, idx) => {
        // Consumi Cena per Partecipante
        containerPart.innerHTML += `
            <div class="border p-2 mb-2 rounded bg-white">
                <h6>${p}</h6>
                <div class="row g-2">
                    <div class="col-3"><input type="number" step="0.01" class="form-control form-control-sm cena-bevande" data-nome="${p}" placeholder="Bevande €"></div>
                    <div class="col-3"><input type="number" step="0.01" class="form-control form-control-sm cena-cibo" data-nome="${p}" placeholder="Cibo €"></div>
                    <div class="col-3"><input type="number" step="0.01" class="form-control form-control-sm cena-dolci" data-nome="${p}" placeholder="Dolci €"></div>
                    <div class="col-3"><input type="number" step="0.01" class="form-control form-control-sm cena-amari" data-nome="${p}" placeholder="Amari €"></div>
                </div>
            </div>
        `;

        // Pagatori Cena
        chkPag.innerHTML += `
            <div class="form-check form-check-inline">
                <input class="form-check-input chk-pag-cena" type="checkbox" id="pag_cena_${idx}" value="${p}" checked onchange="updateCenaPagatoriInputs()">
                <label class="form-check-label" for="pag_cena_${idx}">${p}</label>
            </div>
        `;
    });

    updateCenaPagatoriInputs();
}

function updateCenaPagatoriInputs() {
    const containerPagatori = document.getElementById('inputPagatoriCena');
    containerPagatori.innerHTML = '';
    document.querySelectorAll('.chk-pag-cena:checked').forEach(chk => {
        const p = chk.value;
        containerPagatori.innerHTML += `
            <div class="row align-items-center mb-2">
                <div class="col-4"><label>${p} ha pagato:</label></div>
                <div class="col-8">
                    <input type="number" step="0.01" class="form-control input-pagato-cena" data-nome="${p}" placeholder="Importo €">
                </div>
            </div>
        `;
    });
}

function salvaCena() {
    const titolo = document.getElementById('titoloCena').value.trim();
    if (!titolo) return alert("Inserisci il Titolo spesa!");

    if (titoloGiaEsistente(titolo)) {
        return alert("Errore: Esiste già una spesa o cena con questo nome!");
    }

    let dettagliCena = {};
    state.partecipanti.forEach(p => {
        const bev = Number(document.querySelector(`.cena-bevande[data-nome="${p}"]`)?.value) || 0;
        const cib = Number(document.querySelector(`.cena-cibo[data-nome="${p}"]`)?.value) || 0;
        const dol = Number(document.querySelector(`.cena-dolci[data-nome="${p}"]`)?.value) || 0;
        const ama = Number(document.querySelector(`.cena-amari[data-nome="${p}"]`)?.value) || 0;

        dettagliCena[p] = { bevande: bev, cibo: cib, dolci: dol, amari: ama };
    });

    const sconti = {
        bevande: Number(document.getElementById('scontoBevande').value) || 0,
        cibo: Number(document.getElementById('scontoCibo').value) || 0,
        dolci: Number(document.getElementById('scontoDolci').value) || 0,
        amari: Number(document.getElementById('scontoAmari').value) || 0
    };

    let pagatori = {};
    document.querySelectorAll('.input-pagato-cena').forEach(input => {
        pagatori[input.dataset.nome] = Number(input.value) || 0;
    });

    const nuovaCena = {
        id: generateId(),
        tipo: 'cena',
        titolo: titolo,
        partecipantiCoinvolti: [...state.partecipanti],
        dettagliCena: dettagliCena,
        sconti: sconti,
        pagatori: pagatori
    };

    state.spese.push(nuovaCena);
    salvaStatoLocale();
    document.getElementById('titoloCena').value = '';
    renderAll();
    alert("Cena salvata con successo!");
}

// -------------------------------------------------------------
// 4. SPESE IN DETTAGLIO
// -------------------------------------------------------------
function renderDettaglioSpese() {
    const container = document.getElementById('contenitoreDettaglioSpese');
    container.innerHTML = '';

    if (state.spese.length === 0) {
        container.innerHTML = '<div class="alert alert-info">Nessuna spesa inserita.</div>';
        return;
    }

    state.spese.forEach(spesa => {
        const { dettagliPersona, noteSolata } = calcolaDettaglioSpesa(spesa);

        // Calcolo Saldi Singoli per Rimborsi Interni Spesa
        let saldiInterni = {};
        let totPag = 0, totSpes = 0, totSol = 0, totContr = 0, totCent = 0, totSal = 0;

        Object.keys(dettagliPersona).forEach(p => {
            const d = dettagliPersona[p];
            if (d.involto) {
                saldiInterni[p] = d.saldo;
                totPag += d.haPagato;
                totSpes += d.haSpeso;
                totSol += d.solata;
                totContr += d.controsolata;
                totCent += d.centesiminiVal;
                totSal += d.saldo;
            }
        });

        const rimborsiInterni = calcolaRimborsiOptimizzati(saldiInterni);

        let htmlRows = '';
        state.partecipanti.forEach(p => {
            const d = dettagliPersona[p];
            if (d && d.involto) {
                htmlRows += `
                    <tr>
                        <td><strong>${p}</strong></td>
                        <td>€${d.haPagato.toFixed(2)}</td>
                        <td>€${d.haSpeso.toFixed(2)}</td>
                        <td>€${d.solata.toFixed(2)}</td>
                        <td>€${d.controsolata.toFixed(2)}</td>
                        <td>${d.centesiminiStr || '-'}</td>
                        <td class="${d.saldo >= 0 ? 'text-success' : 'text-danger'} font-weight-bold">€${d.saldo.toFixed(2)}</td>
                    </tr>
                `;
            }
        });

        let rimborsiHtml = '';
        if (rimborsiInterni.length > 0) {
            rimborsiHtml = '<ul class="list-group list-group-flush border-top mt-2">';
            rimborsiInterni.forEach(r => {
                rimborsiHtml += `<li class="list-group-item bg-light text-dark">👉 <strong>${r.da}</strong> deve dare <strong>€${r.importo.toFixed(2)}</strong> a <strong>${r.a}</strong></li>`;
            });
            rimborsiHtml += '</ul>';
        } else {
            rimborsiHtml = '<p class="text-muted p-2">Nessun rimborso interno necessario.</p>';
        }

        let noteHtml = '';
        if (noteSolata.length > 0) {
            noteHtml = `<div class="alert alert-warning mt-2 mb-0"><strong>Attenzione Solate/Controsolate:</strong><br>${noteSolata.join('<br>')}</div>`;
        }

        container.innerHTML += `
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                    <h5 class="m-0">${spesa.titolo} <span class="badge bg-light text-dark">${spesa.tipo.toUpperCase()}</span></h5>
                    <button class="btn btn-sm btn-danger" onclick="eliminaSpesa('${spesa.id}')">Elimina</button>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-bordered text-center align-middle">
                            <thead class="table-secondary">
                                <tr>
                                    <th>Partecipante</th>
                                    <th>Ha Pagato</th>
                                    <th>Ha Speso</th>
                                    <th>Solata</th>
                                    <th>Controsolata</th>
                                    <th>Centesimini</th>
                                    <th>Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${htmlRows}
                            </tbody>
                            <tfoot class="fw-bold table-light">
                                <tr>
                                    <td>TOTALI</td>
                                    <td>€${totPag.toFixed(2)}</td>
                                    <td>€${totSpes.toFixed(2)}</td>
                                    <td>€${totSol.toFixed(2)}</td>
                                    <td>€${totContr.toFixed(2)}</td>
                                    <td>€${totCent.toFixed(2)}</td>
                                    <td>€${totSal.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    ${noteHtml}
                    <div class="mt-3">
                        <h6>Rimborsi Consigliati per questa Spesa:</h6>
                        ${rimborsiHtml}
                    </div>
                </div>
            </div>
        `;
    });
}

function eliminaSpesa(id) {
    if (confirm("Sei sicuro di voler eliminare questa spesa?")) {
        state.spese = state.spese.filter(s => s.id !== id);
        salvaStatoLocale();
        renderAll();
    }
}

// -------------------------------------------------------------
// 5. SALDI E RIMBORSI GLOBALI
// -------------------------------------------------------------
function renderRiepilogoGlobal() {
    // Registro Spese
    const bodyReg = document.getElementById('bodyRegistroSpese');
    bodyReg.innerHTML = '';
    
    state.spese.forEach(s => {
        const tot = Object.values(s.pagatori || {}).reduce((a, b) => a + Number(b), 0);
        bodyReg.innerHTML += `
            <tr>
                <td><span class="badge ${s.tipo === 'cena' ? 'bg-info' : 'bg-secondary'}">${s.tipo}</span></td>
                <td><strong>${s.titolo}</strong></td>
                <td>€${tot.toFixed(2)}</td>
                <td><button class="btn btn-sm btn-outline-danger" onclick="eliminaSpesa('${s.id}')">Elimina</button></td>
            </tr>
        `;
    });

    // Saldi Finali Complessivi
    const { saldiDettagliati, rimborsiGlobali } = calcolaSaldiGlobali();
    const bodySaldi = document.getElementById('bodySaldiFinali');
    bodySaldi.innerHTML = '';

    state.partecipanti.forEach(p => {
        const d = saldiDettagliati[p];
        const centStr = d.centesimini.length > 0 ? d.centesimini.join('') : '-';
        bodySaldi.innerHTML += `
            <tr>
                <td><strong>${p}</strong></td>
                <td>€${d.pagato.toFixed(2)}</td>
                <td>€${d.speso.toFixed(2)}</td>
                <td><code>${centStr}</code></td>
                <td class="${d.saldo >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}">€${d.saldo.toFixed(2)}</td>
            </tr>
        `;
    });

    // Rimborsi Globali
    const containerRimb = document.getElementById('listaRimborsiGlobali');
    containerRimb.innerHTML = '';

    if (rimborsiGlobali.length === 0) {
        containerRimb.innerHTML = '<div class="list-group-item text-center text-muted">Tutti i conti sono in pareggio!</div>';
    } else {
        rimborsiGlobali.forEach(r => {
            containerRimb.innerHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div><strong>${r.da}</strong> deve pagare a <strong>${r.a}</strong></div>
                    <span class="badge bg-success fs-6">€${r.importo.toFixed(2)}</span>
                </div>
            `;
        });
    }
}

function resetTotale() {
    if (confirm("Attenzione: questo cancellerà TUTTI i partecipanti e le spese salvate. Continuare?")) {
        state = { partecipanti: [], spese: [] };
        salvaStatoLocale();
        renderAll();
    }
}
