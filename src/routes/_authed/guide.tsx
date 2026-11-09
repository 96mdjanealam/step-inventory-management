import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  BookOpen,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  RotateCcw,
  AlertTriangle,
  ClipboardList,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Warehouse,
  Store,
  Layers,
  Search,
  Sparkles,
  Bell,
} from 'lucide-react'
import { Button } from '../../components/Button.tsx'
import { Alert } from '../../components/Alert.tsx'
import { ConfirmModal } from '../../components/ConfirmModal.tsx'

export const Route = createFileRoute('/_authed/guide')({
  component: OperationsGuidePage,
})

interface WorkflowStep {
  step: number
  title: string
  action: string
  detail: string
  tip?: string
}

interface WorkflowSection {
  id: string
  category: 'logistics' | 'sales' | 'inventory' | 'governance'
  title: string
  badge: string
  icon: React.ComponentType<{ className?: string }>
  summary: string
  linkTo: string
  linkText: string
  ledgerImpact: string
  steps: WorkflowStep[]
}

const WORKFLOWS: WorkflowSection[] = [
  {
    id: 'transfers',
    category: 'logistics',
    title: 'Inter-Facility Stock Transfers',
    badge: 'Logistics & Replenishment',
    icon: ArrowLeftRight,
    summary:
      'Seamlessly move merchandise between the Main Warehouse and retail store locations, or balance stock between sister stores without phantom inventory.',
    linkTo: '/transfers/new',
    linkText: 'Create Transfer',
    ledgerImpact: 'Atomically creates TRANSFER_OUT at origin and TRANSFER_IN at destination.',
    steps: [
      {
        step: 1,
        title: 'Select Movement Route',
        action: 'Choose Source & Destination facilities',
        detail:
          'Specify where the goods are departing from (e.g. Main Warehouse) and where they are being delivered (e.g. OXTON Flagship Store). The system ensures origin and destination are distinct.',
        tip: 'Ensure the source facility physically holds sufficient available stock before dispatching.',
      },
      {
        step: 2,
        title: 'Add Transfer Line Items',
        action: 'Select variants and transfer quantities',
        detail:
          'Search variants by name or SKU. The system checks real-time available stock at the source location and alerts you if requested quantity exceeds current on-hand units.',
      },
      {
        step: 3,
        title: 'Reference & Notes',
        action: 'Attach tracking code or dispatch note',
        detail:
          'Add bill-of-lading numbers, courier slips, or dispatch reasons in the notes field to facilitate physical cross-checking upon truck arrival.',
      },
      {
        step: 4,
        title: 'Dispatch & Atomic Execution',
        action: 'Submit transfer',
        detail:
          'Upon submission, the immutable ledger immediately deducts source units and credits destination units in a single database transaction, preventing transit discrepancies.',
      },
    ],
  },
  {
    id: 'sales',
    category: 'sales',
    title: 'Point of Sale (POS) & Retail Checkout',
    badge: 'Customer Transactions',
    icon: ShoppingCart,
    summary:
      'Fast, reliable checkout terminal for retail store staff to ring up customer sales, apply payments, and automatically deduct local floor inventory.',
    linkTo: '/sales/new',
    linkText: 'Open POS Register',
    ledgerImpact: 'Immediately logs SALE movement and issues sequential order (ORD-100X).',
    steps: [
      {
        step: 1,
        title: 'Select Store Location',
        action: 'Verify your retail register store',
        detail:
          'Choose the store branch where the sale is physically occurring. Available stock reflects only what is currently in stock at this specific store.',
      },
      {
        step: 2,
        title: 'Scan or Add Items to Cart',
        action: 'Search products by name or SKU',
        detail:
          'Add single or multiple variants to the cart. Real-time validation blocks any checkout if local store inventory is exhausted.',
        tip: 'All items display their configured selling price and available store stock.',
      },
      {
        step: 3,
        title: 'Customer Details & Payment',
        action: 'Select payment method',
        detail:
          'Choose Cash, Credit/Debit Card, or Mobile Banking. Optional customer name and phone contact can be attached for warranty and order tracking.',
      },
      {
        step: 4,
        title: 'Complete Sale',
        action: 'Process order',
        detail:
          'The order is recorded with an official order number (e.g., ORD-1005). Stock is immediately decremented from the store floor.',
      },
    ],
  },
  {
    id: 'returns',
    category: 'sales',
    title: 'Customer Returns & Restocking',
    badge: 'Customer Care & Returns',
    icon: RotateCcw,
    summary:
      'Handle customer merchandise returns with intelligent routing: return pristine stock back to the sales floor, or quarantine defective goods to Damaged Stock.',
    linkTo: '/returns/new',
    linkText: 'Process Return',
    ledgerImpact: 'Logs RETURN movement (credits Store or Damaged Facility, issues RET-100X).',
    steps: [
      {
        step: 1,
        title: 'Locate Original Order',
        action: 'Enter Order Number or item details',
        detail:
          'Reference the customer receipt (ORD-XXXX) to automatically verify purchase price, date, and customer information.',
      },
      {
        step: 2,
        title: 'Condition Inspection',
        action: 'Assess merchandise condition',
        detail:
          'Inspect the garment or item. If tags are intact and condition is pristine, mark as Resaleable. If defective or worn, mark as Defective/Damaged.',
        tip: 'Items marked Defective are quarantined directly away from active retail inventory.',
      },
      {
        step: 3,
        title: 'Restock Routing',
        action: 'Confirm destination facility',
        detail:
          'Resaleable items are automatically returned to the store inventory balance. Defective items are routed to the central Damaged Stock facility.',
      },
      {
        step: 4,
        title: 'Generate Return Voucher',
        action: 'Submit return',
        detail:
          'Generates a sequential return number (e.g., RET-1001) with date, inspected condition, and refund amount.',
      },
    ],
  },
  {
    id: 'damage',
    category: 'inventory',
    title: 'Damaged Stock & Quarantine Write-Offs',
    badge: 'Loss Prevention',
    icon: AlertTriangle,
    summary:
      'Log transit breakage, shop floor wear, or supplier defects so damaged merchandise is immediately excluded from sellable inventory balances.',
    linkTo: '/damage/new',
    linkText: 'Report Damaged Stock',
    ledgerImpact: 'Logs DAMAGE_WRITE_OFF movement and issues tracking number (DAM-100X).',
    steps: [
      {
        step: 1,
        title: 'Select Facility & Incident Origin',
        action: 'Identify location where damage occurred',
        detail:
          'Choose the warehouse or retail store holding the affected inventory item.',
      },
      {
        step: 2,
        title: 'Specify Items & Quantities',
        action: 'Pick variant and quantity affected',
        detail:
          'Enter exact units damaged. The system confirms sufficient on-hand quantity exists at the selected location.',
      },
      {
        step: 3,
        title: 'Document Cause & Evidence',
        action: 'Select reason code & write description',
        detail:
          'Categorize by Transit Damage, Manufacturing Flaw, Soiled/Customer Mishap, or Expired. Provide thorough description for claims.',
        tip: 'Accurate damage documentation assists in quarterly supplier credit and insurance claims.',
      },
      {
        step: 4,
        title: 'Quarantine / Write-Off',
        action: 'Finalize incident',
        detail:
          'Deducts items from sellable floor inventory and transfers them to the Quarantine facility under reference DAM-XXXX.',
      },
    ],
  },
  {
    id: 'audit',
    category: 'governance',
    title: 'Cycle Counts, Physical Audits & Ledger',
    badge: 'Double-Entry Integrity',
    icon: ClipboardList,
    summary:
      'Verify physical warehouse/store shelf counts against calculated balances, inspect historical ledger movements, and perform authorized adjustments.',
    linkTo: '/audit',
    linkText: 'Open Audit Ledger',
    ledgerImpact: 'Logs AUDIT_ADJUSTMENT movement with mandatory supervisor reason code.',
    steps: [
      {
        step: 1,
        title: 'Physical Cycle Count',
        action: 'Perform shelf inventory count',
        detail:
          'Store and warehouse personnel count physical garments and accessories by SKU on the floor and backroom.',
      },
      {
        step: 2,
        title: 'Compare System vs Physical',
        action: 'Check Stock & Locations table',
        detail:
          'Compare physical tally with real-time derived ledger balance in Stock & Locations view.',
      },
      {
        step: 3,
        title: 'Investigate Discrepancies',
        action: 'Inspect recent movements',
        detail:
          'Review the immutable audit log for recent sales, transfers, or returns that might explain count variances.',
      },
      {
        step: 4,
        title: 'Supervised Reconciliation',
        action: 'Record audit adjustment if needed',
        detail:
          'Authorized administrators enter corrective adjustment (+/-) with an audit reason note, preserving full traceability.',
      },
    ],
  },
  {
    id: 'products',
    category: 'inventory',
    title: 'Product Catalog & Variant Management',
    badge: 'Catalog Architecture',
    icon: Package,
    summary:
      'Create and maintain standardized merchandise catalog, assign structured SKUs, configure multi-attribute variants, and upload high-resolution product imagery.',
    linkTo: '/products/new',
    linkText: 'Add New Product',
    ledgerImpact: 'Defines SKU matrix; stock remains 0 until received via Initial Stock or Transfer.',
    steps: [
      {
        step: 1,
        title: 'Product Header & Category',
        action: 'Define name, category, and brand',
        detail:
          'Enter official product name, descriptive details, and retail category (e.g. Outerwear, Footwear, Tops).',
      },
      {
        step: 2,
        title: 'Select Variant Structure',
        action: 'Choose Simple Item vs Multi-Variant Matrix',
        detail:
          'For standard items without options, select Simple Product. For apparel with Sizes (S, M, L, XL) and Colors (Navy, Black, Olive), configure Variant Matrix.',
        tip: 'Attributes automatically generate combination SKUs following the OXTON standard convention.',
      },
      {
        step: 3,
        title: 'Pricing & Structured SKUs',
        action: 'Input Cost Price, Retail Price, and SKUs',
        detail:
          'Set baseline unit cost (internal) and discounted selling price (customer-facing). Ensure SKUs adhere to the standardized format.',
      },
      {
        step: 4,
        title: 'Upload Product & Variant Photos',
        action: 'Drag & drop image gallery',
        detail:
          'Upload catalog images. The first image is automatically designated as the Primary Catalog Cover across the system.',
      },
    ],
  },
]

export function OperationsGuidePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewModalVariant, setPreviewModalVariant] = useState<
    'danger' | 'warning' | 'primary' | null
  >(null)

  const filteredWorkflows = WORKFLOWS.filter((wf) => {
    const matchesCategory =
      selectedCategory === 'all' || wf.category === selectedCategory
    const matchesSearch =
      wf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.steps.some((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.detail.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    return matchesCategory && matchesSearch
  })

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-16">
      {/* =========================================================================
          HERO BANNER & APP BRIEF
          ========================================================================= */}
      <div className="border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="inline-flex items-center gap-1.5 bg-brand-primary/10 px-2.5 py-1 text-xs font-bold text-brand-primary uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5" />
                Operations & Workflow Guide
              </span>
              <span className="text-xs text-neutral-400">|</span>
              <span className="text-xs font-medium text-neutral-500">
                Standard Operating Procedures (SOP)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-brand-charcoal">
              OXTON Operating Procedures & System Architecture
            </h1>

            <p className="mt-2.5 text-sm sm:text-base text-neutral-600 leading-relaxed">
              Welcome to the official <strong>OXTON Inventory Management Manual</strong>.
              This system acts as the centralized operational engine powering our central
              warehouse, regional retail stores, point-of-sale registers, and loss
              prevention workflows.
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-col gap-2.5 flex-shrink-0">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark transition shadow-xs"
            >
              Go to Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/inventory"
              className="inline-flex items-center justify-center gap-2 border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:border-brand-primary hover:text-brand-primary transition"
            >
              Check Live Stock
            </Link>
          </div>
        </div>

        {/* Tiny Brief: System Foundation Cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-neutral-100 pt-6">
          <div className="flex items-start gap-3 bg-neutral-50 p-4 border border-neutral-200/70">
            <div className="p-2 bg-white border border-neutral-200 text-brand-primary flex-shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-charcoal">
                Double-Entry Ledger
              </h3>
              <p className="mt-1 text-xs text-neutral-600 leading-normal">
                Stock is never stored as a flat, editable counter. Every unit is
                dynamically derived from verified, immutable movement records.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-neutral-50 p-4 border border-neutral-200/70">
            <div className="p-2 bg-white border border-neutral-200 text-brand-primary flex-shrink-0">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-charcoal">
                Multi-Facility Topology
              </h3>
              <p className="mt-1 text-xs text-neutral-600 leading-normal">
                Organized into Central Warehouse, 5 Regional Retail Stores, and a
                dedicated Quarantine facility for defective/damaged units.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-neutral-50 p-4 border border-neutral-200/70">
            <div className="p-2 bg-white border border-neutral-200 text-brand-primary flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-charcoal">
                Strict SKU Conventions
              </h3>
              <p className="mt-1 text-xs text-neutral-600 leading-normal">
                All inventory uses standardized SKUs rendered as{' '}
                <code className="bg-white px-1 py-0.5 border border-neutral-200 text-[10px] font-mono">
                  sku: &lt;identifier&gt;
                </code>{' '}
                for barcode and optical precision.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-neutral-50 p-4 border border-neutral-200/70">
            <div className="p-2 bg-white border border-neutral-200 text-brand-primary flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-charcoal">
                Role-Based Guardrails
              </h3>
              <p className="mt-1 text-xs text-neutral-600 leading-normal">
                Admins hold full catalog, staff, and ledger audit rights. Store
                employees have streamlined access for daily sales, transfers, and returns.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          HIGH-LEVEL WORKFLOW VISUAL MAP
          ========================================================================= */}
      <div className="border border-neutral-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-brand-charcoal">
              Merchandise Lifecycle Flow
            </h2>
            <p className="text-xs text-neutral-500">
              How physical goods traverse our network from initial intake to end customer
            </p>
          </div>
          <span className="hidden sm:inline-flex text-[11px] font-medium text-brand-primary bg-brand-bg px-2.5 py-1">
            End-to-End Traceability
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex flex-col border border-neutral-200 bg-neutral-50 p-4 relative">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">
              Phase 1: Inbound
            </div>
            <div className="text-sm font-bold text-neutral-900">Main Warehouse</div>
            <p className="mt-1.5 text-xs text-neutral-600">
              New shipments received from suppliers. Items cataloged, barcoded, and stored
              as central bulk reserve.
            </p>
            <div className="mt-3 text-[11px] font-mono font-medium text-neutral-500">
              Ledger: INITIAL / AUDIT
            </div>
          </div>

          <div className="flex flex-col border border-neutral-200 bg-neutral-50 p-4 relative">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">
              Phase 2: Logistics
            </div>
            <div className="text-sm font-bold text-neutral-900">Inter-Facility Transfers</div>
            <p className="mt-1.5 text-xs text-neutral-600">
              Dispatched from warehouse to stores or between stores to balance regional
              demand.
            </p>
            <div className="mt-3 text-[11px] font-mono font-medium text-neutral-500">
              Ledger: TRANSFER_OUT &amp; IN
            </div>
          </div>

          <div className="flex flex-col border border-neutral-200 bg-neutral-50 p-4 relative">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">
              Phase 3: Retail POS
            </div>
            <div className="text-sm font-bold text-neutral-900">Store Sales Floor</div>
            <p className="mt-1.5 text-xs text-neutral-600">
              Point-of-sale checkout at 5 OXTON store locations. Decrements floor inventory
              upon payment.
            </p>
            <div className="mt-3 text-[11px] font-mono font-medium text-neutral-500">
              Ledger: SALE (ORD-XXXX)
            </div>
          </div>

          <div className="flex flex-col border border-neutral-200 bg-neutral-50 p-4 relative">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">
              Phase 4: Customer Care &amp; Loss
            </div>
            <div className="text-sm font-bold text-neutral-900">Returns &amp; Quarantine</div>
            <p className="mt-1.5 text-xs text-neutral-600">
              Inspected returns restocked to stores; defective or damaged items permanently
              quarantined.
            </p>
            <div className="mt-3 text-[11px] font-mono font-medium text-neutral-500">
              Ledger: RETURN / DAMAGE
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          FILTER & SEARCH TOOLBAR
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Procedures' },
            { id: 'logistics', label: 'Transfers & Logistics' },
            { id: 'sales', label: 'POS & Sales' },
            { id: 'inventory', label: 'Inventory & Catalog' },
            { id: 'governance', label: 'Audit & Governance' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-semibold transition cursor-pointer select-none ${
                selectedCategory === cat.id
                  ? 'bg-brand-charcoal text-white shadow-2xs'
                  : 'bg-white border border-neutral-300 text-neutral-600 hover:border-brand-primary hover:text-brand-primary'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search procedure or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 bg-white text-brand-charcoal focus:border-brand-primary focus:outline-hidden"
          />
        </div>
      </div>

      {/* =========================================================================
          WORKFLOW PROCEDURES ACCORDION / CARDS
          ========================================================================= */}
      <div className="flex flex-col gap-6">
        {filteredWorkflows.map((workflow) => {
          const Icon = workflow.icon
          return (
            <section
              key={workflow.id}
              id={workflow.id}
              className="border border-neutral-200 bg-white shadow-xs"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50/60 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center border border-neutral-200 bg-white text-brand-primary flex-shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                        {workflow.badge}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-brand-charcoal">
                      {workflow.title}
                    </h2>
                  </div>
                </div>

                <Link
                  to={workflow.linkTo}
                  className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto border border-neutral-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-charcoal hover:border-brand-primary hover:text-brand-primary transition shadow-2xs"
                >
                  <span>{workflow.linkText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 flex flex-col gap-6">
                <div>
                  <p className="text-sm text-neutral-600 leading-relaxed">
                    {workflow.summary}
                  </p>
                  <div className="mt-2.5 inline-flex items-center gap-2 bg-neutral-100 px-3 py-1 text-xs text-neutral-700 font-mono">
                    <span className="font-bold text-neutral-500">Ledger Impact:</span>
                    <span>{workflow.ledgerImpact}</span>
                  </div>
                </div>

                {/* Steps Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {workflow.steps.map((st) => (
                    <div
                      key={st.step}
                      className="flex flex-col border border-neutral-200 bg-white p-4 relative hover:border-neutral-300 transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex h-6 w-6 items-center justify-center bg-brand-charcoal text-[11px] font-bold text-white">
                          0{st.step}
                        </span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 opacity-60" />
                      </div>

                      <h3 className="text-xs font-bold text-brand-charcoal">
                        {st.title}
                      </h3>
                      <p className="text-[11px] font-semibold text-brand-primary mt-0.5">
                        {st.action}
                      </p>
                      <p className="mt-2 text-xs text-neutral-600 leading-relaxed flex-1">
                        {st.detail}
                      </p>

                      {st.tip ? (
                        <div className="mt-3 border-t border-neutral-100 pt-2 text-[11px] text-neutral-500 italic">
                          💡 <strong>Tip:</strong> {st.tip}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        })}

        {filteredWorkflows.length === 0 && (
          <div className="border border-neutral-200 bg-white p-12 text-center text-neutral-500 text-sm">
            No operating procedures found matching &quot;{searchQuery}&quot;. Try adjusting your search query.
          </div>
        )}
      </div>

      {/* =========================================================================
          FACILITIES DIRECTORY & ROLE MATRIX
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Facilities Directory */}
        <div className="border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-5 h-5 text-brand-primary" />
            <h3 className="text-base font-bold text-brand-charcoal">
              OXTON Facilities &amp; Location Nodes
            </h3>
          </div>
          <p className="text-xs text-neutral-600 mb-4">
            Every inventory movement references one of these approved location nodes:
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 text-xs">
              <div>
                <span className="font-bold text-brand-charcoal">Main Warehouse</span>
                <span className="ml-2 text-neutral-500">Central Distribution Hub</span>
              </div>
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                Warehouse
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 text-xs">
              <div>
                <span className="font-bold text-brand-charcoal">OXTON Flagship Store</span>
                <span className="ml-2 text-neutral-500">Downtown District</span>
              </div>
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                Retail Store
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 text-xs">
              <div>
                <span className="font-bold text-brand-charcoal">OXTON Uptown Store</span>
                <span className="ml-2 text-neutral-500">Commercial Center</span>
              </div>
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                Retail Store
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 text-xs">
              <div>
                <span className="font-bold text-brand-charcoal">OXTON Metro Outlet</span>
                <span className="ml-2 text-neutral-500">West End Plaza</span>
              </div>
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                Retail Store
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 text-xs">
              <div>
                <span className="font-bold text-brand-charcoal">Damaged Stock Quarantine</span>
                <span className="ml-2 text-neutral-500">Non-Sellable Holding</span>
              </div>
              <span className="bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                Damage Facility
              </span>
            </div>
          </div>
        </div>

        {/* Roles & Permissions Matrix */}
        <div className="border border-neutral-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-brand-primary" />
            <h3 className="text-base font-bold text-brand-charcoal">
              Staff Roles &amp; Security Matrix
            </h3>
          </div>
          <p className="text-xs text-neutral-600 mb-4">
            Access privileges enforced through secure server-side session authentication:
          </p>
          <div className="border border-neutral-200 overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-neutral-100 border-b border-neutral-200 text-[11px] font-bold text-neutral-700 uppercase">
                <tr>
                  <th className="p-2.5">Operational Capability</th>
                  <th className="p-2.5 text-center">Employee</th>
                  <th className="p-2.5 text-center">Administrator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-600">
                <tr>
                  <td className="p-2.5">POS Sales &amp; Checkout</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">✓</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-2.5">Customer Returns &amp; Exchanges</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">✓</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-2.5">Inter-Store Stock Transfers</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">✓</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-2.5">Damaged Stock Incident Logging</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">✓</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">✓</td>
                </tr>
                <tr>
                  <td className="p-2.5">Product Catalog Creation &amp; Editing</td>
                  <td className="p-2.5 text-center text-neutral-400">Read-Only</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">Full Access</td>
                </tr>
                <tr>
                  <td className="p-2.5">Cost Prices &amp; Financial Margins</td>
                  <td className="p-2.5 text-center text-rose-500 font-bold">Hidden</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">Visible</td>
                </tr>
                <tr>
                  <td className="p-2.5">Audit Ledger Adjustments</td>
                  <td className="p-2.5 text-center text-rose-500 font-bold">Blocked</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">Authorized</td>
                </tr>
                <tr>
                  <td className="p-2.5">Staff Accounts Management</td>
                  <td className="p-2.5 text-center text-rose-500 font-bold">Blocked</td>
                  <td className="p-2.5 text-center text-emerald-600 font-bold">Full Access</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            DESIGN SYSTEM: ALERT & CONFIRMATION MODAL PREVIEW
            ========================================================================= */}
        <div className="bg-white border border-neutral-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
            <Bell className="w-4 h-4 text-brand-primary" />
            <h3 className="text-base font-bold text-brand-charcoal">
              System Alerts &amp; Confirmation Dialogs
            </h3>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Standardized brand components replacing native browser alerts and confirms across the system:
          </p>

          {/* Inline Alert Banners */}
          <div className="space-y-2.5 pt-1">
            <Alert variant="error" title="Error Alert">
              An error occurred while saving the ledger record. Please check required fields.
            </Alert>
            <Alert variant="warning" title="Warning Notice">
              Current store inventory is below the reorder threshold (3 units remaining).
            </Alert>
            <Alert variant="info" title="Informational Note">
              All transfers between facilities are automatically tracked in the immutable audit log.
            </Alert>
            <Alert variant="success" title="Success Notification">
              Stock replenishment successfully processed and posted to facility inventory.
            </Alert>
          </div>

          {/* Interactive Confirm Modal Triggers */}
          <div className="pt-3 border-t border-neutral-100">
            <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-2">
              Interactive Confirmation Dialog Preview
            </span>
            <div className="flex flex-wrap gap-2.5">
              <Button
                size="sm"
                variant="danger"
                onClick={() => setPreviewModalVariant('danger')}
              >
                Test Danger Dialog
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPreviewModalVariant('warning')}
              >
                Test Warning Dialog
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setPreviewModalVariant('primary')}
              >
                Test Info Dialog
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Demo ConfirmModal Preview */}
      <ConfirmModal
        isOpen={Boolean(previewModalVariant)}
        onClose={() => setPreviewModalVariant(null)}
        onConfirm={() => setPreviewModalVariant(null)}
        title={
          previewModalVariant === 'danger'
            ? 'Archive Item'
            : previewModalVariant === 'warning'
              ? 'Role Change'
              : 'Synchronize Inventory'
        }
        description="Action confirmation dialog"
        message={
          previewModalVariant === 'danger' ? (
            <span>
              Are you sure you want to archive <strong>"Denim Jacket"</strong>? It will no longer be visible in the active sales catalog.
            </span>
          ) : previewModalVariant === 'warning' ? (
            <span>
              Are you sure you want to promote <strong>"employee@company.com"</strong> to Administrator?
            </span>
          ) : (
            <span>
              Confirm stock balance synchronization for all registered warehouses.
            </span>
          )
        }
        confirmText={
          previewModalVariant === 'danger'
            ? 'Archive Item'
            : previewModalVariant === 'warning'
              ? 'Confirm Role'
              : 'Synchronize'
        }
        variant={previewModalVariant ?? 'danger'}
      />
    </div>
  )
}
