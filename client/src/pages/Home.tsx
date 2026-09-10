import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, ClipboardCheck, Download, Gift, Loader2, Ticket, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

const formatRegistered = (iso?: string) => {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

function EventHeader() {
  return (
    <header className="app-topbar">
      <Link href="/" className="flex items-center gap-3">
        <img src="/assets/inventory/logo-sasa.png" alt="Sasa" className="brand-logo" />
        <span className="sr-only">Sasa Event Hub</span>
      </Link>
      <div className="flex items-center gap-3"><span className="app-crumb">Registrasi undangan</span></div>
    </header>
  );
}

export default function Home() {
  const [form, setForm] = useState({ name: "", department: "", phone: "" });
  const [ticket, setTicket] = useState<{ registrationCode: string; name: string; department: string; phone: string; createdAt?: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const registerMutation = trpc.event.register.useMutation({
    onSuccess: result => {
      setTicket({ ...result, department: form.department, phone: form.phone });
      setForm({ name: "", department: "", phone: "" });
    },
  });

  useEffect(() => {
    if (!ticket) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(ticket.registrationCode, {
      width: 320,
      margin: 2,
      color: { dark: "#273049", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [ticket]);

  useEffect(() => {
    let active = true;
    fetch("/assets/inventory/logo-sasa-white.png")
      .then(response => response.blob())
      .then(
        blob =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      )
      .then(dataUrl => {
        if (active) setLogoDataUrl(dataUrl);
      })
      .catch(() => setLogoDataUrl(null));
    return () => {
      active = false;
    };
  }, []);

  const downloadTicketPdf = () => {
    if (!ticket || !qrDataUrl) return;
    const pdf = new jsPDF({ unit: "mm", format: "a5" });
    const pageBg: [number, number, number] = [247, 248, 250];
    const navy: [number, number, number] = [39, 48, 73];
    const red: [number, number, number] = [226, 27, 34];
    const grey: [number, number, number] = [154, 162, 175];
    const line: [number, number, number] = [229, 232, 237];
    const cx = 74;

    // page background
    pdf.setFillColor(...pageBg);
    pdf.rect(0, 0, 148, 210, "F");

    // ticket card
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(10, 10, 128, 190, 6, 6, "F");

    // red header band (square bottom so the body can overlap with rounded top)
    pdf.setFillColor(...red);
    pdf.roundedRect(10, 10, 128, 62, 6, 6, "F");
    pdf.rect(10, 58, 128, 14, "F");

    // decorative translucent circles
    try {
      const G = (pdf as any).GState;
      pdf.saveGraphicsState();
      pdf.setGState(new G({ opacity: 0.12 }));
      pdf.setFillColor(255, 255, 255);
      pdf.circle(130, 20, 15, "F");
      pdf.circle(22, 64, 16, "F");
      pdf.restoreGraphicsState();
    } catch {
      /* decorative only */
    }

    // header content
    if (logoDataUrl) {
      pdf.addImage(logoDataUrl, "PNG", 19, 16, 28, 14.8);
    } else {
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("Sasa", cx, 27, { align: "center" });
    }
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.text("TIKET UNDANGAN", cx, 41, { align: "center" });
    pdf.setFontSize(15);
    pdf.text("Sasa Event Hub", cx, 51, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text("Malam Apresiasi  ·  Rasa Bersama", cx, 58, { align: "center" });

    // white body card overlapping the header
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(10, 66, 128, 134, 6, 6, "F");

    // left column: QR
    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(18, 80, 46, 46, 4, 4, "S");
    pdf.addImage(qrDataUrl, "PNG", 21, 83, 40, 40);
    pdf.setTextColor(...grey);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.text("KODE TIKET", 41, 133, { align: "center" });
    pdf.setTextColor(...red);
    pdf.setFontSize(13);
    pdf.text(ticket.registrationCode, 41, 141, { align: "center" });

    // right column: details
    const rx = 72;
    pdf.setFillColor(255, 240, 240);
    pdf.roundedRect(rx, 80, 34, 7, 3.5, 3.5, "F");
    pdf.setTextColor(...red);
    pdf.setFontSize(6.5);
    pdf.text("TAMU UNDANGAN", rx + 17, 84.7, { align: "center" });

    pdf.setTextColor(...navy);
    pdf.setFontSize(15);
    pdf.text(pdf.splitTextToSize(ticket.name, 62)[0] ?? ticket.name, rx, 97);

    const field = (label: string, value: string, y: number) => {
      pdf.setTextColor(...grey);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.5);
      pdf.text(label, rx, y);
      pdf.setTextColor(...navy);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(pdf.splitTextToSize(value || "-", 62)[0] ?? "-", rx, y + 6);
    };
    field("DIVISI / DEPARTEMEN", ticket.department, 106);
    field("NO. HANDPHONE", ticket.phone, 121);
    field("TERDAFTAR", formatRegistered(ticket.createdAt), 136);

    // perforation divider
    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.4);
    pdf.setLineDashPattern([1.4, 1.4], 0);
    pdf.line(16, 154, 132, 154);
    pdf.setLineDashPattern([], 0);
    pdf.setFillColor(...pageBg);
    pdf.circle(10, 154, 3, "F");
    pdf.circle(138, 154, 3, "F");

    // status row
    pdf.setTextColor(...grey);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.text("STATUS", 16, 164);
    const statuses = [
      { label: "Registrasi", value: "Selesai", done: true },
      { label: "Doorprize", value: "Menunggu undian", done: false },
      { label: "Hadiah", value: "Belum diambil", done: false },
    ];
    const bw = 36.5;
    const gap = 3.5;
    statuses.forEach((s, i) => {
      const x = 16 + i * (bw + gap);
      pdf.setDrawColor(...line);
      pdf.setLineWidth(0.3);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(x, 168, bw, 15, 3, 3, "FD");
      pdf.setFillColor(s.done ? 77 : 201, s.done ? 150 : 205, s.done ? 41 : 214);
      pdf.circle(x + 4, 173, 0.9, "F");
      pdf.setTextColor(...navy);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text(s.label, x + 6, 174.5);
      pdf.setTextColor(...grey);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      pdf.text(s.value, x + 3, 180);
    });

    // footer
    pdf.setTextColor(...grey);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.text("Simpan tiket ini dan tunjukkan QR kepada panitia saat pengambilan hadiah.", cx, 194, { align: "center" });

    pdf.save(`tiket-${ticket.registrationCode}.pdf`);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    registerMutation.mutate(form);
  };

  return (
    <div className="app-shell min-h-screen bg-[#f7f8fa] text-[#273049]">
      <EventHeader />
      <main>
        <section id="registrasi" className="mx-auto grid min-h-[calc(100vh-82px)] w-full max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[.7fr_1.3fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#e21b22]">01 / Registrasi undangan</p>
            <h2 className="brand-display mt-4 text-4xl font-black leading-tight tracking-[-.045em] text-[#273049] sm:text-5xl">Satu langkah untuk ikut keseruannya.</h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-[#6b6255]">Isi data dengan benar. Kode registrasi akan muncul setelah formulir berhasil dikirim dan dipakai saat mengambil hadiah.</p>
            <div className="mt-9 space-y-4">
              {[{ icon: Users, text: "Data aman untuk kebutuhan event" }, { icon: Gift, text: "Kesempatan doorprize untuk setiap undangan" }, { icon: ClipboardCheck, text: "Tiket digital langsung setelah daftar" }].map(item => <div key={item.text} className="flex items-center gap-3 text-sm font-bold text-[#6b6255]"><span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#fff0bf] text-[#a26b00]"><item.icon className="h-4 w-4" /></span>{item.text}</div>)}
            </div>
          </div>
          <div className={ticket ? "rounded-[28px] border border-[#e5e8ed] bg-white shadow-[0_18px_50px_rgba(39,48,73,.07)]" : "rounded-[28px] border border-[#e5e8ed] bg-white p-6 shadow-[0_18px_50px_rgba(39,48,73,.07)] sm:p-9"}>
            {ticket ? (
              <div className="flex flex-col items-center p-5 sm:p-6">
                <p className="mb-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#4d9629]"><CheckCircle2 className="h-4 w-4" /> Registrasi berhasil</p>

                <div className="w-full overflow-hidden rounded-[26px] border border-[#e5e8ed] bg-white shadow-[0_18px_44px_rgba(39,48,73,.10)]">
                  <header className="relative overflow-hidden bg-gradient-to-br from-[#e21b22] to-[#9d0e17] px-6 pb-12 pt-7 text-center text-white">
                    <span className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-white/10" />
                    <span className="pointer-events-none absolute -bottom-16 -left-14 h-40 w-40 rounded-full bg-white/[.07]" />
                    <img src="/assets/inventory/logo-sasa-white.png" alt="Sasa" className="relative mx-auto h-9 w-auto" />
                    <p className="relative mt-5 text-[10px] font-black uppercase tracking-[.3em] text-white/80">Tiket Undangan</p>
                    <h3 className="brand-display relative mt-2 text-2xl font-black tracking-[-.03em] sm:text-3xl">Sasa Event Hub</h3>
                    <p className="relative mt-2 text-xs font-semibold text-white/75">Malam Apresiasi · Rasa Bersama</p>
                  </header>

                  <div className="relative -mt-6 rounded-t-[24px] bg-white px-6 pb-6 pt-6">
                    <div className="grid gap-6 sm:grid-cols-[minmax(0,150px)_1fr]">
                      <div className="mx-auto w-full max-w-[180px] sm:mx-0">
                        <div className="grid aspect-square place-items-center rounded-2xl border border-[#e5e8ed] bg-white p-3">
                          {qrDataUrl ? <img src={qrDataUrl} alt={`QR tiket ${ticket.registrationCode}`} className="h-full w-full object-contain" /> : <div className="h-full w-full animate-pulse rounded-xl bg-[#f4f1ed]" />}
                        </div>
                        <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[.2em] text-[#9aa2af]">Kode Tiket</p>
                        <p className="mt-1 text-center text-lg font-black tracking-[.06em] text-[#e21b22]">{ticket.registrationCode}</p>
                      </div>

                      <div className="min-w-0">
                        <span className="inline-flex items-center rounded-full bg-[#fff0f0] px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-[#e21b22]">Tamu Undangan</span>
                        <h4 className="brand-display mt-3 truncate text-2xl font-black tracking-[-.03em] text-[#273049]">{ticket.name}</h4>
                        <dl className="mt-4 space-y-3">
                          <div>
                            <dt className="text-[10px] font-black uppercase tracking-[.14em] text-[#9aa2af]">Divisi / Departemen</dt>
                            <dd className="mt-0.5 text-sm font-bold text-[#273049]">{ticket.department}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-black uppercase tracking-[.14em] text-[#9aa2af]">No. Handphone</dt>
                            <dd className="mt-0.5 text-sm font-bold text-[#273049]">{ticket.phone}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-black uppercase tracking-[.14em] text-[#9aa2af]">Terdaftar</dt>
                            <dd className="mt-0.5 text-sm font-bold text-[#273049]">{formatRegistered(ticket.createdAt)}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    <div className="my-6 border-t-2 border-dashed border-[#e5e8ed]" />

                    <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#9aa2af]">Status</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "Registrasi", value: "Selesai", done: true },
                        { label: "Doorprize", value: "Menunggu undian", done: false },
                        { label: "Hadiah", value: "Belum diambil", done: false },
                      ].map(item => (
                        <div key={item.label} className="rounded-xl border border-[#e5e8ed] bg-white px-2 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${item.done ? "bg-[#4d9629]" : "bg-[#c9cdd6]"}`} />
                            <p className="text-[11px] font-black text-[#273049]">{item.label}</p>
                          </div>
                          <p className="mt-1 text-[10px] font-semibold leading-tight text-[#9aa2af]">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="mt-5 max-w-sm text-center text-sm leading-6 text-[#6b6255]">Simpan QR code atau unduh tiket PDF untuk ditunjukkan saat event.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-3"><button type="button" disabled={!qrDataUrl} onClick={downloadTicketPdf} className="inline-flex items-center gap-2 rounded-full bg-[#273049] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#1b2237] disabled:opacity-50"><Download className="h-4 w-4" /> Download tiket PDF</button><button type="button" onClick={() => setTicket(null)} className="rounded-full border border-[#eadfcf] bg-white px-4 py-2.5 text-sm font-black text-[#e21b22]">Daftar lagi</button></div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div className="mb-7"><p className="text-xs font-black uppercase tracking-[.18em] text-[#9a8d7b]">Formulir tamu</p><h3 className="mt-2 text-2xl font-black text-[#273049]">Lengkapi data kamu</h3></div>
                <label className="field-label">Nama lengkap<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Sasa Putri" className="field-input" /></label>
                <label className="field-label">Divisi / departemen<input required value={form.department} onChange={event => setForm({ ...form, department: event.target.value })} placeholder="Contoh: Marketing" className="field-input" /></label>
                <label className="field-label">No handphone<input required type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="08xx-xxxx-xxxx" className="field-input" /></label>
                {registerMutation.error && <p className="rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-semibold text-[#c9161d]">{registerMutation.error.message}</p>}
                <button type="submit" disabled={registerMutation.isPending} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e21b22] px-5 py-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(226,27,34,.18)] transition hover:bg-[#c9161d] disabled:cursor-not-allowed disabled:opacity-60">{registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} {registerMutation.isPending ? "Menyimpan data..." : "Daftar & dapatkan tiket"}</button>
                <p className="text-center text-xs leading-5 text-[#a29482]">Dengan mendaftar, kamu bersedia mengikuti ketentuan event Sasa.</p>
              </form>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
