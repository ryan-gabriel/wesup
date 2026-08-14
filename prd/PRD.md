# **1\. Ringkasan Arsitektur & Produk**

## **1.1 Gambaran Produk & Ruang Lingkup**

Aplikasi Wesup adalah platform pembelian kolektif (group-buying) bahan baku yang dikhususkan bagi UMKM dengan menerapkan model ambil sendiri (self-pickup). Platform ini dikembangkan sebagai proyek Fullstack Web Development Competition INSEVENT 2026 dengan subtema SDG 8\.

Tujuan & Solusi: Sistem didesain untuk mengeliminasi kerumitan logistik atau pengiriman jarak jauh (last-mile) dalam distribusi bahan baku. Platform ini juga secara struktural memitigasi sengketa fisik di lapangan (seperti komplain barang rusak/busuk) serta mencegah masalah selisih harga dan kelebihan dana (refund overage) melalui penguncian waktu dan pembayaran yang ketat.

Value Proposition: UMKM mendapatkan kepastian harga bahan baku yang lebih murah melalui sistem tier diskon berbasis volume pendaftar. Di saat bersamaan, keamanan bertransaksi bagi UMKM dan Supplier dijamin menggunakan mekanisme Escrow selama 24 jam.

Batasan Sistem (Scope MVP): Cakupan wilayah pelayanan operasional dibatasi secara ketat hanya di wilayah Bandung. Hal ini bertujuan untuk membatasi kompleksitas logistik (menghilangkan kebutuhan last-mile) dan memfasilitasi kemampuan Admin untuk melakukan verifikasi fisik (survei langsung) ke lokasi Supplier.

Asumsi Operasional: UMKM dianggap sepenuhnya menyetujui jarak dan lokasi pengambilan ketika mereka mencentang persetujuan (consent) secara eksplisit saat mendaftar. Validasi keaslian Supplier diasumsikan dapat dilakukan secara manual (kunjungan fisik) oleh Admin pada tahap MVP sebelum digantikan oleh integrasi API pemerintah dan Al di masa depan.

## 

## **1.2 Ringkasan Arsitektur Sistem**

Arsitektur Wesup didesain dengan batasan-batasan teknis yang kaku untuk memastikan integritas transaksi tanpa membebani biaya server.

* Model Titik Tunggal (Self-Pickup): Tidak ada Drop Point atau perantara logistik terpisah. Supplier berfungsi sebagai satu-satunya titik kumpul barang, dan UMKM diwajibkan datang untuk melakukan serah-terima fisik.

* Sistem Pembayaran Terkunci: Transaksi berjalan dalam jendela waktu yang kaku. Waktu pendaftaran (Order Window) ditutup secara absolut dan mengunci besaran tier diskon sebelum masa pembayaran (Payment Window) dibuka. Apabila syarat minimum tier tidak tercapai, sistem secara otomatis merujuk pada Tier 1 (Harga Dasar/Tertinggi). Hal ini memastikan harga final sudah pasti untuk diterbitkan menjadi tagihan QRIS sebelum proses transfer dana dilakukan.

* Mekanisme Escrow 24 Jam: Setelah serah-terima fisik divalidasi, sistem menahan dana di tabel Escrow selama 1x24 jam untuk memberikan waktu garansi pengecekan kondisi barang, memitigasi sengketa sebelum uang cair otomatis ke Supplier. Proses pencairan ini dieksekusi secara on-demand melalui pendekatan Lazy Evaluation saat terdapat interaksi sistem setelah durasi tersebut terlewati.

* Lazy Evaluation & API Gatekeeper: Sistem meniadakan fungsi pemantauan latar belakang (cron/scheduled job) untuk menghemat kapabilitas serverless Vercel. Status penutupan pendaftaran, sanksi No-Show, dan pencairan Escrow dihitung serta dieksekusi secara presisi (on-demand) saat kueri API dipanggil setelah melewati batas waktu. Setiap endpoint API bertindak sebagai penjaga gerbang (Gatekeeper) yang memvalidasi timestamp absolut untuk mencegah manipulasi batas waktu pembayaran atau deadlock.

## 

## **1.3 Struktur Modul Utama**

Sistem Wesup dipecah menjadi 10 modul bisnis agar arsitektur terukur dan pembagian tanggung jawab pengembangan menjadi jelas:

1. **Modul Identity & Access Management (IAM)**: Fondasi keamanan yang mengelola autentikasi berbasis role, verifikasi profil dasar (Nama, Email, No. WA), bukti foto fisik dan koordinat lokasi tempat usaha, serta data Pengaturan Rekening (Disbursement Setup) untuk pencairan dana Supplier dan pengembalian dana (refund) UMKM.

2. **Modul Catalog & Campaign**: Menangani pembuatan batch penawaran dari Supplier, pengaturan koordinat pin map yang presisi, validasi timeline absolut (waktu buka, tutup, bayar, siap), pembagian harga tier, serta recurring post yang otomatis menggeser parameter waktu absolut pada batch berikutnya berdasarkan interval waktu yang ditentukan.

3. **Modul Marketplace & Discovery**: Etalase antarmuka UMKM untuk memfilter radius lokasi, mencatat timestamp persetujuan (consent) lokasi pengambilan, dan fitur share link pemasaran.

4. **Modul Order & Batch Processing**: Sistem otomatis yang memproses pendaftaran UMKM, meningkatkan hitungan Atomic Counter untuk mencegah tabrakan data (race condition), dan mengunci harga akhir pada batas waktu (cutoff).

5. **Modul Payment**: Menangani pembuatan tagihan di dalam Payment Window yang valid, terintegrasi dengan gerbang pembayaran, dan mencakup layanan pendengar webhook untuk sinkronisasi status lunas otomatis.

6. **Modul Fulfillment & Pickup**: Fasilitator serah-terima di lapangan yang menerbitkan kode QR (dengan alternatif fallback PIN 4-digit) untuk dipindai oleh Supplier sebagai bukti barang telah diambil.

7. **Modul Escrow & Resolution**: Pengelola hitung mundur dana tertahan, eksekusi pencairan otomatis (jika aman), penghangusan dana (jika UMKM tidak datang atau No-Show), serta alur pengajuan foto sengketa barang cacat yang didukung oleh peninjauan rekam jejak persetujuan lokasi oleh Admin.

8. **Modul Moderation & Admin Panel**: Ruang kendali eksklusif Admin untuk mencatat audit log, meninjau validasi KYC fisik, melakukan aksi Takedown pada produk melanggar, serta memutus hasil sengketa (sebagai Arbiter tunggal).

9. **Modul Reputation & Penalty**: Modul kedisiplinan yang menampung rating pasca-transaksi dan skrip otomatis (sanksi progresif hingga suspend) bagi UMKM yang berulang kali gagal membayar (Hit and Run).

10. **Modul Notification**: Mesin penyebar informasi berbasis peristiwa menggunakan API WhatsApp, didukung dengan pusat pemberitahuan di dalam aplikasi (In-App Notification Center) sebagai cadangan operasional.

## 

## **1.4 Tech Stack**

| Layer | Teknologi | Peran dalam Sistem |
| :---- | :---- | :---- |
| Repository | Monorepo (single Next.js project) | Frontend & backend dalam satu codebase, satu deployment target. |
| Frontend & Backend | Next.js (App Router \+ API Routes) | UI rendering \+ business logic (batch, tier, refund, suspend, webhook listener) dalam satu framework. |
| Database & Object Storage | Supabase (PostgreSQL \+ Storage \+ Auth) | Data relasional terpusat \+ penyimpanan foto dengan fungsi kompresi gambar otomatis \+ manajemen otorisasi role-based. |
| Cache & Atomic Operation | Redis (Upstash serverless-compatible) | (1) Atomic counter untuk volume tier batch, (2) mekanisme Distributed Lock (SETNX) saat API Gatekeeper mengunci harga untuk mencegah tabrakan data (race condition) pada eksekusi konkuren, dan (3) cache progress bar tier UMKM secara real-time. |
| Payment | QRIS via Midtrans Sandbox | Gerbang pembayaran untuk pengujian menggunakan client/server key testing tanpa memerlukan dokumen legal perusahaan. |
| Notifikasi | Fonnte / WhatsApp API Trial & In-App UI | Peringatan batas waktu, pembukaan jendela pembayaran, penyebaran referal, dengan antarmuka UI pendamping sebagai cadangan (fallback) jika limitasi WA tercapai. |
| Deployment | Vercel | Hosting Next.js app; Supabase & Upstash tetap beroperasi sebagai layanan terpisah yang dihubungkan via environment variable. |

# **2\. Role dan Detail Fitur**

## **2.1 SUPPLIER (Penyedia Bahan Baku)**

Berikut adalah spesifikasi mendalam untuk fitur-fitur yang dikelola oleh role Supplier, yang dirancang untuk mendukung operasional MVP serta mengantisipasi masalah (kasus khusus) di lapangan.

## 

### **2.1.1 Registrasi & Pengaturan Akun (Identity & Access Management)**

* **Detail Fungsional & Subfitur**: Pendaftaran akun baru dengan mengisi formulir esensial (Nama Lengkap, Email, Nomor WhatsApp, Nama Usaha, Alamat Lengkap Teks, dan Pin Map lokasi usaha) serta mengunggah Foto Fisik Tempat Usaha. Dilengkapi fitur Pengaturan Rekening (Disbursement Setup) untuk penarikan dana dari sistem Escrow.

* **Kompresi Gambar Client-Side (WebP)**: Seluruh foto yang diunggah dari client (dengan batas ukuran fail mentah maksimal 10MB) wajib dikompresi dan dikonversi otomatis ke format .webp di frontend (menggunakan Canvas API / Web Worker) sebelum diunggah ke Supabase Storage agar tidak membebani komputasi backend dan storage.

* Business Rules: Akun Supplier baru berstatus Pending (tidak bisa memposting penawaran) hingga Admin melakukan validasi melalui pengecekan foto tempat usaha dan verifikasi fisik/survei lokasi pada tahap MVP.

* **Dependencies**: Membutuhkan integrasi dengan modul autentikasi Supabase Auth dan modul penyimpanan Supabase Storage.

* **Kondisi Eksekusi**: Sukses jika mendapat persetujuan (approval) Admin; Gagal secara sistem jika formulir esensial tidak lengkap atau koordinat lokasi tidak terdeteksi.

## 

### **2.1.2 Manajemen Penawaran (Catalog & Campaign)**

* **Detail Fungsional & Subfitur**: Pembuatan penawaran barang (nama, kategori, kuantitas minimum), fitur Simpan Draft, unggah foto produk (kompresi .webp di frontend maksimal 10MB). Penentuan titik kumpul dipecah menjadi input teks alamat dan Pin Peta Presisi (Maps) serta Fitur Hapus Katalog/Postingan.

* Aturan Hapus Katalog & Notifikasi:
  1. Supplier diizinkan untuk menghapus postingan katalog yang sedang aktif.
  2. Edge Case (Sudah ada pendaftar): Jika katalog dihapus saat sudah memiliki pendaftar (UMKM), sistem akan mengubah status batch menjadi CANCELLED_BY_SUPPLIER, serta memicu pengiriman Notifikasi Pembatalan Otomatis (via WhatsApp API dan In-App Notification) kepada seluruh UMKM terdaftar.
  3. Jika ada UMKM yang sudah melakukan pembayaran di Payment Window, sistem secara otomatis memasukkan transaksi tersebut ke Antrean Full Refund di Panel Admin.

* **Validasi Input**: Seluruh kolom wajib diisi (mandatory). Khusus lokasi, koordinat lintang-bujur dari Pin Peta tidak boleh kosong dan harus terdeteksi di dalam batas geografi wilayah Bandung.

* **Business Rules**: Apabila jumlah pendaftar (UMKM) sudah lebih dari 0, sistem akan mengunci (lock) form lokasi secara permanen; Supplier dilarang memindah lokasi agar komitmen jarak awal UMKM tidak dirugikan. Supplier harus membatalkan penawaran lama dan membuat baru jika ingin pindah lokasi.

* **Dependencies**: Status verifikasi akun harus sudah "Disetujui" (Approved) oleh Admin.

* **Kondisi Eksekusi**: Sukses menerbitkan ke Marketplace; Gagal mempublikasikan jika pin map kosong.

## 

### **2.1.3 Pengaturan Timeline & Tier Diskon**

* **Detail Fungsional & Subfitur**: Input parameter waktu absolut (Waktu Buka Pendaftaran, Waktu Tutup Pendaftaran, Mulai Payment Window, Durasi/Batas Akhir Payment Window, dan Estimasi Barang Ready). Input minimal 2 tingkatan (tier) harga berdasarkan pencapaian volume kumulatif, di mana Tier 1 bertindak sebagai Harga Dasar/Tertinggi apabila target minimum tier selanjutnya tidak tercapai.

* **Validasi Input**:

  * **Pencegahan Time-Travel**: Urutan waktu wajib bersifat masa depan dan linear (Buka \< Tutup \< Mulai Payment \< Batas Akhir Payment \< Ready).

  * **Pencegahan Harga Terbalik**: Validasi form akan menolak input jika harga untuk tier volume besar diatur lebih mahal daripada harga tier dasar/volume kecil.

  * **Pencegahan Tumpang Tindih (Overlap)**: Rentang kuota (volume) antar tier tidak boleh saling tumpang tindih.

* **Business Rules**: Skema tingkatan harga diskon tidak bisa diubah atau dimodifikasi di tengah siklus (lock tier) begitu pendaftar pertama bergabung.

* **Dependencies**: Terintegrasi langsung dengan fungsionalitas Manajemen Penawaran (Catalog).

* **Kondisi Eksekusi**: Gagal (submit disabled) jika urutan waktu tidak logis, harga antar tier tidak selaras, atau terdapat tumpang tindih rentang kuota.

## 

### **2.1.4 Postingan Otomatis (Recurring Management)**

* **Detail Fungsional & Subfitur**: Pengaturan penawaran yang tayang berulang secara jadwal (contoh: otomatis tiap Senin & Kamis). Dilengkapi notifikasi (H-1) pengingat ulasan (review), serta tombol konfirmasi tayang manual.

* **Validasi Input**: Wajib melakukan klik konfirmasi penyetujuan informasi sebelum penawaran diterbitkan.

* **Business Rules**:

  * Timestamp absolut untuk batch berulang (recurring) dihasilkan secara otomatis dengan menambahkan interval waktu yang telah diatur (misalnya \+7 hari) pada seluruh parameter waktu dari batch sebelumnya.

  * Untuk mencegah skenario kelalaian (harga basi atau stok kosong), jika Supplier tidak mengkonfirmasi review dalam batas waktu, sistem mengambil posisi default aman yakni menahan/membatalkan tayangan penawaran tersebut.

* **Dependencies**: Membutuhkan fungsi dasar modul Notification (Notifikasi) dan Modul Catalog.

* **Kondisi Eksekusi**: Sukses tayang otomatis jika terdapat konfirmasi manual; Batal tayang jika diabaikan.

## 

### **2.1.5 Dasbor Manajemen UMKM & Serah Terima (Fulfillment)**

* **Detail Fungsional & Subfitur:** Halaman Dasbor Pesanan (Order Management) untuk melihat daftar UMKM yang akan mengambil barang. Tersedia fitur Pemindai Kode QR UMKM, form Input Manual PIN 4-digit (sebagai cadangan/fallback operasional jika kamera kotor/sibuk), dan tombol Pembatalan Darurat (Force Majeure).

* **Validasi Input:** Pencocokan hasil pindai QR atau ketikan PIN dengan identitas pesanan di database yang berstatus Lunas.

* **Business Rules:**

  * Keberhasilan pemindaian mengubah status barang menjadi "Sudah Diambil" dan memulai argo tabel Escrow 24 jam.

  * Supplier diwajibkan secara operasional untuk bersiap melayani penukaran secara fisik selama jendela 12 jam toleransi penuh sejak waktu Estimasi Ready dimulai.

  * Jika sebelum serah-terima barang rusak (contoh: kebanjiran, gagal panen), tombol Pembatalan Darurat (Force Majeure) akan secara instan membatalkan pesanan, tidak membebani UMKM dengan status penalti No-Show, dan langsung memicu antrean proses Full Refund secara manual via Admin.

* **Dependencies:** Order UMKM harus telah dikonfirmasi oleh Webhook Payment.

* **Kondisi Eksekusi:** Sukses melakukan validasi pengambilan (timer Escrow berjalan); Gagal memindai jika QR tidak valid.

## 

### **2.1.6 Resolusi Transaksi & Pelaporan (Reputation & Escrow)**

* **Detail Fungsional & Subfitur:** Form laporan pengguna (UMKM bermasalah) yang mencakup subfitur unggah foto/tangkapan layar (screenshot) obrolan dengan batas ukuran maksimal 10MB. Pengawasan alur uang masuk ke dalam menu Pengaturan Rekening (Disbursement Setup).

* **Validasi Input:** Ekstensi fail yang diunggah wajib dalam format gambar yang diizinkan sistem serta tidak melewati batas ukuran fail mentah.

* **Business Rules:**

  * Pencairan dana (Auto-Release) ditransfer otomatis ke rekening bank secara on-demand jika durasi 1x24 jam (pasca serah-terima) berlalu tanpa tombol komplain ditekan UMKM.

  * Apabila UMKM tidak mendatangi lokasi melewati batas waktu absolut Estimasi Ready (No-Show), dana UMKM hangus secara mutlak dan diberikan sepenuhnya ke Supplier sebagai kompensasi.

  * Laporan/rating buruk (bintang 1\) yang ditujukan ke Supplier tidak memicu sanksi (auto-suspend) berbasis algoritma untuk menghindari sabotase bisnis (review bombing) antar pesaing.

* **Dependencies:** Penjadwalan bergantung pada modul penyelesaian (Fulfillment) dan parameter waktu Estimasi Ready.

* **Kondisi Eksekusi:** Sukses (Dana Cair) jika tidak ada sengketa; Tertunda jika bukti komplain UMKM masuk ke panel moderasi Admin.

## 

## **2.2 UMKM (Konsumen)**

Berikut adalah spesifikasi mendalam untuk fitur-fitur yang digunakan oleh role UMKM, dirancang untuk memastikan kelancaran pencarian, kejelasan persetujuan, dan keamanan transaksi berdasarkan evaluasi operasional lapangan.

### **2.2.1 Pencarian & Etalase (Marketplace & Discovery)**

* **Detail Fungsional & Subfitur:** Fitur pencarian barang berbasis teks dengan Fitur Debouncer (300ms–500ms) untuk menahan kueri ke backend, filter postingan berdasarkan kategori item, filter rentang harga, dan pencarian berdasarkan radius/jarak dari lokasi UMKM. Modul dilengkapi Paginasi, Empty State, dan Skeleton Loading. Terdapat fitur Bagikan Tautan (Share Link) via WhatsApp berslogan menarik menggunakan URL umum (direct link) tanpa mekanisme pelacakan referral unik.

* **Validasi Input:** Teks pencarian ditahan oleh fungsi Debounce sebelum mengeksekusi kueri API. Slider radius divalidasi dengan rate limiting untuk mencegah kelebihan beban kueri basis data.

* **Business Rules:** Sistem otomatis mengkalkulasi dan menampilkan jarak absolut beserta estimasi waktu dari lokasi UMKM ke titik kumpul Supplier secara langsung pada kartu penawaran.

* **Dependencies:** Membutuhkan data penawaran yang berstatus aktif dari Modul Catalog.

## 

### **2.2.2 Pendaftaran & Persetujuan Lokasi (Location Consent)**

* **Detail Fungsional & Subfitur:** Tampilan detail lokasi titik kumpul, tombol bergabung (Join Batch), progress bar pencapaian volume tier secara real-time, dan Checkbox Persetujuan Lokasi Pengambilan yang wajib dicentang.

* **Validasi Input:** Sistem memblokir aksi pada tombol "Daftar" (submit disabled) apabila checkbox persetujuan belum dicentang oleh UMKM.

* **Business Rules:**

  * Sistem wajib merekam timestamp saat checkbox dicentang sebagai bukti rekam jejak persetujuan absolut (Audit Trail) jika UMKM mengajukan komplain kejauhan di kemudian hari.

  * Jika pada saat waktu pendaftaran ditutup ternyata volume kumulatif tidak menyentuh syarat tier diskon manapun, pesanan UMKM tidak batal, melainkan harga akan merujuk (terkunci) pada harga dasar (Tier 1).

* **Dependencies:** Terhubung dengan Atomic Counter Redis pada sistem pemrosesan pesanan (Order) untuk pembaruan progress bar hitungan volume.

## 

### **2.2.3 Pembayaran Tagihan (Payment Window)**

* **Detail Fungsional & Subfitur:** Pembuatan tagihan final sesuai tier yang dikunci, tampilan UI Countdown sebelum masa pembayaran (yang wajib dikalkulasi menggunakan Server Timestamp dari respons API untuk mengabaikan jam lokal perangkat klien dan mencegah manipulasi), integrasi pembayaran QRIS via Midtrans Sandbox, dan fitur UI Feedback (Toast/Snackbar) sebagai bagian dari penanganan eror (Global Error Handling) jika koneksi terputus atau API gateway gagal.

* **Validasi Input:** Pengecekan timestamp API Gatekeeper untuk memastikan pembayaran tidak dapat diproses (tombol diblokir) sebelum jendela pembayaran (Payment Window) dibuka atau setelah tenggat waktu lewat.

* **Business Rules:** UMKM yang berhasil mendaftar namun melewatkan pembayaran di dalam Payment Window akan terdeteksi sebagai pelanggar Hit and Run. Sistem menjatuhkan sanksi otomatis berjenjang: Peringatan WhatsApp (Pelanggaran ke-1), Penangguhan/Suspend Akun Sementara 7 Hari (ke-2), dan Penangguhan Permanen (ke-3).

* **Dependencies:** Pembayaran menggunakan nilai invoice final absolut yang dikeluarkan oleh modul API Gatekeeper tepat pada saat waktu pendaftaran (cutoff) ditutup.

## 

### **2.2.4 Dasbor Pesanan & Serah Terima (Order Management & Fulfillment)**

* **Detail Fungsional & Subfitur:** Dasbor Riwayat Transaksi (Order Dashboard) bagi UMKM untuk memantau pesanan aktif maupun selesai. Sistem diwajibkan menampilkan status state "Menunggu Jendela Pembayaran Dibuka" selama masa jeda antara waktu tutup pendaftaran hingga jendela pembayaran aktif. Terdapat fitur penerbitan (generate) Kode QR Pengambilan dan penampilan PIN 4-digit cadangan sebagai bukti validasi serah-terima di titik kumpul. Dilengkapi dengan Pusat Notifikasi Dalam Aplikasi (In-App Notification Center) untuk memantau status pesanan jika pengiriman WhatsApp delay/gagal.

* **Validasi Input:** Kode QR dan PIN Pengambilan hanya akan diterbitkan (generate) oleh sistem jika status tagihan pada database telah dikonfirmasi valid dan lunas (paid).

* **Business Rules:** Jika UMKM tidak mendatangi lokasi hingga batas toleransi yang ditetapkan (maksimal 12 jam operasional melewati waktu Estimasi Ready) dalam Skenario No-Show, status transaksi dianggap selesai dengan sanksi: dana UMKM hangus secara penuh (100%) dan tidak dapat di-refund.

* **Dependencies:** Tergantung pada sinyal keberhasilan pembayaran dari Webhook Listener Midtrans.

## 

### **2.2.5 Komplain & Resolusi Sengketa (Escrow)**

* **Detail Fungsional & Subfitur:** Tombol laporan sengketa barang cacat/busuk (Complaint Tracking), form unggah bukti foto kondisi barang di lapangan, dan fitur Pengisian Rekening Manual untuk memfasilitasi pengembalian dana QRIS. Pengunggahan media diproses melalui modul Kompresi Gambar Otomatis (dengan batas ukuran fail maksimal 10MB) yang dikerjakan secara asinkron (non-blocking) agar tidak menghentikan proses antarmuka.

* **Validasi Input:** Pemrosesan sengketa (penahanan dana/ suspend escrow) ditolak apabila lampiran dokumen bukti foto kosong atau melewati batas ukuran maksimal.

* **Business Rules:**

  * Tombol komplain hanya dimunculkan dan dapat ditekan dengan batas tenggat waktu maksimal 1x24 jam sejak status pesanan ditandai "Sudah Diambil". Jika UMKM menyadari kecacatan pada jam ke-25, komplain ditolak permanen oleh sistem karena uang telah cair otomatis ke Supplier.

  * Formulir Pengisian Rekening Manual hanya ditampilkan kepada UMKM setelah Admin memenangkan sengketa pihak UMKM dan mengubah statusnya menjadi persetujuan Full Refund.

* **Dependencies:** Fitur ini baru terbuka setelah dipicu oleh perubahan status "Sudah Diambil" pada Modul Fulfillment.

## 

### **2.2.6 Penilaian & Ulasan (Reputation)**

* **Detail Fungsional & Subfitur:** Form pengisian peringkat Bintang (skala 1-5) dan kolom input ulasan/komentar teks opsional mengenai kualitas pelayanan Supplier.

* **Validasi Input:** Akses pengisian rating diblokir secara mutlak bagi UMKM yang transaksinya diakhiri dengan status No-Show (tidak hadir).

* **Business Rules:** Untuk mencegah tindakan sabotase reputasi (review bombing) secara prematur, kolom rating dikunci rapat dan tidak akan di-render pada UI sebelum rekam jejak pesanan memvalidasi bahwa proses serah-terima fisik (pickup) benar-benar telah rampung.

* **Dependencies:** Menunggu penyelesaian alur serah-terima fisik di Modul Fulfillment.

## 

## **2.3 ADMIN (Moderator & Arbiter)**

Berikut adalah spesifikasi mendalam untuk fitur-fitur ruang kendali eksklusif yang dioperasikan oleh role Admin, dirancang untuk menjaga kualitas, ketertiban, dan keadilan di dalam platform, dengan memperhatikan mitigasi penyalahgunaan wewenang dan limitasi teknis gateway pembayaran.

## 

### **2.3.1 Verifikasi & Antrean Supplier (Supplier Verification & Queue Management)**

* **Detail Fungsional:** Dasbor antrean peninjauan dokumen registrasi Supplier baru (nama dan email), foto lokasi, dan jawaban formulir bisnis.

* **Requirement:** Admin dapat menyetujui (Approve) atau menolak (Reject) status verifikasi Supplier.

* **Business Rules:** Dalam mode operasional MVP, Admin wajib turun langsung ke lapangan untuk melakukan pengecekan fisik lokasi usaha di Bandung. Tombol persetujuan di dasbor hanya boleh ditekan setelah survei fisik tervalidasi.

* **Validasi:** Sistem mengunci hak akses postingan Supplier hingga parameter verifikasi berubah menjadi disetujui.

* **Dependency:** Membutuhkan masukan dokumen dari Modul Identity & Access Management (IAM).

* **Exception Handling:** Jika dokumen buram atau tidak lolos validasi fisik, Admin memberikan status penolakan beserta log alasan, dan Supplier harus mengunggah ulang data.

## 

### **2.3.2 Moderasi Konten & Takedown**

* **Detail Fungsional:** Pemantauan daftar seluruh penawaran yang sedang aktif (Marketplace). Dilengkapi fitur tombol Takedown.

* **Requirement:** Admin dapat memblokir batch yang sedang berjalan jika terindikasi melanggar (barang ilegal, harga menipu, penipuan lokasi).

* **Business Rules:**

  * Aksi Takedown diwajibkan menyertakan alasan yang tercatat secara permanen di dalam sistem.

  * Tindakan Takedown pada penawaran yang sudah memiliki pendaftar akan langsung memicu penghentian transaksi dan mewajibkan alur pengembalian dana (Full Refund) kepada semua UMKM terkait.

* **Validasi:** Sistem mewajibkan kolom input teks (alasan pelanggaran) diisi sebelum eksekusi Takedown berhasil.

* **Dependency:** Terhubung langsung dengan basis data Modul Catalog dan Modul Notification.

* **Exception Handling:** Notifikasi otomatis langsung dikirimkan ke Supplier yang bersangkutan segera setelah tombol ditekan.

## 

### **2.3.3 Manajemen Pengembalian Dana (Refund Management)**

* **Detail Fungsional:** Dasbor antrean eksekusi pengembalian dana manual akibat dari aksi Takedown, pembatalan Force Majeure dari Supplier, atau sengketa komplain yang dimenangkan oleh UMKM.

* **Requirement:** Platform menyediakan formulir input Pengaturan Rekening penerima untuk UMKM yang hanya dimunculkan dan diisi oleh UMKM setelah status tiket diubah menjadi persetujuan pengembalian dana.

* **Business Rules:** Mengingat limitasi API pengembalian dana instan pada QRIS Midtrans Sandbox (yang membutuhkan penanganan di luar sistem API), pencairan Full Refund wajib diproses secara manual oleh Admin dengan mentransfer kembali dana 100% tanpa potongan ke rekening UMKM menggunakan data rekening yang telah disubmit UMKM.

* **Validasi:** Admin wajib memperbarui status tiket dari "Menunggu Refund" menjadi "Refund Selesai" dengan melampirkan konfirmasi transfer manual.

* **Dependency:** Bergantung pada tombol keputusan Arbiter di Modul Escrow atau tombol aksi di Modul Takedown.

* **Exception Handling:** Jika rekening UMKM tidak valid, Admin melakukan kontak langsung via email/WhatsApp pengguna.

### **2.3.4 Penyelesaian Sengketa Escrow (Dispute Resolution)**

* **Detail Fungsional:** Panel antrean moderasi laporan komplain cacat/busuk. Menampilkan komparasi dokumen bukti foto fisik barang dari UMKM, detail transaksi, data rekam jejak persetujuan (consent) lokasi dari UMKM, dan opsi input catatan klarifikasi tambahan.

* **Requirement:** Menyediakan dua tombol aksi keputusan mutlak: "Rilis/Cairkan Dana ke Supplier" dan "Kembalikan Dana (Full Refund) ke UMKM".

* **Business Rules:**

  * Admin bertindak sebagai Arbiter dengan wewenang tak terbantahkan (mutlak).

  * Tindakan penekanan tombol keputusan ini akan mengesampingkan status hitung mundur timer Escrow dan seketika mengakhiri siklus transaksi.

* **Validasi:** Keputusan ini bersifat satu arah dan tidak bisa dibatalkan (irreversible).

* **Dependency:** Hanya terpicu jika UMKM menekan tombol komplain dalam kurun waktu 1x24 jam.

* **Exception Handling:** Apabila setelah melakukan pengecekan visual foto/klarifikasi email dan bukti UMKM dinilai lemah atau tidak meyakinkan, Admin wajib menolak komplain tersebut dan langsung melepaskan (release) dana ke Supplier.

## 

### **2.3.5 Manajemen Pengguna & Pemulihan (User Management, Ban & Recovery)**

* **Detail Fungsional:** Tabel pemantauan seluruh pengguna (Supplier dan UMKM), mencakup fitur penangguhan akun secara manual (Ban/Suspend) dan pemulihan status akun (Recovery).

* **Requirement:** Admin memiliki kendali untuk mencabut hak akses registrasi pada pesanan baru atau hak pembuatan batch penawaran.

* **Business Rules:**

  * Tidak ada alur pemulihan (unban) yang dijalankan otomatis oleh sistem.

  * Pengguna yang dijatuhi sanksi penangguhan permanen (baik secara sistem otomatis akibat Hit and Run, maupun manual oleh Admin) diwajibkan mengajukan permohonan banding pemulihan secara manual melalui kontak email.

  * Admin wajib meninjau kelayakan pengajuan (case-by-case) sebelum melepaskan pemblokiran.

* **Validasi:** Status Ban akan memblokir endpoint autentikasi pengguna tersebut ke modul transaksional.

* **Dependency:** Terintegrasi secara vertikal dengan Modul Reputation & Penalty dan Modul IAM.

* **Exception Handling:** Apabila permohonan banding ditolak setelah dievaluasi, status akun dipertahankan dalam kondisi ditangguhkan permanen.

### **2.3.6 Catatan Log Aktivitas Admin (Admin Audit Log)**

* **Detail Fungsional:** Tabel historis (Activity History) tersembunyi yang merekam secara detail setiap parameter aksi kritikal yang dilakukan oleh seluruh akun dengan role Admin.

* **Requirement:** Merekam Timestamp, ID Admin, ID Transaksi/Akun, dan Jenis Aksi (contoh: Eksekusi Takedown, Keputusan Sengketa, Persetujuan Verifikasi KTP, Suspend Manual).

* **Business Rules:** Ini adalah fitur teknis implisit (namun sangat diwajibkan) untuk memitigasi risiko penipuan internal (internal fraud) serta memantau potensi penyalahgunaan wewenang mutlak dari Admin.

* **Validasi:** Basis data log aktivitas Admin bersifat Append-Only (hanya bisa ditambah) dan berstatus Read-Only (tidak dapat diedit atau dihapus oleh Admin yang bersangkutan).

* **Dependency:** Terhubung ke setiap rute API pemrosesan (endpoint) yang dimodifikasi oleh hak akses Admin.

* **Exception Handling:** Jika proses pencatatan log gagal dilakukan pada tingkat database, maka eksekusi aksi (seperti pengubahan status refund) harus dibatalkan (rollback) oleh sistem.

## **2.4 Fitur Pendukung & Lintas Peran (Cross-Functional Support Features)**

Bagian ini memuat spesifikasi fitur-fitur implisit dan pendukung sistem yang beroperasi melintasi berbagai role (Supplier, UMKM, Admin) untuk menjamin stabilitas, performa, dan pengalaman pengguna (UX) yang profesional.

### **2.4.1 Autentikasi & Manajemen Sesi (Session Management)**

* **Detail Fungsional:** Fasilitas masuk (Login), keluar (Logout), pemulihan kata sandi (Forgot Password), dan pengelolaan sesi pengguna yang aktif.

* **Requirement:** Sistem harus membedakan hak akses (Role-Based Access) setelah pengguna berhasil login, serta menjaga sesi pengguna agar tidak mudah terputus di tengah proses transaksi.

* **Dependencies:** Terintegrasi dengan basis data Supabase Auth.

### **2.4.2 Manajemen Unggahan Media (Image Compression)**

* **Detail Fungsional:** Modul kompresi, ubah ukuran (resizing), dan konversi format gambar secara otomatis di client-side.

* **Requirement:** Seluruh fail media berupa foto (Foto Lokasi Usaha, Foto Produk, dan Bukti Sengketa) yang diunggah pengguna (maksimal 10MB) wajib dikonversi menjadi format .webp dan dikompresi di sisi frontend (klien) sebelum dikirim ke server. Pemrosesan dilakukan secara asinkron (Web Worker / Canvas) agar Main Thread UI tidak terganggu (non-blocking UI).

* **Business Rules:** Memindahkan beban kompresi dari server backend ke perangkat klien untuk menghemat sumber daya komputasi serverless serta menekan konsumsi kapasitas Supabase Storage.

### **2.4.3 Penanganan Status Antarmuka (Global UI/UX States & Error Handling)**

* **Detail Fungsional:** Standarisasi visual untuk kondisi memuat (loading), kondisi data kosong (empty state), dan kondisi galat (error state).

* **Requirement:**

  * **Skeleton Loading:** Wajib ditampilkan saat antarmuka sedang menunggu respons pengambilan data dari Redis atau Supabase.

  * **Empty States:** Wajib menampilkan halaman ilustrasi yang informatif (bukan layar kosong atau putih) apabila filter pencarian dari UMKM tidak membuahkan hasil, atau saat tabel antrean Admin kosong.

  * **Toast/Snackbar (Global Error Handling):** Sistem diwajibkan memberikan umpan balik (UI feedback) berupa pesan pop-up kecil apabila terjadi masalah, seperti pembayaran gagal, OTP salah, atau koneksi internet pengguna terputus.

### **2.4.4 Optimasi Pengambilan Data (Pagination & Fetching Limit)**

* **Detail Fungsional:** Pembatasan jumlah kemunculan item pada satu halaman dan implementasi penomoran halaman (pagination).

* **Requirement:** Wajib diimplementasikan pada Modul Marketplace & Discovery (daftar produk) serta Modul Moderation & Admin Panel (tabel sengketa dan pengguna).

* **Business Rules:** Sistem membatasi jumlah query yang ditarik dalam satu waktu (fetching limit) untuk mencegah kelebihan beban (overload) pada database Supabase ketika data pesanan atau produk sudah sangat masif, sekaligus mempercepat waktu muat aplikasi.

### **2.4.5 Pusat Notifikasi Terpadu (In-App Notification Center)**

* **Detail Fungsional:** Ikon lonceng notifikasi di dalam aplikasi yang menyimpan riwayat pemberitahuan pengguna.

* **Requirement:** Menampilkan pengingat batas waktu, konfirmasi pembayaran, teguran (suspend), dan status komplain.

* **Business Rules:** Karena sistem mengandalkan Fonnte/WhatsApp API Trial yang rentan terhadap limitasi (rate limit) atau kegagalan pengiriman pihak ketiga, keberadaan In-App Notification disarankan sebagai saluran komunikasi cadangan (fallback) agar pengguna tetap mendapatkan informasi yang pasti tersampaikan.

### 

### **2.4.6 Pendengar Integrasi (Webhook Listener)**

* **Detail Fungsional:** Titik akhir (endpoint) API di sisi backend yang berstatus selalu sedia mendengarkan pembaruan data.

* **Requirement:** Menangkap notifikasi/callback keberhasilan pembayaran secara otomatis dari server Midtrans. Khusus untuk kebutuhan pengujian (Quality Assurance), sistem diwajibkan menyediakan API endpoint *testing* khusus di lingkungan *Staging/Dev* untuk menonaktifkan sinkronisasi *webhook* Midtrans secara sementara guna memfasilitasi pengujian skenario rekonsiliasi keterlambatan jaringan.

* **Business Rules:** Ini merupakan fitur implisit wajib bagi Modul Payment untuk menjembatani komunikasi antar-server, sehingga pesanan UMKM dapat otomatis berubah menjadi "Sudah Dibayar" tanpa intervensi manual penyegaran halaman.

# **3\. Sistem Otomatis (Business Logic Layer)**

## **3.1 Mekanisme Gatekeeper & Event-Driven Check (Anti-Deadlock)**

Sistem backend Wesup beroperasi menggunakan arsitektur Lazy Evaluation murni, meniadakan penggunaan pemantauan latar belakang (cron/scheduled job) untuk menghemat kapabilitas komputasi serverless.

* **On-Demand Evaluation:** Status waktu (seperti penutupan batch atau pembukaan payment) dihitung secara presisi hanya ketika terdapat request API yang menyentuh batch tersebut.

* **Strict API Gatekeeper:** Sebagai proteksi, setiap endpoint API (terutama registrasi dan pembayaran) diwajibkan memvalidasi kecocokan timestamp absolut pada payload sebelum memproses query lanjutan. Penetrasi API (abuse) di luar jadwal pendaftaran akan langsung ditolak (Rejected) oleh Gatekeeper.

* **Penanganan Delay Rekonsiliasi & Distributed Lock:** Apabila tidak ada satupun aktivitas pengguna organik selama masa transisi waktu (misal: jeda antara waktu tutup pendaftaran hingga jendela pembayaran dibuka), Gatekeeper akan melakukan sinkronisasi dan rekonsiliasi data pada kueri pertama yang masuk setelah masa transisi tersebut berakhir. Untuk mencegah eksekusi ganda (race condition) pada kueri konkuren pertama yang masuk secara bersamaan, Gatekeeper diwajibkan menggunakan mekanisme *Distributed Lock* (misalnya dengan perintah SETNX pada Redis) sehingga hanya satu *request* yang bertugas memigrasikan status/data, sementara *request* lainnya sekadar bertindak sebagai pembaca (reader).

## 

## **3.2 Redis Atomic Counter & Resolusi Harga (The Tiering Logic)**

Sistem mengelola fluktuasi antrean pendaftar (UMKM) dan penentuan harga akhir menggunakan memori sementara untuk mencegah race condition.

* **Atomic Increment:** Setiap request "Daftar" memicu perintah INCR pada counter Redis milik batch terkait. Antrean diproses berurutan di dalam memori, lalu datanya disajikan secara real-time ke sistem untuk menghitung progres batas minimum.

* **Penguncian Volume & Penerbitan Tagihan:** Mengatasi batasan integrasi QRIS, evaluasi dan penguncian harga tier diskon final secara absolut dihitung dan dikunci ke database Supabase tepat pada saat Waktu Tutup Pendaftaran berakhir. Hal ini diwajibkan agar sistem dapat menerbitkan nilai tagihan (invoice) QRIS yang spesifik dan valid kepada UMKM sebelum jendela pembayaran dibuka. Jika target minimum tier tidak tercapai pada saat penutupan pendaftaran, sistem secara otomatis akan merujuk (terkunci) pada harga Tier 1 (Harga Dasar/Tertinggi).

* **Mitigasi The Tiering Trap:** Karena harga dikunci di awal (sebelum pembayaran), perlindungan bagi Supplier terhadap kerugian akibat UMKM yang mendaftar namun tidak membayar bertumpu secara penuh pada penegakan skrip kedisiplinan (Auto-Suspend) yang ketat bagi pelanggar Hit and Run.

## 

## **3.2 Alur Pembayaran & Webhook Listener Midtrans** 

Logika transaksi diikat dengan jendela waktu yang kaku (Payment Window) yang mencakup rentang waktu spesifik (Mulai Payment hingga Batas Akhir Payment) untuk menghindari selisih transfer dan sinkronisasi status pembayaran.

* **Validasi Window:** API gateway (generasi token QRIS) akan menolak request (mengembalikan error HTTP 403 Forbidden) jika diakses secara prematur sebelum jendela pembayaran dibuka, atau diakses setelah waktunya habis.

* **Webhook Listener:** Backend menyediakan endpoint khusus (/api/webhook/midtrans) yang bertugas mendengarkan callback asinkron dari server Midtrans. Payload webhook ini yang memicu perubahan status pesanan pada database dari "Pending" menjadi "Paid" (Lunas). Untuk memfasilitasi pengujian skenario rekonsiliasi secara menyeluruh di lingkungan *Staging/Dev*, disediakan API endpoint pengujian khusus guna mematikan sinkronisasi webhook secara sementara.

* **Penanganan Delay Webhook & Rekonsiliasi:** Pada saat Payment Window ditutup, sistem backend tidak langsung menghukum pengguna berstatus "Pending". Gatekeeper diwajibkan mengeksekusi rekonsiliasi manual (Fetch Status API ke Midtrans) untuk memastikan tidak ada delay callback sebelum mengunci status final pesanan.

## 

## **3.3 Automasi Escrow & Serah Terima (Fulfillment Lifecycle)**

Siklus operasional serah-terima fisik dan penahanan dana diatur oleh batas waktu absolut yang terotomatisasi secara *On-Demand*. Mengingat arsitektur tidak menggunakan *cron job*, eksekusi pengalihan dana dan sanksi bergantung sepenuhnya pada mekanisme *Lazy Evaluation*.

* **Penguncian Dana (Escrow 24 Jam):** Timer Escrow 1x24 jam baru mulai dihitung ketika endpoint pemindaian QR atau input PIN 4-digit di-trigger oleh Supplier di lapangan (status berubah menjadi "Sudah Diambil"). Pasca 24 jam berlalu, skrip pencairan dana (auto-release) akan memindahkan saldo dari tabel penampungan ke tabel Payout Supplier secara *on-demand* saat terdapat pemanggilan API yang relevan (misalnya saat Supplier membuka Dasbor Penghasilan atau kueri rekonsiliasi Gatekeeper berjalan).

* **Batas Waktu Absolut No-Show:** Status No-Show (UMKM tidak datang) dievaluasi oleh sistem secara *on-demand* maksimal 12 jam setelah batas Estimasi Ready terlewati tanpa ada trigger pemindaian QR. Pada titik evaluasi tersebut, transaksi ditutup secara forceful, dan 100% dana UMKM dialokasikan (dicairkan) ke tabel saldo Supplier sebagai kompensasi tanpa bisa di-refund.

* **Suspend Escrow:** Apabila masuk kueri dari endpoint Komplain (\<24 jam), sistem akan langsung membekukan (suspend) timer auto-release tanpa batas waktu, dan mengalihkan otoritas status transaksi sepenuhnya kepada endpoint keputusan Arbiter (Admin).

## 

## **3.4 Skrip Auto-Suspend (Hit and Run Protection)** 

Skrip kedisiplinan otomatis yang berjalan di backend untuk melindungi ekosistem dari pengguna yang mendaftar secara manipulatif.

* **Trigger Event:** Untuk mencegah race condition, skrip di-trigger seketika setelah proses Rekonsiliasi Manual (Fetch Status API Midtrans) oleh Gatekeeper selesai dilakukan pada batas akhir Payment Window. Sistem melakukan kueri seluruh pesanan dalam batch tersebut yang berstatus "Belum Bayar" atau "Expired".

* **Eskalasi Penalti Otomatis:** Sistem memberikan strike pelanggaran ke profil tabel pengguna UMKM.

  * Pelanggaran 1x: Memicu API Notifikasi WA (Peringatan).

  * Pelanggaran 2x: Mengubah field status akun di tabel Supabase menjadi suspended\_temporary dan menghitung timestamp pemblokiran 7 hari. Perhitungan durasi 7 hari penangguhan ini wajib dihitung secara retrospektif (ditambahkan) dari timestamp absolut batas akhir *Payment Window*, bukan dari waktu *Date.now()* saat skrip rekonsiliasi tereksekusi, guna mencegah durasi sanksi yang membengkak.

  * Pelanggaran 3x: Mengubah status akun menjadi suspended\_permanent, memutus akses Auth token ke modul Order/Join Batch.

* **Pengecualian (Exception):** Sistem dilarang memicu alur auto-suspend berdasarkan akumulasi parameter rating buruk (bintang 1\) pada entitas Supplier. Sanksi Supplier murni ditangani oleh tinjauan manual (Modul Moderasi).

## 

## **3.5 Alur Refund & Sengketa Final (Queue Management)** 

Skenario pengembalian dana (refund) memiliki rute eksekusi yang spesifik karena limitasi QRIS.

* **Refund Trigger:** Alur ini hanya di-trigger oleh tiga peristiwa absolut: Admin mengeklik fungsi Takedown pada penawaran berjalan, Supplier menekan tombol Pembatalan Darurat (Force Majeure) sebelum serah-terima, atau Admin (Arbiter) memenangkan UMKM di panel sengketa Escrow.

* **Refund Queue Generation:** Mengingat arsitektur API QRIS (Midtrans Sandbox) di Indonesia tidak mendukung auto-refund instan ke rekening pelanggan secara langsung, trigger pengembalian dana tersebut tidak mengeksekusi transfer uang secara otomatis. Sebaliknya, trigger ini akan mengubah status dana pada sistem menjadi "Menunggu Refund", mencatatkan datanya ke tabel Antrean Refund di panel Admin, dan mengirimkan notifikasi kepada UMKM terkait untuk menginput nomor Pengaturan Rekening manual agar Admin dapat mentransfer saldo secara off-system.

## 

## **3.6 Validasi Logika Backend (Business Rules Validation)**

Untuk mencegah anomali basis data, backend secara mutlak mengimplementasikan validasi payload pada layer API routes:

1. **Time-Travel Validation:** Payload timeline batch baru akan ditolak (HTTP 400 Bad Request) jika urutan timestamp tidak berurutan secara linear: Buka \< Tutup \< Mulai Payment \< Batas Akhir Payment \< Ready.

2. **Tier Inversion & Overlap Prevention:** Logika pengkondisian akan mengeblok pembuatan batch apabila nilai nominal parameter harga Tier N+1 (kuota lebih banyak) ≥ Tier N (kuota lebih sedikit), serta memastikan bahwa rentang kuota (volume) antar tier tidak boleh saling tumpang tindih (overlap).

3. **Pengecekan Keaslian Supplier:** Saat registrasi Supplier, backend memvalidasi kelengkapan data esensial (Nama, Email, No. WA, Nama Usaha, Alamat Teks, Koordinat Pin Map, dan Foto Tempat Usaha). Transaksi postingan ditahan (blocked) hingga Admin mengonfirmasi persetujuan status akun.

# **4\. Alur End-to-End (End-to-End Flow)**

Berikut adalah alur bisnis komprehensif dari awal hingga akhir (end-to-end), yang telah mengintegrasikan seluruh fitur, validasi, dan penanganan skenario khusus (edge cases) pada platform Wesup.

**Fase 1: Registrasi & Verifikasi Identitas (Onboarding)**

1. SUPPLIER mendaftar ke platform dengan mengisi data profil esensial (Nama, Email, No. WA, Nama Usaha, Alamat Teks, dan Pin Map) serta mengunggah Foto Fisik Tempat Usaha yang dikompresi otomatis ke format .webp di frontend.

2. SUPPLIER mengatur Pengaturan Rekening untuk keperluan pencairan dana Escrow.

3. ADMIN melakukan verifikasi fisik (Kunjungan Lokasi) untuk memastikan keabsahan usaha (MVP Mode). Jika valid, Admin mengubah status akun menjadi "Disetujui" (Approved).

**Fase 2: Pembuatan Kampanye Penawaran (Cataloging)** 

4. SUPPLIER mempublikasikan penawaran (batch) dengan mengisi detail barang, menetapkan Tier Diskon (Sistem memvalidasi harga tier besar wajib lebih murah dan memastikan tidak ada tumpang tindih rentang kuota antar tier), serta mengatur Timeline absolut (Buka \< Tutup \< Mulai Payment \< Batas Akhir Payment \< Ready). 

5. SUPPLIER menetapkan titik kumpul menggunakan Pin Peta Presisi. (Sistem akan mengunci/lock koordinat lokasi secara permanen jika sudah ada minimal 1 UMKM yang mendaftar agar tidak merugikan komitmen awal UMKM).

**Fase 3: Penemuan & Pendaftaran (Discovery & Ordering)**

6. UMKM memfilter penawaran berdasarkan radius jarak. Sistem secara otomatis menghitung jarak dan estimasi waktu pengambilan ke lokasi Supplier. (UMKM dapat membagikan Share Link ke WhatsApp untuk mengejar kuota tier via jalur referral).

7. UMKM diwajibkan mencentang Checkbox Persetujuan (Consent) Lokasi. (Sistem merekam timestamp sebagai rekam jejak persetujuan mutlak).

8. UMKM menekan "Daftar". (Sistem mengkalkulasi antrean pendaftar ke dalam Atomic Counter Redis secara real-time untuk memperbarui indikator tier).

**Fase 4: Penguncian Volume & Penagihan (Cutoff & Gatekeeper)**

9. \[Waktu Pendaftaran Ditutup\] \-\> API Gatekeeper pada sistem backend secara mutlak mengunci penambahan antrean baru dan mengevaluasi total volume di Redis. Eksekusi ini wajib menggunakan mekanisme *Distributed Lock* (misalnya SETNX) untuk mencegah tabrakan data (*race condition*) pada saat kueri konkuren memicu evaluasi secara bersamaan.

10. SISTEM menetapkan Harga Final secara absolut berdasarkan total volume pendaftar pada saat penutupan tersebut. (Jika syarat minimum tier tidak tercapai, sistem secara otomatis merujuk pada harga Tier 1 yang bertindak sebagai Harga Dasar/Tertinggi). Tagihan (Invoice) diterbitkan, dan antarmuka Dasbor Pesanan UMKM akan menampilkan UI state "Menunggu Jendela Pembayaran Dibuka" selama masa jeda transisi ke fase pembayaran.

**Fase 5: Pembayaran Terkunci (Payment Window)**

11. \[Mulai Payment Window\] \-\> UMKM melakukan pembayaran tagihan secara spesifik (tanpa selisih uang) menggunakan QRIS Midtrans Sandbox, dipandu oleh UI Countdown yang dikalkulasi berdasarkan Server Timestamp untuk mencegah manipulasi jam perangkat lokal. (Pembayaran di luar jendela waktu ini akan diblokir oleh API Gatekeeper).

12. SISTEM (Webhook Listener) menerima konfirmasi callback dari server Midtrans dan mengubah status pesanan menjadi "Sudah Dibayar" (Paid). 13\. 

13. \[Batas Akhir Payment Window\] \-\> API Gatekeeper mengeksekusi Rekonsiliasi Manual (Fetch Status API Midtrans) untuk memastikan tidak ada delay webhook. Setelah rekonsiliasi selesai, SISTEM memindai pendaftar yang masih belum membayar dan secara otomatis mengeksekusi sanksi Hit and Run (peringatan hingga suspend permanen) kepada UMKM tersebut. (Perhitungan durasi penangguhan 7 hari dihitung secara retrospektif dari timestamp absolut Batas Akhir Payment Window, bukan dari waktu saat skrip tereksekusi).

**Fase 6: Penyiapan Barang & Serah Terima (Fulfillment)**

14. \[Estimasi Ready\] \-\> SUPPLIER menyiapkan bahan baku di titik kumpul dan diwajibkan secara operasional untuk bersiap melayani penukaran secara fisik selama jendela 12 jam toleransi penuh sejak waktu ini dimulai. (Apabila terjadi Force Majeure seperti barang rusak/bencana, SUPPLIER dapat menekan tombol Pembatalan Darurat yang akan langsung memicu antrean Full Refund ke UMKM).

15. UMKM mendatangi lokasi dan menunjukkan Kode QR Pengambilan (atau menyebutkan PIN 4-digit sebagai fallback).

16. SUPPLIER memindai QR/memasukkan PIN melalui sistem. Status pesanan berubah menjadi "Sudah Diambil".

**Fase 7: Resolusi Escrow & Pencairan (Post-Fulfillment)** 

17. \[Jendela Escrow 24 Jam\] \-\> Dana pembayaran ditahan di dalam sistem selama 1x24 jam terhitung sejak barang "Sudah Diambil". Terdapat tiga skenario percabangan: \* **Skenario A (AMAN):** Waktu 24 jam berlalu tanpa komplain. Dana otomatis CAIR ke rekening Supplier yang dieksekusi secara *on-demand* (*Lazy Evaluation*) saat terdapat pemanggilan API yang relevan. \* **Skenario B (SENGKETA \- Max \<24 Jam):** UMKM menekan tombol komplain dan mengunggah bukti foto fisik barang cacat/busuk. Timer Escrow dibekukan. ADMIN (Arbiter) mengevaluasi bukti beserta rekam jejak persetujuan (*consent*) lokasi dari UMKM secara mutlak. Jika komplain ditolak \-\> Dana Dirilis ke Supplier. Jika komplain diterima \-\> Masuk antrean Full Refund Manual ke UMKM. (Sistem baru akan memunculkan formulir Pengisian Rekening Manual kepada UMKM hanya setelah tiket disetujui untuk di-refund oleh Admin). \* **Skenario C (NO-SHOW):** Jika UMKM tidak datang memindai QR melewati tenggat maksimal 12 jam operasional setelah waktu Estimasi Ready, status transaksi dievaluasi secara *on-demand*. Dana dinyatakan HANGUS 100% dan dicairkan ke Supplier sebagai kompensasi penyiapan barang tanpa bisa di-refund.

**Fase 8: Penilaian Akhir (Reputation)**

18. UMKM memberikan Rating (Bintang 1-5) dan ulasan tertulis pada profil SUPPLIER. (Formulir ini tidak bisa diakses oleh UMKM yang berstatus No-Show, dan akumulasi rating buruk tidak memicu suspend otomatis pada akun Supplier). 

19. Transaksi Selesai.

# **5\. Kenapa Arsitektur Ini Kuat untuk Dinilai**

## **5.1 Inovasi Model Bisnis & Value Proposition (30%)** 

latform Wesup menawarkan value proposition yang sangat realistis untuk dieksekusi dengan memecahkan masalah logistik last-mile melalui model self-pickup.

* **Kekuatan Kepercayaan Hibrida:** Kombinasi tier diskon dinamis dan trust score dua arah (UMKM dapat di-suspend sistem, Supplier dinilai oleh UMKM) membangun ekosistem transaksi yang aman tanpa memerlukan kompleksitas logistik berlebih. Penahanan dana via Escrow 24 Jam menjamin keamanan kualitas secara hibrida (gabungan antara sistem digital dan verifikasi fisik di lapangan).

* **Kematangan Business Rules:** Sistem tidak hanya memikirkan skenario sukses (Happy Path), tetapi juga memitigasi risiko bisnis tingkat tinggi. Mitigasi celah "Tiering Trap" (penguncian harga final pada saat penutupan pendaftaran untuk penerbitan tagihan QRIS yang dipadukan dengan sanksi Auto-Suspend mutlak guna mencegah kerugian Supplier akibat Hit and Run), aturan dana hangus untuk UMKM No-Show (dengan toleransi waktu operasional 12 jam yang jelas), dan fitur Pembatalan Darurat (Force Majeure) bagi Supplier menunjukkan kedalaman logika bisnis yang sangat matang dan siap diimplementasikan di dunia nyata.

## **5.2 Kedalaman Implementasi Teknis & Alasan Arsitektur (25%)**

Pilihan arsitektur didesain khusus untuk mengoptimalkan biaya serverless sekaligus mencegah anomali data tingkat lanjut, memberikan kedalaman teknis yang kuat untuk dipresentasikan:

* **Optimasi Serverless (API Gatekeeper & Lazy Evaluation):** Sistem secara sadar menghindari penggunaan cron job pemantau latar belakang yang memakan biaya dan dibatasi oleh Vercel. Sebagai gantinya, arsitektur menggunakan evaluasi *on-demand* (Lazy Evaluation) yang dipadukan dengan API Gatekeeper untuk memvalidasi timestamp mutlak guna mencegah manipulasi batas waktu pembayaran, serta mengeksekusi pencairan otomatis dana Escrow dan sanksi No-Show secara pasif saat terdapat kueri API lanjutan.

* **Keandalan Data (Redis Atomic Counter & Distributed Lock):** Untuk platform group-buying di mana pengguna mengeklik tombol secara serentak (FOMO), potensi *race condition* dieliminasi dengan penggunaan fungsi Atomic Increment pada Redis yang menghitung antrean secara berurutan dan real-time di dalam memori. Hal ini diperkuat dengan implementasi *Distributed Lock* (seperti SETNX) pada API Gatekeeper saat penguncian harga batas waktu (*cutoff*) untuk menjamin tidak ada tabrakan data saat *request* konkuren masuk secara bersamaan.

* **Keandalan Operasional (Fallback & Testing Systems):** Sistem dirancang tangguh (Toleransi Kesalahan) dengan menyediakan endpoint Webhook Listener untuk menangkap callback pembayaran secara asinkron, serta secara spesifik menyediakan *endpoint* pengujian di lingkungan *Staging/Dev* untuk memastikan mekanisme rekonsiliasi keterlambatan jaringan dapat diuji secara komprehensif oleh QA Engineer.

## **5.3 Kematangan Desain Antarmuka & UX (25%)**

Platform tidak hanya fungsional secara backend, tetapi juga mempertimbangkan penanganan kesalahan UI di lingkungan yang tidak ideal:

* **Audit Trail via UI:** Penggunaan Checkbox Persetujuan (Consent) yang merekam timestamp saat menyetujui jarak lokasi adalah elemen visual tegas yang menyelesaikan celah sengketa secara preventif, memberikan landasan data yang solid bagi Admin saat bertindak sebagai Arbiter.

* **Fleksibilitas Lapangan & Transisi yang Jelas:** Sistem menyediakan fitur alternatif seperti input manual PIN 4-digit apabila kamera pemindai QR Supplier kotor/gagal di lingkungan lapangan yang basah atau sibuk. Transisi antar fase transaksi dikelola dengan kejelasan *state* antarmuka (misalnya, status "Menunggu Jendela Pembayaran Dibuka") untuk mencegah kebingungan pengguna. Sistem juga menyertakan Pusat Notifikasi Dalam Aplikasi (In-App Notification Center) sebagai cadangan bila notifikasi WhatsApp gratis gagal terkirim.

* **Global Error Handling & Non-Blocking UI:** Pengalaman pengguna (UX) yang profesional dijamin melalui penyediaan status loading (Skeleton), halaman kosong (Empty State), dan UI Feedback (Toast/Snackbar) untuk menjembatani keterlambatan proses data. Selain itu, kalkulasi UI Countdown diwajibkan menggunakan *Server Timestamp* untuk mencegah manipulasi jam klien, dan proses kompresi gambar 10MB dieksekusi secara asinkron agar tidak memblokir render antarmuka (*non-blocking UI*).

## **5.4 Kesiapan MVP & Potensi Skalabilitas (20%)**

Narasi sistem ini sangat defensible (mudah dipertahankan di hadapan penilai) karena memiliki batasan (scope) MVP yang sangat masuk akal, tanpa janji otomatisasi fiktif.

* **Pendekatan MVP yang Pragmatis:** Keputusan membatasi scope di wilayah Bandung serta menggunakan tenaga Admin untuk verifikasi fisik lokasi (KYC) dan eksekusi Full Refund manual secara off-system (akibat keterbatasan API Gateway QRIS Sandbox) adalah pendekatan Quality Control tahap awal yang paling logis dan jujur untuk sebuah startup.

* **Visi Future Development (Skalabilitas):** Seiring dengan bertumbuhnya platform, kompetensi dan roadmap sistem telah disiapkan untuk proses scaling up. Intervensi manual pada tahap MVP ini telah dirancang untuk digantikan secara mulus oleh otomatisasi teknologi mutakhir, seperti integrasi API verifikasi Pemerintah (OSS/NIB) dan sistem verifikasi KTP/Lokasi menggunakan teknologi AI Image Recognition. Sistem ini juga memiliki ruang pengembangan masa depan yang jelas untuk fitur pesan dalam aplikasi (In-App Messaging) dan dasbor analitik bisnis.

