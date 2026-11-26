/**
 * Database Storage Engine - ASN SEHATI BKPSDM
 * Menggunakan IndexedDB (Mesin Database Bawaan Peramban Setara SQLite)
 * 100% Permanen, Tersimpan di Komputer Klien, Tanpa Batas 5MB LocalStorage
 */

const DB_NAME = 'UNDIAN_ASN_SEHATI_DATABASE';
const DB_VERSION = 1;

window.AppDB = {
    db: null,
    isReady: false,

    /**
     * Membuka koneksi ke IndexedDB browser
     */
    init: function() {
        return new Promise((resolve) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB tidak tersedia di peramban ini. Menggunakan LocalStorage.');
                resolve(false);
                return;
            }

            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('collections')) {
                    db.createObjectStore('collections', { keyPath: 'key' });
                }
            };

            request.onsuccess = function(event) {
                window.AppDB.db = event.target.result;
                window.AppDB.isReady = true;
                resolve(true);
            };

            request.onerror = function(event) {
                console.warn('Gagal membuka IndexedDB:', event.target.error);
                resolve(false);
            };
        });
    },

    /**
     * Menyimpan data koleksi (Master, Nominasi, Riwayat)
     */
    save: function(key, data) {
        return new Promise((resolve) => {
            if (!this.db || !this.isReady) {
                // Fallback ke LocalStorage
                try {
                    localStorage.setItem('SEHATI_' + key, JSON.stringify(data));
                } catch (e) {}
                resolve(false);
                return;
            }

            try {
                const tx = this.db.transaction(['collections'], 'readwrite');
                const store = tx.objectStore('collections');
                store.put({ key: key, value: data, updatedAt: new Date().toISOString() });
                
                tx.oncomplete = function() {
                    // Simpan juga salinan ringkas di localStorage sebagai cadangan ganda
                    try {
                        localStorage.setItem('SEHATI_' + key, JSON.stringify(data));
                    } catch (e) {}
                    resolve(true);
                };

                tx.onerror = function() {
                    resolve(false);
                };
            } catch (err) {
                resolve(false);
            }
        });
    },

    /**
     * Memuat data koleksi berdasarkan kunci
     */
    load: function(key) {
        return new Promise((resolve) => {
            if (!this.db || !this.isReady) {
                try {
                    const fallback = localStorage.getItem('SEHATI_' + key);
                    resolve(fallback ? JSON.parse(fallback) : null);
                } catch (e) {
                    resolve(null);
                }
                return;
            }

            try {
                const tx = this.db.transaction(['collections'], 'readonly');
                const store = tx.objectStore('collections');
                const request = store.get(key);

                request.onsuccess = function() {
                    if (request.result && request.result.value) {
                        resolve(request.result.value);
                    } else {
                        // Cek fallback localStorage
                        try {
                            const fallback = localStorage.getItem('SEHATI_' + key);
                            resolve(fallback ? JSON.parse(fallback) : null);
                        } catch (e) {
                            resolve(null);
                        }
                    }
                };

                request.onerror = function() {
                    resolve(null);
                };
            } catch (err) {
                resolve(null);
            }
        });
    },

    /**
     * Ekspor seluruh database ke file JSON untuk cadangan aman
     */
    exportBackup: async function() {
        const master = await this.load('MASTER_PEGAWAI') || AppState.masterPegawai;
        const nominasi = await this.load('NOMINASI') || AppState.nominasi;
        const winners = await this.load('WINNERS') || AppState.winnersHistory;
        const settings = await this.load('SETTINGS') || AppState.settings;

        const backupData = {
            appName: 'Undian ASN SEHATI - BKPSDM',
            version: '2.0',
            exportedAt: new Date().toISOString(),
            masterPegawai: master,
            nominasi: nominasi,
            winnersHistory: winners,
            settings: settings
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cadangan_database_undian_asn_sehati_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    /**
     * Impor file JSON cadangan untuk memulihkan seluruh data
     */
    importBackup: function(file) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error('Tidak ada file dipilih'));

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.masterPegawai && Array.isArray(data.masterPegawai)) {
                        AppState.masterPegawai = data.masterPegawai;
                        await this.save('MASTER_PEGAWAI', data.masterPegawai);
                    }
                    if (data.nominasi && Array.isArray(data.nominasi)) {
                        AppState.nominasi = data.nominasi;
                        await this.save('NOMINASI', data.nominasi);
                    }
                    if (data.winnersHistory && Array.isArray(data.winnersHistory)) {
                        AppState.winnersHistory = data.winnersHistory;
                        await this.save('WINNERS', data.winnersHistory);
                    }
                    if (data.settings) {
                        AppState.settings = { ...AppState.settings, ...data.settings };
                        await this.save('SETTINGS', AppState.settings);
                    }

                    saveToStorage();
                    renderAllViews();
                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }
};
