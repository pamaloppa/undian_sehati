/**
 * P2P Real-Time Sync Engine - ASN SEHATI BKPSDM
 * 100% Murni HTML5 + JavaScript (WebRTC via PeerJS)
 * TANPA PHP, TANPA DATABASE SERVER, Bekerja di Semua Hosting Statis
 * 
 * Laptop 1 (Panggung): Menerima update data secara instan di layar
 * Laptop 2 (Admin)   : Mengunggah CSV sewaktu-waktu & mengirimkan ke Laptop 1
 */

window.P2PSync = {
    peer: null,
    connection: null,
    role: 'none', // 'stage' | 'admin' | 'none'
    roomId: 'SEHATI-BKPSDM',
    isConnected: false,

    /**
     * Inisialisasi awal
     */
    init: function() {
        const savedRoom = localStorage.getItem('SEHATI_P2P_ROOM');
        if (savedRoom) this.roomId = savedRoom;

        const savedRole = localStorage.getItem('SEHATI_P2P_ROLE');
        // Secara default (atau jika bukan admin), langsung aktifkan penerima Panggung
        if (savedRole !== 'admin') {
            this.startAsStage(this.roomId, false);
        }
    },

    /**
     * Mode Laptop 1: Layar Panggung (Penerima Data)
     */
    startAsStage: function(customRoomId = 'SEHATI-BKPSDM', showFeedback = true) {
        this.role = 'stage';
        this.roomId = (customRoomId || 'SEHATI-BKPSDM').trim().toUpperCase();
        localStorage.setItem('SEHATI_P2P_ROOM', this.roomId);
        localStorage.setItem('SEHATI_P2P_ROLE', 'stage');

        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
        }

        const peerId = 'SEHATI_' + this.roomId.replace(/[^A-Z0-9]/g, '');

        try {
            this.peer = new Peer(peerId, {
                debug: 1
            });

            this.peer.on('open', (id) => {
                this.updateUiStatus('waiting', `📡 Layar Panggung Aktif. Menunggu sambungan dari Laptop Panitia (Kode: ${this.roomId})`);
                if (showFeedback) {
                    alert(`✅ Mode Panggung Aktif!\n\nKode Sambungan: ${this.roomId}\n\nDi Laptop 2 (Panitia), buka web ini dan masukkan kode tersebut untuk menghubungkan.`);
                }
            });

            this.peer.on('connection', (conn) => {
                this.connection = conn;
                this.setupStageDataChannel(conn);
            });

            this.peer.on('error', (err) => {
                console.warn('P2P Error:', err);
                if (err.type === 'unavailable-id') {
                    this.updateUiStatus('connected', `📡 Layar Panggung tersambung (ID: ${this.roomId})`);
                } else {
                    this.updateUiStatus('error', `Koneksi P2P: ${err.message || err.type}`);
                }
            });

        } catch (err) {
            console.error('Gagal memulai PeerJS:', err);
            this.updateUiStatus('error', 'Gagal memuat WebRTC P2P');
        }
    },

    /**
     * Handler penerimaan data di Laptop 1 (Panggung)
     */
    setupStageDataChannel: function(conn) {
        conn.on('open', () => {
            this.isConnected = true;
            this.updateUiStatus('connected', `🟢 Laptop Panitia Terhubung Langsung! Siap menerima perubahan data.`);
            this.showToast(`🟢 Terhubung dengan Laptop Panitia!`);
            
            // Kirim konfirmasi balik ke Laptop 2
            conn.send({
                type: 'ACK_CONNECTED',
                stageName: 'Layar Utama Panggung ASN SEHATI',
                currentNominasiCount: (window.AppState && window.AppState.nominasi) ? window.AppState.nominasi.length : 0
            });
        });

        conn.on('data', (packet) => {
            if (!packet || typeof packet !== 'object') return;
            this.handleIncomingDataOnStage(packet);
        });

        conn.on('close', () => {
            this.isConnected = false;
            this.updateUiStatus('waiting', `📡 Layar Panggung Aktif (Menunggu sambungan ulang panitia)`);
            this.showToast(`⚠️ Sambungan Laptop Panitia terputus`);
        });
    },

    /**
     * Pemrosesan data yang dikirim oleh Laptop 2 ke Laptop 1
     */
    handleIncomingDataOnStage: function(packet) {
        if (!window.AppState) return;

        if (packet && packet.type === 'RESET_STATUS') {
            if (typeof window.resetAllStatus === 'function') {
                window.resetAllStatus(true);
            }
            this.showToast('🔄 Status undian di-reset oleh Laptop Panitia.');
            return;
        }

        // Jangan timpa jika panggung sedang memutar undian
        if (window.AppState.isRolling) {
            if (this.connection) {
                this.connection.send({ type: 'BUSY_ROLLING', message: 'Panggung sedang memutar undian, pembaruan ditunda.' });
            }
            return;
        }

        let updatedMsg = [];

        if (packet.masterPegawai && Array.isArray(packet.masterPegawai)) {
            window.AppState.masterPegawai = packet.masterPegawai;
            updatedMsg.push(`${packet.masterPegawai.length} Master Pegawai`);
        }

        if (packet.nominasi && Array.isArray(packet.nominasi)) {
            window.AppState.nominasi = packet.nominasi;
            updatedMsg.push(`${packet.nominasi.length} Nominasi`);
        }

        if (packet.settings && typeof packet.settings === 'object') {
            window.AppState.settings = { ...window.AppState.settings, ...packet.settings };
        }

        // Jalankan pencocokan dan perbarui UI layar panggung
        if (typeof window.reEvaluateNominasiMatches === 'function') {
            window.reEvaluateNominasiMatches();
        }
        if (typeof window.saveToStorage === 'function') {
            window.saveToStorage();
        }
        if (typeof window.renderAllViews === 'function') {
            window.renderAllViews();
        }
        // Pastikan seluruh elemen panggung ter-render seketika
        if (typeof window.updateStatusBar === 'function') window.updateStatusBar();
        if (typeof window.renderPrizeCards === 'function') window.renderPrizeCards();
        if (typeof window.renderNominasiTable === 'function') window.renderNominasiTable();
        if (typeof window.renderMasterTable === 'function') window.renderMasterTable();

        const summaryText = updatedMsg.join(' & ') || 'Data Baru';
        this.showToast(`🎉 DATA DIPERBARUI OLEH LAPTOP PANITIA!\n(${summaryText})`);

        if (this.connection) {
            this.connection.send({
                type: 'SYNC_SUCCESS',
                message: `Berhasil diperbarui di Layar Panggung (${summaryText})`
            });
        }
    },

    /**
     * Mode Laptop 2: Admin / Panitia (Pengunggah & Pengirim Data)
     */
    connectToStage: function(targetRoomId = 'SEHATI-BKPSDM') {
        this.role = 'admin';
        this.roomId = (targetRoomId || 'SEHATI-BKPSDM').trim().toUpperCase();
        localStorage.setItem('SEHATI_P2P_ROOM', this.roomId);
        localStorage.setItem('SEHATI_P2P_ROLE', 'admin');

        if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
        }

        const targetPeerId = 'SEHATI_' + this.roomId.replace(/[^A-Z0-9]/g, '');

        try {
            this.peer = new Peer({
                debug: 1
            });

            this.updateUiStatus('connecting', `Menghubungkan ke Laptop Panggung (${this.roomId})...`);

            this.peer.on('open', (myId) => {
                const conn = this.peer.connect(targetPeerId, {
                    reliable: true
                });

                this.connection = conn;

                conn.on('open', () => {
                    this.isConnected = true;
                    this.updateUiStatus('connected', `🟢 Berhasil Terhubung ke Layar Panggung (Kode: ${this.roomId})`);
                    this.showToast(`🟢 Terhubung ke Layar Panggung! Menyinkronkan data...`);

                    // Otomatis kirim data yang ada saat ini ke Layar Panggung tanpa perlu refresh
                    setTimeout(() => {
                        if (window.AppState && ((window.AppState.nominasi && window.AppState.nominasi.length > 0) || (window.AppState.masterPegawai && window.AppState.masterPegawai.length > 0))) {
                            this.broadcastCurrentData('ALL');
                        }
                    }, 400);
                });

                conn.on('data', (packet) => {
                    if (packet && packet.type === 'ACK_CONNECTED') {
                        this.showToast(`Layar Panggung terkonfirmasi (${packet.currentNominasiCount} data ada saat ini)`);
                    } else if (packet && packet.type === 'SYNC_SUCCESS') {
                        this.showToast(`✅ ${packet.message}`);
                    } else if (packet && packet.type === 'RESET_STATUS') {
                        if (typeof window.resetAllStatus === 'function') {
                            window.resetAllStatus(true);
                        }
                        this.showToast('🔄 Status undian di-reset oleh Layar Panggung.');
                    }
                });

                conn.on('close', () => {
                    this.isConnected = false;
                    this.updateUiStatus('disconnected', `Terputus dari Layar Panggung`);
                });
            });

            this.peer.on('error', (err) => {
                this.updateUiStatus('error', `Gagal menghubungkan: ${err.message || 'Pastikan Laptop 1 sudah membuka kode tersebut'}`);
            });

        } catch (err) {
            this.updateUiStatus('error', 'Gagal memuat WebRTC P2P');
        }
    },

    /**
     * Mengirimkan data saat ini dari Laptop 2 ke Laptop 1
     * Mendukung pengiriman per-kategori ('ALL', 'NOMINASI', 'MASTER')
     */
    broadcastCurrentData: function(scope = 'ALL') {
        if (!this.connection || !this.isConnected) {
            this.showToast('⚠️ Belum terhubung ke Laptop Layar Panggung. Silakan klik Sambungkan terlebih dahulu.');
            return false;
        }

        try {
            const cleanArray = (arr) => {
                if (!Array.isArray(arr)) return [];
                return arr.map(item => {
                    const copy = { ...item };
                    if (copy.raw && typeof copy.raw === 'object') {
                        copy.raw = { ...copy.raw };
                    }
                    return copy;
                });
            };

            const payload = {
                type: scope === 'NOMINASI' ? 'SYNC_NOMINASI' : (scope === 'MASTER' ? 'SYNC_MASTER' : 'SYNC_ALL'),
                timestamp: Date.now()
            };

            if (scope === 'ALL' || scope === 'MASTER') {
                payload.masterPegawai = cleanArray(window.AppState.masterPegawai);
            }
            if (scope === 'ALL' || scope === 'NOMINASI') {
                payload.nominasi = cleanArray(window.AppState.nominasi);
            }
            if (scope === 'ALL') {
                payload.settings = window.AppState.settings ? { ...window.AppState.settings } : {};
            }

            // Sanitasi objek murni untuk memastikan bebas dari referensi siklis
            const sanitized = JSON.parse(JSON.stringify(payload));
            this.connection.send(sanitized);

            let desc = [];
            if (sanitized.nominasi) desc.push(`${sanitized.nominasi.length} Nominasi`);
            if (sanitized.masterPegawai) desc.push(`${sanitized.masterPegawai.length} Master Pegawai`);
            this.showToast(`📤 Mengirim data (${desc.join(' & ') || 'Data'}) ke Panggung...`);
            return true;
        } catch (e) {
            console.error('Gagal mengirim data P2P:', e);
            this.showToast(`❌ Gagal mengirim data: ${e.message}`);
            return false;
        }
    },

    /**
     * Memperbarui label status di modal & navbar
     */
    updateUiStatus: function(state, message) {
        const dot = document.getElementById('sync-status-dot');
        const textModal = document.getElementById('p2p-status-text');
        const badgeNav = document.getElementById('nav-sync-badge');

        if (dot) {
            dot.className = `sync-dot ${state}`;
            dot.title = message;
        }

        if (badgeNav) {
            if (state === 'connected') {
                badgeNav.style.display = 'inline-block';
                badgeNav.textContent = '🟢 P2P Terhubung';
            } else if (state === 'waiting') {
                badgeNav.style.display = 'inline-block';
                badgeNav.textContent = '📡 Panggung Standby';
            } else {
                badgeNav.style.display = 'none';
            }
        }

        if (textModal) {
            textModal.textContent = message;
            textModal.style.color = state === 'connected' ? '#10b981' : (state === 'error' ? '#ef4444' : '#67e8f9');
        }
    },

    /**
     * Notifikasi Toast visual di layar
     */
    showToast: function(message) {
        let toast = document.getElementById('p2p-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'p2p-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 30px;
                right: 30px;
                background: linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(15, 23, 42, 0.95));
                border: 2px solid #fbbf24;
                color: #ffffff;
                padding: 14px 22px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(251, 191, 36, 0.4);
                font-size: 0.95rem;
                font-weight: 600;
                z-index: 999999;
                max-width: 420px;
                white-space: pre-line;
                transform: translateY(100px);
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';

        setTimeout(() => {
            toast.style.transform = 'translateY(100px)';
            toast.style.opacity = '0';
        }, 5000);
    }
};

// Inisialisasi otomatis setelah DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.P2PSync.init());
} else {
    window.P2PSync.init();
}
