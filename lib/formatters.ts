// Formats an ABN string as XX XXX XXX XXX regardless of how it was entered.
export function formatAbn(abn: string): string {
  const d = abn.replace(/\D/g, "");
  if (d.length !== 11) return abn;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
}

export function fh(h: number): string {
  if (!h || h <= 0) return "0h 00m";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${String(mins).padStart(2, "0")}m`;
}

export function fc(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n || 0);
}

// Long date: "Mon, 5 May 2025"
export function fd(d: string): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

// Short invoice date: "05/05/2025"
export function fdInv(d: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function genId(): string {
  return crypto.randomUUID();
}

export function buildPdfFilename(
  pattern: string,
  invoiceNum: number,
  companyName: string,
  date: string,
): string {
  const [y, m, d] = (date || todayStr()).split("-");
  const company = (companyName || "Invoice").replace(/[^a-zA-Z0-9]/g, "");
  const name = (pattern || "Invoice-{num}-{company}-{date}")
    .replace(/\{num\}/g,     String(invoiceNum || 1))
    .replace(/\{company\}/g, company)
    .replace(/\{date\}/g,    `${d}${m}${y}`)
    .replace(/\{year\}/g,    y)
    .replace(/\{month\}/g,   m)
    .replace(/\{day\}/g,     d);
  return name.endsWith(".pdf") ? name : name + ".pdf";
}

export async function downloadPdf(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF }   = await import("jspdf");
  const canvas = await html2canvas(element, {
    scale: 1.5, useCORS: true, backgroundColor: "#ffffff", logging: false,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW   = pdf.internal.pageSize.getWidth();
  const pageH   = pdf.internal.pageSize.getHeight();
  const imgH    = (canvas.height * pageW) / canvas.width;
  let remaining = imgH;
  let offset    = 0;
  pdf.addImage(imgData, "PNG", 0, offset, pageW, imgH);
  remaining -= pageH;
  while (remaining > 0) {
    offset -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, offset, pageW, imgH);
    remaining -= pageH;
  }
  pdf.save(filename);
}
