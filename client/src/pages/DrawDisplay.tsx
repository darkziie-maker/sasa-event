import { useEffect, useMemo, useState } from "react";
import { Expand, Gift, Sparkles, Trophy, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

type Winner = {
  name: string;
  department: string;
  registrationCode: string;
  prizeName: string;
};

type DrawMessage =
  | { type: "draw-start"; prizeName: string; candidates: Array<{ name: string; department: string }>; at?: number }
  | { type: "draw-reveal"; winner: Winner; at?: number }
  | { type: "display-reset"; at?: number };

const CHANNEL_NAME = "sasa-doorprize-display";
const STORAGE_KEY = "sasa-doorprize-event";

export default function DrawDisplay() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login-dashboard" });
  const statusQuery = trpc.event.drawDisplay.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: true });
  const [phase, setPhase] = useState<"idle" | "rolling" | "winner">("idle");
  const [prizeName, setPrizeName] = useState("Hadiah doorprize");
  const [candidates, setCandidates] = useState<Array<{ name: string; department: string }>>([]);
  const [rollingIndex, setRollingIndex] = useState(0);
  const [winner, setWinner] = useState<Winner | null>(null);

  const handleMessage = (message: DrawMessage) => {
    if (message.type === "draw-start") {
      setPrizeName(message.prizeName);
      setCandidates(message.candidates);
      setWinner(null);
      setPhase("rolling");
    } else if (message.type === "draw-reveal") {
      setPrizeName(message.winner.prizeName);
      setWinner(message.winner);
      setPhase("winner");
      void statusQuery.refetch();
    } else {
      setWinner(null);
      setPhase("idle");
    }
  };

  useEffect(() => {
    // Saat layar baru dibuka, ikuti event terakhir HANYA kalau masih fresh
    // (menghindari nampilkan pemenang lama setelah reset, tapi tetap nampilkan
    // roller kalau layar dibuka persis saat undian baru mulai).
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as DrawMessage;
        if (typeof parsed.at === "number" && Date.now() - parsed.at < 120000) handleMessage(parsed);
      } catch {}
    }
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
    if (channel) channel.onmessage = event => handleMessage(event.data as DrawMessage);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try { handleMessage(JSON.parse(event.newValue) as DrawMessage); } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (phase !== "rolling" || candidates.length === 0) return;
    const ROLL_MS = 4200;
    const startAt = performance.now();
    let timer: number | undefined;
    let cancelled = false;
    const scheduleNext = () => {
      if (cancelled) return;
      const t = Math.min(1, (performance.now() - startAt) / ROLL_MS);
      const delay = 55 + Math.pow(t, 2.6) * 650; // cepat → lambat
      timer = window.setTimeout(() => {
        setRollingIndex(index => (index + 1 + Math.floor(Math.random() * 3)) % candidates.length);
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [phase, candidates]);

  useEffect(() => {
    if (phase !== "idle" || !statusQuery.data?.latestWinner) return;
    const latest = statusQuery.data.latestWinner;
    setWinner({ name: latest.name, department: latest.department, registrationCode: latest.registrationCode, prizeName: latest.prizeName });
    setPrizeName(latest.prizeName);
  }, [phase, statusQuery.data?.latestWinner]);

  const rollingCandidate = useMemo(() => candidates[rollingIndex] ?? { name: "Menyiapkan peserta...", department: "" }, [candidates, rollingIndex]);
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#273049] text-white">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#e21b22]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-24 h-[560px] w-[560px] rounded-full bg-[#ffd949]/15 blur-3xl" />
      <header className="relative z-10 flex items-center justify-between px-7 py-6 sm:px-10 lg:px-14">
        <div className="rounded-2xl bg-white px-4 py-2 shadow-lg"><img src="/assets/inventory/logo-sasa.png" alt="Sasa" className="h-11 w-auto object-contain" /></div>
        <button type="button" onClick={toggleFullscreen} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-xs font-black backdrop-blur transition hover:bg-white/15"><Expand className="h-4 w-4" /> Fullscreen</button>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-104px)] max-w-7xl flex-col justify-center px-6 pb-10 sm:px-10 lg:px-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.28em] text-[#ffd949]">Sasa Event Hub</p><h1 className="mt-3 text-2xl font-black tracking-[-.03em] sm:text-3xl">Doorprize Live Draw</h1></div>
          <div className="flex gap-3"><div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">Peserta</p><p className="mt-1 text-xl font-black text-[#ffd949]">{statusQuery.data?.registered ?? 0}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">Pemenang</p><p className="mt-1 text-xl font-black text-[#ffd949]">{statusQuery.data?.totalWinners ?? 0}</p></div></div>
        </div>

        <section className="relative grid min-h-[480px] place-items-center overflow-hidden rounded-[40px] border border-white/10 bg-white/[.07] p-8 text-center shadow-[0_36px_100px_rgba(0,0,0,.25)] backdrop-blur sm:p-14">
          {phase === "rolling" ? <div className="w-full"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-[#ffd949] text-[#273049] shadow-[0_0_60px_rgba(255,217,73,.25)]"><Sparkles className="h-9 w-9 animate-pulse" /></div><p className="mt-8 text-sm font-black uppercase tracking-[.25em] text-[#ffd949]">Mengacak {prizeName}</p><p className="mt-7 truncate text-5xl font-black tracking-[-.055em] sm:text-7xl lg:text-8xl">{rollingCandidate.name}</p><p className="mt-5 text-xl font-bold text-white/50">{rollingCandidate.department}</p><div className="mx-auto mt-10 h-2 max-w-lg overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#e21b22]" /></div></div> : winner ? <div className="w-full"><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-[#ffd949] text-[#273049] shadow-[0_0_70px_rgba(255,217,73,.3)]"><Trophy className="h-10 w-10" /></div><p className="mt-8 text-sm font-black uppercase tracking-[.28em] text-[#ffd949]">Selamat kepada pemenang</p><p className="mt-6 text-5xl font-black tracking-[-.055em] sm:text-7xl lg:text-8xl">{winner.name}</p><p className="mt-5 text-xl font-bold text-white/55">{winner.department}</p><div className="mx-auto mt-9 inline-flex items-center gap-3 rounded-2xl bg-[#e21b22] px-7 py-4"><Gift className="h-5 w-5" /><span className="text-lg font-black">{winner.prizeName}</span></div><p className="mt-5 text-sm font-black tracking-[.18em] text-white/45">{winner.registrationCode}</p></div> : <div><div className="mx-auto grid h-20 w-20 place-items-center rounded-[28px] bg-white/10 text-[#ffd949]"><Gift className="h-9 w-9" /></div><p className="mt-8 text-sm font-black uppercase tracking-[.28em] text-[#ffd949]">Layar siap</p><p className="mt-6 text-4xl font-black tracking-[-.045em] sm:text-6xl">Menunggu undian dimulai</p><p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-white/50">Pilih hadiah dan tekan tombol shuffle dari dashboard panitia.</p></div>}
        </section>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-white/40"><Users className="h-4 w-4" /> {authLoading || !user || statusQuery.isFetching ? "Menghubungkan layar..." : "Layar tersinkron dengan dashboard panitia"}</div>
      </main>
    </div>
  );
}
