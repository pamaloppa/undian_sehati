/**
 * APLIKASI UNDIAN SEHATI - BKPSDM
 * Logika Aplikasi Utama (App Controller)
 */

const DEFAULT_PRIZES = [
    { id: 'prize_1', name: 'Sepeda Listrik', icon: '⚡🚲', num: 1 },
    { id: 'prize_2', name: 'Sepeda Lipat', icon: '🚲', num: 2 },
    { id: 'prize_3', name: 'Kulkas 2 Pintu', icon: '❄️', num: 3 },
    { id: 'prize_4', name: 'TV 32 Inch', icon: '📺', num: 4 },
    { id: 'prize_5', name: 'Mesin Cuci', icon: '🫧', num: 5 }
];

const STORAGE_KEYS = {
    MASTER: 'SEHATI_UNDIAN_MASTER_PEGAWAI',
    NOMINASI: 'SEHATI_UNDIAN_NOMINASI',
    WINNERS: 'SEHATI_UNDIAN_WINNERS_HISTORY',
    SETTINGS: 'SEHATI_UNDIAN_SETTINGS',
    SELECTED_PRIZE: 'SEHATI_UNDIAN_SELECTED_PRIZE'
};

const AppState = {
    masterPegawai: [],
    nominasi: [],
    winnersHistory: [],
    currentRoundWinners: [],
    isRolling: false,
    prizes: [...DEFAULT_PRIZES],
    selectedPrizeId: 'prize_1',
    settings: {
        drawCount: 1, // Default 1 pemenang per putaran bergantian (bisa diubah ke 5)
        prizeName: 'Sepeda Listrik',
        excludePreviousWinners: true,
        soundEnabled: true,
        rollDuration: 7000, // base duration in ms
        dataSource: 'nominasi' // 'nominasi' or 'master'
    }
};

window.AppState = AppState;

// ============================================================
// INISIALISASI SAAT DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Muat sinkron dari LocalStorage agar UI instan tanpa jeda
    loadFromLocalStorageSync();
    initEventListeners();
    initDropzones();
    renderAllViews();

    // 2. Inisialisasi IndexedDB permanen (mesin database lokal browser setara SQLite)
    if (window.AppDB) {
        await window.AppDB.init();
        await hydrateFromIndexedDB();
    }
});

// ============================================================
// PENYIMPANAN LOCALSTORAGE & INDEXEDDB
// ============================================================
function loadFromLocalStorageSync() {
    try {
        const savedMaster = localStorage.getItem(STORAGE_KEYS.MASTER);
        if (savedMaster) AppState.masterPegawai = JSON.parse(savedMaster);

        const savedNominasi = localStorage.getItem(STORAGE_KEYS.NOMINASI);
        if (savedNominasi) AppState.nominasi = JSON.parse(savedNominasi);

        const savedWinners = localStorage.getItem(STORAGE_KEYS.WINNERS);
        if (savedWinners) AppState.winnersHistory = JSON.parse(savedWinners);

        const savedPrizeId = localStorage.getItem(STORAGE_KEYS.SELECTED_PRIZE);
        if (savedPrizeId && DEFAULT_PRIZES.some(p => p.id === savedPrizeId)) {
            AppState.selectedPrizeId = savedPrizeId;
        }

        const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (savedSettings) {
            AppState.settings = { ...AppState.settings, ...JSON.parse(savedSettings) };
        }

        // Pastikan default 1 pemenang per hadiah untuk pengundian bergantian
        AppState.settings.drawCount = 1;

        // Sinkronkan nama hadiah aktif
        const activePrize = AppState.prizes.find(p => p.id === AppState.selectedPrizeId);
        if (activePrize) AppState.settings.prizeName = activePrize.name;

        // Muat preferensi hide menu
        const savedMenuHidden = localStorage.getItem('SEHATI_MENU_HIDDEN');
        if (savedMenuHidden === 'true') {
            document.body.classList.add('menu-hidden');
        }

    } catch (e) {
        console.error('Gagal memuat dari storage:', e);
    }

    try {
        reEvaluateNominasiMatches();
    } catch (e) {}

    if (window.soundEffects) {
        window.soundEffects.setEnabled(AppState.settings.soundEnabled);
    }
}

async function hydrateFromIndexedDB(force = false) {
    if (!window.AppDB || !window.AppDB.isReady) return;
    try {
        const idbMaster = await window.AppDB.load('MASTER_PEGAWAI');
        const idbNominasi = await window.AppDB.load('NOMINASI');
        const idbWinners = await window.AppDB.load('WINNERS');

        let shouldReRender = false;
        if (idbMaster && Array.isArray(idbMaster) && (force || idbMaster.length !== AppState.masterPegawai.length || AppState.masterPegawai.length === 0)) {
            AppState.masterPegawai = idbMaster;
            shouldReRender = true;
        }
        if (idbNominasi && Array.isArray(idbNominasi) && (force || idbNominasi.length !== AppState.nominasi.length || AppState.nominasi.length === 0)) {
            AppState.nominasi = idbNominasi;
            shouldReRender = true;
        }
        if (idbWinners && Array.isArray(idbWinners) && (force || idbWinners.length !== AppState.winnersHistory.length)) {
            AppState.winnersHistory = idbWinners;
            shouldReRender = true;
        }

        if (shouldReRender) {
            reEvaluateNominasiMatches();
            renderAllViews();
        }
    } catch (e) {
        console.warn('Gagal hidrasi dari IndexedDB:', e);
    }
}

function saveToStorage() {
    // 1. Simpan konfigurasi kecil ke LocalStorage (pasti berhasil, hanya beberapa byte)
    try { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(AppState.settings)); } catch (e) {}
    try { localStorage.setItem(STORAGE_KEYS.SELECTED_PRIZE, AppState.selectedPrizeId); } catch (e) {}
    try { localStorage.setItem(STORAGE_KEYS.WINNERS, JSON.stringify(AppState.winnersHistory)); } catch (e) {}

    // 2. Nominasi ke LocalStorage jika ukurannya wajar (< 1000 baris)
    try {
        if (AppState.nominasi.length <= 1000) {
            localStorage.setItem(STORAGE_KEYS.NOMINASI, JSON.stringify(AppState.nominasi));
        } else {
            localStorage.removeItem(STORAGE_KEYS.NOMINASI);
        }
    } catch (e) {
        localStorage.removeItem(STORAGE_KEYS.NOMINASI);
    }

    // 3. Master Pegawai: ribuan baris dengan 50 kolom (melebihi 5MB kuota LocalStorage)
    // Jangan biarkan mengunci kuota 5MB LocalStorage browser!
    try {
        if (AppState.masterPegawai.length <= 200) {
            localStorage.setItem(STORAGE_KEYS.MASTER, JSON.stringify(AppState.masterPegawai));
        } else {
            localStorage.removeItem(STORAGE_KEYS.MASTER);
        }
    } catch (e) {
        localStorage.removeItem(STORAGE_KEYS.MASTER);
    }

    // 4. Simpan SEMUA data (Master, Nominasi, Riwayat) ke IndexedDB permanen (Kapasitas Tak Terbatas!)
    if (window.AppDB && window.AppDB.isReady) {
        window.AppDB.save('MASTER_PEGAWAI', AppState.masterPegawai);
        window.AppDB.save('NOMINASI', AppState.nominasi);
        window.AppDB.save('WINNERS', AppState.winnersHistory);
        window.AppDB.save('SETTINGS', AppState.settings);
    }

    // 5. Siarkan ke tab / jendela lain di browser yang sama via BroadcastChannel
    try {
        if (window.SehatiBroadcast) {
            window.SehatiBroadcast.postMessage({
                type: 'LOCAL_DATA_CHANGED',
                timestamp: Date.now(),
                masterCount: AppState.masterPegawai.length,
                nominasiCount: AppState.nominasi.length
            });
        }
    } catch (e) {}
}

function handleBackupRestore(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (confirm('Apakah Anda yakin ingin memulihkan database dari file cadangan ini?')) {
        window.AppDB.importBackup(file).then(() => {
            alert('✅ Database berhasil dipulihkan!');
        }).catch(err => {
            alert('Gagal memulihkan cadangan: ' + err.message);
        });
    }
    event.target.value = '';
}

// ============================================================
// KONTROL VISIBILITAS MENU (HIDE / SHOW MENU)
// ============================================================
function toggleMenuVisibility() {
    document.body.classList.toggle('menu-hidden');
    const isHidden = document.body.classList.contains('menu-hidden');
    try {
        localStorage.setItem('SEHATI_MENU_HIDDEN', isHidden ? 'true' : 'false');
    } catch (e) {}

    const toggleBtn = document.getElementById('btn-toggle-menu');
    if (toggleBtn) {
        toggleBtn.title = isHidden ? "Tampilkan Menu Navigasi (H / M)" : "Sembunyikan Menu (Mode Panggung Full)";
    }
}

// ============================================================
// LOGIKA SINKRONISASI & MATCHING MASTER VS NOMINASI
// ============================================================
function enrichNominasiList(nominasiRawList) {
    const cleanNipKey = (val) => String(val || '').replace(/[^0-9a-zA-Z]/g, '').trim().toLowerCase();

    const masterMap = new Map();
    AppState.masterPegawai.forEach(pegawai => {
        const nipVal = pegawai.nip || (pegawai.raw && (pegawai.raw.nip || pegawai.raw.employee_nip));
        if (nipVal) {
            const cleanKey = cleanNipKey(nipVal);
            if (cleanKey) masterMap.set(cleanKey, pegawai);
        }
    });

    return nominasiRawList.map(item => {
        const nipVal = item.nip || item.employee_nip || (item.raw && (item.raw.employee_nip || item.raw.nip));
        const cleanKey = cleanNipKey(nipVal);
        const matchedPegawai = masterMap.get(cleanKey);

        if (matchedPegawai) {
            return {
                ...item,
                nama: matchedPegawai.nama || item.nama,
                namaAsli: matchedPegawai.namaAsli || item.namaAsli,
                opd: matchedPegawai.opd || item.opd || '',
                unor: matchedPegawai.unor || item.unor || '',
                unitKerja: matchedPegawai.unitKerja || item.unitKerja || 'Pemerintah Daerah',
                jabatan: matchedPegawai.jabatan || item.jabatan || 'Pegawai',
                pangkat: matchedPegawai.pangkat || '',
                gol: matchedPegawai.gol || '',
                pangkatGol: matchedPegawai.pangkatGol || '',
                foto: matchedPegawai.foto || item.foto || '',
                foto_kecil: matchedPegawai.foto_kecil || '',
                foto_full: matchedPegawai.foto_full || '',
                isMatched: true
            };
        } else {
            return {
                ...item,
                opd: item.opd || '',
                unor: item.unor || '',
                unitKerja: item.unitKerja || 'Pemerintah Daerah',
                jabatan: item.jabatan || 'Pegawai',
                foto: item.foto || '',
                isMatched: false
            };
        }
    });
}

function reEvaluateNominasiMatches() {
    // Segarkan foto master jika tersimpan dari sesi sebelumnya
    if (window.CSVParser && window.CSVParser.normalizeMasterRecord) {
        AppState.masterPegawai = AppState.masterPegawai.map(p => {
            if ((!p.foto || !p.foto_kecil) && p.raw) {
                const refreshed = window.CSVParser.normalizeMasterRecord(p.raw);
                return { ...p, ...refreshed };
            }
            return p;
        });
    }

    AppState.nominasi = enrichNominasiList(AppState.nominasi);
    saveToStorage();
}

// ============================================================
// DATA POOL UNTUK PENGUNDIAN
// ============================================================
function getEligiblePool() {
    let sourcePool = AppState.settings.dataSource === 'master' 
        ? [...AppState.masterPegawai] 
        : [...AppState.nominasi];

    // Jika nominasi masih kosong tapi master ada, gunakan master dengan notifikasi otomatis
    if (sourcePool.length === 0 && AppState.masterPegawai.length > 0) {
        sourcePool = [...AppState.masterPegawai];
    }

    if (AppState.settings.excludePreviousWinners) {
        const wonNips = new Set();
        AppState.winnersHistory.forEach(round => {
            round.winners.forEach(w => {
                if (w.nip) wonNips.add(String(w.nip).trim().toLowerCase());
            });
        });

        sourcePool = sourcePool.filter(p => !wonNips.has(String(p.nip).trim().toLowerCase()));
    }

    return sourcePool;
}

// ============================================================
// SISTEM PENGUNDIAN (DRAW ENGINE DENGAN 5 SLOT BERPUTAR)
// ============================================================
function startDraw() {
    if (AppState.isRolling) return;

    const pool = getEligiblePool();
    const countNeeded = AppState.settings.drawCount || 1;

    if (pool.length === 0) {
        alert('⚠️ Tidak ada peserta yang dapat diundi!\n\nSilakan unggah data nominasi atau database pegawai terlebih dahulu, atau aktifkan opsi "Boleh Menang Berulang" di pengaturan.');
        return;
    }

    if (pool.length < countNeeded) {
        const confirmDraw = confirm(`⚠️ Peserta yang tersisa hanya ${pool.length} orang, sedangkan target undian adalah ${countNeeded} orang.\n\nApakah ingin tetap melanjutkan mengundi ${pool.length} orang ini?`);
        if (!confirmDraw) return;
    }

    const actualDrawCount = Math.min(pool.length, countNeeded);

    // Pemilihan pemenang secara adil & acak menggunakan Fisher-Yates dengan crypto RNG
    const selectedWinners = getRandomWinners(pool, actualDrawCount);
    AppState.currentRoundWinners = selectedWinners;
    AppState.isRolling = true;

    // Persiapan UI
    const drawBtn = document.getElementById('btn-start-draw');
    const spotlightBtn = document.getElementById('btn-show-spotlight');
    if (drawBtn) drawBtn.disabled = true;
    if (spotlightBtn) spotlightBtn.style.display = 'none';

    // Update slot visual count
    renderSlotPlaceholders(actualDrawCount);

    // Mulai efek suara berputar
    if (window.soundEffects) {
        window.soundEffects.startRollSound();
    }

    // Jalankan animasi reel dramatis dengan kurva perlambatan bertahap (Deceleration)
    const slotElements = document.querySelectorAll('.slot-card');
    const totalRollTime = Math.max(5000, AppState.settings.rollDuration || 7000);
    const stepDelay = 800; // ms jeda antar slot

    selectedWinners.forEach((winner, idx) => {
        const slotEl = slotElements[idx];
        if (!slotEl) return;

        slotEl.classList.remove('locked');
        slotEl.classList.add('spinning');

        const avatarPhoto = slotEl.querySelector('.avatar-photo');
        const placeholderIcon = slotEl.querySelector('.avatar-placeholder-icon');
        const initialsEl = slotEl.querySelector('.avatar-initials');
        if (avatarPhoto) avatarPhoto.style.display = 'none';
        if (placeholderIcon) placeholderIcon.style.display = 'block';
        if (initialsEl) initialsEl.style.display = 'none';

        const slotStopTime = totalRollTime + (idx * stepDelay);
        const startTime = Date.now();

        function spinStep() {
            if (!AppState.isRolling) return;

            const elapsed = Date.now() - startTime;
            const remaining = slotStopTime - elapsed;

            // Jika waktu pengacakan habis -> Kunci pemenang sah (LOCKED!)
            if (remaining <= 0) {
                lockWinnerSlot(slotEl, winner, idx + 1);
                if (window.soundEffects) {
                    window.soundEffects.playCardLock(idx);
                }

                // Jika ini slot terakhir -> Puncak Kemenangan!
                if (idx === selectedWinners.length - 1) {
                    onAllSlotsLocked(selectedWinners);
                }
                return;
            }

            // Pilih acak nama peserta
            const randomSample = pool[Math.floor(Math.random() * pool.length)];
            const nameEl = slotEl.querySelector('.slot-name');
            const nipEl = slotEl.querySelector('.slot-nip');
            const unitEl = slotEl.querySelector('.slot-unit');
            const jabatanEl = slotEl.querySelector('.slot-jabatan');

            if (nameEl) nameEl.textContent = randomSample.nama || 'Mengacak...';
            if (nipEl) nipEl.textContent = randomSample.nip || '••••••••••••••••••';
            if (unitEl) unitEl.textContent = randomSample.unitKerja || '';
            if (jabatanEl) jabatanEl.textContent = randomSample.jabatan || '';

            // KURVA PERLAMBATAN DRAMATIS (Deceleration Tension)
            let nextDelay = 55;
            if (remaining < 900) {
                // Tahap Klimaks (0.9s terakhir): Pergantian sangat lambat, nama tertahan
                nextDelay = 360;
                if (nameEl) nameEl.style.filter = 'none';
            } else if (remaining < 2000) {
                // Tahap Menegangkan (2s terakhir): Melambat nyata
                nextDelay = 200;
                if (nameEl) nameEl.style.filter = 'blur(0.5px)';
            } else if (remaining < 3800) {
                // Tahap Transisi (3.8s terakhir): Mulai melambat
                nextDelay = 105;
                if (nameEl) nameEl.style.filter = 'blur(1px)';
            } else {
                // Tahap Awal: Putaran kilat berkecepatan tinggi
                nextDelay = 55;
                if (nameEl) nameEl.style.filter = 'blur(1.5px)';
            }

            setTimeout(spinStep, nextDelay);
        }

        spinStep();
    });
}

function getRandomWinners(sourcePool, count) {
    const clone = [...sourcePool];
    const winners = [];

    // Menggunakan window.crypto jika tersedia untuk true randomness
    const getRandomIndex = (max) => {
        if (window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            return array[0] % max;
        }
        return Math.floor(Math.random() * max);
    };

    for (let i = 0; i < count; i++) {
        if (clone.length === 0) break;
        const index = getRandomIndex(clone.length);
        winners.push(clone[index]);
        clone.splice(index, 1);
    }

    return winners;
}

function lockWinnerSlot(slotEl, winner, rankNumber) {
    if (!slotEl) return;

    slotEl.classList.remove('spinning');
    slotEl.classList.add('locked');

    const nameEl = slotEl.querySelector('.slot-name');
    const nipEl = slotEl.querySelector('.slot-nip');
    const unitEl = slotEl.querySelector('.slot-unit');
    const jabatanEl = slotEl.querySelector('.slot-jabatan');
    const initialsEl = slotEl.querySelector('.avatar-initials');
    const statusPill = slotEl.querySelector('.slot-status-pill');

    if (nameEl) nameEl.textContent = winner.nama || 'Nama Tidak Tersedia';
    if (nipEl) nipEl.textContent = winner.nip ? `NIP: ${winner.nip}` : '-';
    if (unitEl) unitEl.textContent = winner.unitKerja || 'Pemerintah Daerah';
    
    if (jabatanEl) {
        let details = [];
        if (winner.jabatan) details.push(winner.jabatan);
        if (winner.pangkatGol) details.push(winner.pangkatGol);
        let html = details.join(' • ');
        if (winner.keterangan && winner.keterangan !== 'Peserta Nominasi SEHATI') {
            html += `<div style="margin-top: 6px;"><span class="badge-sehati-achievement" style="display:inline-block; padding: 2px 10px; border-radius: 16px; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); color: var(--gold-light); font-weight: 600; font-size: 0.82rem;">${winner.keterangan}</span></div>`;
        }
        jabatanEl.innerHTML = html;
    }

    if (initialsEl) {
        initialsEl.textContent = getInitials(winner.nama);
    }

    // Tampilkan Foto Pemenang yang bersumber dari Master Pegawai
    const avatarPhoto = slotEl.querySelector('.avatar-photo');
    const placeholderIcon = slotEl.querySelector('.avatar-placeholder-icon');

    if (avatarPhoto) {
        if (winner.foto) {
            avatarPhoto.src = winner.foto;
            avatarPhoto.style.display = 'block';
            if (placeholderIcon) placeholderIcon.style.display = 'none';
            if (initialsEl) initialsEl.style.display = 'none';

            avatarPhoto.onerror = function() {
                avatarPhoto.style.display = 'none';
                if (initialsEl) initialsEl.style.display = 'block';
            };
        } else {
            avatarPhoto.style.display = 'none';
            if (placeholderIcon) placeholderIcon.style.display = 'none';
            if (initialsEl) initialsEl.style.display = 'block';
        }
    }

    if (statusPill) {
        statusPill.textContent = '★ Pemenang Sah';
    }
}

function onAllSlotsLocked(winners) {
    AppState.isRolling = false;

    // Hentikan suara putaran
    if (window.soundEffects) {
        window.soundEffects.stopRollSound();
        window.soundEffects.playFanfare();
    }

    // Ledakan konfeti panggung
    if (window.ConfettiManager) {
        window.ConfettiManager.burst(250, true);
        setTimeout(() => window.ConfettiManager.burst(150, false), 700);
    }

    const currentPrize = AppState.prizes.find(p => p.id === AppState.selectedPrizeId) || { name: AppState.settings.prizeName };

    // Catat ke Riwayat Pemenang
    const roundData = {
        id: 'ROUND_' + Date.now(),
        timestamp: new Date().toLocaleString('id-ID', {
            dateStyle: 'full',
            timeStyle: 'medium'
        }),
        prizeId: AppState.selectedPrizeId,
        prizeName: currentPrize.name,
        winners: winners
    };

    AppState.winnersHistory.unshift(roundData);
    saveToStorage();

    // Re-enable tombol
    const drawBtn = document.getElementById('btn-start-draw');
    const spotlightBtn = document.getElementById('btn-show-spotlight');
    if (drawBtn) drawBtn.disabled = false;
    if (spotlightBtn) spotlightBtn.style.display = 'inline-flex';

    // Perbarui kartu hadiah & label tombol
    renderPrizeCards();
    updateDrawButtonLabel();

    // Tampilkan notifikasi lanjut ke hadiah berikutnya
    const promptEl = document.getElementById('next-prize-prompt');
    const msgEl = document.getElementById('next-prize-message');
    const btnNext = document.getElementById('btn-next-prize');

    if (promptEl && msgEl && btnNext) {
        promptEl.style.display = 'flex';
        const currIdx = AppState.prizes.findIndex(p => p.id === AppState.selectedPrizeId);
        const nextPrize = (currIdx >= 0 && currIdx < AppState.prizes.length - 1) ? AppState.prizes[currIdx + 1] : null;

        if (nextPrize) {
            msgEl.innerHTML = `🎉 Selamat! Pengundian untuk <strong>${currentPrize.name}</strong> selesai! (${winners.length} Pemenang Sah).`;
            btnNext.textContent = `Lanjut ke Hadiah Berikutnya (${nextPrize.name}) 👉`;
            btnNext.onclick = goToNextPrize;
            btnNext.style.display = 'inline-block';
        } else {
            msgEl.innerHTML = `🏆 Rangkaian pengundian seluruh 5 hadiah utama telah berhasil diselesaikan!`;
            btnNext.textContent = `Lihat Riwayat & Cetak Berita Acara 👉`;
            btnNext.onclick = () => {
                document.querySelector('.nav-tab-btn[data-tab="tab-history"]')?.click();
            };
        }
    }

    // Update status counter dan tabel riwayat
    updateStatusBar();
    renderHistoryTab();

    // Buka Spotlight Modal setelah 1.5 detik perayaan
    setTimeout(() => {
        openWinnerSpotlightModal(roundData);
    }, 1500);
}

function getInitials(name) {
    if (!name) return 'PS';
    // Hapus gelar umum (Dr., Drs., S.Kom, M.Si, dsb) untuk inisial nama asli
    const clean = name.replace(/(Dr\.|Drs\.|H\.|Hj\.|S\.[A-Za-z]+|M\.[A-Za-z]+)/gi, '').trim();
    const parts = clean.split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0] ? parts[0].substring(0, 2) : 'PS').toUpperCase();
}

// ============================================================
// LOGIKA PILIHAN 5 HADIAH BERGANTIAN (1 PEMENANG PER HADIAH)
// ============================================================
function renderPrizeCards() {
    const grid = document.getElementById('prize-cards-grid');
    if (!grid) return;

    grid.innerHTML = '';

    AppState.prizes.forEach(prize => {
        const card = document.createElement('div');
        const isActive = prize.id === AppState.selectedPrizeId;
        
        // Cek pemenang untuk hadiah ini dari riwayat
        const roundsForPrize = AppState.winnersHistory.filter(r => 
            (r.prizeId && String(r.prizeId) === String(prize.id)) || 
            (r.prizeName && r.prizeName.toLowerCase().includes(prize.name.toLowerCase()))
        );
        
        const lastRound = roundsForPrize[0];
        const lastWinner = lastRound && lastRound.winners && lastRound.winners[0];
        const isDrawn = !!lastWinner;

        let cardClass = 'prize-card';
        if (isActive) cardClass += ' active';
        if (isDrawn) cardClass += ' drawn';

        card.className = cardClass;
        card.onclick = () => selectPrize(prize.id);

        if (isDrawn && lastWinner) {
            // TAMPILAN SETELAH DIUNDI: NIP, Nama, OPD, dan Foto Pemenang!
            const photoHtml = lastWinner.foto
                ? `<img src="${lastWinner.foto}" alt="${lastWinner.nama}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <span style="display:none;">${getInitials(lastWinner.nama)}</span>`
                : `<span>${getInitials(lastWinner.nama)}</span>`;

            const opdDisplay = lastWinner.opd || lastWinner.unitKerja || 'Pemerintah Daerah';

            card.innerHTML = `
                <div class="prize-card-drawn-layout">
                    <div class="pc-drawn-top">
                        <span class="prize-card-num">#${prize.num}</span>
                        <span class="prize-card-title">${prize.name}</span>
                        <span class="prize-card-status drawn">✓ SAH</span>
                    </div>
                    <div class="pc-drawn-winner">
                        <div class="pc-winner-avatar">
                            ${photoHtml}
                        </div>
                        <div class="pc-winner-details">
                            <div class="pc-winner-name" title="${lastWinner.nama}">${lastWinner.nama}</div>
                            <div class="pc-winner-nip">NIP: ${lastWinner.nip || '-'}</div>
                            <div class="pc-winner-opd" title="${opdDisplay}">${opdDisplay}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // TAMPILAN STANDBY / BELUM DIUNDI
            let statusText = 'Siap Diundi';
            if (isActive) {
                statusText = '★ Sedang Aktif';
            }

            card.innerHTML = `
                <span class="prize-card-num">#${prize.num}</span>
                <div class="prize-card-icon">${prize.icon}</div>
                <div class="prize-card-body">
                    <div class="prize-card-title">${prize.name}</div>
                    <div class="prize-card-status">${statusText}</div>
                </div>
            `;
        }

        grid.appendChild(card);
    });
}

function selectPrize(prizeId) {
    if (AppState.isRolling) return;

    AppState.selectedPrizeId = prizeId;
    const prize = AppState.prizes.find(p => p.id === prizeId) || AppState.prizes[0];
    AppState.settings.prizeName = prize.name;
    AppState.settings.drawCount = 1; // 1 pemenang per hadiah

    const displayEl = document.getElementById('stage-prize-name-display');
    const inputEl = document.getElementById('quick-prize-input');
    const nextPrompt = document.getElementById('next-prize-prompt');

    if (displayEl) displayEl.textContent = prize.name;
    if (inputEl) inputEl.value = prize.name;
    if (nextPrompt) nextPrompt.style.display = 'none';

    renderPrizeCards();
    updateDrawButtonLabel();
    renderSlotPlaceholders(1);
    saveToStorage();
}

function setDrawCount(count = 1) {
    if (AppState.isRolling) return;
    AppState.settings.drawCount = 1;
    updateDrawButtonLabel();
    renderSlotPlaceholders(1);
    saveToStorage();
}

function updateDrawButtonLabel() {
    const labelEl = document.getElementById('btn-draw-label');
    if (!labelEl) return;
    const currentPrize = AppState.prizes.find(p => p.id === AppState.selectedPrizeId) || { name: AppState.settings.prizeName };
    labelEl.textContent = `MULAI UNDI: ${currentPrize.name.toUpperCase()}`;
}

function goToNextPrize() {
    if (AppState.isRolling) return;

    const currIdx = AppState.prizes.findIndex(p => p.id === AppState.selectedPrizeId);
    if (currIdx >= 0 && currIdx < AppState.prizes.length - 1) {
        selectPrize(AppState.prizes[currIdx + 1].id);
        const stageEl = document.getElementById('tab-stage');
        if (stageEl && typeof stageEl.scrollIntoView === 'function') {
            stageEl.scrollIntoView({ behavior: 'smooth' });
        }
    } else {
        alert('🎉 Semua 5 kategori hadiah utama telah selesai diundi!');
    }
}

// ============================================================
// RENDERING TAMPILAN (VIEWS)
// ============================================================
function renderAllViews() {
    renderPrizeCards();
    updateDrawButtonLabel();
    renderSlotPlaceholders(1);
    updateStatusBar();
    renderMasterTable();
    renderNominasiTable();
    renderHistoryTab();
    renderSettingsTab();
}

function renderSlotPlaceholders(count = 1) {
    const container = document.getElementById('slots-container');
    if (!container) return;

    container.innerHTML = '';
    const currentPrize = AppState.prizes.find(p => p.id === AppState.selectedPrizeId) || { name: AppState.settings.prizeName };

    container.className = 'slots-container single-slot';

    const slot = document.createElement('div');
    slot.className = 'slot-card';
    slot.id = 'slot-card-1';

    slot.innerHTML = `
        <div class="slot-header">
            <span class="slot-rank-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                Pemenang Hadiah: ${currentPrize.name}
            </span>
        </div>
        <div class="slot-avatar">
            <img class="avatar-photo" src="" alt="" style="display:none; width:100%; height:100%; object-fit:cover; border-radius:50%;">
            <span class="avatar-initials">--</span>
            <span class="avatar-placeholder-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="8" r="5"/>
                    <path d="M20 21a8 8 0 1 0-16 0"/>
                </svg>
            </span>
        </div>
        <div class="slot-body">
            <div class="slot-name">Siap Diundi</div>
            <div class="slot-nip">NIP: ••••••••••••••••••</div>
            <div class="slot-unit">Tekan tombol di bawah untuk mengundi pemenang</div>
            <div class="slot-jabatan"></div>
        </div>
        <div class="slot-footer">
            <span class="slot-status-pill">Standby</span>
        </div>
    `;

    container.appendChild(slot);
}

function updateStatusBar() {
    const totalMaster = AppState.masterPegawai.length;
    const totalNominasi = AppState.nominasi.length;
    const pool = getEligiblePool();

    let totalWon = 0;
    const wonNips = new Set();
    AppState.winnersHistory.forEach(r => r.winners.forEach(w => {
        if (w.nip) wonNips.add(w.nip);
    }));
    totalWon = wonNips.size;

    const elTotalMaster = document.getElementById('stat-total-master');
    const elTotalNominasi = document.getElementById('stat-total-nominasi');
    const elEligible = document.getElementById('stat-eligible');
    const elWon = document.getElementById('stat-won');

    if (elTotalMaster) elTotalMaster.textContent = totalMaster.toLocaleString('id-ID');
    if (elTotalNominasi) elTotalNominasi.textContent = totalNominasi.toLocaleString('id-ID');
    if (elEligible) elEligible.textContent = pool.length.toLocaleString('id-ID');
    if (elWon) elWon.textContent = totalWon.toLocaleString('id-ID');

    // Update match banner on Nominasi panel
    const matchCount = AppState.nominasi.filter(n => n.isMatched).length;
    const matchAlert = document.getElementById('nominasi-match-alert');
    if (matchAlert) {
        if (totalNominasi > 0) {
            matchAlert.style.display = 'flex';
            matchAlert.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
                <div><strong>${matchCount} dari ${totalNominasi}</strong> peserta nominasi cocok dengan Database Pegawai Master.</div>
            `;
        } else {
            matchAlert.style.display = 'none';
        }
    }
}

// ============================================================
// TABEL DATA MASTER PEGAWAI
// ============================================================
function renderMasterTable(filterQuery = '') {
    const tbody = document.getElementById('tbody-master');
    const countBadge = document.getElementById('master-count-badge');
    if (!tbody) return;

    let list = AppState.masterPegawai;
    if (filterQuery) {
        const q = filterQuery.toLowerCase();
        list = list.filter(p => 
            (p.nip && String(p.nip).toLowerCase().includes(q)) ||
            (p.nama && p.nama.toLowerCase().includes(q)) ||
            (p.unitKerja && p.unitKerja.toLowerCase().includes(q))
        );
    }

    if (countBadge) countBadge.textContent = `${list.length} Data`;
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 36px; color: var(--text-dim);">
                    Belum ada data pegawai. Silakan unggah file CSV atau klik "Gunakan Data Contoh".
                </td>
            </tr>
        `;
        return;
    }

    list.slice(0, 100).forEach((item, index) => {
        const tr = document.createElement('tr');
        const jabInfo = [item.jabatan, item.pangkatGol].filter(Boolean).join(' • ');
        const photoHtml = item.foto 
            ? `<img src="${item.foto}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <span style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">${getInitials(item.nama)}</span>`
            : `<span style="display:flex; width:100%; height:100%; align-items:center; justify-content:center;">${getInitials(item.nama)}</span>`;

        tr.innerHTML = `
            <td style="color: var(--text-dim);">${index + 1}</td>
            <td class="cell-nip">${item.nip || '-'}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; overflow: hidden; background: rgba(6, 182, 212, 0.2); border: 1.5px solid rgba(103, 232, 249, 0.4); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #67e8f9;">
                        ${photoHtml}
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #ffffff;">${item.nama || '-'}</div>
                        ${item.namaAsli && item.namaAsli !== item.nama ? `<div style="font-size: 0.75rem; color: var(--text-dim);">${item.namaAsli}</div>` : ''}
                    </div>
                </div>
            </td>
            <td>${item.unitKerja || '-'}</td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">${jabInfo || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================================
// TABEL DATA NOMINASI UNDIAN
// ============================================================
function renderNominasiTable(filterQuery = '') {
    const tbody = document.getElementById('tbody-nominasi');
    const countBadge = document.getElementById('nominasi-count-badge');
    if (!tbody) return;

    let list = AppState.nominasi;
    if (filterQuery) {
        const q = filterQuery.toLowerCase();
        list = list.filter(p => 
            (p.nip && String(p.nip).toLowerCase().includes(q)) ||
            (p.nama && p.nama.toLowerCase().includes(q)) ||
            (p.unitKerja && p.unitKerja.toLowerCase().includes(q)) ||
            (p.keterangan && p.keterangan.toLowerCase().includes(q))
        );
    }

    if (countBadge) countBadge.textContent = `${list.length} Peserta`;
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 36px; color: var(--text-dim);">
                    Belum ada data nominasi. Silakan unggah file CSV nominasi atau klik "Gunakan Data Contoh".
                </td>
            </tr>
        `;
        return;
    }

    list.slice(0, 100).forEach((item, index) => {
        const tr = document.createElement('tr');
        const badgeHtml = item.isMatched 
            ? `<span class="cell-badge matched">✓ Master Terhubung</span>`
            : `<span class="cell-badge standalone">Data Mandiri</span>`;

        const photoHtml = item.foto 
            ? `<img src="${item.foto}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <span style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">${getInitials(item.nama)}</span>`
            : `<span style="display:flex; width:100%; height:100%; align-items:center; justify-content:center;">${getInitials(item.nama)}</span>`;

        tr.innerHTML = `
            <td style="color: var(--text-dim);">${index + 1}</td>
            <td class="cell-nip">${item.nip || '-'}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; overflow: hidden; background: rgba(6, 182, 212, 0.2); border: 1.5px solid rgba(103, 232, 249, 0.4); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #67e8f9;">
                        ${photoHtml}
                    </div>
                    <div style="font-weight: 600; color: #ffffff;">${item.nama || '-'}</div>
                </div>
            </td>
            <td>${item.unitKerja || '-'}</td>
            <td style="color: var(--gold-light); font-size: 0.8rem;">${item.keterangan || '-'}</td>
            <td>${badgeHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================================
// TAB RIWAYAT PEMENANG & CETAK BERITA ACARA
// ============================================================
function renderHistoryTab() {
    const container = document.getElementById('history-rounds-list');
    const emptyState = document.getElementById('history-empty-state');
    if (!container) return;

    container.innerHTML = '';

    if (AppState.winnersHistory.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    AppState.winnersHistory.forEach((round, roundIdx) => {
        const roundCard = document.createElement('div');
        roundCard.className = 'history-round-card';

        const roundNumber = AppState.winnersHistory.length - roundIdx;

        let winnersListHtml = '';
        round.winners.forEach((w, wIdx) => {
            const photoHtml = w.foto 
                ? `<img src="${w.foto}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <span style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">${getInitials(w.nama)}</span>`
                : `<span style="display:flex; width:100%; height:100%; align-items:center; justify-content:center;">${getInitials(w.nama)}</span>`;

            winnersListHtml += `
                <div class="history-winner-pill">
                    <div class="hw-rank">${wIdx + 1}</div>
                    <div class="hw-avatar" style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: var(--gold-gradient); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.8rem; font-weight: 800; color: #041217; border: 1.5px solid rgba(251, 191, 36, 0.5);">
                        ${photoHtml}
                    </div>
                    <div class="hw-info">
                        <div class="hw-name" title="${w.nama}">${w.nama || '-'}</div>
                        <div class="hw-nip">${w.nip || '-'}</div>
                        <div class="hw-unit" title="${w.unitKerja}">${w.unitKerja || '-'}</div>
                    </div>
                </div>
            `;
        });

        roundCard.innerHTML = `
            <div class="history-round-header">
                <div class="round-title-wrap">
                    <h3>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" color="var(--primary-gold)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        Putaran ${roundNumber} — ${round.prizeName}
                    </h3>
                    <div class="round-timestamp">Dilaksanakan pada: ${round.timestamp}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-secondary" style="padding: 6px 14px; font-size: 0.8rem;" onclick="printSingleRound('${round.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Cetak Berita Acara
                    </button>
                    <button class="btn-action danger" style="width: auto; padding: 6px 12px; font-size: 0.8rem;" onclick="deleteRound('${round.id}')">
                        Hapus
                    </button>
                </div>
            </div>
            <div class="history-winners-grid">
                ${winnersListHtml}
            </div>
        `;

        container.appendChild(roundCard);
    });
}

function deleteRound(roundId) {
    if (!confirm('Apakah Anda yakin ingin menghapus putaran undian ini dari riwayat?')) return;
    AppState.winnersHistory = AppState.winnersHistory.filter(r => r.id !== roundId);
    saveToStorage();
    renderHistoryTab();
    updateStatusBar();
}

function resetAllHistory() {
    resetAllStatus();
}

function exportWinnersCSV() {
    if (AppState.winnersHistory.length === 0) {
        alert('Belum ada riwayat pemenang untuk diekspor!');
        return;
    }

    let csvContent = "Putaran,Nama Hadiah,Waktu Undian,Peringkat,NIP,Nama Pemenang,Unit Kerja,Jabatan\n";

    AppState.winnersHistory.forEach((round, rIdx) => {
        const roundNum = AppState.winnersHistory.length - rIdx;
        round.winners.forEach((w, wIdx) => {
            const row = [
                `"Putaran ${roundNum}"`,
                `"${(round.prizeName || '').replace(/"/g, '""')}"`,
                `"${round.timestamp}"`,
                wIdx + 1,
                `"'${w.nip || ''}"`, // Tanda kutip tunggal agar Excel tidak merusak format NIP
                `"${(w.nama || '').replace(/"/g, '""')}"`,
                `"${(w.unitKerja || '').replace(/"/g, '""')}"`,
                `"${(w.jabatan || '').replace(/"/g, '""')}"`
            ];
            csvContent += row.join(",") + "\n";
        });
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `daftar_pemenang_undian_bkpsdm_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================
// CETAK BERITA ACARA RESMI (PRINT FUNCTION)
// ============================================================
function printOfficialReport(roundId = null) {
    let roundsToPrint = AppState.winnersHistory;
    if (roundId) {
        roundsToPrint = AppState.winnersHistory.filter(r => r.id === roundId);
    }

    if (roundsToPrint.length === 0) {
        alert('Tidak ada data putaran untuk dicetak!');
        return;
    }

    let reportHtml = `
        <div class="print-header-layout">
            <img src="assets/logo_asn_sehati.png" class="print-logo-img" alt="Logo ASN SEHATI">
            <div class="print-header-text">
                <h2>PEMERINTAH DAERAH</h2>
                <h3>BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA (BKPSDM)</h3>
                <p style="font-size: 0.95rem; font-weight: bold; margin-top: 4px; letter-spacing: 0.5px;">BERITA ACARA RESMI PENGUNDIAN PEMENANG ASN SEHATI</p>
            </div>
        </div>
        <p style="font-size: 0.85rem; line-height: 1.6; margin-bottom: 16px;">
            Pada hari ini telah dilaksanakan pengundian dengan sistem acak transparan digital ASN SEHATI. Berikut adalah daftar pemenang yang sah dan telah diverifikasi:
        </p>
    `;

    roundsToPrint.forEach((round, rIdx) => {
        reportHtml += `
            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 8px; font-size: 1rem; text-transform: uppercase;">
                    ${round.prizeName} — (${round.timestamp})
                </h4>
                <table class="print-table">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="width: 40px; text-align: center;">No</th>
                            <th style="width: 170px;">NIP</th>
                            <th>Nama Pemenang</th>
                            <th>Unit Kerja / Instansi</th>
                            <th>Jabatan</th>
                            <th style="width: 120px; text-align: center;">Tanda Tangan</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        round.winners.forEach((w, wIdx) => {
            reportHtml += `
                <tr>
                    <td style="text-align: center;">${wIdx + 1}</td>
                    <td style="font-family: monospace;">${w.nip || '-'}</td>
                    <td><strong>${w.nama || '-'}</strong></td>
                    <td>${w.unitKerja || '-'}</td>
                    <td>${w.jabatan || '-'}</td>
                    <td></td>
                </tr>
            `;
        });

        reportHtml += `
                    </tbody>
                </table>
            </div>
        `;
    });

    reportHtml += `
        <div class="print-signatures">
            <div class="signature-block">
                <div>Saksi I</div>
                <div class="signature-space"></div>
                <div>( ..................................... )</div>
                <div style="font-size: 0.75rem; color: #555;">NIP.</div>
            </div>
            <div class="signature-block">
                <div>Saksi II</div>
                <div class="signature-space"></div>
                <div>( ..................................... )</div>
                <div style="font-size: 0.75rem; color: #555;">NIP.</div>
            </div>
            <div class="signature-block">
                <div>Ketua Panitia Undian</div>
                <div class="signature-space"></div>
                <div>( ..................................... )</div>
                <div style="font-size: 0.75rem; color: #555;">NIP.</div>
            </div>
        </div>
    `;

    let printContainer = document.getElementById('print-container');
    if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'print-container';
        printContainer.className = 'print-only-report';
        document.body.appendChild(printContainer);
    }
    printContainer.innerHTML = reportHtml;

    window.print();
}

function printSingleRound(roundId) {
    printOfficialReport(roundId);
}

// ============================================================
// MODAL SPOTLIGHT PEMENANG
// ============================================================
function openWinnerSpotlightModal(roundData) {
    const modal = document.getElementById('modal-spotlight');
    const titleEl = document.getElementById('modal-prize-title');
    const gridEl = document.getElementById('modal-winners-grid');
    if (!modal || !gridEl) return;

    if (titleEl) titleEl.textContent = `Pemenang Sah: ${roundData.prizeName || 'Hadiah Utama'}`;
    gridEl.innerHTML = '';

    roundData.winners.forEach((w) => {
        const card = document.createElement('div');
        card.className = 'modal-winner-card';
        const achieveBadge = (w.keterangan && w.keterangan !== 'Peserta Nominasi SEHATI')
            ? `<div style="margin-top: 8px; font-size: 0.85rem; color: #fbbf24; background: rgba(251, 191, 36, 0.15); padding: 4px 12px; border-radius: 20px; display: inline-block; border: 1px solid rgba(251, 191, 36, 0.35); font-weight: 600;">${w.keterangan}</div>`
            : '';
        const jabInfo = [w.jabatan, w.pangkatGol].filter(Boolean).join(' • ');

        const photoHtml = w.foto
            ? `<img src="${w.foto}" alt="${w.nama}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div style="width: 100%; height: 100%; display: none; align-items: center; justify-content: center; color: #041217; font-weight: 900; font-size: 2.2rem;">${getInitials(w.nama)}</div>`
            : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #041217; font-weight: 900; font-size: 2.2rem;">${getInitials(w.nama)}</div>`;

        card.innerHTML = `
            <div style="width: 100px; height: 100px; border-radius: 50%; background: var(--gold-gradient); margin: 0 auto 14px; box-shadow: 0 0 25px rgba(251, 191, 36, 0.6); border: 3px solid #ffffff; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center;">
                ${photoHtml}
            </div>
            <div class="modal-winner-name" style="font-size: 1.5rem; margin-bottom: 8px;">${w.nama || '-'}</div>
            <div class="modal-winner-nip" style="font-size: 1rem; margin-bottom: 6px;">NIP: ${w.nip || '-'}</div>
            <div class="modal-winner-unit" style="font-size: 0.92rem; color: #67e8f9;">${w.unitKerja || '-'}</div>
            <div style="font-size: 0.82rem; color: #94d2bd; margin-top: 4px;">${jabInfo}</div>
            ${achieveBadge}
        `;
        gridEl.appendChild(card);
    });

    modal.classList.add('active');
}

function closeWinnerSpotlightModal() {
    const modal = document.getElementById('modal-spotlight');
    if (modal) modal.classList.remove('active');
}

// ============================================================
// FILE UPLOAD & DROPZONE HANDLERS
// ============================================================
function initDropzones() {
    setupDropzone('dropzone-master', 'input-file-master', handleMasterFileUpload);
    setupDropzone('dropzone-nominasi', 'input-file-nominasi', handleNominasiFileUpload);
}

function setupDropzone(dropzoneId, inputId, handlerFn) {
    const dropzone = document.getElementById(dropzoneId);
    const input = document.getElementById(inputId);
    if (!dropzone || !input) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handlerFn(files[0]);
        }
    });

    input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handlerFn(e.target.files[0]);
        }
    });
}

function handleMasterFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        try {
            const rawObjects = window.CSVParser.toObjects(text);
            if (rawObjects.length === 0) {
                alert('File CSV kosong atau format tidak sesuai!');
                return;
            }

            const normalized = rawObjects.map(obj => window.CSVParser.normalizeMasterRecord(obj));
            AppState.masterPegawai = normalized;
            reEvaluateNominasiMatches();
            saveToStorage();
            renderMasterTable();
            renderNominasiTable();
            updateStatusBar();

            if (window.P2PSync && window.P2PSync.isConnected) {
                window.P2PSync.broadcastCurrentData('MASTER');
            }

            alert(`✅ Berhasil mengunggah ${normalized.length} data ke Database Pegawai Master!`);
        } catch (err) {
            alert('Gagal memproses file CSV: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function handleNominasiFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        try {
            const rawObjects = window.CSVParser.toObjects(text);
            if (rawObjects.length === 0) {
                alert('File CSV kosong atau format tidak sesuai!');
                return;
            }

            const rawNormalized = rawObjects.map(obj => window.CSVParser.normalizeNominasiRecord(obj));
            const enriched = enrichNominasiList(rawNormalized);
            AppState.nominasi = enriched;
            saveToStorage();
            renderNominasiTable();
            updateStatusBar();

            if (window.P2PSync && window.P2PSync.isConnected) {
                window.P2PSync.broadcastCurrentData('NOMINASI');
            }

            const matchCount = enriched.filter(n => n.isMatched).length;
            alert(`✅ Berhasil mengunggah ${enriched.length} peserta nominasi!\n(${matchCount} data cocok dengan Database Master)`);
        } catch (err) {
            alert('Gagal memproses file CSV: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// ============================================================
// DEMO DATA LOADER (SATU KLIK UNTUK TESTING)
// ============================================================
function loadDemoMaster() {
    const demoCsv = `"id";"peg_id";"unor_id";"jabatan_id";"orang_id";"nip";"nama";"lvl";"unor";"opd_id";"opd";"tmtjabatan";"jabatan";"is_plt";"pos";"induk_id";"panggol_id";"tmtpanggol";"pangkat";"gol";"jnskelamin";"tmptlahir";"tgllahir";"agama";"kls";"eselon_id";"gender";"foto_kecil";"foto_full";"jft";"struktural";"nama_eselon";"kec";"kepulauan";"jenis_pegawai";"usia";"bup";"usia_pensiun";"jenjangpend_id";"tgllulus";"jurusan";"namasekolah";"jenjang_pendidikan";"glrdpn";"glrblkng";"is_tenagakesehatan";"is_plh";"plhberakhir";"tmtcpns";"tmtpn"
"1";"101";"201";"301";"401";"198501152010011005";"Ahmad Fauzi";"3";"Bidang Pengadaan & Informasi";"501";"Badan Kepegawaian dan PSDM";"2020-01-02";"Pranata Komputer Ahli Muda";"0";"1";"0";"12";"2021-04-01";"Penata";"III/c";"L";"Jakarta";"1985-01-15";"Islam";"9";"0";"Laki-laki";"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80";"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80";"1";"0";"-";"Kecamatan Pusat";"0";"PNS";"41";"58";"58";"6";"2008-08-10";"Teknik Informatika";"Institut Teknologi Sepuluh Nopember";"S-1";"";"S.Kom";"0";"0";"";"2010-01-01";"2011-03-01"
"2";"102";"202";"302";"402";"199003222014022003";"Siti Rahmawati";"3";"Bidang Mutasi & Promosi";"501";"Badan Kepegawaian dan PSDM";"2021-06-15";"Analis SDM Aparatur Muda";"0";"1";"0";"11";"2022-04-01";"Penata Muda Tingkat I";"III/b";"P";"Surabaya";"1990-03-22";"Islam";"8";"0";"Perempuan";"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80";"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80";"1";"0";"-";"Kecamatan Timur";"0";"PNS";"36";"58";"58";"6";"2012-07-20";"Administrasi Publik";"Universitas Brawijaya";"S-1";"";"S.AP";"0";"0";"";"2014-02-01";"2015-05-01"
"3";"103";"203";"303";"403";"198711092009021004";"Dedi Hermawan";"2";"Bidang Pengembangan Karir";"501";"Badan Kepegawaian dan PSDM";"2019-11-01";"Kepala Bidang Pengembangan Karir";"0";"1";"0";"13";"2020-10-01";"Penata Tingkat I";"III/d";"L";"Bandung";"1987-11-09";"Islam";"11";"3";"Laki-laki";"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80";"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80";"0";"1";"Administrator";"Kecamatan Barat";"0";"PNS";"39";"58";"58";"7";"2016-09-15";"Ilmu Pemerintahan";"IPDN";"S-2";"";"S.STP, M.Tr.IP";"0";"0";"";"2009-02-01";"2010-12-01"
"4";"104";"204";"304";"404";"199208172015032001";"Ratna Dewi";"4";"Sekretariat";"501";"Badan Kepegawaian dan PSDM";"2022-01-10";"Pengadministrasi Kepegawaian";"0";"1";"0";"9";"2023-04-01";"Penata Muda";"III/a";"P";"Semarang";"1992-08-17";"Islam";"7";"0";"Perempuan";"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";"0";"0";"-";"Kecamatan Utara";"0";"PNS";"34";"58";"58";"6";"2014-06-25";"Sosiologi";"Universitas Diponegoro";"S-1";"";"S.Sos";"0";"0";"";"2015-03-01";"2016-08-01"
"5";"105";"205";"305";"405";"198604052008011006";"Budi Santoso";"3";"Bidang Perencanaan Makro";"502";"Bappeda Litbang";"2018-04-01";"Perencana Ahli Muda";"0";"1";"0";"12";"2021-10-01";"Penata";"III/c";"L";"Yogyakarta";"1986-04-05";"Islam";"9";"0";"Laki-laki";"https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80";"https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=500&auto=format&fit=crop&q=80";"1";"0";"-";"Kecamatan Selatan";"0";"PNS";"40";"58";"58";"6";"2007-11-18";"Ekonomi Pembangunan";"Universitas Gadjah Mada";"S-1";"";"S.E";"0";"0";"";"2008-01-01";"2009-04-01"
"6";"106";"206";"306";"406";"198902182012012004";"Nurul Hidayati";"3";"Bidang Pencegahan Penyakit";"503";"Dinas Kesehatan";"2020-03-01";"Epidemiolog Kesehatan Ahli Pertama";"0";"1";"0";"11";"2022-10-01";"Penata Muda Tingkat I";"III/b";"P";"Malang";"1989-02-18";"Islam";"8";"0";"Perempuan";"https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80";"https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80";"1";"0";"-";"Kecamatan Pusat";"0";"PNS";"37";"58";"58";"6";"2011-08-30";"Biologi Sains";"Universitas Airlangga";"S-1";"";"S.Si";"1";"0";"";"2012-01-01";"2013-06-01"
"7";"107";"207";"307";"407";"199407252019031002";"Fajar Pratama";"4";"Bidang Layanan e-Government";"504";"Dinas Komunikasi & Informatika";"2022-07-01";"Pranata Komputer Pertama";"0";"1";"0";"9";"2023-10-01";"Penata Muda";"III/a";"L";"Surakarta";"1994-07-25";"Islam";"7";"0";"Laki-laki";"https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80";"https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&auto=format&fit=crop&q=80";"1";"0";"-";"Kecamatan Timur";"0";"PNS";"32";"58";"58";"6";"2018-05-12";"Teknologi Rekayasa Komputer";"Politeknik Elektronika Negeri Surabaya";"D-IV";"";"S.Tr.Kom";"0";"0";"";"2019-03-01";"2020-09-01"
"8";"108";"208";"308";"408";"198812102011012007";"Tri Wulandari";"3";"SMP Negeri 1";"505";"Dinas Pendidikan & Kebudayaan";"2017-01-01";"Guru Madya Matematika";"0";"1";"0";"13";"2021-04-01";"Penata Tingkat I";"III/d";"P";"Cirebon";"1988-12-10";"Islam";"10";"0";"Perempuan";"https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80";"https://images.unsplash.com/photo-1580489944761-15a19d654956?w=500&auto=format&fit=crop&q=80";"1";"0";"-";"Kecamatan Barat";"0";"PNS";"38";"60";"60";"6";"2010-06-18";"Pendidikan Matematika";"Universitas Negeri Semarang";"S-1";"";"S.Pd";"0";"0";"";"2011-01-01";"2012-04-01"
"9";"109";"209";"309";"409";"199105032014031003";"Eko Prasetyo";"3";"Inspektur Pembantu Wilayah II";"506";"Inspektorat Daerah";"2019-08-15";"Auditor Ahli Pertama";"0";"1";"0";"11";"2022-04-01";"Penata Muda Tingkat I";"III/b";"L";"Semarang";"1991-05-03";"Islam";"8";"0";"Laki-laki";"https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80";"https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=80";"1";"0";"-";"Kecamatan Utara";"0";"PNS";"35";"58";"58";"6";"2013-09-14";"Ilmu Hukum";"Universitas Diponegoro";"S-1";"";"S.H";"0";"0";"";"2014-03-01";"2015-08-01"
"10";"110";"210";"310";"410";"198309192007011002";"Bambang Sudarsono";"1";"Pimpinan Badan";"501";"Badan Kepegawaian dan PSDM";"2021-03-01";"Kepala Badan Kepegawaian & PSDM";"0";"1";"0";"15";"2020-04-01";"Pembina Utama Muda";"IV/c";"L";"Solo";"1983-09-19";"Islam";"14";"2";"Laki-laki";"https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80";"https://images.unsplash.com/photo-1560250097-0b93528c311a?w=500&auto=format&fit=crop&q=80";"0";"1";"Pimpinan Tinggi Pratama";"Kecamatan Pusat";"0";"PNS";"43";"60";"60";"8";"2015-12-20";"Manajemen Kebijakan Publik";"Universitas Indonesia";"S-3";"Dr.";"M.Si";"0";"0";"";"2007-01-01";"2008-05-01"`;

    const rawObjects = window.CSVParser.toObjects(demoCsv);
    AppState.masterPegawai = rawObjects.map(obj => window.CSVParser.normalizeMasterRecord(obj));
    reEvaluateNominasiMatches();
    saveToStorage();
    renderMasterTable();
    renderNominasiTable();
    updateStatusBar();
    alert('✅ Berhasil memuat 10 data contoh Pegawai Master (Struktur 50 Kolom Semicolon)!');
}

function loadDemoNominasi() {
    const demoCsv = `"employee_nip","day","unit_id","steps","calories","updated_at"
"198501152010011005","28","501","12450","620","2026-11-20 18:30:15"
"199003222014022003","28","501","15820","790","2026-11-20 19:10:04"
"198711092009021004","28","501","10100","510","2026-11-20 17:45:22"
"199208172015032001","28","501","13200","660","2026-11-20 20:05:40"
"198604052008011006","28","502","16400","820","2026-11-20 18:55:12"
"198902182012012004","28","503","18900","945","2026-11-20 20:15:33"
"199407252019031002","28","504","11750","585","2026-11-20 19:40:50"
"198812102011012007","28","505","14300","715","2026-11-20 18:20:10"
"199105032014031003","28","506","10900","545","2026-11-20 17:35:05"
"198309192007011002","28","501","17500","875","2026-11-20 20:50:00"`;

    const rawObjects = window.CSVParser.toObjects(demoCsv);
    const normalized = rawObjects.map(obj => window.CSVParser.normalizeNominasiRecord(obj));
    AppState.nominasi = enrichNominasiList(normalized);
    saveToStorage();
    renderNominasiTable();
    updateStatusBar();
    alert('✅ Berhasil memuat 10 data contoh Nominasi ASN SEHATI (Format Langkah & Kalori)!');
}

function clearMasterData() {
    if (!confirm('Apakah Anda yakin ingin mengosongkan Database Pegawai Master?')) return;
    AppState.masterPegawai = [];
    reEvaluateNominasiMatches();
    saveToStorage();
    renderAllViews();

    // Siarkan ke tab lain di komputer yang sama
    if (window.SehatiBroadcast) {
        try { window.SehatiBroadcast.postMessage({ type: 'CLEAR_MASTER' }); } catch (e) {}
    }

    // Siarkan ke Laptop 1 (Panggung) via WebRTC P2P
    if (window.P2PSync && window.P2PSync.isConnected && window.P2PSync.connection) {
        try {
            window.P2PSync.connection.send({ type: 'CLEAR_MASTER' });
        } catch (e) {
            console.warn('Gagal broadcast CLEAR_MASTER:', e);
        }
    }
}

function clearNominasiData() {
    if (!confirm('Apakah Anda yakin ingin mengosongkan Data Nominasi Undian?')) return;
    AppState.nominasi = [];
    saveToStorage();
    renderAllViews();

    // Siarkan ke tab lain di komputer yang sama
    if (window.SehatiBroadcast) {
        try { window.SehatiBroadcast.postMessage({ type: 'CLEAR_NOMINASI' }); } catch (e) {}
    }

    // Siarkan ke Laptop 1 (Panggung) via WebRTC P2P
    if (window.P2PSync && window.P2PSync.isConnected && window.P2PSync.connection) {
        try {
            window.P2PSync.connection.send({ type: 'CLEAR_NOMINASI' });
        } catch (e) {
            console.warn('Gagal broadcast CLEAR_NOMINASI:', e);
        }
    }
}

// ============================================================
// SETTINGS TAB RENDER & HANDLER
// ============================================================
function renderSettingsTab() {
    const inputDrawCount = document.getElementById('setting-draw-count');
    const inputPrizeName = document.getElementById('setting-prize-name');
    const toggleExclude = document.getElementById('setting-exclude-previous');
    const toggleSound = document.getElementById('setting-sound');
    const selectSource = document.getElementById('setting-data-source');

    if (inputDrawCount) inputDrawCount.value = AppState.settings.drawCount;
    if (inputPrizeName) inputPrizeName.value = AppState.settings.prizeName;
    const selectDuration = document.getElementById('setting-roll-duration');
    if (selectDuration) selectDuration.value = AppState.settings.rollDuration || 7000;
    if (toggleExclude) toggleExclude.checked = AppState.settings.excludePreviousWinners !== false;
    if (toggleSound) toggleSound.checked = AppState.settings.soundEnabled;
    if (selectSource) selectSource.value = AppState.settings.dataSource;

    // Sinkronkan input cepat di Stage Bar
    const quickPrize = document.getElementById('quick-prize-input');
    if (quickPrize) quickPrize.value = AppState.settings.prizeName;

    const stagePrizeBadge = document.getElementById('stage-prize-name-display');
    if (stagePrizeBadge) stagePrizeBadge.textContent = AppState.settings.prizeName;
}

function saveSettingsFromUI() {
    const inputDrawCount = document.getElementById('setting-draw-count');
    const inputPrizeName = document.getElementById('setting-prize-name');
    const toggleExclude = document.getElementById('setting-exclude-previous');
    const toggleSound = document.getElementById('setting-sound');
    const selectSource = document.getElementById('setting-data-source');

    if (inputDrawCount) {
        let val = parseInt(inputDrawCount.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 10) val = 10;
        AppState.settings.drawCount = val;
    }

    if (inputPrizeName) AppState.settings.prizeName = inputPrizeName.value || 'Hadiah Putaran';
    if (toggleExclude) AppState.settings.excludePreviousWinners = toggleExclude.checked;
    if (toggleSound) AppState.settings.soundEnabled = toggleSound.checked;
    const selectDuration = document.getElementById('setting-roll-duration');
    if (selectDuration) AppState.settings.rollDuration = parseInt(selectDuration.value) || 7000;
    if (selectSource) AppState.settings.dataSource = selectSource.value;

    if (window.soundEffects) {
        window.soundEffects.setEnabled(AppState.settings.soundEnabled);
    }

    saveToStorage();
    renderAllViews();
    alert('Pengaturan berhasil disimpan!');
}

// ============================================================
// EVENT LISTENERS & NAVIGATION
// ============================================================
function initEventListeners() {
    // Nav Tab Switching
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });

            const activeTabContent = document.getElementById(targetTab);
            if (activeTabContent) activeTabContent.classList.add('active');

            // Kunci scroll pada panggung undian, aktifkan scroll pada tab manajemen
            if (targetTab === 'tab-stage') {
                document.body.classList.add('stage-active');
            } else {
                document.body.classList.remove('stage-active');
            }
        });
    });

    // Keyboard Shortcuts: H atau M untuk Toggle Hide/Show Menu, Spasi/Enter untuk Undi
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        if (e.key === 'h' || e.key === 'H' || e.key === 'm' || e.key === 'M') {
            toggleMenuVisibility();
        } else if (e.key === ' ' || e.key === 'Enter') {
            const stageTab = document.getElementById('tab-stage');
            if (stageTab && stageTab.classList.contains('active') && !AppState.isRolling) {
                e.preventDefault();
                startDraw();
            }
        }
    });

    // Quick Prize Name sync
    const quickPrize = document.getElementById('quick-prize-input');
    if (quickPrize) {
        quickPrize.addEventListener('input', (e) => {
            AppState.settings.prizeName = e.target.value;
            const stagePrizeBadge = document.getElementById('stage-prize-name-display');
            if (stagePrizeBadge) stagePrizeBadge.textContent = e.target.value;
            saveToStorage();
        });
    }

    // Sound toggle button in header
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            AppState.settings.soundEnabled = !AppState.settings.soundEnabled;
            if (window.soundEffects) window.soundEffects.setEnabled(AppState.settings.soundEnabled);
            saveToStorage();
            updateSoundIcon();
        });
    }

    // Fullscreen toggle
    const fullscreenBtn = document.getElementById('btn-toggle-fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    // Search filters
    const searchMaster = document.getElementById('search-master');
    if (searchMaster) {
        searchMaster.addEventListener('input', (e) => renderMasterTable(e.target.value));
    }

    const searchNominasi = document.getElementById('search-nominasi');
    if (searchNominasi) {
        searchNominasi.addEventListener('input', (e) => renderNominasiTable(e.target.value));
    }
}

function updateSoundIcon() {
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (!soundBtn) return;
    if (AppState.settings.soundEnabled) {
        soundBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
        soundBtn.title = "Suara Aktif (Klik untuk Mematikan)";
    } else {
        soundBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
        soundBtn.title = "Suara Nonaktif (Klik untuk Menyalakan)";
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// ============================================================
// MODAL SINKRONISASI 2 LAPTOP (P2P REAL-TIME)
// ============================================================
function openSyncModal() {
    const modal = document.getElementById('modal-p2p-sync');
    if (modal) modal.classList.add('active');
}

function closeSyncModal() {
    const modal = document.getElementById('modal-p2p-sync');
    if (modal) modal.classList.remove('active');
}

// ============================================================
// RESET SEMUA STATUS UNDIAN (KEMBALI KE PUTARAN 1)
// ============================================================
function resetAllStatus(silent = false) {
    if (!silent) {
        const confirmReset = confirm(
            "⚠️ KONFIRMASI RESET SEMUA STATUS UNDIAN\n\n" +
            "Apakah Anda yakin ingin me-reset seluruh status pengundian?\n\n" +
            "• Seluruh riwayat pemenang akan dikosongkan (pemenang bisa diundi lagi).\n" +
            "• Kategori hadiah kembali ke hadiah pertama (Sepeda Listrik).\n" +
            "• Panggung undian kembali ke status Standby awal.\n" +
            "• (Database Pegawai & Nominasi TETAP AMAN tersimpan).\n\n" +
            "Lanjutkan reset status?"
        );
        if (!confirmReset) return;
    }

    // 1. Kosongkan riwayat pemenang
    AppState.winnersHistory = [];
    AppState.isRolling = false;
    AppState.currentRoundWinners = [];

    // 2. Reset status hadiah ke hadiah pertama (Sepeda Listrik)
    AppState.selectedPrizeId = (AppState.prizes && AppState.prizes[0]) ? AppState.prizes[0].id : 1;
    AppState.settings.prizeName = (AppState.prizes && AppState.prizes[0]) ? AppState.prizes[0].name : 'Sepeda Listrik';

    // 3. Sembunyikan prompt next prize & tombol spotlight
    const promptEl = document.getElementById('next-prize-prompt');
    const spotlightBtn = document.getElementById('btn-show-spotlight');
    const drawBtn = document.getElementById('btn-start-draw');
    if (promptEl) promptEl.style.display = 'none';
    if (spotlightBtn) spotlightBtn.style.display = 'none';
    if (drawBtn) drawBtn.disabled = false;

    // 4. Render ulang seluruh komponen panggung
    renderSlotPlaceholders(1);
    renderPrizeCards();
    updateDrawButtonLabel();
    updateStatusBar();
    renderHistoryTab();
    renderSettingsTab();

    // 5. Simpan ke IndexedDB & LocalStorage
    saveToStorage();

    // 6. Jika P2P terhubung, sinkronkan reset ke laptop pasangan
    if (!silent && window.P2PSync && window.P2PSync.isConnected && window.P2PSync.connection) {
        try {
            window.P2PSync.connection.send({ type: 'RESET_STATUS' });
        } catch (e) {}
    }

    if (!silent) {
        if (window.P2PSync && typeof window.P2PSync.showToast === 'function') {
            window.P2PSync.showToast('✅ Seluruh status undian berhasil di-reset ke awal!');
        } else {
            alert('✅ Seluruh status undian berhasil di-reset ke awal!');
        }
    }
}

// ============================================================
// EKSPOR GLOBAL KE WINDOW UNTUK SINKRONISASI REAL-TIME
// ============================================================
window.renderAllViews = renderAllViews;
window.reEvaluateNominasiMatches = reEvaluateNominasiMatches;
window.saveToStorage = saveToStorage;
window.updateStatusBar = updateStatusBar;
window.renderPrizeCards = renderPrizeCards;
window.renderNominasiTable = renderNominasiTable;
window.renderMasterTable = renderMasterTable;
window.resetAllStatus = resetAllStatus;
window.loadFromLocalStorageSync = loadFromLocalStorageSync;
window.getEligiblePool = getEligiblePool;

// Sinkronisasi otomatis antar-tab dalam satu laptop/browser tanpa refresh
window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEYS.MASTER || e.key === STORAGE_KEYS.NOMINASI || e.key === STORAGE_KEYS.WINNERS || e.key === STORAGE_KEYS.SETTINGS) {
        console.log('[MULTI-TAB AUTO-SYNC] Terdeteksi perubahan data dari tab lain:', e.key);
        loadFromLocalStorageSync();
        renderAllViews();
    }
});

// Kanal sinkronisasi instan antar-tab / multi-jendela di komputer yang sama (Chrome, Edge, Firefox)
if (typeof BroadcastChannel !== 'undefined') {
    window.SehatiBroadcast = new BroadcastChannel('SEHATI_LIVE_CHANNEL');
    window.SehatiBroadcast.onmessage = async (event) => {
        if (!event.data) return;
        if (event.data.type === 'CLEAR_MASTER') {
            console.log('[BROADCAST-CHANNEL] Pengosongan Database Master dari jendela lain');
            AppState.masterPegawai = [];
            reEvaluateNominasiMatches();
            renderAllViews();
        } else if (event.data.type === 'CLEAR_NOMINASI') {
            console.log('[BROADCAST-CHANNEL] Pengosongan Data Nominasi dari jendela lain');
            AppState.nominasi = [];
            renderAllViews();
        } else if (event.data.type === 'LOCAL_DATA_CHANGED') {
            console.log('[BROADCAST-CHANNEL] Menerima pembaruan data dari jendela lain!');
            if (window.AppDB && window.AppDB.isReady) {
                await hydrateFromIndexedDB(true);
            } else {
                loadFromLocalStorageSync();
                renderAllViews();
            }
        }
    };
}
