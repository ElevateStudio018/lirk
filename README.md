# Kleo — marknadssajt med 3D-scroll

Ny marknadssajt för Kleo med samma innehåll, färger och typsnitt som den nuvarande sidan
(`marketing/index.html` i `kleo-platform`), men byggd kring scrollstyrda 3D-effekter.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # produktionsbygge
npm run typecheck
npm run format
```

Knapparna leder till plattformen. Sätt `NEXT_PUBLIC_APP_URL` (se `.env.example`); standard är
`https://primr-saas.vercel.app`.

## Stack

Next.js 16 · React 19 · React Three Fiber (three.js) · GSAP ScrollTrigger + SplitText · Lenis · Tailwind v4.

## Effekterna

En fast WebGL-partikelvärld ligger bakom hela sidan och formas om medan man scrollar
(`components/three`, styrs från `lib/scene.ts`):

| Sektion | Partiklar | DOM-effekt |
|---|---|---|
| Hero | Vågen från nuvarande hero, med "lövblås" vid muspekaren | Rubriken vänds upp bokstav för bokstav och exploderar mot kameran vid scroll |
| För svenska småföretagare | Vågen | Branscherna snurrar på en 3D-cylinder, snabbare ju fortare man scrollar |
| Trygghet. Avlastning. Effektivitet. | Kleo-ringen (logotypen) | Orden sitter på ett prisma som vänds ett steg i taget (fastlåst) |
| Teamet | Sfär runt appen | App-skärmen ligger lutad och rätar upp sig, notiser svävar på olika djup, korten viks in |
| Tolv specialister | Tolv klot i omlopp | 3D-karusell med alla tolv, ett varv per scroll (fastlåst, mörk) |
| Tre steg | Tunnel man flyger genom | Stegen rusar fram ur djupet och flyger förbi (fastlåst, mörk) |
| Varför Kleo | Lugn våg | Korten ligger med baksidan upp och vänds |
| Siffror | — | Panelen reser sig, siffrorna rullar på 3D-hjul |
| Omdömen | Lugn våg | Kort på ett lutat plan som glider åt olika håll |
| Priser | Lugn våg | Planerna ligger som en kortlek och fläktas ut |
| Vanliga frågor | Lugn våg | Frågorna viks ut mot betraktaren |
| Final | Kleo-ringen igen | Rubriken vänds in, jättestor "Kleo" reser sig i footern |

Allt respekterar `prefers-reduced-motion`: då stängs fastlåsning och 3D-animationer av och
sektionerna visas som vanliga listor.

## Innehåll

All text ligger i `lib/content.ts`. Siffrorna i "Siffror, inte snack." är produktfakta ur
texten (12 specialister, 3 minuter, 3 dagar gratis) — räknarna på nuvarande sida pekar på
mallvärden som inte finns i repot. Byt gärna till riktiga siffror.

Kontaktformuläret skickar till plattformens `/api/leads` (samma fält som nuvarande sida) och
öppnar ett förifyllt mejl till hej@kleo.se om det misslyckas. Från en annan domän kräver det
CORS-stöd på `/api/leads`.
