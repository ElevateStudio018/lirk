# Lirk – AI-studieplattform (V1)

Lirk hjälper svenska elever att plugga inför ett prov. Eleven lägger in provet och lärarens
underlag. Appen tar reda på vad provet kräver, testar vad eleven redan kan, bygger en plan som
anpassas efter resultaten och ger korta visuella lektioner, övningar, övningsprov och en
bedömning kopplad till underlaget.

Allt är byggt kring en enda fråga: **Vad ska jag göra idag?**

```
Skapa prov → Underlag → Kunskapskarta → Diagnostiskt test → Studieplan
   → Pass (lektion med checkpoints → övningar → adaptiva steg) …
   → Övningsprov 1 → AI-bedömning → Riktad träning → Slutprov → Jämförelse
```

## Design

Helt svart gränssnitt i stil med Days Since och Cal AI: svart bakgrund, grafitgrå nyanser, vita
pill-knappar och "liquid glass"-ytor (halvgenomskinliga, blurrade kort med ljuskant). Dashboarden
visar dagarna kvar som en enda stor siffra. Allt styrs av tokens och utilities i
`src/app/globals.css`: `glass`, `glass-strong` och `glass-panel` för modaler, sheets och den
flytande tabbaren. Videolektionerna (`src/remotion/theme.ts`) använder samma svarta glastema.

## Kom igång

```bash
npm install
cp .env.example .env.local        # fyll i Supabase + OpenAI
npm run dev
```

### Supabase

1. Skapa ett Supabase-projekt.
2. Kör migrationen `supabase/migrations/20260927000001_init.sql`, antingen i SQL-editorn eller med
   `supabase db push`. Migrationen skapar alla tabeller, index, RLS-policyer, triggers och den
   privata lagringsbucketen `materials`.
3. Under **Authentication → URL Configuration**: lägg till `<din-url>/auth/callback` som redirect-URL
   (behövs för magisk länk och e-postbekräftelse).
4. Lägg in `NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon-nyckeln).

Service-role-nyckeln används **inte** någonstans. Alla frågor går som den inloggade användaren,
så RLS gäller alltid, även i route handlers.

Utan Supabase-variabler skickar appen till `/setup` med instruktioner. Utan `OPENAI_API_KEY`
fungerar allt som inte kräver AI, och AI-funktionerna visar ett tydligt felmeddelande i stället
för att krascha.

## Kommandon

| Kommando | Vad det gör |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint (inkl. React Compiler-regler) · TypeScript |
| `npm test` | Enhetstester (vitest): motorer, rättning, AI-klient, AI-skydd, videoschema |
| `npm run test:db` | Kör migrationen + RLS-tester mot en lokal PostgreSQL (`PGHOST`, `PGPORT`, `PGUSER`) |
| `npm run test:e2e` | Hela studieloopen genom tjänstelagret mot PostgreSQL + PostgREST med RLS (se nedan) |
| `npm run gen:types` | Genererar `src/lib/supabase/database.types.ts` från migrationerna (utan Docker) |
| `npm run remotion:studio` | Remotion Studio med testlektionerna |
| `npm run remotion:render -- GreenhouseDemo out.mp4` | Renderar en lektion till MP4 |

## Arkitektur

```
src/
  app/                      Next.js App Router (Next 16, "proxy.ts" i stället för middleware)
    (app)/                  inloggade sidor: dashboard, exams, study, exam, results, profile
    api/                    route handlers för allt som tar tid eller anropar AI
    demo/lektion/[slug]     publika testlektioner
  components/
    ui/                     designsystemet (Button, Card, ProgressRing, Modal, Sheet, Tabs …)
    lesson/lesson-player    Remotion Player + checkpoints + mikrolektioner + textning + TTS
    questions/              inmatning för alla nio frågetyper + feedback
  lib/
    domain/                 zod-scheman: frågor, passaktiviteter, ämnesprofiler
    engine/                 deterministiska motorer (ren TypeScript, fullt testade)
    ai/                     OpenAI-klient + en fil per AI-uppgift
    services/               server-only affärslogik (databas + motorer + AI)
    video/                  scenschema, tidslinje, TTS-gränssnitt, testlektioner
    supabase/               klienter (browser/server/proxy) och genererade typer
  remotion/                 kompositionen och de 16 scenkomponenterna
supabase/
  migrations/               schema + RLS
  tests/                    RLS-tester + Supabase-shim för vanlig PostgreSQL
public/demo/                demomaterial (Geografi åk 8, Matematik)
tests/                      enhetstester och e2e
```

### Principer

- **AI analyserar, regler beslutar.** Mastery, studieplan, adaptiva beslut, provberedskap och
  jämförelser räknas deterministiskt i `lib/engine`. LLM:en används för det språkliga: läsa underlag,
  skriva frågor och lektioner, rätta öppna svar och bedöma prov.
- **Allt AI-svar valideras.** `generateStructured` använder Structured Outputs (strict JSON Schema
  från zod), validerar svaret igen med zod plus en semantisk validator per uppgift, skickar tillbaka
  problemen och försöker en gång till. Fel blir `AIError` med stabila koder, som visas som vänliga
  meddelanden med "Försök igen".
- **Hitta aldrig på underlag.** Varje område i kunskapskartan har `source_material_id` och citat.
  Citaten kontrolleras mot den riktiga texten, och ett "uttryckligt" område vars citat inte går att
  hitta nedgraderas automatiskt till "appens bedömning". Material som inte går att läsa markeras som
  misslyckat med en tydlig förklaring.
- **Inga betygslöften.** Bedömningen nekas om texten förutsäger ett betyg. Utan betygskriterier i
  underlaget ersätts kriterietexten med en fast formulering som säger just det.

### Motorerna (`src/lib/engine`)

| Modul | Innehåll |
|---|---|
| `mastery.ts` | Beta-fördelning (Jeffreys-prior) över all svarshistorik, viktad efter frågetyp och källa, med tidsavklingning. Ger `mastery`, `confidence` och mönstret *consistent success / consistent failure / mixed / insufficient evidence*. Ett enskilt fel ger låg säkerhet, inte låg kunskap. |
| `grading.ts` | Deterministisk rättning: flerval (med missuppfattning), tal (inkl. upptäckt av minustecken som fallit bort), ordningsföljd, para ihop, hitta felet. |
| `planner.ts` | Prioritet = 0,4·viktighet + 0,4·lucka·säkerhet + 0,2·förkunskapsvikt. Förkunskaper först, spacad repetition efter 1/3/7 dagar, kända områden repeteras bara, de två sista passen är *Övningsprov 1* och *Riktad träning + Slutprov*. Om tiden inte räcker väljs de minst viktiga bort, och eleven får veta vilka. |
| `adaptive.ts` | Regelmotor: SKIP, MICRO_LESSON, EASIER_EXAMPLE, HARDER_QUESTION, REVIEW, CONTINUE. Varje beslut loggas i `adaptive_decisions` med regel, skäl och indata och visas under *Plan → Varför ser planen ut så här?* |
| `readiness.ts` | Provberedskap = viktat snitt av kunskap × (0,6 + 0,4·säkerhet) × minne, plus täckning. Förklaringen syns i "Så här räknades detta ut". |
| `compare.ts` | Övningsprov 1 mot slutprovet: vad förbättrades, vad är osäkert, vad du ska titta på precis innan provet. |
| `next-step.ts` | Svarar på "Vad ska jag göra idag?" för dashboarden. |

### Material-pipeline

`UPLOAD → STORE` sker i webbläsaren, direkt mot den privata bucketen. RLS begränsar varje användare
till `<user_id>/…`. `EXTRACT → NORMALIZE` körs i `POST /api/materials/:id/process`:

- PDF: text via `unpdf`
- text/markdown: läses som den är
- bilder: AI-vision som bara transkriberar det som faktiskt syns
- inklistrad text och "det här har läraren sagt": sparas som den är

Varje steg sätter `processing_status` (uploaded → processing → ready | failed). Både originalet och
den normaliserade texten sparas. Steget `ANALYZE` bygger kunskapskartan.

### Video

En lektion är `{ title, scenes[], checkpoints[] }` (`lib/video/schema.ts`). Det finns 16
scenmallar: title, concept, big-number, comparison, timeline, process, cause-effect, equation,
graph, quote, definition, memory-trick, misconception, example, summary och question-transition.
AI:n skriver scenerna som JSON, och `remotion/SceneRenderer.tsx` väljer rätt React-komponent.
Allt ritas med text, SVG och CSS, med frame-baserade animationer (spring, ritade linjer och pilar,
räknare, sekventiell visning, zoom och panorering).

Lektionsspelaren har play/paus, spolning, förlopp, helskärm (med CSS-reserv för iPhone), textning
och hastighet. Vid en checkpoint pausas videon. Rätt svar ger `continue`. Fel svar som avslöjar en
missuppfattning, eller två fel i rad, ger `insert_micro_lesson`: en kort serie scener i samma
spelare. Därefter fortsätter lektionen.

Rösten går via gränssnittet `TTSProvider` (`lib/video/tts.ts`). V1 använder webbläsarens talsyntes
på svenska och faller tillbaka på `SilentTTSProvider`. Textningen visas alltid, så appen fungerar
helt utan röst.

Testlektionerna *Växthuseffekten* (geografi) och *Enkla ekvationer* (matematik) använder
tillsammans alla 16 scentyper. De kan ses utan inloggning på `/demo/lektion/vaxthuseffekten` och
`/demo/lektion/ekvationer`.

### Databas

Tabeller: `profiles`, `study_projects`, `source_materials`, `knowledge_topics`,
`diagnostic_questions`, `question_attempts` (all svarshistorik), `study_plans`, `study_sessions`,
`lesson_modules`, `lesson_scenes`, `exercise_sets`, `adaptive_decisions`, `mock_exams`,
`mock_exam_questions`, `exam_attempts`, `assessment_results` och `remediation_targets`.

Varje tabell har `user_id default auth.uid()` och RLS. Vid insert och update kontrolleras dessutom
att föräldraraden (prov, lektion, övningsprov) tillhör samma användare. En trigger låser inskickade
provförsök, så att svaren inte kan ändras och försöket inte kan öppnas igen.

## Tester

- **Enhetstester** (`npm test`, 78 st): motorer, rättning, AI-klienten (retry, validering,
  felkoder med mockad OpenAI), skydd mot påhittade citat och betygslöften, videoscheman, tidslinje,
  checkpoints och normalisering.
- **RLS** (`npm run test:db`): User B kan varken läsa, ändra, radera eller koppla data till User A:s
  prov, lektioner, övningsprov eller filer. Anon har ingen åtkomst. Inskickade prov är låsta.
- **End-to-end** (`npm run test:e2e`, 9 st): hela loopen för *Geografi åk 8 – växthuseffekt och
  klimat*. Det går från demounderlaget via kunskapskarta, diagnos, plan, pass med checkpoint och
  adaptiv mikrolektion, övningsprov 1 med låsning och bedömning, riktad träning och slutprov till
  jämförelserapporten. En andra körning gör samma sak för *Matematik – ekvationer*. Testet går mot
  riktig PostgreSQL med produktionens migration och RLS via PostgREST (samma REST-lager som
  Supabase). Bara LLM:en är utbytt mot fixturer, och de måste klara exakt samma zod-scheman och
  validatorer som riktiga modellsvar.

## Status per prompt

| # | Område | Status |
|---|---|---|
| 1 | Grundprojekt, designsystem, layouter, navigation | ✅ Tokens i `globals.css`, 12 UI-komponenter, sidomeny (desktop) och bottenmeny (mobil) |
| 2 | Auth + databas | ✅ E-post/lösenord och magisk länk, profiler, migration, RLS, genererade typer, RLS-test |
| 3 | Skapa ett prov | ✅ Guide i sex steg, uppladdning, klistra in, "läraren har sagt", exempelunderlag |
| 4 | Materialprocessor | ✅ Pipeline med status, PDF, text och vision, förhandsvisning av inläst text, tydliga fel |
| 5 | Kunskapskarta | ✅ Strukturerad output, explicit mot inferred i UI, citat med källa, verifiering |
| 6 | Diagnostiskt test | ✅ 8–15 frågor, två frågor per viktigt område, mastery och säkerhet, kort sammanfattning |
| 7 | Studieplan | ✅ Deterministisk, spacad repetition, de två sista passen, omplanering efter varje pass |
| 8 | Videomotor | ✅ 16 scenmallar, JSON → lektion, två testlektioner i olika ämnen |
| 9 | Spelare + checkpoints | ✅ Alla kontroller, continue eller insert_micro_lesson, sparar förlopp och svar |
| 10 | Övningsmotor | ✅ Nio frågetyper, konkret feedback, mastery från historik, mönster |
| 11 | Adaptiv motor | ✅ Regelmotor med sex beslut, loggning och förklaring i UI |
| 12 | Dashboard + provberedskap | ✅ Nästa uppgift, dagar kvar, områden i grön/gul/röd/grå, förklarad beredskap |
| 13 | Övningsprov 1 | ✅ Ingen hjälp, nya frågor, ämnesanpassat, autospar, låses vid inlämning |
| 14 | AI-bedömning | ✅ Sex dimensioner per fråga, källhänvisningar, kriterier eller tydligt "saknas", tre viktigaste, åtgärdsmål |
| 15 | Riktad träning + slutprov | ✅ 3–4 svagheter, mikrolektion, exempel, återkallning, svårare fråga och kontrollfråga, nya frågor, jämförelse |
| 16 | Polish, QA, demo | ✅ Laddnings-, tom-, fel- och försök-igen-lägen, demounderlag, e2e, visuell granskning mobil/desktop |

## Kvarvarande teknisk skuld

- **Riktiga AI-körningar är inte testade i den här miljön.** Det fanns ingen `OPENAI_API_KEY`, så
  e2e-testerna använder fixturer. Promptkvaliteten, svarstider och kostnad behöver provas mot
  riktiga modeller innan lansering. Modellnamnen går att ändra via env.
- **Långa AI-anrop är synkrona HTTP-anrop** (upp till cirka 60–90 s för kunskapskarta, lektion och
  bedömning, `maxDuration` 300). Nästa steg är en jobbkö eller bakgrundsfunktioner med polling eller
  realtime, så att en avbruten förfrågan inte lämnar ett prov i läget `analyzing`. Just nu kan
  eleven starta om analysen.
- **Ingen rate limiting eller kostnadsspärr** per användare för AI-anrop.
- **Supabase Auth och Storage är inte e2e-testade.** Auth-flödet och uppladdning till Storage är
  bara verifierade mot typer och dokumentation. Databasdelen är testad mot PostgreSQL och PostgREST.
  Kör ett varv mot ett riktigt Supabase-projekt.
- **Skannade PDF:er** avvisas med en uppmaning att ladda upp foton. Det finns ingen OCR av
  PDF-sidor, och HEIC-bilder stöds inte.
- **Webbläsarens talsyntes** varierar i kvalitet mellan enheter, och på iOS går den inte att pausa
  mitt i en mening, så den startas om per scen. En moln-TTS med förrenderade ljudfiler kopplas in via
  `TTSProvider`.
- **Remotion-licens:** Remotion är gratis för individer och små företag (högst 3 anställda). Större
  organisationer behöver en företagslicens.
- **Renderad MP4** stöds via Remotion CLI, men appen spelar alltid upp lektioner live i spelaren.
  Det finns ingen server-rendering eller CDN för video.
- **Ljust läge** finns inte. Appen är alltid mörk.
- `backdrop-filter` (glaseffekten) kostar prestanda på äldre Android-enheter.
- Tillgänglighet (skärmläsare i spelaren, tangentbordsnavigering i provet) är grundläggande men
  inte granskad med hjälpmedel.
