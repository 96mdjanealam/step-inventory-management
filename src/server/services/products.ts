import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { products, productVariants } from '../db/schema/index.ts'
import { logActivity } from './activity-logs.ts'
import type {
  CreateProductInput,
  ListProductsInput,
  UpdateProductInput,
} from '../../lib/schemas/product.ts'

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildVariants(input: CreateProductInput) {
  if (input.variants.length > 0) return input.variants

  if (input.discountedPrice === undefined) {
    throw new Error('A price is required when no variants are given')
  }

  return [
    {
      sku: input.sku,
      attributes: {},
      image: input.image,
      discountedPrice: input.discountedPrice,
      regularPrice: input.regularPrice,
    },
  ]
}

function uniqueViolationConstraint(error: unknown): string | undefined {
  const candidates = [error, (error as { cause?: unknown } | undefined)?.cause]
  for (const candidate of candidates) {
    const pgError = candidate as
      { code?: string; constraint?: string } | undefined
    if (pgError?.code === '23505') return pgError.constraint
  }
  return undefined
}

export async function createProduct(input: CreateProductInput, userId: string) {
  const slug = input.slug ?? slugify(input.name)
  if (!slug) {
    throw new Error(
      'Could not generate a slug from the name; please provide one',
    )
  }

  const variantRows = buildVariants(input)

  try {
    return await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          name: input.name,
          category: input.category,
          targetConsumer: input.targetConsumer,
          measurementType: input.measurementType,
          unit: input.unit,
          images: input.images ?? [],
          description: input.description,
          slug,
          createdBy: userId,
        })
        .returning()

      const variants = await tx
        .insert(productVariants)
        .values(
          variantRows.map((variant, index) => ({
            productId: product.id,
            sku: variant.sku,
            attributes: variant.attributes,
            image: variant.image,
            discountedPrice: variant.discountedPrice,
            regularPrice: variant.regularPrice,
            isDefault: index === 0,
          })),
        )
        .returning()

      await logActivity(
        {
          userId,
          action: 'product.create',
          entityType: 'product',
          entityId: product.id,
          description: `Created product "${product.name}" with ${variants.length} variant(s)`,
          metadata: {
            name: product.name,
            category: product.category,
            slug: product.slug,
          },
        },
        tx,
      )

      return { ...product, variants }
    })
  } catch (error) {
    const constraint = uniqueViolationConstraint(error)
    if (constraint === 'products_slug_unique') {
      throw new Error('A product with this name already exists')
    }
    if (constraint === 'product_variants_sku_unique') {
      throw new Error('This SKU is already in use')
    }
    throw error
  }
}

export async function listProducts(input: ListProductsInput) {
  const escapedSearch = input.search?.replace(/[%_\\]/g, '\\$&')

  const where = and(
    input.includeArchived ? undefined : eq(products.isActive, true),
    escapedSearch ? ilike(products.name, `%${escapedSearch}%`) : undefined,
    input.category
      ? sql`lower(${products.category}) = lower(${input.category})`
      : undefined,
  )

  const [items, total] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
        slug: products.slug,
        targetConsumer: products.targetConsumer,
        measurementType: products.measurementType,
        unit: products.unit,
        images: products.images,
        isActive: products.isActive,
        createdAt: products.createdAt,
        discountedPrice: productVariants.discountedPrice,
        regularPrice: productVariants.regularPrice,
        variantImage: productVariants.image,
      })
      .from(products)
      .leftJoin(
        productVariants,
        and(
          eq(productVariants.productId, products.id),
          eq(productVariants.isDefault, true),
        ),
      )
      .where(where)
      .orderBy(desc(products.createdAt), products.id)
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db.$count(products, where),
  ])

  return { items, total, page: input.page, pageSize: input.pageSize }
}

export async function getProductById(id: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1)

  if (!product) {
    throw new Error('Product not found')
  }

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .orderBy(desc(productVariants.isDefault), productVariants.createdAt)

  return {
    ...product,
    variants,
  }
}

export async function updateProduct(
  input: UpdateProductInput,
  userId?: string,
) {
  return await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: products.id, name: products.name, slug: products.slug })
      .from(products)
      .where(eq(products.id, input.id))
      .limit(1)

    if (!current) {
      throw new Error('Product not found')
    }

    const slug =
      current.name !== input.name ? slugify(input.name) : current.slug

    if (!slug) {
      throw new Error('Could not generate a valid slug from the product name')
    }

    try {
      const [updated] = await tx
        .update(products)
        .set({
          name: input.name,
          category: input.category,
          targetConsumer: input.targetConsumer,
          ...(input.images !== undefined ? { images: input.images } : {}),
          description: input.description ?? null,
          slug,
        })
        .where(eq(products.id, input.id))
        .returning()

      await logActivity(
        {
          userId,
          action: 'product.update',
          entityType: 'product',
          entityId: updated.id,
          description: `Updated product "${updated.name}"`,
          metadata: {
            previousName: current.name,
            newName: updated.name,
            category: updated.category,
          },
        },
        tx,
      )

      return updated
    } catch (error) {
      const constraint = uniqueViolationConstraint(error)
      if (constraint === 'products_slug_unique') {
        throw new Error('A product with this name already exists')
      }
      throw error
    }
  })
}

export async function archiveProduct(id: string, userId?: string) {
  return await db.transaction(async (tx) => {
    const [archived] = await tx
      .update(products)
      .set({ isActive: false })
      .where(and(eq(products.id, id), eq(products.isActive, true)))
      .returning({
        id: products.id,
        name: products.name,
        isActive: products.isActive,
      })

    if (!archived) {
      throw new Error('Product not found or already archived')
    }

    await logActivity(
      {
        userId,
        action: 'product.archive',
        entityType: 'product',
        entityId: archived.id,
        description: `Archived product "${archived.name}"`,
      },
      tx,
    )

    return archived
  })
}

export async function restoreProduct(id: string, userId?: string) {
  return await db.transaction(async (tx) => {
    const [restored] = await tx
      .update(products)
      .set({ isActive: true })
      .where(and(eq(products.id, id), eq(products.isActive, false)))
      .returning({
        id: products.id,
        name: products.name,
        isActive: products.isActive,
      })

    if (!restored) {
      throw new Error('Product not found or already active')
    }

    await logActivity(
      {
        userId,
        action: 'product.restore',
        entityType: 'product',
        entityId: restored.id,
        description: `Restored product "${restored.name}"`,
      },
      tx,
    )

    return restored
  })
}

export async function listActiveProductsWithVariants() {
  const activeProds = await db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      measurementType: products.measurementType,
      unit: products.unit,
    })
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.name)

  if (activeProds.length === 0) return []

  const prodIds = activeProds.map((p) => p.id)
  const variants = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sku: productVariants.sku,
      attributes: productVariants.attributes,
      discountedPrice: productVariants.discountedPrice,
      regularPrice: productVariants.regularPrice,
      isDefault: productVariants.isDefault,
    })
    .from(productVariants)
    .where(
      and(
        inArray(productVariants.productId, prodIds),
        eq(productVariants.isActive, true),
      ),
    )
    .orderBy(desc(productVariants.isDefault), productVariants.sku)

  const variantsByProd = new Map<string, typeof variants>()
  for (const v of variants) {
    const list = variantsByProd.get(v.productId) ?? []
    list.push(v)
    variantsByProd.set(v.productId, list)
  }

  return activeProds.map((p) => ({
    ...p,
    variants: variantsByProd.get(p.id) ?? [],
  }))
}
