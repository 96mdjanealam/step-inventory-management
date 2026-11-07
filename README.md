# OXTON Inventory Management

An enterprise-grade, multi-location retail inventory and point-of-sale management system. Built with an immutable double-entry stock ledger, real-time stock derivation, and role-based access control.

**Live Application**: [https://step-inventory-management.vercel.app/](https://step-inventory-management.vercel.app/)

---

## Key Features

- **Multi-Location Inventory**: Manage stock across the Central Main Warehouse, retail stores, and a dedicated Damaged Stock quarantine facility.
- **Double-Entry Ledger**: Stock quantities are derived from an immutable `stock_movements` table (`INITIAL`, `TRANSFER_IN`, `TRANSFER_OUT`, `SALE`, `RETURN`, `DAMAGE_WRITE_OFF`, `AUDIT_ADJUSTMENT`), preventing floating counters or phantom balances.
- **Product & Variant Catalog**: Supports single products and multi-attribute variant matrices (Sizes, Colors, Styles) with formatted SKUs (`sku: <value>`), cost/selling prices, and image uploads.
- **Stock Transfers**: Inter-facility transfer workflows with atomic updates (deducts source and credits destination in a single transaction).
- **Point of Sale (POS)**: Fast retail register checkout with stock validation, payment selection, and sequential order generation (`ORD-100X`).
- **Customer Returns**: Inspect merchandise condition and route resaleable items back to the store floor or quarantine defective units (`RET-100X`).
- **Damaged Stock**: Incident logging and loss write-offs (`DAM-100X`).
- **Audit & Cycle Counts**: Physical count verification with authorized supervisor reconciliation notes.
- **Operations Guide**: In-app standard operating procedures (SOP) and workflow documentation accessible directly from the sidebar.

---

## Tech Stack & Tools

| Layer                  | Technology                                                                    |
| ---------------------- | ----------------------------------------------------------------------------- |
| **Framework**          | [TanStack Start](https://tanstack.com/start) (Fullstack React 19 + Nitro SSR) |
| **Routing**            | [TanStack Router](https://tanstack.com/router) (Type-safe file-based routing) |
| **Styling**            | [Tailwind CSS v4](https://tailwindcss.com/) (Zero-radius design system)       |
| **Database**           | PostgreSQL ([Supabase](https://supabase.com/))                                |
| **ORM & Migrations**   | [Drizzle ORM](https://orm.drizzle.team/) & Drizzle Kit                        |
| **Cloud Storage**      | Supabase Storage (`product-images` bucket)                                    |
| **Icons & Charts**     | [Lucide React](https://lucide.dev/), [Recharts](https://recharts.org/)        |
| **Validation**         | [Zod](https://zod.dev/)                                                       |
| **Language & Tooling** | TypeScript, Vite 8, ESLint, Prettier                                          |

---

## Local Development Setup

### 1. Prerequisites

- **Node.js** v20.x or higher
- **npm** v10.x or higher
- A PostgreSQL database instance (or Supabase project)

### 2. Clone & Install

```bash
git clone <repository-url>
cd inventory-management
npm install
```

### 3. Environment Variables

Create a `.env.local` file in the project root based on `.env.example`:

```bash
cp .env.example .env.local
```

Fill in your database and Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_service_role_secret_key

DATABASE_URL=postgresql://postgres.your-project:password@aws-0-pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### 4. Database Setup & Seeding

Push the schema to your PostgreSQL database and seed sample stores, products, inventory, and orders:

```bash
# Push schema tables and sequences to PostgreSQL
npm run db:push

# Seed locations, sample products/variants, initial stock, and sales
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## User Roles

| Role              | Scope             | Key Permissions & Capabilities                                                      |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------- |
| **Administrator** | System Governance | Full system access, staff accounts, catalog editing, cost prices, audit adjustments |
| **Employee**      | Store Floor & POS | POS checkout, inventory lookups, stock transfers, customer returns, damage logging  |

---

## Available Scripts

| Command                   | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `npm run dev`             | Starts the Vite development server on port 3000             |
| `npm run build`           | Builds the client and server bundles for production         |
| `npm run preview`         | Previews the production build locally                       |
| `npm run generate-routes` | Regenerates TanStack Router route tree (`routeTree.gen.ts`) |
| `npm run db:push`         | Pushes Drizzle schema changes directly to the database      |
| `npm run db:seed`         | Populates sample stores, products, stock, and orders        |
| `npm run db:studio`       | Opens Drizzle Studio GUI for inspecting database tables     |
| `npm run format`          | Runs Prettier and auto-fixes ESLint issues                  |
| `npm run check`           | Checks formatting and code style                            |

---

Made with love by Md Jane Alam
