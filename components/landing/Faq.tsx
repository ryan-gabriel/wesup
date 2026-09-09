"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const FAQS = [
    {
        question: "Apakah Wesup melayani di luar Bandung?",
        answer:
            "Untuk tahap MVP, Wesup beroperasi khusus di wilayah Bandung. Model self-pickup menghilangkan ongkos kirim, jadi pastikan lokasi titik kumpul supplier terjangkau sebelum bergabung.",
    },
    {
        question: "Bagaimana cara kerja diskon tier?",
        answer:
            "Setiap penawaran punya tingkatan harga berdasarkan volume total pendaftar. Semakin banyak UMKM yang bergabung, semakin besar kuota terkumpul dan semakin murah harga yang terbuka. Saat pendaftaran ditutup, harga dikunci otomatis — jika target tier tidak tercapai, Anda tetap mendapat harga Tier 1 (harga dasar).",
    },
    {
        question: "Bagaimana saya tahu supplier terpercaya?",
        answer:
            "Setiap supplier diverifikasi Admin melalui survei fisik ke lokasi usaha sebelum dapat mempublikasikan penawaran. Selain itu, dana Anda ditahan sistem selama 24 jam setelah barang diambil, sehingga baru cair ke supplier bila tidak ada komplain.",
    },
    {
        question: "Apa yang terjadi jika barang rusak atau tidak sesuai?",
        answer:
            "Dalam 24 jam setelah barang diambil, Anda dapat mengajukan komplain dengan melampirkan bukti foto. Dana akan dibekukan dan ditinjau Admin sebagai arbiter. Jika komplain diterima, dana dikembalikan penuh ke rekening Anda.",
    },
    {
        question: "Bagaimana jika saya terlambat mengambil barang?",
        answer:
            "Ada toleransi 12 jam operasional sejak estimasi barang siap. Lewat batas itu tanpa pengambilan, pesanan dianggap No-Show dan dana hangus sebagai kompensasi supplier — jadi pastikan Anda datang tepat waktu.",
    },
    {
        question: "Apakah ada biaya pengiriman atau ongkos kirim?",
        answer:
            "Tidak ada. Wesup menerapkan model self-pickup: Anda mengambil langsung pesanan di titik kumpul supplier. Ini yang membuat harga bahan baku tetap murah dibanding belanja eceran.",
    },
] as const;

export function LandingFaq() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section id="faq" className="scroll-mt-24 py-20 md:py-24">
            <div className="mx-auto max-w-3xl px-4 sm:px-6">
                <SectionHeading
                    eyebrow="FAQ"
                    title="Pertanyaan yang Sering Diajukan"
                    description="Masih ragu? Temukan jawaban paling umum seputar belanja kolektif di Wesup."
                />

                <div className="space-y-3">
                    {FAQS.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (
                            <FaqItem
                                key={faq.question}
                                faq={faq}
                                isOpen={isOpen}
                                onToggle={() => setOpenIndex(isOpen ? null : index)}
                            />
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

interface FaqItemProps {
    faq: (typeof FAQS)[number];
    isOpen: boolean;
    onToggle: () => void;
}

function FaqItem({ faq, isOpen, onToggle }: FaqItemProps) {
    const buttonId = useId();
    const contentId = useId();

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <h3>
                <button
                    id={buttonId}
                    type="button"
                    onClick={onToggle}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
                >
                    <span className="text-balance">{faq.question}</span>
                    <ChevronDown
                        className={`h-5 w-5 shrink-0 text-blue-600 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                    />
                </button>
            </h3>
            <div
                id={contentId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="px-6 pb-5"
            >
                {isOpen ? (
                    <p className="text-sm leading-relaxed text-slate-600 text-pretty">{faq.answer}</p>
                ) : null}
            </div>
        </div>
    );
}