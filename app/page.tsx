import React from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag, ShieldCheck, Truck, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header/Nav placeholder */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">Wesup</span>
          </div>
          <nav className="hidden md:flex gap-8">
            <Link href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Fitur</Link>
            <Link href="/beranda-umkm" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Panduan UMKM</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors hidden sm:block">Masuk</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-28 md:pt-32 md:pb-40 bg-zinc-50 flex items-center justify-center">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-blue-700 bg-blue-100/50 border border-blue-200 mb-8 backdrop-blur-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
              </span>
              Solusi Pemasok UMKM
            </span>

            <h1 className="mx-auto max-w-5xl text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-[1.1] text-balance">
              Pembelian Kolektif Bahan Baku UMKM <br className="hidden md:block" />
              <span className="text-blue-600 relative whitespace-nowrap">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 418 42"
                  className="absolute left-0 top-2/3 h-[0.58em] w-full fill-blue-300/40"
                  preserveAspectRatio="none"
                >
                  <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.738 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.051.951.569 2.296 1.116 2.876.527.559 7.076 2.581 18.073 5.578 21.2 5.772 49.333 9.69 82.5 11.458 13.918.739 32.81.996 46.696.633 78.441-2.054 153.945-12.222 232.062-31.258 5.419-1.32 10.87-2.671 12.115-3.003 3.51-1.042 3.195-2.906-1.059-6.22-4.103-3.21-10.741-6.177-18.74-8.384-18.016-4.966-41.97-9.014-69.605-11.758-29.351-2.915-77.01-4.084-100.661-1.614z" />
                </svg>
                <span className="relative z-10">(Self-Pickup)</span>
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg sm:text-xl text-slate-600 mb-10 leading-relaxed text-balance">
              Dapatkan harga grosir tanpa minimun order besar dengan bergabung bersama ratusan UMKM lainnya. Belanja bersama, kumpulkan diskonnya, dan ambil sendiri tanpa pusing urusan ongkos kirim logistik last-mile!
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/supplier/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow hover:bg-blue-700 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all active:scale-[0.98]"
              >
                Daftar Sebagai Supplier
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/beranda-umkm"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 transition-all active:scale-[0.98]"
              >
                Mulai Belanja (UMKM)
                <ShoppingBag className="h-5 w-5 text-slate-500" />
              </Link>
            </div>
          </div>

          {/* Decorative background gradients */}
          <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80 pointer-events-none" aria-hidden="true">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#93c5fd] to-[#3b82f6] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
          </div>
          <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)] pointer-events-none" aria-hidden="true">
            <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#60a5fa] to-[#93c5fd] opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"></div>
          </div>
        </section>

        {/* Value Proposition Section */}
        <section id="features" className="py-24 sm:py-32 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl text-balance">
                Fokus Pada Solusi, Bukan Sekadar Transaksi
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Wesup menghadirkan sistem inovatif yang mengoptimalkan seluruh proses pengadaan bahan baku.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
              {/* Feature 1 */}
              <div className="flex flex-col items-start p-8 sm:p-10 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute -top-12 -right-12 text-slate-50 opacity-[0.03] group-hover:opacity-[0.05] group-hover:scale-110 transition-all duration-500 pointer-events-none">
                  <TrendingDown className="h-64 w-64" />
                </div>
                <div className="mb-6 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100/50 group-hover:bg-blue-100 transition-colors">
                  <TrendingDown className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4 tracking-tight">Tier Diskon Volume</h3>
                <p className="text-slate-600 leading-relaxed">
                  Gabungan pembelian antar-UMKM secara kolektif meningkatkan volume order di platform. Nikmati <strong>harga grosir termurah</strong> melalui sistem tiering, meski skala bisnis Anda masih berkembang.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col items-start p-8 sm:p-10 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute -top-12 -right-12 text-slate-50 opacity-[0.03] group-hover:opacity-[0.05] group-hover:scale-110 transition-all duration-500 pointer-events-none">
                  <ShieldCheck className="h-64 w-64" />
                </div>
                <div className="mb-6 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100/50 group-hover:bg-emerald-100 transition-colors">
                  <ShieldCheck className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4 tracking-tight">Transaksi Aman dengan Escrow 24 Jam</h3>
                <p className="text-slate-600 leading-relaxed">
                  Bebas dari resiko penipuan. Sistem Escrow akan <strong>menahan dana Anda</strong> dan hanya meneruskannya ke supplier dalam <strong>1x24 jam</strong> setelah Anda mengkonfirmasi barang sesuai dengan pesanan.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="flex flex-col items-start p-8 sm:p-10 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute -top-12 -right-12 text-slate-50 opacity-[0.03] group-hover:opacity-[0.05] group-hover:scale-110 transition-all duration-500 pointer-events-none">
                  <Truck className="h-64 w-64" />
                </div>
                <div className="mb-6 rounded-2xl bg-purple-50 p-4 ring-1 ring-purple-100/50 group-hover:bg-purple-100 transition-colors">
                  <Truck className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4 tracking-tight">Tanpa Kendala Logistik Last-Mile</h3>
                <p className="text-slate-600 leading-relaxed">
                  Lupakan ongkir mahal. Ambil pesanan Anda langsung di sentra pickup kolektif / gudang pusat supplier. <strong>Self-Pickup</strong> memastikan pengadaan barang lebih cepat, murah, dan mandiri.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Simple Footer */}
      <footer className="border-t border-slate-200 bg-zinc-50 py-12 pb-16 md:py-12 mt-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1">
              <ShoppingBag className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-lg">Wesup</span>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} Wesup. Hak cipta dilindungi undang-undang.
          </p>
        </div>
      </footer>
    </div>
  );
}
