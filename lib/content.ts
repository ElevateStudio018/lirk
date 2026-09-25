/**
 * All copy on the site, taken from the current Kleo marketing site
 * (marketing/index.html + the Framer copy replacements in kleo-platform).
 */

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://primr-saas.vercel.app").replace(/\/$/, "");

export const LINKS = {
  signup: `${APP_URL}/onboarding`,
  login: `${APP_URL}/auth/login`,
  privacy: `${APP_URL}/integritetspolicy`,
  terms: `${APP_URL}/villkor`,
  leads: `${APP_URL}/api/leads`,
  email: "hej@kleo.se",
};

export const NAV = [
  { label: "Teamet", href: "#teamet" },
  { label: "Så funkar det", href: "#sa-funkar-det" },
  { label: "Priser", href: "#priser" },
  { label: "Vanliga frågor", href: "#vanliga-fragor" },
];

export const HERO = {
  eyebrow: "Det digitala teamet för svenska småföretagare.",
  title: "Den anställde du inte har råd att anställa.",
  lead: "Kleo är ett team av digitala medarbetare som sköter sälj, fakturor, kundservice, marknadsföring och HR åt dig. Anställ på tre minuter. Du har alltid sista ordet.",
  primary: "Anställ ditt team",
  secondary: "Starta gratis",
};

export const AUDIENCE = {
  title: "För svenska småföretagare som vill mer",
  industries: ["Verkstäder", "Salonger", "Restauranger", "Byggfirmor", "Butiker", "Gårdar"],
  note: "Inte konsulter. Inte byråer. Folk som faktiskt driver något.",
};

export const VALUES = {
  label: "Byggd för dig som driver eget",
  words: ["Trygghet.", "Avlastning.", "Effektivitet."],
  body: "Ingen växer in i mer admin. Kleo lär sig hur du jobbar, vad du prioriterar och hur du pratar med dina kunder. Ju mer du litar på teamet, desto mer tar de.",
  cta: "Starta gratis",
};

export const PRODUCT = {
  eyebrow: "Teamet",
  title: "Slut på att jaga uppföljningar och fakturor.",
  body: "Kleo binder ihop kunder, mejl och underlag på ett ställe.",
};

export const FEATURES = [
  {
    title: "Sälj & uppföljning",
    body: "Säljassistenten skriver offerten, uppföljningen och svaret till kunden innan du hinner glömma. Du läser igenom och skickar — kunden får svar samma dag.",
  },
  {
    title: "Ekonomi & fakturor",
    body: "Ekonomin skriver fakturatexten när jobbet är klart och påminnelsen när någon är sen med betalningen. Underlaget är redo att klistra in i Fortnox eller Visma.",
  },
  {
    title: "Marknadsföring & HR",
    body: "Marknadsföraren skriver veckans inlägg på Instagram, mejl till stamkunderna och svar på Google-recensioner. HR-stödet tar fram jobbannonser, introduktionsplaner och underlag inför svåra samtal. Du säger ja eller justerar.",
  },
];

export const SPECIALISTS_INTRO = {
  eyebrow: "Tolv specialister",
  title: "Riktigt team. Inte botar.",
  body: "Tolv specialister: sälj, support, ekonomi, marknad, HR, juridik, omvärld, projekt, kundvård, rekrytering, inköp och analys. Var och en med ett tydligt jobb. Inte en chatbot som låtsas vara tolv.",
};

/** Names, roles, taglines and accents from kleo-platform/lib/agent-theme.ts. */
export const SPECIALISTS = [
  {
    name: "Säljassistenten",
    role: "Sälj & Uppföljning",
    tagline: "Kunder, offerter, kalla mejl — stänger fler affärer.",
    accent: "#D45A2B",
    initials: "SÄ",
  },
  {
    name: "Supporten",
    role: "Kundservice & Ärenden",
    tagline: "Lugna svar på tuffa kundfrågor.",
    accent: "#3B7FBF",
    initials: "SU",
  },
  {
    name: "Ekonomin",
    role: "Finans & Fakturering",
    tagline: "Fakturor, kassaflöde, moms — noggrant och realistiskt.",
    accent: "#2D8A4E",
    initials: "EK",
  },
  {
    name: "Marknadsföraren",
    role: "Marknad & Innehåll",
    tagline: "Copy, kampanjer, sociala medier — i din ton.",
    accent: "#7A9B2D",
    initials: "MA",
  },
  {
    name: "HR-stödet",
    role: "Personal & Dokument",
    tagline: "Anställningsavtal, introduktion, svåra samtal — med trygghet.",
    accent: "#B06DA8",
    initials: "HR",
  },
  {
    name: "Juridikstödet",
    role: "Avtal & Juridik",
    tagline: "Avtal, villkor och GDPR – i klartext.",
    accent: "#5E6472",
    initials: "JU",
  },
  {
    name: "Omvärldsbevakaren",
    role: "Konkurrenter & Marknad",
    tagline: "Koll på konkurrenterna och din egen nisch.",
    accent: "#3F63B5",
    initials: "OM",
  },
  {
    name: "Projektledaren",
    role: "Projekt & Planering",
    tagline: "Tidplaner, checklistor och ordning i veckan.",
    accent: "#E08A3C",
    initials: "PR",
  },
  {
    name: "Kundvårdaren",
    role: "Kundvård & Återköp",
    tagline: "Håller kunderna kvar – och får dem att komma tillbaka.",
    accent: "#2D7A8A",
    initials: "KV",
  },
  {
    name: "Rekryteraren",
    role: "Rekrytering & Urval",
    tagline: "Rätt person – från annons till erbjudande.",
    accent: "#9B6B2D",
    initials: "RE",
  },
  {
    name: "Inköparen",
    role: "Inköp & Leverantörer",
    tagline: "Bättre inköp, jämförda offerter, lägre kostnader.",
    accent: "#5A7A3B",
    initials: "IN",
  },
  {
    name: "Analytikern",
    role: "Siffror & Rapporter",
    tagline: "Gör dina siffror begripliga.",
    accent: "#6B5B8A",
    initials: "AN",
  },
];

export const STEPS = {
  title: "Tre steg från kaos till koll.",
  items: [
    {
      n: ".01",
      title: "Sätta upp ditt team",
      body: "Välj de medarbetare du vill ha bland tolv specialister – från sälj och ekonomi till juridik och inköp. Du är igång på under tre minuter. Inga formulär, ingen onboarding-konsult.",
    },
    {
      n: ".02",
      title: "Koppla till dina processer",
      body: "Kleo lär sig din ton, dina kunder och hur du jobbar — medan ni jobbar tillsammans. Inga inställningar att klicka i. Du gör som vanligt. Teamet läser av.",
    },
    {
      n: ".03",
      title: "De levererar, du kontrollerar",
      body: "Tre nivåer per uppgift: Föreslå · Gör klart, jag kollar · Kör på. Du väljer själv för varje sak. Litar du mer? Släpp loss mer. Vill du in i detalj? Det går också.",
    },
  ],
  levels: ["Föreslå", "Gör klart, jag kollar", "Kör på"],
  cta: "Starta gratis",
};

export const WHY = {
  title: "Varför välja Kleo?",
  body: "Inga botar i kö. Inga halvfärdiga AI-lösningar. Ett team som faktiskt gör jobbet — på svenska, för svenska företag.",
  items: [
    {
      title: "Riktigt team. Inte botar.",
      body: "Tolv specialister: sälj, support, ekonomi, marknad, HR, juridik, omvärld, projekt, kundvård, rekrytering, inköp och analys. Var och en med ett tydligt jobb. Inte en chatbot som låtsas vara tolv.",
    },
    {
      title: "Du har sista ordet.",
      body: "Kleo föreslår. Du godkänner. Eller säger åt teamet att köra på — du bestämmer per uppgift, inte en gång för alla.",
    },
    {
      title: "Svensk data. Svensk vardag.",
      body: "Kontot och konversationerna lagras i EU. Vi förstår Fortnox, F-skatt, ROT, RUT och hur en svensk småföretagare faktiskt jobbar. Byggt i Stockholm av folk som själva drivit eget.",
    },
    {
      title: "Igång på tre minuter.",
      body: "Ingen lång uppstart. Ingen konsult som ska ”förstå er verksamhet”. Du har en specialist på plats och klar att jobba — innan kaffet hunnit kallna.",
    },
  ],
};

/**
 * The live site animates template counters whose targets are not in the
 * repo, so these figures are the product facts stated elsewhere in the copy.
 */
export const STATS = {
  title: "Siffror, inte snack.",
  body: "Färdiga utkast på sekunder. Du granskar, teamet skriver.",
  items: [
    {
      value: 12,
      suffix: "",
      label: "specialister i ditt team.",
      body: "Sälj, support, ekonomi, marknad, HR, juridik, omvärld, projekt, kundvård, rekrytering, inköp och analys.",
    },
    {
      value: 3,
      suffix: " min",
      label: "tills du är igång.",
      body: "En junior säljare hade behövt en vecka för att lära känna ditt företag. Kleo behöver mindre än ett kaffe.",
    },
    {
      value: 3,
      suffix: " dagar",
      label: "gratis, utan kort.",
      body: "Inga begränsningar. Du provar hela teamet, inte en demoversion.",
    },
  ],
};

export const TESTIMONIALS = {
  title: "Vad våra kunder säger.",
  body: 'Inga löften om "transformation". Bara företagare som hinner mer. Och kommer hem i tid.',
  label: "Så kan det se ut",
  items: [
    {
      quote:
        "Exempel: salongen får färdiga sms till stamkunder som inte bokat på länge. Ägaren läser igenom och skickar.",
      name: "Sara L.",
      role: "Frisör, Göteborg",
    },
    {
      quote: "Exempel: första offerten skriven på några minuter, med ROT-avdraget uträknat. Klar att skicka.",
      name: "Erik B.",
      role: "Egenföretagare",
    },
    {
      quote:
        "Exempel: påminnelser, offerter och kundsvar som brukar ta en söndag i månaden blir färdiga utkast på några minuter.",
      name: "Lina & Johan",
      role: "Byggfirma med 8 anställda",
    },
  ],
};

export const PRICING = {
  title: "Priser.",
  body: "Ingen bindningstid. Inga dolda avgifter. Säg upp när du vill — direkt i kontot.",
  includes: "Ingår",
  cta: "Starta gratis",
  plans: [
    {
      name: "Solo",
      price: "1 499 kr/mån",
      body: "För dig som driver själv. 2 medarbetare. Igång på 3 minuter. Mejl-support. Resend-mejl ingår. 3 dagar gratis.",
      features: [
        "2 digitala medarbetare",
        "Igång på 3 minuter",
        "Support via mejl",
        "Lär sig din ton",
        "Ingen bindningstid",
      ],
    },
    {
      name: "Team",
      price: "2 499 kr/mån",
      body: "För dig med 1–5 anställda. 3 medarbetare. Översikt på allt som händer. Alla kontrollnivåer. 3 dagar gratis.",
      features: [
        "3 digitala medarbetare",
        "Översikt över allt teamet gör",
        "Support på svenska",
        "Alla kontrollnivåer",
        "Ingen bindningstid",
      ],
    },
    {
      name: "Avdelning",
      price: "4 499 kr/mån",
      body: "För dig med 6–15 anställda. 6 medarbetare. Egen kontaktperson. Vi sätter upp tillsammans.",
      features: [
        "6 digitala medarbetare",
        "Kontot lagras i EU",
        "Egen kontaktperson",
        "Vi sätter upp allt tillsammans",
        "Prioriterad support",
      ],
    },
  ],
};

export const FAQ = {
  title: "Vanliga frågor.",
  body: "Det folk brukar undra över. Saknas något? Hör av dig.",
  items: [
    {
      q: "Hur snabbt kommer jag igång?",
      a: "Du har en specialist på plats inom tre minuter. Inga formulär. Ingen onboarding-konsult. Kleo lär sig resten medan ni jobbar.",
    },
    {
      q: "Finns det en gratis plan?",
      a: "Tre dagar gratis utan kort. Inga begränsningar. Du provar hela teamet, inte en demoversion.",
    },
    {
      q: "Funkar det med Fortnox och Visma?",
      a: "Direktkoppling till Fortnox och Visma är under utveckling. Tills dess levererar Kleo färdiga underlag som du klistrar in på en sekund.",
    },
    {
      q: "Hur säker är min data?",
      a: "Kontot och dina konversationer lagras i EU, krypterat både när de skickas och när de ligger still. Svaren tas fram av AI-leverantörer under avtal – vi säljer aldrig din data och den används inte för att träna AI-modeller. Allt står i vår integritetspolicy.",
    },
    {
      q: "Funkar det om jag är fler än 15?",
      a: "Ja. På Avdelning- och Organisationsplanen får du egen kontaktperson och prioriterad support. Hör av dig så pratar vi.",
    },
    {
      q: "Kan jag anpassa Kleo?",
      a: "Kleo lär sig automatiskt. Tonläge, prioriteringar och kontrollnivå anpassar sig efter hur ni jobbar.",
    },
    {
      q: "Hur fungerar betalningen?",
      a: "Månadsabonnemang. Ingen bindningstid. Säg upp när du vill — direkt i kontot.",
    },
    {
      q: "Var sitter ni?",
      a: "Stockholm. Vi bygger Kleo för svenska småföretag — av folk som själva drivit verkstad, salong, restaurang och butik.",
    },
  ],
};

export const CONTACT = {
  eyebrow: "Frågor? Hör av dig.",
  title: "Prata med en människa.",
  body: "Inga botar. Inga ärendenummer. Du pratar med någon som själv har drivit eget — och vet hur det funkar.",
  note: "Vi hör av oss inom 24 timmar. Oftast snabbare.",
  submit: "Skicka",
  employees: ["1-10", "10-30", "30-80", "80+"],
};

export const FINAL_CTA = {
  title: "Anställ ditt första team idag.",
  sub: "Igång på 3 minuter.",
  primary: "Starta gratis",
  secondary: "Eller prata med oss först.",
};

export const FOOTER = {
  tagline: "Det digitala teamet för svenska småföretagare.",
  copyright: "Byggd i Stockholm för svenska småföretag. © 2026.",
};
