# 2627-waai-006-Asset-Tracking-Tool

Webapplicatie (WaaiTrack) waarmee medewerkers van de Waaiburg materiaal kunnen reserveren, zodat er een duidelijk overzicht is van wat wanneer beschikbaar is.

## Werking

- **Reserveren** – kies een periode en reserveer beschikbaar materiaal.
- **Reserveringen** – bekijk en annuleer reserveringen (beheerders zien alles).
- **Beheren** – beheerders beheren materiaal, categorieën, afdelingen en gebruikers.
- **Instellingen** – o.a. de zomerregeling.

## Structuur

```
code/
├── backend/    FastAPI + SQLAlchemy (api/, models/, seeders/)
├── frontend/   React + TypeScript + Vite + Tailwind (components/, features/)
└── docker-compose.yml
documents/      Projectdocumentatie
```

## Development omgeving

Vereisten: Python 3.13, Node.js 24 en Docker.

Maak eerst `code/.env` aan op basis van `code/.env.example`. In VS Code gaat het daarna het snelst via de task **Start dev**: open bovenaan het Command Palette (`Cmd/Ctrl+Shift+P`) en kies *Tasks: Run Task*, of druk meteen op `Cmd/Ctrl+Shift+B`. Die start de database, backend en frontend in één keer. De dependencies installeer je eenmalig met de task **Setup**. Handmatig kan het ook:

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

## Docker omgeving

Om de volledige applicatie (database, backend en frontend) in containers te draaien, maak je ook eerst `code/.env` aan en voer je dit uit:

```bash
cd code
docker compose up -d --build
```

De frontend draait dan op de `FRONTEND_PORT` uit `.env` (standaard http://localhost:5173).