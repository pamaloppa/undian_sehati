# Aplikasi Undian Berkah ASN SEHATI — BKPSDM

Aplikasi sistem pengundian (*lucky draw / doorprize*) berbasis **HTML5 murni, CSS3 modern, dan JavaScript vanilla**. Dirancang khusus sesuai identitas visual **Logo Resmi ASN SEHATI** (Palet warna *Emerald-Cyan Liquid Glass*, aksen Kuda Terbang Pegasus Emas 3D, serta motif denyut nadi *Heartbeat Pulse Line*).

---

## 🌟 Fitur Utama & Mode Panggung 1 Layar Penuh

1. **Tampilan Fit 1 Layar Penuh (100vh Zero-Scroll)**:
   - Dirancang khusus agar **pas 1 layar monitor / proyektor / videotron** tanpa ada *scrolling* halaman ke bawah.
   - **Fitur Sembunyikan Menu (*Hide Menu*)**:
     - Klik tombol mata / sembunyikan menu di pojok kanan atas navbar untuk menyembunyikan menu dan bilah statistik sehingga panggung undian membesar 100% mengisi layar.
     - Tombol melayang (*floating button*) **`[ ☰ Tampilkan Menu ]`** siap diklik kapan saja untuk memunculkan kembali menu navigasi.
     - **Pintasan Keyboard (*Shortcut*)**: Tekan tombol **`H`** atau **`M`** pada keyboard untuk menyembunyikan/menampilkan menu seketika. Tekan **Spasi / Enter** untuk memutar undian!

2. **5 Kategori Hadiah Utama (1 Pemenang per Hadiah - Bergantian)**:
   - ⚡🚲 **Sepeda Listrik**
   - 🚲 **Sepeda Lipat**
   - ❄️ **Kulkas 2 Pintu**
   - 📺 **TV 32 Inch**
   - 🫧 **Mesin Cuci**
   - Kartu hadiah horizontal yang interaktif: setiap hadiah diundi 1 orang pemenang secara bergantian.
   - Begitu pengundian selesai, kartu hadiah langsung bertanda centang **`✓ Selesai Diundi`** dan muncul tombol pintar: **`[ Lanjut ke Hadiah Berikutnya 👉 ]`**.

3. **Slot Pemenang Utama Megah di Tengah Panggung**:
   - Satu kartu pemenang besar dengan animasi putaran reel berkecepatan tinggi, efek blur, avatar inisial emas, NIP, serta Unit Kerja ASN.
   - Efek suara drumroll dan fanfare kemenangan (Web Audio API) yang bekerja 100% offline.
   - Ledakan konfeti partikel emas, cyan, dan zamrud.

4. **Dua Tingkat Data Terpisah (Master Pegawai & Nominasi)**:
   - **Database Pegawai Master**: Menyimpan seluruh data ASN (NIP, Nama, Unit Kerja, Jabatan).
   - **Data Nominasi Undian**: Diunggah terpisah berisi peserta yang berhak ikut undian tertentu.
   - **Pencocokan Otomatis (*Auto-Enrichment*)**: Sistem secara cerdas mencocokkan NIP dari file nominasi dengan Database Master.
   - Tab Database dan Nominasi tetap dapat di-*scroll* secara normal untuk menampung ribuan baris data pegawai.

5. **Laporan & Berita Acara Siap Cetak**:
   - Dilengkapi logo resmi ASN SEHATI, pengelompokan pemenang per kategori hadiah, serta kolom tanda tangan Saksi I, Saksi II, dan Ketua Panitia Undian.
   - Ekspor data ke format CSV / Excel sekali klik.
---

## 🌟 Fitur Utama

1. **Panggung Undian Megah (5 Pemenang Sekaligus)**
   - 5 slot kartu animasi berputar (*slot machine reel effect*) dengan penguncian berurutan (*sequential reveal: 1 per 1*) untuk membangun ketegangan (*suspense*).
   - Efek suara sintetis interaktif (Web Audio API): suara putaran cepat, ketukan kunci pemenang (*thud & chime*), dan kembang api fanfare kemenangan. Bekerja 100% offline tanpa perlu file MP3 eksternal.
   - Efek ledakan konfeti partikel emas panggung (*canvas confetti*).
   - Panggung Spotlight Modal untuk penyerahan hadiah & sesi foto pemenang.
   - Tombol *Layar Penuh (Fullscreen)* untuk proyektor / LED videotron panggung.

2. **Dua Tingkat Data Terpisah (Master Pegawai & Nominasi)**
   - **Database Pegawai Master**: Menyimpan seluruh data ASN / Pegawai (NIP, Nama, Unit Kerja, Jabatan).
   - **Data Nominasi Undian**: Diunggah terpisah berisi peserta yang berhak ikut undian tertentu.
   - **Pencocokan Otomatis (*Auto-Enrichment*)**: Sistem secara cerdas mencocokkan NIP dari file nominasi dengan Database Master untuk otomatis menarik Nama, Unit Kerja, dan Jabatan lengkap.

3. **Fleksibilitas Format File CSV**
   - Mendukung format pemisah koma (`,`) maupun titik-koma (`;`) khas Microsoft Excel regional Indonesia.
   - Mampu membaca file CSV dengan teks bertanda petik ganda (`""`).
   - Fitur unggah praktis dengan *Drag and Drop* (seret & lepas) atau pilih file manual.

4. **Transparansi & Riwayat Pemenang**
   - Menggunakan algoritma acak *Fisher-Yates* diperkuat oleh `window.crypto.getRandomValues` untuk keadilan sejati (*true cryptographic fairness*).
   - Opsi proteksi: **Pemenang sebelumnya tidak diundi lagi** (dapat diaktifkan/dinonaktifkan di pengaturan).
   - Riwayat lengkap per putaran disimpan otomatis di penyimpanan lokal browser (*LocalStorage*).

5. **Laporan & Berita Acara Siap Cetak**
   - **Cetak Berita Acara Resmi**: Menghasilkan dokumen resmi bertanda tangan Saksi I, Saksi II, dan Ketua Panitia Undian.
   - **Ekspor CSV / Excel**: Unduh seluruh daftar pemenang ke dalam format CSV kapan saja.

---

## 🚀 Cara Menjalankan Aplikasi

Tidak memerlukan instalasi server khusus (Apache, Node.js, atau XAMPP). Cukup:

1. **Klik ganda file `Buka_Aplikasi_Undian.bat`** atau **klik ganda file `index.html`** di peramban (Google Chrome, Microsoft Edge, Mozilla Firefox, dll).
2. Aplikasi langsung siap digunakan!

---

## 📁 Struktur Format CSV

### 1. Database Pegawai Master (`sample_data/data_pegawai_master.csv`)
Mendukung format 50 kolom resmi kepegawaian BKPSDM (pemisah titik koma `;` atau koma `,`):
```csv
"id";"peg_id";"unor_id";"jabatan_id";"orang_id";"nip";"nama";"lvl";"unor";"opd_id";"opd";"tmtjabatan";"jabatan";"is_plt";"pos";"induk_id";"panggol_id";"tmtpanggol";"pangkat";"gol";"jnskelamin";"tmptlahir";"tgllahir";"agama";"kls";"eselon_id";"gender";"foto_kecil";"foto_full";"jft";"struktural";"nama_eselon";"kec";"kepulauan";"jenis_pegawai";"usia";"bup";"usia_pensiun";"jenjangpend_id";"tgllulus";"jurusan";"namasekolah";"jenjang_pendidikan";"glrdpn";"glrblkng";"is_tenagakesehatan";"is_plh";"plhberakhir";"tmtcpns";"tmtpn"
```
*Sistem secara otomatis merangkai:*
- Nama lengkap dengan gelar depan & gelar belakang (`glrdpn` + `nama` + `glrblkng`).
- Unit kerja informatif gabungan OPD & UNOR (`opd` — `unor`).
- Pangkat dan golongan (`pangkat / gol`).
- **Resolusi Foto Profil Otomatis (SIMPEG Plus Google Storage)**:
  Sesuai arsitektur SIMPEG Plus:
  `https://storage.googleapis.com/simpeg-plus/` + `foto_kecil` (dibersihkan dari `public/` dan base domain) + `?timestamp`.
  Jika foto belum ada atau gagal dimuat, sistem otomatis menampilkan inisial emas (*graceful fallback*) tanpa ikon gambar rusak.

### 2. Data Nominasi ASN SEHATI (`sample_data/data_nominasi.csv`)
Struktur kolom tantangan kesehatan ASN SEHATI:
```csv
"employee_nip","day","unit_id","steps","calories","updated_at"
"198501152010011005","28","501","12450","620","2026-11-20 18:30:15"
"199003222014022003","28","501","15820","790","2026-11-20 19:10:04"
"198711092009021004","28","501","10100","510","2026-11-20 17:45:22"
```
*Kolom `employee_nip` secara otomatis dipadankan dengan `nip` pada Database Master Pegawai, dan capaian tantangan (`steps` langkah & `calories` kkal) langsung ditampilkan pada kartu pemenang dan berita acara.*

---

## 📡 Sinkronisasi Real-Time 2 Laptop (100% Murni HTML/JS — Tanpa PHP)

Dirancang khusus untuk skenario acara:
- **Laptop 1 (Panggung)**: Terhubung ke Proyektor / Videotron panggung untuk memutar undian.
- **Laptop 2 (Panitia / Admin)**: Mengunggah data CSV Master Pegawai / Nominasi sewaktu-waktu jika ada perubahan peserta di lapangan.

### Cara Menghubungkan 2 Laptop:
1. Kedua laptop membuka link web undian (bisa di hosting statis gratis apa pun seperti GitHub Pages/Vercel/cPanel).
2. Klik tombol **`[ 📡 Sambung Laptop ]`** di navbar atas.
3. Di **Laptop 1 (Panggung)**: Klik **"Buka Siaran Layar Panggung"** (Kode: `SEHATI-BKPSDM`).
4. Di **Laptop 2 (Panitia)**: Klik **"Sambungkan"**. Muncul status **`🟢 Terhubung`**.
5. **Selesai!** Setiap kali Laptop 2 mengunggah CSV baru, datanya **langsung terkirim secara instan ke Layar Panggung** tanpa perlu me-refresh halaman panggung!

---

## 💾 Penyimpanan Permanen & Cadangan Offline

1. **Penyimpanan Permanen (IndexedDB)**:
   - Data pegawai dan nominasi sekali diunggah akan **terus menempel permanen** di peramban (IndexedDB dengan fallback LocalStorage).
   - Data tidak akan hilang saat komputer dimatikan, browser di-refresh, atau aplikasi ditutup.
   - Tersedia tombol **Cadangkan Database (Backup JSON)** dan **Pulihkan Cadangan (Restore)** untuk pemindahan antar-laptop jika tanpa koneksi sama sekali.

---

## 🧪 Mencoba dengan Data Contoh (1 Klik)

Pada tab **Database Pegawai** dan tab **Data Nominasi**, tersedia tombol:
- **"Gunakan Data Contoh Pegawai (Demo)"** -> Otomatis mengisi 10 pegawai master (50 kolom lengkap).
- **"Gunakan Data Contoh Nominasi (Demo)"** -> Otomatis mengisi 10 nominasi ASN SEHATI (langkah & kalori).

Setelah itu kembali ke tab **Panggung Undian** dan klik tombol **MULAI UNDI: SEPEDA LISTRIK**!
