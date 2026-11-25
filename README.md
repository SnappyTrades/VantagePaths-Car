# VantagePaths Car

**VantagePaths gives everyday car buyers & owners the unfair advantage — 100% online, from your couch, with zero dealer spam.**

---

## Core 4-Pillar Platform

1. **Buy From Home (`/buy` — Couch-to-Keys Deal Room)**
   - **Anti-Dealer Leverage Car Hunter:** Pre-sorted Oldest-on-Lot deep links across Cars.com, CarGurus, AutoTrader & TrueCar + drop-in live MarketCheck / Auto.dev API support with 6-hour SQLite caching, **0–100 Buyer Leverage Scores**, and **Est. True Out-The-Door (OTD)** pricing.
   - **Live Free US Gov NHTSA VIN Intelligence:** Instant 17-digit VIN decode, open safety recalls, and real owner defect complaints.
   - **Multi-Dealer Side-by-Side Bid Board:** Compare competing dealers, auto-flag junk add-ons & statutory doc-fee cap overages, and generate Round 1 & Round 2 Counter-Offer Emails.
   - **Out-of-State Buying & Shipping Math + 4-Square Monthly Payment BS-Detector + Pre-Delivery Buyer's Order PDF Auditor.**
2. **2-Step Car Loan Rescue & F&I Add-On Refunds (`/rescue`)**
   - **Step 1:** Calculates **Free-Look 100% vs. Prorated Refunds** across Extended Warranties (VSC), GAP Waivers, Tire/Wheel & Maintenance plans + **Avoided Compound Loan Interest** + **Loan-to-Value (LTV %) Drop** so underwater borrowers unlock refinance eligibility.
   - **Step 2:** Unlocks ready-to-sign **Formal Cancellation Demand Letters**, **Day-14 Dealer Stall-Buster Escalation Notices**, **Lender Principal Verification Scripts**, and **Branded PDF Packets** — plus Direct-to-Administrator Bypass Directory & Signed TILA Contract Breakdown Auditor.
3. **Zero-Spam Auto Insurance Audit (`/insurance`)**
   - Audits Declarations Pages for renewal loyalty penalties, collision deductible break-even math, and CLUE roadside traps — outputting a clean **1-Page Apples-to-Apples Email Quote Spec** + **6-Month Pre-Renewal Alerts**.
4. **Sell or Trade In for Max Cash (`/sell`)**
   - Compares **Dealer Trade-In (+ State Sales Tax Credit)** vs. **Instant Cash Offers** vs. **Private Party Sale**, paired with a Zero-Scam Private Sale Checklist.
5. **50 States + DC Car Buyer Law Hub (`/states` & `/state/:code` + `/sitemap.xml`)**
   - Statutory doc fee caps, trade-in tax credit rules, VSC/GAP free-look windows, and *"Can I Return a Car?"* myth busters for every state.

---

## Dual Day-1 Revenue Architecture

- **Layer 1 — Direct Stripe Self-Service Passes:** `$29` 60-Day VantagePaths Auto Pass + `+$15` 1-Click USPS Certified Mail SKU (server-enforced SQLite paywall; runs in local Demo Unlock mode until `STRIPE_SECRET_KEY` is added to `.env`).
- **Layer 2 — Tracked High-CPA Affiliate Redirects (`/api/partner/click/:partnerId`):** Earns on 100% free users across Auto Refinance, Pre-Approval, Auto Insurance, Instant Cash Offers, and Mobile Used-Car Inspections — tracked live in `/admin`.
- **Layer 3 — Retention Alerts:** 6-month insurance renewal & car-sniper alerts stored in SQLite.

---

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000`.

### Scripts
- `npm run dev` — Start Express + Vite full-stack server
- `npm run lint` — TypeScript strict check (`tsc --noEmit`)
- `npm test` — Run deterministic & paywall unit test suite
- `npm run build` — Production Vite bundle (`dist/`)
- `npm start` — Run production server (`NODE_ENV=production`)
