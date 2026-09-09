import { SectionHeading } from "./SectionHeading";

const STEPS = [
    {
        title: "Temukan Penawaran",
        description:
            "Jelajahi marketplace, filter berdasarkan kategori, harga, dan radius. Jarak ke titik kumpul supplier ditampilkan langsung di kartu penawaran.",
    },
    {
        title: "Daftar & Setujui Lokasi",
        description:
            "Tekan Join Batch, centang persetujuan lokasi pengambilan, dan catat posisi Anda di antrean volume secara real-time.",
    },
    {
        title: "Kuota Ditutup, Harga Terkunci",
        description:
            "Saat pendaftaran ditutup, sistem mengunci harga berdasarkan volume terkumpul. Target tier belum tercapai? Harga memakai Tier 1 (harga dasar) — pesanan tetap aman.",
    },
    {
        title: "Bayar Sekali Lewat QRIS",
        description:
            "Tagihan final terbit di Payment Window dengan countdown berbasis server. Cukup scan sekali, tanpa selisih transaksi.",
    },
    {
        title: "Ambil Langsung dengan QR / PIN",
        description:
            "Datang ke titik kumpul, tunjukkan Kode QR pengambilan atau sebutkan PIN 4-digit sebagai cadangan. Supplier memindai untuk verifikasi serah terima.",
    },
    {
        title: "Escrow Cair & Beri Rating",
        description:
            "Dana ditahan 24 jam setelah barang diambil. Aman — cair otomatis ke supplier, atau ajukan komplain foto jika barang rusak, lalu beri rating supplier Anda.",
    },
] as const;

export function HowItWorks() {
    return (
        <section id="cara-kerja" className="scroll-mt-24 bg-slate-50 py-20 md:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <SectionHeading
                    eyebrow="Cara Kerja"
                    title="Enam langkah menuju belanja yang lebih hemat"
                    description="Alur transaksi dirancang ketat dan transparan — tidak ada kejutan harga, tidak ada biaya kirim terselubung."
                />

                <ol className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {STEPS.map((step, index) => (
                        <li
                            key={step.title}
                            className="relative flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
                        >
                            <span
                                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-base font-extrabold text-white shadow-sm shadow-blue-600/20 tabular-nums"
                                aria-hidden="true"
                            >
                                {index + 1}
                            </span>
                            <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-900 text-balance">
                                {step.title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600 text-pretty">
                                {step.description}
                            </p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}