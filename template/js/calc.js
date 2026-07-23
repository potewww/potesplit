// Stato globale dell'applicazione
let state = {
    partecipanti: [], // Array di stringhe (nomi)
    spese: [] // Array di oggetti spesa/cena
};

// Genera un ID univoco
function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

// Verifica se un titolo esiste già tra spese o cene
function titoloGiaEsistente(titolo) {
    const tNorm = titolo.trim().toLowerCase();
    return state.spese.some(s => s.titolo.trim().toLowerCase() === tNorm);
}

// Calcola il dettaglio finanziario di una singola spesa/cena
function calcolaDettaglioSpesa(spesa) {
    let risultati = {};
    
    // Inizializza i dati solo per chi era presente/valido al momento della creazione
    const partecipantiValidi = spesa.partecipantiCoinvolti || state.partecipanti;

    state.partecipanti.forEach(p => {
        risultati[p] = {
            haPagato: 0,
            haSpeso: 0,
            solata: 0,
            controsolata: 0,
            centesiminiStr: "",
            centesiminiVal: 0,
            saldo: 0,
            involto: partecipantiValidi.includes(p)
        };
    });

    // 1. Calcolo di quanto ha pagato ciascuno
    if (spesa.pagatori) {
        Object.keys(spesa.pagatori).forEach(p => {
            if (risultati[p]) {
                risultati[p].haPagato = Number(spesa.pagatori[p]) || 0;
            }
        });
    }

    // 2. Calcolo di quanto ha speso ciascuno
    if (spesa.tipo === 'cena') {
        // Calcolo quote cena con sconti
        let totConsumi = 0;
        let consumiPerPersona = {};

        partecipantiValidi.forEach(p => {
            const c = spesa.dettagliCena[p] || { bevande: 0, cibo: 0, dolci: 0, amari: 0 };
            const totP = (Number(c.bevande)||0) + (Number(c.cibo)||0) + (Number(c.dolci)||0) + (Number(c.amari)||0);
            consumiPerPersona[p] = totP;
            totConsumi += totP;
        });

        const sconti = spesa.sconti || { bevande: 0, cibo: 0, dolci: 0, amari: 0 };
        const totSconti = (Number(sconti.bevande)||0) + (Number(sconti.cibo)||0) + (Number(sconti.dolci)||0) + (Number(sconti.amari)||0);
        const totaleEffettivo = Math.max(0, totConsumi - totSconti);

        partecipantiValidi.forEach(p => {
            if (totConsumi > 0) {
                const quotaProporzionale = (consumiPerPersona[p] / totConsumi) * totaleEffettivo;
                risultati[p].haSpeso = Math.round(quotaProporzionale * 100) / 100;
            } else {
                risultati[p].haSpeso = 0;
            }
        });

    } else {
        // Spesa Generica (Equa o Custom)
        if (spesa.metodoDivisione === 'custom') {
            partecipantiValidi.forEach(p => {
                risultati[p].haSpeso = Number(spesa.quoteCustom[p]) || 0;
            });
        } else {
            // Divisione Equa
            const numPart = partecipantiValidi.length;
            const totalePagato = Object.values(spesa.pagatori || {}).reduce((a, b) => a + Number(b), 0);
            if (numPart > 0) {
                const quotaBase = Math.floor((totalePagato / numPart) * 100) / 100;
                let restoCentesimi = Math.round((totalePagato - (quotaBase * numPart)) * 100);

                partecipantiValidi.forEach((p, idx) => {
                    let quota = quotaBase;
                    if (idx < restoCentesimi) {
                        quota = Math.round((quota + 0.01) * 100) / 100;
                        risultati[p].centesiminiVal += 0.01;
                        risultati[p].centesiminiStr = "+0.01";
                    }
                    risultati[p].haSpeso = quota;
                });
            }
        }
    }

    // 3. Calcolo Solata / Controsolata e Saldo
    let noteSolata = [];

    partecipantiValidi.forEach(p => {
        const d = risultati[p];
        d.saldo = Math.round((d.haPagato - d.haSpeso) * 100) / 100;

        // Gestione Solata / Controsolata per la specifica voce
        if (spesa.solate && spesa.solate[p]) {
            const s = spesa.solate[p];
            if (s > 0) {
                d.solata = s;
                noteSolata.push(`${p} ha subito una solata di +€${s.toFixed(2)} (quota teorica: €${(d.haSpeso - s).toFixed(2)})`);
            } else if (s < 0) {
                d.controsolata = Math.abs(s);
                noteSolata.push(`${p} ha avuto una controsolata di -€${Math.abs(s).toFixed(2)} (quota teorica: €${(d.haSpeso + Math.abs(s)).toFixed(2)})`);
            }
        }
    });

    return { dettagliPersona: risultati, noteSolata: noteSolata };
}

// Algoritmo di calcolo dei rimborsi ottimizzati
function calcolaRimborsiOptimizzati(saldiMap) {
    let debitori = [];
    let creditori = [];

    Object.keys(saldiMap).forEach(p => {
        const val = Math.round(saldiMap[p] * 100) / 100;
        if (val < -0.001) {
            debitori.push({ nome: p, importo: Math.abs(val) });
        } else if (val > 0.001) {
            creditori.push({ nome: p, importo: val });
        }
    });

    let rimborsi = [];
    let i = 0, j = 0;

    while (i < debitori.length && j < creditori.length) {
        let deb = debitori[i];
        let cred = creditori[j];

        let min = Math.min(deb.importo, cred.importo);
        min = Math.round(min * 100) / 100;

        if (min > 0) {
            rimborsi.push({ da: deb.nome, a: cred.nome, importo: min });
        }

        deb.importo = Math.round((deb.importo - min) * 100) / 100;
        cred.importo = Math.round((cred.importo - min) * 100) / 100;

        if (deb.importo <= 0.001) i++;
        if (cred.importo <= 0.001) j++;
    }

    return rimborsi;
}

// Calcola i Saldi Complessivi Globali
function calcolaSaldiGlobali() {
    let saldi = {};
    state.partecipanti.forEach(p => {
        saldi[p] = { pagato: 0, speso: 0, centesimini: [], saldo: 0 };
    });

    state.spese.forEach(spesa => {
        const { dettagliPersona } = calcolaDettaglioSpesa(spesa);
        Object.keys(dettagliPersona).forEach(p => {
            if (saldi[p]) {
                saldi[p].pagato += dettagliPersona[p].haPagato;
                saldi[p].speso += dettagliPersona[p].haSpeso;
                if (dettagliPersona[p].centesiminiStr) {
                    saldi[p].centesimini.push(dettagliPersona[p].centesiminiStr);
                }
            }
        });
    });

    let saldiSoloMonto = {};
    Object.keys(saldi).forEach(p => {
        saldi[p].pagato = Math.round(saldi[p].pagato * 100) / 100;
        saldi[p].speso = Math.round(saldi[p].speso * 100) / 100;
        saldi[p].saldo = Math.round((saldi[p].pagato - saldi[p].speso) * 100) / 100;
        saldiSoloMonto[p] = saldi[p].saldo;
    });

    const rimborsiGlobali = calcolaRimborsiOptimizzati(saldiSoloMonto);

    return { saldiDettagliati: saldi, rimborsiGlobali: rimborsiGlobali };
}
