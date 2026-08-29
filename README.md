# RuralCare Connect

An offline-capable SIH demonstration app for routing a rural citizen or ASHA worker to an appropriate **public** healthcare service. It is a prototype with synthetic facility data only; it is not a diagnosis tool or a live government system.

## Run in VS Code

1. Install [Node.js 20+](https://nodejs.org/) and open this folder in VS Code.
2. Copy `.env.example` to `.env` (leaving the key blank is fine).
3. In the VS Code terminal run `npm install` once, then run `npm run dev`.
4. Open the local URL shown for `web` (normally `http://localhost:5173`).

The first run creates a local SQLite database and seeds a fictional Tamil Nadu demo district. Use the **Staff dashboard** link to see the operational view.

## Useful commands

- `npm run dev` - initialize SQLite and start API + PWA
- `npm test` - safety and facility-matching unit tests
- `npm run build` - type-check and create the production web build

## Demo route

Choose Tamil or English, enter a need such as `My child has fever and cough for two days`, confirm the bounded assessment, choose a facility, then create a referral. Switch to offline in browser developer tools and submit a referral to demonstrate the local queue; reconnect to sync it.

## Safety and data

- All names, facilities, availability, and referrals are synthetic prototype data.
- Emergency keywords bypass normal recommendations and show urgent human-care guidance.
- AI is optional and never decides emergency routing or facility ranking.
- Do not put API keys in source code or commit `.env`.
