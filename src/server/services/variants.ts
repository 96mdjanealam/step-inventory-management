import { and, desc, eq, ne } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { products, productVariants } from '../db/schema/index.ts'
import { logActivity } from './activity-logs.ts'
import type {
  CreateVariantInput,
  ToggleVariantActiveInput,
  UpdateVariantInput,
} from '../../lib/schemas/product.ts'

function uniqueViolationConstraint(error: unknown): string | undefined {
  const candidates = [error, (error as { cause?: unknown } | undefined)?.cause]
  for (const candidate of candidates) {
    const pgError = candidate as
      { code?: string; constraint?: string } | undefined
    if (pgError?.code === '23505') return pgError.constraint
  }
  return undefined
}

export async function createVariant(
  input: CreateVariantInput,
  userId?: string,
) {
  return await db.transaction(async (tx) => {
    const [product] = await tx
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1)

    if (!product) {
      throw new Error('Product not found')
    }

    const existingVariants = await tx
      .select({ id: productVariants.id, isDefault: productVariants.isDefault })
      .from(productVariants)
      .where(eq(productVariants.productId, input.productId))

    let isDefault = input.isDefault
    if (isDefault) {
      // Unset previous default before inserting new default
      await tx
        .update(productVariants)
        .set({ isDefault: false })
        .where(eq(productVariants.productId, input.productId))
    } else if (
      existingVariants.length === 0 ||
      !existingVariants.some((v) => v.isDefault)
    ) {
      isDefault = true
    }

    try {
      const [created] = await tx
        .insert(productVariants)
        .values({
          productId: input.productId,
          sku: input.sku || null,
          attributes: input.attributes,
          image: input.image || null,
          discountedPrice: input.discountedPrice,
          regularPrice: input.regularPrice || null,
          isDefault,
        })
        .returning()

      await logActivity(
        {
          userId,
          action: 'variant.create',
          entityType: 'variant',
          entityId: created.id,
          description: `Added variant for "${product.name}" (SKU: ${created.sku ?? 'None'}, Price: $${created.discountedPrice})`,
          metadata: {
            productId: product.id,
            productName: product.name,
            sku: created.sku,
            discountedPrice: created.discountedPrice,
            attributes: created.attributes,
          },
        },
        tx,
      )

      return created
    } catch (error) {
      const constraint = uniqueViolationConstraint(error)
      if (constraint === 'product_variants_sku_unique') {
        throw new Error('This SKU is already in use')
      }
      if (constraint === 'product_variants_unique_attributes') {
        throw new Error(
          'A variant with these attributes already exists for this product',
        )
      }
      throw error
    }
  })
}

export async function updateVariant(
  input: UpdateVariantInput,
  userId?: string,
) {
  return await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, input.id))
      .limit(1)

    if (!current) {
      throw new Error('Variant not found')
    }

    let isDefault = input.isDefault

    if (isDefault) {
      // Unset default on other variants for this product
      await tx
        .update(productVariants)
        .set({ isDefault: false })
        .where(
          and(
            eq(productVariants.productId, current.productId),
            ne(productVariants.id, current.id),
          ),
        )
    } else if (current.isDefault) {
      // Unsetting default on current: first find candidate, unset current, then set candidate
      const [otherActive] = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, current.productId),
            ne(productVariants.id, current.id),
            eq(productVariants.isActive, true),
          ),
        )
        .orderBy(desc(productVariants.createdAt))
        .limit(1)

      if (otherActive) {
        // Candidate will be promoted below
      } else {
        // Can't unset default if this is the only active variant
        isDefault = true
      }
    }

    try {
      const [updated] = await tx
        .update(productVariants)
        .set({
          sku: input.sku || null,
          attributes: input.attributes,
          image: input.image || null,
          discountedPrice: input.discountedPrice,
          regularPrice: input.regularPrice || null,
          isDefault,
        })
        .where(eq(productVariants.id, input.id))
        .returning()

      // If we unset default, promote the other active variant now
      if (current.isDefault && !isDefault) {
        const [otherActive] = await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(
            and(
              eq(productVariants.productId, current.productId),
              ne(productVariants.id, current.id),
              eq(productVariants.isActive, true),
            ),
          )
          .orderBy(desc(productVariants.createdAt))
          .limit(1)

        if (otherActive) {
          await tx
            .update(productVariants)
            .set({ isDefault: true })
            .where(eq(productVariants.id, otherActive.id))
        }
      }

      await logActivity(
        {
          userId,
          action: 'variant.update',
          entityType: 'variant',
          entityId: updated.id,
          description: `Updated variant (SKU: ${updated.sku ?? 'None'}, Price: $${updated.discountedPrice})`,
          metadata: {
            variantId: updated.id,
            productId: updated.productId,
            sku: updated.sku,
            discountedPrice: updated.discountedPrice,
            isDefault: updated.isDefault,
          },
        },
        tx,
      )

      return updated
    } catch (error) {
      const constraint = uniqueViolationConstraint(error)
      if (constraint === 'product_variants_sku_unique') {
        throw new Error('This SKU is already in use')
      }
      if (constraint === 'product_variants_unique_attributes') {
        throw new Error(
          'A variant with these attributes already exists for this product',
        )
      }
      throw error
    }
  })
}

export async function toggleVariantActive(
  input: ToggleVariantActiveInput,
  userId?: string,
) {
  return await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, input.id))
      .limit(1)

    if (!current) {
      throw new Error('Variant not found')
    }

    if (current.isActive === input.isActive) {
      return current
    }

    if (!input.isActive) {
      // Deactivating: ensure at least one other variant remains active
      const activeVariants = await tx
        .select({ id: productVariants.id, isDefault: productVariants.isDefault })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, current.productId),
            eq(productVariants.isActive, true),
          ),
        )

      if (activeVariants.length <= 1) {
        throw new Error('Cannot deactivate the only active variant of a product')
      }

      // First deactivate current variant and unset default
      const [updated] = await tx
        .update(productVariants)
        .set({
          isActive: false,
          isDefault: false,
        })
        .where(eq(productVariants.id, current.id))
        .returning()

      // If current was default, promote another active variant to default
      if (current.isDefault) {
        const nextDefault = activeVariants.find((v) => v.id !== current.id)
        if (nextDefault) {
          await tx
            .update(productVariants)
            .set({ isDefault: true })
            .where(eq(productVariants.id, nextDefault.id))
        }
      }

      await logActivity(
        {
          userId,
          action: 'variant.toggle',
          entityType: 'variant',
          entityId: updated.id,
          description: `Deactivated variant (SKU: ${updated.sku ?? 'None'})`,
          metadata: {
            variantId: updated.id,
            productId: updated.productId,
            isActive: false,
          },
        },
        tx,
      )

      return updated
    } else {
      // Activating: check if another variant is already default
      const defaultVariant = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, current.productId),
            eq(productVariants.isDefault, true),
          ),
        )
        .limit(1)

      try {
        const [updated] = await tx
          .update(productVariants)
          .set({
            isActive: true,
            isDefault: defaultVariant.length === 0,
          })
          .where(eq(productVariants.id, current.id))
          .returning()

        await logActivity(
          {
            userId,
            action: 'variant.toggle',
            entityType: 'variant',
            entityId: updated.id,
            description: `Activated variant (SKU: ${updated.sku ?? 'None'})`,
            metadata: {
              variantId: updated.id,
              productId: updated.productId,
              isActive: true,
            },
          },
          tx,
        )

        return updated
      } catch (error) {
        const constraint = uniqueViolationConstraint(error)
        if (constraint === 'product_variants_unique_attributes') {
          throw new Error(
            'Cannot activate variant: another active variant has identical attributes',
          )
        }
        throw error
      }
    }
  })
}
