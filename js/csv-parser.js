/**
 * CSV Parser Helper - BKPSDM ASN SEHATI
 * Disesuaikan khusus untuk struktur CSV Master Pegawai & CSV Nominasi SEHATI
 * Mendukung pemisah titik koma (;) dan koma (,) serta teks bertanda kutip ganda ("")
 */

window.CSVParser = {
    /**
     * Mendeteksi delimiter yang paling dominan di baris pertama
     */
    detectDelimiter: function(text) {
        const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
        const semicolons = (firstLine.match(/;/g) || []).length;
        const commas = (firstLine.match(/,/g) || []).length;
        const tabs = (firstLine.match(/\t/g) || []).length;

        if (semicolons > commas && semicolons > tabs) return ';';
        if (tabs > commas && tabs > semicolons) return '\t';
        return ',';
    },

    /**
     * Mem-parsing teks CSV menjadi array of rows
     */
    parse: function(text) {
        if (!text || !text.trim()) return [];

        const delimiter = this.detectDelimiter(text);
        const rows = [];
        let currentRow = [];
        let currentCell = '';
        let insideQuotes = false;

        const cleanText = text.replace(/^\uFEFF/, ''); // Hapus BOM jika ada

        for (let i = 0; i < cleanText.length; i++) {
            const char = cleanText[i];
            const nextChar = cleanText[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    // Escaped quote: "" -> "
                    currentCell += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === delimiter && !insideQuotes) {
                currentRow.push(currentCell.trim());
                currentCell = '';
            } else if ((char === '\r' || char === '\n') && !insideQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                currentRow.push(currentCell.trim());
                if (currentRow.some(cell => cell.length > 0)) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
        }

        if (currentCell.length > 0 || currentRow.length > 0) {
            currentRow.push(currentCell.trim());
            if (currentRow.some(cell => cell.length > 0)) {
                rows.push(currentRow);
            }
        }

        return rows;
    },

    /**
     * Mengubah baris CSV menjadi array of object berdasarkan header
     */
    toObjects: function(text) {
        const rawRows = this.parse(text);
        if (rawRows.length < 2) return [];

        // Bersihkan header dari tanda kutip atau spasi berlebih
        const headers = rawRows[0].map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
        const dataRows = rawRows.slice(1);

        return dataRows.map((row, index) => {
            const obj = { _rowId: index + 1 };
            headers.forEach((header, colIndex) => {
                const cellVal = row[colIndex] !== undefined ? row[colIndex].replace(/^["']|["']$/g, '').trim() : '';
                obj[header] = cellVal;
            });
            return obj;
        });
    },

    /**
     * Resolusi URL foto profil SIMPEG Plus BKPSDM:
     * Format sumber: "public/...", full URL, atau path relatif
     * Basis URL: https://storage.googleapis.com/simpeg-plus/
     */
    resolveSimpegPhotoUrl: function(fotoVal) {
        if (!fotoVal || typeof fotoVal !== 'string') return '';
        let clean = fotoVal.trim();
        if (!clean || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined' || clean === '-' || clean.includes('default-profile.png')) {
            return '';
        }

        // Jika sudah berupa data URI (base64) atau blob
        if (clean.startsWith('data:') || clean.startsWith('blob:')) {
            return clean;
        }

        // Normalisasi Windows backslash ke slash
        clean = clean.replace(/\\/g, '/');

        // Bersihkan domain storage.googleapis.com jika sudah ada
        clean = clean.replace(/https?:\/\/storage\.googleapis\.com\/simpeg-plus\/?/gi, '');

        // Bersihkan prefix public/ (mendukung awalan /, ./, atau tanpa awalan)
        clean = clean.replace(/^\.?\/?public\/?/i, '').replace(/public\//gi, '');

        // Bersihkan slash di paling depan jika masih ada
        clean = clean.replace(/^\/+/, '').trim();

        if (!clean || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined') {
            return '';
        }

        // Jika URL eksternal lain (misal https://images.unsplash.com untuk demo), biarkan utuh
        if (/^https?:\/\//i.test(clean)) {
            return clean;
        }

        // Terapkan URL resmi Google Storage SIMPEG Plus BKPSDM dengan session cache buster
        const cacheBuster = (typeof window !== 'undefined' && window.__SIMPEG_CACHE_KEY__) 
            || (typeof window !== 'undefined' ? (window.__SIMPEG_CACHE_KEY__ = Date.now()) : Date.now());

        return `https://storage.googleapis.com/simpeg-plus/${clean}?${cacheBuster}`;
    },

    /**
     * Normalisasi khusus untuk Struktur Master Pegawai BKPSDM
     */
    normalizeMasterRecord: function(rawObj) {
        const nip = String(rawObj.nip || rawObj.employee_nip || rawObj.id_pegawai || '').trim();
        const namaAsli = String(rawObj.nama || rawObj.nama_pegawai || '').trim();
        const glrdpn = String(rawObj.glrdpn || '').trim();
        const glrblkng = String(rawObj.glrblkng || '').trim();

        // Format nama lengkap dengan gelar depan & belakang
        let namaLengkap = namaAsli;
        if (glrdpn && glrdpn !== '-' && glrdpn !== 'null') {
            namaLengkap = glrdpn + ' ' + namaLengkap;
        }
        if (glrblkng && glrblkng !== '-' && glrblkng !== 'null') {
            namaLengkap = namaLengkap + ', ' + glrblkng;
        }

        const opd = String(rawObj.opd || rawObj.instansi || rawObj.skpd || '').trim();
        const unor = String(rawObj.unor || rawObj.unit_organisasi || '').trim();
        const jabatan = String(rawObj.jabatan || rawObj.nama_jabatan || '').trim();
        const pangkat = String(rawObj.pangkat || '').trim();
        const gol = String(rawObj.gol || '').trim();
        
        // Logika resmi URL foto profil SIMPEG Plus
        const rawKecil = String(rawObj.foto_kecil || '').trim();
        const rawFull = String(rawObj.foto_full || '').trim();
        const fotoKecil = this.resolveSimpegPhotoUrl(rawKecil);
        const fotoFull = this.resolveSimpegPhotoUrl(rawFull);
        const foto = fotoKecil || fotoFull || this.resolveSimpegPhotoUrl(rawObj.foto || rawObj.url_foto || rawObj.foto_pegawai || '');

        // Unit kerja yang informatif (gabungan OPD dan UNOR)
        let unitKerja = opd || 'Pemerintah Daerah';
        if (unor && unor !== opd) {
            unitKerja = `${opd} — ${unor}`;
        }

        return {
            nip: nip,
            nama: namaLengkap || namaAsli || 'Pegawai ASN',
            namaAsli: namaAsli,
            opd: opd || 'Pemerintah Daerah',
            unor: unor,
            unitKerja: unitKerja,
            jabatan: jabatan || 'Pegawai',
            pangkat: pangkat,
            gol: gol,
            pangkatGol: [pangkat, gol].filter(Boolean).join(' / '),
            foto: foto,
            foto_kecil: fotoKecil || foto,
            foto_full: fotoFull || foto,
            raw: rawObj
        };
    },

    /**
     * Normalisasi khusus untuk Struktur Nominasi ASN SEHATI:
     * "employee_nip","day","unit_id","steps","calories","updated_at"
     */
    normalizeNominasiRecord: function(rawObj) {
        const nip = String(rawObj.employee_nip || rawObj.nip || rawObj.id || '').trim();
        const steps = Number(rawObj.steps) || 0;
        const calories = Number(rawObj.calories) || 0;
        const day = String(rawObj.day || '').trim();
        const unitId = String(rawObj.unit_id || '').trim();

        // Keterangan pencapaian tantangan SEHATI
        let keteranganParts = [];
        if (steps > 0) keteranganParts.push(`🏃 ${steps.toLocaleString('id-ID')} Langkah`);
        if (calories > 0) keteranganParts.push(`🔥 ${calories.toLocaleString('id-ID')} kkal`);
        if (day) keteranganParts.push(`Hari ${day}`);

        return {
            nip: nip,
            employee_nip: nip,
            nama: rawObj.nama || `Peserta NIP: ${nip}`,
            unitKerja: rawObj.unit_id ? `Unit ID: ${rawObj.unit_id}` : 'Peserta SEHATI',
            jabatan: rawObj.jabatan || 'Peserta Tantangan Sehat',
            steps: steps,
            calories: calories,
            day: day,
            unit_id: unitId,
            keterangan: keteranganParts.join(' • ') || 'Peserta Nominasi SEHATI',
            raw: rawObj
        };
    },

    /**
     * Normalizer otomatis fleksibel
     */
    normalizeRecord: function(rawObj, type = 'auto') {
        const keys = Object.keys(rawObj);
        if (type === 'master' || keys.includes('opd') || keys.includes('glrdpn') || keys.includes('unor')) {
            return this.normalizeMasterRecord(rawObj);
        }
        if (type === 'nominasi' || keys.includes('employee_nip') || keys.includes('steps') || keys.includes('calories')) {
            return this.normalizeNominasiRecord(rawObj);
        }
        return this.normalizeMasterRecord(rawObj);
    },

    /**
     * Alias kompatibilitas
     */
    normalizeEmployeeRecord: function(rawObj, type = 'auto') {
        return this.normalizeRecord(rawObj, type);
    }
};
