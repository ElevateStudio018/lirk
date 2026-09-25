import { KleoMark } from "./Brand";
import { Send } from "./Icons";

const SIDEBAR = [
  { label: "Hem", active: true },
  { label: "Teamet" },
  { label: "Godkännanden", badge: 3 },
  { label: "Historik" },
  { label: "Inställningar" },
];

const OFFER = [
  ["Arbete", "42 000 kr"],
  ["Material", "18 500 kr"],
  ["ROT-avdrag (30 % av arbetet)", "−12 600 kr"],
];

/**
 * A coded replica of the Kleo platform: a quote drafted by Säljassistenten,
 * waiting for approval. Used as the tilting product screen.
 */
export default function AppMock() {
  return (
    <div className="flex h-full w-full overflow-hidden rounded-[inherit] bg-bg text-left text-[13px] text-ink">
      {/* Sidebar */}
      <aside className="hidden w-[23%] shrink-0 flex-col border-r border-black/[0.06] bg-white/60 p-4 sm:flex">
        <div className="flex items-center gap-2 px-2 py-1">
          <KleoMark size={18} />
          <span className="font-display text-[15px] font-semibold tracking-[-0.04em]">Kleo</span>
        </div>
        <nav className="mt-6 flex flex-col gap-0.5">
          {SIDEBAR.map((item) => (
            <span
              key={item.label}
              className={`flex items-center justify-between rounded-lg px-2.5 py-2 ${
                item.active ? "bg-white font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06)]" : "text-ink-2"
              }`}
            >
              {item.label}
              {item.badge ? (
                <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-blue px-1 text-[10px] font-semibold text-white">
                  {item.badge}
                </span>
              ) : null}
            </span>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 rounded-xl p-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-[10px] font-semibold text-white">
            AA
          </span>
          <span className="leading-tight">
            <span className="block text-[12px] font-medium">Anna Andersson</span>
            <span className="block text-[11px] text-ink-3">Anderssons Rör AB</span>
          </span>
        </div>
      </aside>

      {/* Conversation */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3">
          <span className="font-medium">Offert till familjen Berg</span>
          <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2D8A4E]" />3 i teamet online
          </span>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden px-5 py-5">
          <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-white">
            Kan du skriva en offert till familjen Berg? Badrumsrenovering, 6 kvm. Glöm inte ROT.
          </div>

          <div className="flex max-w-[92%] gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#D45A2B] text-[10px] font-semibold text-white">
              SÄ
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ink-3">
                <span className="font-medium text-ink">Säljassistenten</span> · klart på 40 sekunder
              </p>
              <div className="mt-2 rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(16,41,110,0.25)]">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Offert · Badrumsrenovering</span>
                  <span className="rounded-full bg-blue/10 px-2 py-0.5 text-[11px] font-medium text-blue">Utkast</span>
                </div>
                <dl className="mt-3 space-y-1.5">
                  {OFFER.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 text-ink-2">
                      <dt className="truncate">{k}</dt>
                      <dd className="tabular-nums">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-dashed border-black/10 pt-2 font-semibold">
                    <dt>Att betala</dt>
                    <dd className="tabular-nums">47 900 kr</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {["Föreslå", "Gör klart, jag kollar", "Kör på"].map((l, i) => (
                    <span
                      key={l}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        i === 1 ? "bg-navy text-white" : "bg-mist text-ink-2"
                      }`}
                    >
                      {l}
                    </span>
                  ))}
                  <span className="ml-auto rounded-full bg-blue px-3 py-1 text-[11px] font-medium text-white">
                    Godkänn & skicka
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
            <span className="text-ink-3">
              Fråga teamet<span className="caret text-blue">|</span>
            </span>
            <span className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-blue text-white">
              <Send size={13} />
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
