import { listClients } from "@/lib/clients.js";
import { getScannedProjects } from "@/lib/scan.js";
import { metaByRel } from "@/lib/project-meta.js";
import { totalsByClient } from "@/lib/time-entries.js";
import { getTodayHoliday } from "@/lib/external/holidays.js";
import { getFxRates, convertCents } from "@/lib/external/fx.js";
import { config as extConfig } from "@/lib/external/config.js";
import ClientsTable from "@/components/clients/clients-table.jsx";

export const dynamic = "force-dynamic";

function startOfMonth() {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(1); return d.getTime();
}

function formatLocalTime(tz) {
  if (!tz) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date()) + "Z";
  } catch {
    return null;
  }
}

export default async function ClientsPage() {
  const [clients, projects] = await Promise.all([
    Promise.resolve(listClients()),
    getScannedProjects(),
  ]);
  const meta = metaByRel();

  const projectRows = projects
    .filter((p) => p.tracked !== false && p.status !== "untracked")
    .map((p) => ({
      rel: p.rel,
      name: p.name,
      status: p.status,
      client_id: meta[p.rel]?.client_id ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // External signals — parallel + non-blocking. Computed once for the page.
  const monthlyTotalsRaw = totalsByClient({ from: startOfMonth(), billable: true });
  const monthlyTotalsById = new Map(
    monthlyTotalsRaw.filter((r) => r.client_id != null).map((r) => [r.client_id, r])
  );
  const [fxR, ...holidaysR] = await Promise.allSettled([
    getFxRates(),
    ...clients.map((c) => (c.country ? getTodayHoliday(c.country) : Promise.resolve(null))),
  ]);
  const fx = fxR.status === "fulfilled" ? fxR.value : null;
  const HOUR_MS = 3600_000;
  const userCcy = extConfig.user.currency;

  const clientSignals = {};
  clients.forEach((c, i) => {
    const tot = monthlyTotalsById.get(c.id);
    let billClient = null, billUser = null;
    if (tot && c.default_rate_cents) {
      const hours = Number(tot.total_ms) / HOUR_MS;
      const cents = Math.round(hours * Number(c.default_rate_cents));
      const ccy = c.default_currency || "USD";
      billClient = { cents, ccy };
      if (fx && ccy !== userCcy) {
        const converted = convertCents(cents, ccy, userCcy, fx);
        if (converted != null) billUser = { cents: converted, ccy: userCcy };
      }
    }
    const hol = holidaysR[i]?.status === "fulfilled" ? holidaysR[i].value : null;
    clientSignals[c.id] = {
      localTime: formatLocalTime(c.tz),
      tz: c.tz || null,
      holiday: hol,
      monthBillClient: billClient,
      monthBillUser: billUser,
    };
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Group projects, set default rates, keep contact info handy. Click a row to manage its projects.
        </p>
      </header>
      <ClientsTable clients={clients} projects={projectRows} signals={clientSignals} />
    </div>
  );
}
