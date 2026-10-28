import { and, desc, eq, gte, lte, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../db/index.ts'
import { activityLogs, locations, profiles } from '../db/schema/index.ts'
import type {
  ListActivityLogsInput,
  LogActivityInput,
} from '../../lib/schemas/activity-log.ts'

export type DatabaseOrTransaction =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function logActivity(
  input: LogActivityInput,
  client: DatabaseOrTransaction = db,
) {
  const [created] = await client
    .insert(activityLogs)
    .values({
      userId: input.userId || null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      description: input.description,
      metadata: input.metadata ?? {},
      sourceLocationId: input.sourceLocationId || null,
      destinationLocationId: input.destinationLocationId || null,
    })
    .returning()

  return created
}

export async function listActivityLogs(input: ListActivityLogsInput) {
  const sourceLocation = alias(locations, 'source_location')
  const destLocation = alias(locations, 'dest_location')

  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 20

  const conditions = [
    input.action ? eq(activityLogs.action, input.action) : undefined,
    input.entityType ? eq(activityLogs.entityType, input.entityType) : undefined,
    input.userId ? eq(activityLogs.userId, input.userId) : undefined,
    input.locationId
      ? or(
          eq(activityLogs.sourceLocationId, input.locationId),
          eq(activityLogs.destinationLocationId, input.locationId),
        )
      : undefined,
    input.startDate
      ? gte(activityLogs.createdAt, new Date(input.startDate))
      : undefined,
    input.endDate
      ? lte(activityLogs.createdAt, new Date(input.endDate))
      : undefined,
  ]

  const where = and(...conditions.filter(Boolean))

  const [items, total] = await Promise.all([
    db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        description: activityLogs.description,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt,
        user: {
          id: profiles.id,
          username: profiles.username,
          role: profiles.role,
        },
        sourceLocation: {
          id: sourceLocation.id,
          name: sourceLocation.name,
          type: sourceLocation.type,
        },
        destinationLocation: {
          id: destLocation.id,
          name: destLocation.name,
          type: destLocation.type,
        },
      })
      .from(activityLogs)
      .leftJoin(profiles, eq(activityLogs.userId, profiles.id))
      .leftJoin(sourceLocation, eq(activityLogs.sourceLocationId, sourceLocation.id))
      .leftJoin(destLocation, eq(activityLogs.destinationLocationId, destLocation.id))
      .where(where)
      .orderBy(desc(activityLogs.createdAt), activityLogs.id)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.$count(activityLogs, where),
  ])

  return { items, total, page, pageSize }
}
