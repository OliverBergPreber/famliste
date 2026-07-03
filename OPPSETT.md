# Famliste: oppsett

Appen virker med én gang du åpner `index.html` i en nettleser, men da lagres data kun lokalt på hver enhet. For at du og samboeren din skal dele kalender og lister, må dere gjøre to ting: sette opp Firebase (gratis) og legge appen på nett.

## Del 1: Firebase (ca. 5 min)

1. Gå til https://console.firebase.google.com og logg inn med Google-kontoen din.
2. Klikk **Create a project**, kall det f.eks. `famliste`. Google Analytics kan skrus av.
3. I menyen til venstre: **Build → Realtime Database → Create Database**. Velg region `europe-west1` og **Start in test mode**.
4. Klikk tannhjulet oppe til venstre → **Project settings**. Under **Your apps**, klikk web-ikonet `</>`, gi appen et navn og klikk **Register app**.
5. Du får nå en `firebaseConfig`-blokk. Kopier verdiene inn i toppen av `index.html` (erstatt blokken som starter med `apiKey: "DIN_API_KEY"`).

### Sikre databasen (viktig, gjør etter testing)

Test mode er åpent for alle i 30 dager. Bytt reglene under **Realtime Database → Rules** til noe sånt:

```json
{
  "rules": {
    "families": {
      "$code": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Dette er fortsatt "sikkerhet via hemmelig kode". Velg derfor en familiekode ingen kan gjette, f.eks. `familie-x7k2p9`. For et privat par-prosjekt er dette normalt godt nok, men ikke legg inn sensitiv informasjon.

## Del 2: Legg appen på nett

Enkleste alternativ er **Netlify Drop**:

1. Gå til https://app.netlify.com/drop
2. Dra hele Famliste-mappen inn i vinduet.
3. Du får en adresse som `https://noe-tilfeldig.netlify.app` som begge kan åpne på mobilen.

Alternativer: GitHub Pages eller Firebase Hosting (`firebase deploy`) fungerer like bra.

## Del 3: På telefonene

1. Åpne adressen i Safari (iPhone) eller Chrome (Android).
2. **iPhone:** Del-knappen → *Legg til på Hjem-skjerm*. **Android:** meny → *Legg til på startsiden*.
3. Åpne appen, trykk tannhjulet, skriv inn navnene deres og **samme familiekode** på begge telefoner.

Ferdig! Alt dere legger inn synkes i sanntid mellom telefonene.

## Feilsøking

- Gult banner «Lokal modus» betyr at Firebase-config mangler eller at familiekoden ikke er satt.
- Endringer synes ikke hos den andre: sjekk at begge har nøyaktig samme familiekode (tannhjulet).
- Etter oppdatering av appen på nett: lukk og åpne appen helt på nytt (service worker cacher gammel versjon).
