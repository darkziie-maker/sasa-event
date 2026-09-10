import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import QrScanner from "qr-scanner";
import { BarChart3, Camera, CheckCircle2, CircleDollarSign, Gift, Loader2, LogOut, MonitorUp, ScanLine, Shuffle, Ticket, Trophy, Users, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const mediaSupported = () =>
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login-dashboard" });
  const query = trpc.event.dashboard.useQuery(undefined, { enabled: Boolean(user) });
  const [selectedPrizeId, setSelectedPrizeId] = useState<number | null>(null);
  const [winner, setWinner] = useState<{ name: string; registrationCode: string; prizeName: string } | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [rollingName, setRollingName] = useState("");
  const [scannedCode, setScannedCode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [continuousMode, setContinuousMode] = useState(true);
  const [scanNotice, setScanNotice] = useState("");
  const lastScanRef = useRef({ code: "", at: 0 });
  const scanLockedRef = useRef(false);
  const continuousModeRef = useRef(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const displayChannelRef = useRef<BroadcastChannel | null>(null);
  const drawMutation = trpc.event.draw.useMutation();
  const redeemMutation = trpc.event.redeem.useMutation({ onSuccess: result => { lastScanRef.current = { ...lastScanRef.current, at: Date.now() }; scanLockedRef.current = false; setScannedCode(""); setScanNotice(`Redeem berhasil untuk ${result.guest.name}. Scanner siap untuk peserta berikutnya.`); void query.refetch(); } });
  const data = query.data;
  const selectedPrize = data?.prizes.find(prize => prize.id === selectedPrizeId);

  const playScanFeedback = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([70, 35, 70]);
    const audio = audioContextRef.current;
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, audio.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.2);
  };

  const handleScanResult = (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    const now = Date.now();
    if (!code || scanLockedRef.current || (lastScanRef.current.code === code && now - lastScanRef.current.at < 1800)) return;
    scanLockedRef.current = true;
    lastScanRef.current = { code, at: now };
    setScannedCode(code);
    setScanNotice(`QR terbaca: ${code}`);
    playScanFeedback();
    if (!continuousModeRef.current) {
      scannerRef.current?.stop();
      setScannerOpen(false);
    }
  };

  useEffect(() => {
    if ("BroadcastChannel" in window) displayChannelRef.current = new BroadcastChannel("sasa-doorprize-display");
    return () => {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      displayChannelRef.current?.close();
      displayChannelRef.current = null;
    };
  }, []);

  const startScanner = async () => {
    if (!videoRef.current) return;
    setScannerError("");
    if (!mediaSupported()) {
      setScannerError(
        "Kamera diblokir karena koneksi belum aman (butuh HTTPS). Buka lewat https://100.99.82.118:3443 atau https://habitat-assistant.tail41f5b0.ts.net lalu izinkan akses kamera."
      );
      return;
    }
    try {
      if (!audioContextRef.current) {
        const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextCtor) audioContextRef.current = new AudioContextCtor();
      }
      if (audioContextRef.current?.state === "suspended") await audioContextRef.current.resume();
      if (!scannerRef.current) {
        scannerRef.current = new QrScanner(videoRef.current, result => {
          handleScanResult(result.data);
        }, { preferredCamera: "environment", highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true });
      }
      await scannerRef.current.start();
      setScannerOpen(true);
    } catch (error) {
      setScannerError(error instanceof Error ? error.message : "Kamera tidak dapat dibuka. Pastikan izin kamera sudah diberikan.");
      setScannerOpen(false);
    }
  };

  const stopScanner = () => {
    scannerRef.current?.stop();
    setScannerOpen(false);
  };

  // Auto-open the camera scanner as soon as the panitia dashboard is ready —
  // no extra tap needed (the browser still asks for camera permission once).
  useEffect(() => {
    if (authLoading || !user) return;
    const timer = window.setTimeout(() => {
      void startScanner();
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const toggleContinuousMode = () => {
    setContinuousMode(value => {
      continuousModeRef.current = !value;
      return !value;
    });
  };

  const skipCurrentTicket = () => {
    scanLockedRef.current = false;
    setScannedCode("");
    setScanNotice("Tiket dilewati. Scanner siap membaca peserta berikutnya.");
  };

  const publishDrawEvent = (message: object) => {
    localStorage.setItem("sasa-doorprize-event", JSON.stringify(message));
    displayChannelRef.current?.postMessage(message);
  };

  const openDrawDisplay = () => {
    window.open("/layar-undian", "sasa-doorprize-display", "popup,width=1440,height=900");
  };

  const runDraw = async () => {
    if (!selectedPrizeId || !selectedPrize || isShuffling) return;
    const candidates = data?.drawCandidates ?? [];
    if (!candidates.length) return;
    setWinner(null);
    setIsShuffling(true);
    publishDrawEvent({ type: "draw-start", prizeName: selectedPrize.name, candidates });
    let index = 0;
    setRollingName(candidates[0]?.name ?? "");
    const ticker = window.setInterval(() => {
      index = (index + 1) % candidates.length;
      setRollingName(candidates[index]?.name ?? "");
    }, 85);
    try {
      await new Promise(resolve => window.setTimeout(resolve, 2600));
      const result = await drawMutation.mutateAsync({ prizeId: selectedPrizeId });
      window.clearInterval(ticker);
      const revealedWinner = { name: result.winner.name, department: result.winner.department, registrationCode: result.winner.registrationCode, prizeName: result.prize.name };
      setRollingName(result.winner.name);
      setWinner(revealedWinner);
      publishDrawEvent({ type: "draw-reveal", winner: revealedWinner });
      setSelectedPrizeId(null);
      void query.refetch();
    } catch {
      window.clearInterval(ticker);
      publishDrawEvent({ type: "display-reset" });
    } finally {
      setIsShuffling(false);
    }
  };

  const logoutStaff = async () => {
    await logout();
    window.location.href = "/login-dashboard";
  };

  if (authLoading || !user || query.isLoading) return <div className="grid min-h-screen place-items-center bg-[#f7f8fa]"><Loader2 className="h-7 w-7 animate-spin text-[#e21b22]" /></div>;

  return <div className="app-shell min-h-screen bg-[#f7f8fa] text-[#273049]">
    <header className="app-topbar"><Link href="/login-dashboard" className="flex items-center gap-3"><img src="/assets/inventory/logo-sasa.png" alt="Sasa" className="brand-logo" /><span className="sr-only">Sasa Event Hub</span></Link><div className="flex items-center gap-2 sm:gap-3"><span className="app-crumb hidden lg:inline">{user.name || "Panitia"}</span><button type="button" onClick={openDrawDisplay} className="app-exit inline-flex items-center gap-2"><MonitorUp className="h-3.5 w-3.5" /><span className="hidden sm:inline">Layar undian</span></button><Link href="/redeem" className="inline-flex items-center gap-2 rounded-full bg-[#e21b22] px-4 py-2 text-xs font-black text-white transition hover:bg-[#c9161d]"><Ticket className="h-3.5 w-3.5" /> Redeem manual</Link><button type="button" onClick={logoutStaff} className="app-exit inline-flex items-center gap-2"><LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Keluar</span></button></div></header>
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#e21b22]">Panel panitia / realtime</p><h1 className="brand-display mt-3 text-4xl font-black tracking-[-.045em] sm:text-5xl">Kelola pengambilan hadiah.</h1><p className="mt-3 text-sm leading-6 text-[#6b7280]">Pindai tiket peserta, validasi pemenang, lalu tandai hadiah sebagai sudah diambil.</p></div><div className="flex items-center gap-2 text-xs font-bold text-[#6b7280]"><span className="status-dot" /> Data tersinkron saat halaman dibuka</div></div>

      <section className="mb-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-[28px] bg-[#273049] p-6 text-white shadow-[0_18px_50px_rgba(39,48,73,.16)] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#ffd949]">01 / Scan tiket</p><h2 className="mt-2 text-2xl font-black">Pindai QR peserta</h2><p className="mt-3 max-w-sm text-sm leading-6 text-white/65">Arahkan kamera ke QR code pada tiket digital peserta. Kode akan terisi otomatis untuk divalidasi.</p></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-[#ffd949]"><ScanLine className="h-5 w-5" /></div></div><div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><div><p className="text-xs font-black text-white">Mode antrean</p><p className="mt-1 text-[11px] text-white/55">Kamera aktif, satu tiket dikunci sampai divalidasi</p></div><button type="button" role="switch" aria-checked={continuousMode} onClick={toggleContinuousMode} className={`relative h-7 w-12 rounded-full transition ${continuousMode ? "bg-[#ffd949]" : "bg-white/20"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${continuousMode ? "left-6" : "left-1"}`} /></button></div><div className={`relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30 ${scannerOpen ? "block" : "hidden"}`}><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /><div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-[#ffd949] shadow-[0_0_0_999px_rgba(0,0,0,.22)]" /></div>{!scannerOpen && <div className="mt-6 grid min-h-32 place-items-center rounded-2xl border border-dashed border-white/15 bg-white/5 text-center"><Camera className="h-7 w-7 text-[#ffd949]" /><p className="mt-2 text-xs font-bold text-white/55">Kamera belum aktif</p></div>}{scannerError && <p className="mt-4 rounded-xl bg-[#fff0f0] px-4 py-3 text-xs font-semibold text-[#ffb5b8]">{scannerError}</p>}{scanNotice && <p className="mt-4 rounded-xl bg-[#effae8] px-4 py-3 text-xs font-semibold text-[#4d9629]">{scanNotice}</p>}<button type="button" onClick={scannerOpen ? stopScanner : startScanner} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ffd949] px-5 py-4 text-sm font-black text-[#273049] transition hover:bg-[#f5c400]">{scannerOpen ? <><XCircle className="h-4 w-4" /> Matikan kamera</> : <><Camera className="h-4 w-4" /> Buka kamera scanner</>}</button></div>

        <div className="rounded-[28px] border border-[#e5e8ed] bg-white p-6 shadow-[0_16px_44px_rgba(39,48,73,.06)] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#e21b22]">02 / Validasi hadiah</p><h2 className="mt-2 text-2xl font-black">Konfirmasi tiket</h2><p className="mt-3 text-sm leading-6 text-[#6b7280]">Pastikan kode sudah benar sebelum menandai hadiah sebagai diambil.</p></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0f0] text-[#e21b22]"><Ticket className="h-5 w-5" /></div></div><label className="field-label mt-7">Kode dari QR<input value={scannedCode} onChange={event => setScannedCode(event.target.value.toUpperCase())} placeholder="SASA-XXXXXX" className="field-input text-center text-xl font-black tracking-[.14em]" /></label><button type="button" disabled={!scannedCode || redeemMutation.isPending} onClick={() => redeemMutation.mutate({ registrationCode: scannedCode })} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e21b22] px-5 py-4 text-sm font-black text-white transition hover:bg-[#c9161d] disabled:cursor-not-allowed disabled:opacity-50">{redeemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {redeemMutation.isPending ? "Memvalidasi..." : "Validasi & redeem hadiah"}</button>{scannedCode && <button type="button" onClick={skipCurrentTicket} className="mt-3 w-full rounded-2xl border border-[#e5e8ed] px-5 py-3 text-xs font-black text-[#6b7280] transition hover:border-[#273049] hover:text-[#273049]">Lewati & scan peserta berikutnya</button>}{redeemMutation.error && <p className="mt-4 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-semibold text-[#c9161d]">{redeemMutation.error.message}</p>}{redeemMutation.data && <div className="mt-5 rounded-2xl border border-[#b6df9f] bg-[#effae8] p-4"><p className="text-xs font-black uppercase tracking-[.15em] text-[#4d9629]">Redeem berhasil</p><p className="mt-2 text-lg font-black">{redeemMutation.data.guest.name}</p><p className="mt-1 text-sm font-semibold text-[#6b6255]">{redeemMutation.data.prize?.name}</p><p className="mt-2 text-xs font-semibold text-[#4d9629]">Diproses oleh {redeemMutation.data.redeemedBy}</p></div>}<p className="mt-5 text-center text-xs leading-5 text-[#9aa2af]">Scanner hanya membaca kode. Panitia tetap menekan tombol validasi untuk mengonfirmasi pengambilan.</p></div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Total undangan", value: data?.stats.totalGuests ?? 0, icon: Users, tone: "red" }, { label: "Pemenang doorprize", value: data?.stats.winners ?? 0, icon: Trophy, tone: "yellow" }, { label: "Sudah redeem", value: data?.stats.redeemed ?? 0, icon: CheckCircle2, tone: "green" }, { label: "Menunggu redeem", value: data?.stats.waitingRedeem ?? 0, icon: CircleDollarSign, tone: "navy" }].map(stat => <div key={stat.label} className={`stat-card tone-${stat.tone}`}><div className="flex items-start justify-between"><span className="text-sm font-bold text-[#6b6255]">{stat.label}</span><stat.icon className="h-5 w-5" /></div><p className="mt-5 text-4xl font-black">{stat.value}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full w-2/3 rounded-full bg-current opacity-70" /></div></div>)}</div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_.92fr]"><section className="rounded-[28px] border border-[#e5e8ed] bg-white p-6 shadow-[0_16px_44px_rgba(39,48,73,.06)] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#e21b22]">03 / Shuffle hadiah</p><h2 className="mt-2 text-2xl font-black">Undi pemenang sekarang</h2></div><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0bf] text-[#a26b00]"><Shuffle className="h-5 w-5" /></div></div><p className="mt-3 max-w-lg text-sm leading-6 text-[#6b7280]">Pilih kategori hadiah, lalu tekan shuffle. Setiap undangan hanya bisa memenangkan satu hadiah.</p><div className="mt-7 space-y-3">{data?.prizes.map(prize => <button key={prize.id} type="button" onClick={() => setSelectedPrizeId(prize.id)} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${selectedPrizeId === prize.id ? "border-[#e21b22] bg-[#fff0f0]" : "border-[#e5e8ed] bg-[#f7f8fa] hover:border-[#f1c934]"}`}><div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${selectedPrizeId === prize.id ? "bg-[#e21b22] text-white" : "bg-[#fff0bf] text-[#a26b00]"}`}><Gift className="h-4 w-4" /></span><span><span className="block text-sm font-black">{prize.name}</span><span className="mt-1 block text-xs font-semibold text-[#9aa2af]">{prize.detail}</span></span></div><span className="text-right"><span className="block text-sm font-black">{prize.drawn}/{prize.quantity}</span><span className="block text-[10px] font-black uppercase tracking-[.12em] text-[#9aa2af]">terundi</span></span></button>)}</div>{isShuffling && <div className="mt-6 overflow-hidden rounded-2xl border border-[#f1c934] bg-[#fff9df] p-5 text-center"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#a26b00]">Sedang mengacak peserta</p><p className="mt-3 truncate text-2xl font-black text-[#273049]">{rollingName}</p></div>}<button type="button" disabled={!selectedPrizeId || isShuffling || drawMutation.isPending || !(data?.drawCandidates.length) || Boolean(selectedPrize && selectedPrize.drawn >= selectedPrize.quantity)} onClick={runDraw} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#273049] px-5 py-4 text-sm font-black text-white transition hover:bg-[#1b2237] disabled:cursor-not-allowed disabled:opacity-40">{isShuffling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}{isShuffling ? "Mengacak peserta..." : selectedPrize && selectedPrize.drawn >= selectedPrize.quantity ? "Hadiah sudah habis" : "Mulai shuffle & pilih pemenang"}</button>{drawMutation.error && <p className="mt-4 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-semibold text-[#c9161d]">{drawMutation.error.message}</p>}{winner && <div className="mt-6 rounded-2xl border border-[#b6df9f] bg-[#effae8] p-5"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#4d9629]"><Trophy className="h-4 w-4" /> Pemenang terpilih</div><p className="mt-3 text-2xl font-black">{winner.name}</p><p className="mt-1 text-sm font-semibold text-[#6b6255]">{winner.prizeName} · <span className="font-black text-[#4d9629]">{winner.registrationCode}</span></p></div>}</section><section className="rounded-[28px] bg-[#273049] p-6 text-white shadow-[0_16px_44px_rgba(39,48,73,.14)] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#ffd949]">Operational pulse</p><h2 className="mt-2 text-2xl font-black">Kesiapan event</h2></div><BarChart3 className="h-6 w-6 text-[#ffd949]" /></div><div className="mt-8 space-y-6">{[{ label: "Registrasi masuk", value: data?.stats.totalGuests ?? 0, note: "undangan tercatat", width: Math.min(100, (data?.stats.totalGuests ?? 0) * 10) }, { label: "Hadiah tersalurkan", value: data?.stats.redeemed ?? 0, note: "hadiah diambil", width: data?.stats.winners ? Math.round(((data?.stats.redeemed ?? 0) / data.stats.winners) * 100) : 0 }, { label: "Partisipasi doorprize", value: data?.stats.winners ?? 0, note: "pemenang terpilih", width: data?.stats.totalGuests ? Math.round(((data?.stats.winners ?? 0) / data.stats.totalGuests) * 100) : 0 }].map(item => <div key={item.label}><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-black">{item.label}</p><p className="mt-1 text-xs text-white/55">{item.note}</p></div><p className="text-2xl font-black text-[#ffd949]">{item.value}</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ffd949] transition-all duration-500" style={{ width: `${Math.max(item.width, item.value ? 8 : 0)}%` }} /></div></div>)}</div><div className="mt-9 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/65">Tip: tampilkan dashboard di layar utama saat sesi pengundian agar semua undangan bisa ikut merasakan momennya.</div></section></div>

      <section className="mt-6 rounded-[28px] border border-[#e5e8ed] bg-white p-6 shadow-[0_16px_44px_rgba(39,48,73,.06)] sm:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#e21b22]">Audit pengambilan</p><h2 className="mt-2 text-2xl font-black">Riwayat redeem terbaru</h2></div><span className="rounded-full bg-[#fff0bf] px-3 py-2 text-xs font-black text-[#a26b00]">{data?.recentRedemptions.length ?? 0} transaksi terakhir</span></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead><tr className="border-b border-[#e5e8ed] text-[10px] font-black uppercase tracking-[.16em] text-[#9aa2af]"><th className="pb-3 pr-4">Undangan</th><th className="pb-3 pr-4">Hadiah</th><th className="pb-3 pr-4">Kode</th><th className="pb-3 pr-4">Panitia</th><th className="pb-3">Waktu redeem</th></tr></thead><tbody>{data?.recentRedemptions.map(item => <tr key={item.id} className="border-b border-[#f0f2f5] text-sm"><td className="py-4 pr-4"><p className="font-black">{item.name}</p><p className="mt-1 text-xs font-semibold text-[#6b7280]">{item.department}</p></td><td className="py-4 pr-4 text-xs font-bold text-[#273049]">{item.prizeName}</td><td className="py-4 pr-4 font-black tracking-[.08em] text-[#e21b22]">{item.registrationCode}</td><td className="py-4 pr-4 text-xs font-bold text-[#6b7280]">{item.redeemedBy ?? "Panitia"}</td><td className="py-4 text-xs font-semibold text-[#9aa2af]">{item.redeemedAt ? new Date(item.redeemedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "—"}</td></tr>)}</tbody></table>{!data?.recentRedemptions.length && <div className="py-12 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-[#c8ced7]" /><p className="mt-3 text-sm font-semibold text-[#9aa2af]">Belum ada hadiah yang diambil.</p></div>}</div></section>
    </main>
  </div>;
}
