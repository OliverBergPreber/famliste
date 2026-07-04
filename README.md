# Famliste

En delt hverdagsapp for par: felles kalender, handleliste og gjøremål med sanntidssynkronisering mellom telefoner. Bygget som en installerbar PWA i ren HTML, CSS og JavaScript, helt uten rammeverk eller byggverktøy.

## Prøv appen

**[remarkable-gecko-16eb22.netlify.app](https://remarkable-gecko-16eb22.netlify.app)**

Åpne lenken og test alt direkte, ingen innlogging eller oppsett kreves. På mobil kan appen legges til på hjemskjermen og brukes som en vanlig app. For å teste sanntidssynk mellom to enheter: åpne innstillingene (tannhjulet) på begge og skriv inn samme selvvalgte familiekode.

## Bakgrunn

Famliste løser et konkret problem i en travel hverdag: hvem gjør hva, og når? I stedet for løse meldinger og påminnelser samles alt på ett sted. Begge kan legge inn vakter, avtaler og oppgaver, se hvem som eier hva med ett blikk, og krysse av i sanntid.

## Funksjoner

**Kalender**
* Måneds-, uke- og dagvisning med norsk ukenummerering
* Trykk på en dato i månedsvisningen for å se dagens innhold direkte under kalenderen
* Hendelser over flere dager, med dagteller (dag 2/7)
* Nattevakter som krysser midnatt vises automatisk på begge dager (16:00 på startdagen, 00:45 på dagen etter)
* Flervalg av enkeltdager i en minikalender, for eksempel en vaktuke
* Gjentakende hendelser: hver uke, annenhver uke, hver fjerde uke eller månedlig, generert som redigerbare enkelthendelser med serietilhørighet og seriesletting

**Gjøremål**
* Tre faste felt, ett per person pluss felles, med fargekoding og avatarer
* Skriv oppgaven og trykk på personen som skal ha den, fordelt med ett trykk
* Datosatte oppgaver dukker først opp i listen den dagen de gjelder, forfalte blir stående med varsel
* Flytt oppgaver mellom personer ved å trykke på avataren

**Handleliste**
* Enkel felles liste: legg til, huk av, tøm fullførte

**Motivasjon**
* Konfetti og animasjoner ved fullførte oppgaver
* Valgfritt kooperativt poengsystem: oppgaver vektes 1 til 3 poeng, paret samler mot et felles mål og låser opp en selvvalgt premie
* Designet bevisst som samarbeid fremfor konkurranse for å unngå usunn poengføring i forholdet

## Teknisk

| Område | Valg |
|---|---|
| Frontend | Vanilla JavaScript, ingen avhengigheter eller byggsteg |
| Synk | Firebase Realtime Database med sanntidslyttere |
| Offline | Service worker med network-first-cache, appen åpner uten nett |
| Installasjon | PWA med manifest, kjører som app fra hjemskjermen |
| Fallback | Kjører i lokal modus med localStorage til synk er konfigurert |

Utvalgte detaljer:

* **Datamodell:** Hendelser og gjøremål deler én kolleksjon med typefelt, slik at gjøremål kan leve både i kalenderen og i oppgavelisten uten duplisering.
* **Serier:** Gjentakelse materialiseres som enkelthendelser med felles serie-ID. Hver forekomst kan endres eller hukes av separat, og hele serien kan slettes samlet.
* **Poengintegritet:** Poengsummen lagres som en egen delt teller i stedet for å avledes fra oppgavene, slik at sletting av historikk ikke påvirker opptjente poeng.
* **Mobiltilpasning:** Safe area-håndtering for Dynamic Island og hjemindikator, 16 px skriftstørrelse i inputfelt for å unngå autozoom på iOS, responsive brekkpunkter for små telefoner, nettbrett og liggende modus.
* **Batch-skriving:** Serier og flervalg skrives som én atomisk oppdatering mot databasen.

## Kom i gang

**Bruke appen (ingen oppsett nødvendig)**

Er appen allerede publisert, trenger dere bare adressen. Åpne den på begge telefoner, legg appen på hjemskjermen og skriv inn samme selvvalgte familiekode i innstillingene. Én og samme installasjon kan brukes av flere par samtidig, siden hver familiekode gir et eget adskilt datarom.

**Kjøre din egen installasjon (for utviklere)**

1. Klon repoet og åpne `index.html` i en nettleser. Appen kjører umiddelbart i lokal modus.
2. For synk mellom enheter: opprett et gratis Firebase-prosjekt med Realtime Database og lim inn konfigurasjonen øverst i `app.js`. Se `OPPSETT.md` for en steg for steg-guide.
3. Publiser mappen på valgfri statisk host (Netlify, GitHub Pages, Firebase Hosting).

## Filstruktur

```
index.html    Markup og modaler
style.css     All styling, temavariabler og responsivitet
app.js        Tilstand, synk, rendering og forretningslogikk
sw.js         Service worker for offline-støtte
manifest.json PWA-manifest
OPPSETT.md    Oppsettsguide for Firebase og publisering
```

## Sikkerhet

Delingen beskyttes av en hemmelig familiekode som datasti i databasen. Firebase-konfigurasjonen i `app.js` er bevisst offentlig, slik webapper mot Firebase er ment å fungere. Dette er et avveid valg for et privat prosjekt uten sensitiv informasjon: velg en kode som ikke kan gjettes, og vær klar over at alle brukere av samme installasjon deler samme databaseprosjekt og kvote. Arkitekturen er forberedt for Firebase Authentication med regelbasert tilgang dersom behovet endres.

## Videre planer

* Push-varsler for kommende hendelser
* Automatisk forlengelse av gjentakende serier
* Historikk over oppnådde mål og premier
