# 2627-waai-006-Asset-Tracking-Tool

Webapplicatie (WaaiTrack) waarmee medewerkers van de Waaiburg materiaal kunnen reserveren, zodat er een duidelijk overzicht is van wat wanneer beschikbaar is.

## Werking

- **Reserveren** – kies een periode en reserveer beschikbaar materiaal.
- **Catalogus** – bekijk alle materialen en categoriën die er zijn.
- **Reserveringen** – bekijk, wijzig en annuleer reserveringen. Beheerders zien alles en registreren wanneer materiaal terug is, eventueel met gemelde defecten.
- **Problemen** – beheerders zien welk materiaal defect is (telt niet mee als beschikbaar) en markeren het als opgelost.
- **Beheren** – beheerders beheren materiaal, categorieën, afdelingen en gebruikers, en kunnen een back-up downloaden of terugzetten.
- **Instellingen** – o.a. de zomerregeling.
- **Herinneringsmails** – is materiaal `REMINDER_AFTER_HOURS` uur na het einde van een reservering nog niet terug, dan krijgt de gebruiker een mail (afdeling in CC). Alleen actief als `MAIL_SENDER` is ingevuld.

## Structuur

```
code/
├── backend/                       FastAPI + SQLAlchemy (api/, models/, seeders/)
├── frontend/                      React + TypeScript + Vite + Tailwind (components/, features/)
├── docker-compose.yml             lokaal / development
├── docker-compose-production.yml  productie
└── .env.example
documents/                         Projectdocumentatie (o.a. ERD)
```

De database-tabellen en het beheerdersaccount worden automatisch aangemaakt bij het opstarten van de backend.

## Configuratie (`code/.env`)

Kopieer `code/.env.example` naar `code/.env` en pas aan waar nodig. De belangrijkste variabelen:

| Variabele | Uitleg |
| --- | --- |
| `POSTGRES_*` | Verbinding met de database. |
| `JWT_SECRET` | Geheime sleutel voor de login-tokens. **Altijd wijzigen in productie.** |
| `COOKIE_SECURE` | `true` zodra de site via HTTPS draait. |
| `AUTH_METHOD` | `email` (e-mail + wachtwoord) of `sso` (Microsoft-login). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Beheerdersaccount dat bij opstarten wordt aangemaakt. Bij SSO wordt dat Microsoft-account beheerder en is het wachtwoord niet nodig. |
| `AZURE_*` | App-registratie in Azure, nodig voor SSO en/of mails. |
| `MAIL_SENDER` | Mailbox die de herinneringen verstuurt (leeg = geen mails). Vereist de permissie *Mail.Send*. |
| `REMINDER_AFTER_HOURS` | Aantal uur na het einde van een reservering voordat de herinnering vertrekt. |
| `APP_URL` | Publiek adres van de frontend (gebruikt in mails en voor SSO). |

## Development omgeving

Vereisten: Python 3.13, Node.js 24 en Docker.

In VS Code gaat het het snelst via de tasks: installeer de dependencies eenmalig met **Setup** en start daarna alles met **Start dev** (`Cmd/Ctrl+Shift+B`). Handmatig kan het ook:

```bash
cp code/.env.example code/.env

# eenmalig installeren
cd code/backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd ../frontend && npm install

# starten (elk in een eigen terminal)
cd code && docker compose up -d --wait db
cd code/backend && .venv/bin/uvicorn app.main:app --reload --port 8000 --env-file ../.env
cd code/frontend && npm run dev
```

Open http://localhost:5173 en log in met het beheerdersaccount.

## Docker omgeving (lokaal)

De volledige applicatie (database, backend en frontend) in containers, gebouwd vanuit de lokale code:

```bash
cd code
docker compose up -d --build
```

De frontend draait dan op de `FRONTEND_PORT` uit `.env` (standaard http://localhost:5173).

## Productie

`docker-compose-production.yml` bouwt de images rechtstreeks vanuit deze GitHub-repository, dus op de server zijn alleen dat bestand en een `.env` nodig (geen checkout van de code). De database en backend zijn niet van buitenaf bereikbaar; alleen de frontend luistert op `FRONTEND_PORT` (standaard poort 80).

```bash
# in een map met docker-compose-production.yml en .env
docker compose -f docker-compose-production.yml up -d --build
```

- Updaten naar de laatste versie: hetzelfde commando opnieuw uitvoeren.
- Een specifieke branch of tag gebruiken: zet `GIT_REF` in `.env` (standaard `main`).
- Zet in `.env` minstens een sterk `JWT_SECRET` en `POSTGRES_PASSWORD`, de juiste `APP_URL`, en `COOKIE_SECURE=true` bij HTTPS.
- Database en geüploade afbeeldingen staan in de Docker-volumes `db_data` en `uploads_data`. Maak regelmatig een back-up via **Beheren**.

## SSO

`AZURE_REDIRECT_URI` moet eindigen op `/api/auth/sso/callback`, bv. `http://localhost:5173/api/auth/sso/callback`. Zet exact dezelfde URI in Azure onder *Authentication* → **Web**.
