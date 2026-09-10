import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, BarChart3, Gift, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

const RETURN_KEY = "sasa-login-return";

export default function StaffLogin() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    sessionStorage.removeItem(RETURN_KEY);
  }, [user]);

  const loginAsStaff = () => {
    sessionStorage.setItem(RETURN_KEY, "/dashboard");
    startLogin();
  };

  return (
    <div className="app-shell min-h-screen bg-[#f7f8fa] text-[#273049]">
      <header className="app-topbar">
        <Link href="/login-dashboard" className="flex items-center gap-3">
          <img src="/assets/inventory/logo-sasa.png" alt="Sasa" className="brand-logo" />
          <span className="sr-only">Sasa Event Hub</span>
        </Link>
        <Link href="/" className="app-exit inline-flex items-center gap-2"><ArrowLeft className="h-3.5 w-3.5" /> Akses peserta</Link>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-82px)] w-full max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8">
        <section className="rounded-[28px] bg-[#273049] p-7 text-white shadow-[0_24px_60px_rgba(39,48,73,.16)] sm:p-10 lg:p-14">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#ffd949]"><ShieldCheck className="h-4 w-4" /> Area operasional</div>
          <h1 className="brand-display mt-5 max-w-xl text-4xl font-black leading-[1.02] tracking-[-.055em] sm:text-6xl">Pusat kendali event.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/70">Kelola registrasi, pengundian doorprize, pemindaian QR, dan riwayat pengambilan hadiah dari satu dashboard.</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[{ icon: BarChart3, text: "Data realtime" }, { icon: QrCode, text: "QR scanner" }, { icon: Gift, text: "Kelola hadiah" }].map(item => <div key={item.text} className="rounded-2xl border border-white/10 bg-white/5 p-4"><item.icon className="h-5 w-5 text-[#ffd949]" /><p className="mt-3 text-xs font-bold text-white/80">{item.text}</p></div>)}
          </div>
        </section>

        <section className="rounded-[28px] border border-[#e5e8ed] bg-white p-7 shadow-[0_18px_50px_rgba(39,48,73,.07)] sm:p-10">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0f0] text-[#e21b22]"><LockKeyhole className="h-5 w-5" /></div>
          <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-[#e21b22]">Akses panitia</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-.04em]">Login dashboard</h2>
          <p className="mt-4 text-sm leading-6 text-[#6b7280]">Masuk menggunakan akun panitia untuk membuka alat operasional event.</p>
          {user ? (
            <div className="mt-7">
              <div className="rounded-2xl border border-[#b6df9f] bg-[#effae8] px-4 py-3"><p className="text-xs font-black uppercase tracking-[.14em] text-[#4d9629]">Sesi aktif</p><p className="mt-1 text-sm font-bold text-[#273049]">{user.name || user.email || "Akun panitia"}</p></div>
              <Link href="/dashboard" className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#e21b22] px-5 py-4 text-sm font-black text-white transition hover:bg-[#c9161d]">Buka dashboard <ArrowRight className="h-4 w-4" /></Link>
            </div>
          ) : (
            <button type="button" onClick={loginAsStaff} disabled={loading} className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e21b22] px-5 py-4 text-sm font-black text-white transition hover:bg-[#c9161d] disabled:opacity-60">{loading ? "Memeriksa akses..." : "Masuk sebagai panitia"} <ArrowRight className="h-4 w-4" /></button>
          )}
          <p className="mt-5 text-center text-xs leading-5 text-[#9aa2af]">Halaman ini khusus untuk tim operasional dan panitia event.</p>
        </section>
      </main>
    </div>
  );
}
