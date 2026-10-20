import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import RetentionService from '#services/retention_service'

test.group('Retenção · maintenance:purge', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('apaga eventos, auditoria, sessões e limites vencidos e preserva o recente', async ({
    assert,
  }) => {
    const now = DateTime.utc()
    const old = now.minus({ days: 5000 }).toJSDate()
    const recent = now.minus({ days: 1 }).toJSDate()
    await db.table('page_events').multiInsert([
      {
        kind: 'view',
        resource_type: 'home',
        visitor_hash: 'a',
        device: 'desktop',
        created_at: old,
      },
      {
        kind: 'view',
        resource_type: 'home',
        visitor_hash: 'b',
        device: 'desktop',
        created_at: recent,
      },
    ])
    await db.table('audit_logs').multiInsert([
      { action: 'x.old', created_at: old },
      { action: 'x.recent', created_at: recent },
    ])
    await db.table('sessions').multiInsert([
      { id: 'expired', data: '{}', expires_at: now.minus({ hours: 1 }).toJSDate() },
      { id: 'valid', data: '{}', expires_at: now.plus({ hours: 1 }).toJSDate() },
    ])
    await db.table('rate_limits').multiInsert([
      { key: 'gone', points: 3, expire: now.minus({ minutes: 5 }).toMillis() },
      { key: 'kept', points: 1, expire: now.plus({ minutes: 5 }).toMillis() },
    ])

    const report = await RetentionService.purgeAll(now)

    assert.equal(report.page_events, 1)
    assert.equal(report.audit_logs, 1)
    assert.equal(report.sessions, 1)
    assert.equal(report.rate_limits, 1)
    const audits = await db.from('audit_logs').select('action')
    const sessions = await db.from('sessions').select('id')
    const limits = await db.from('rate_limits').select('key')
    assert.deepEqual(
      audits.map((r) => r.action),
      ['x.recent']
    )
    assert.deepEqual(
      sessions.map((r) => r.id),
      ['valid']
    )
    assert.deepEqual(
      limits.map((r) => r.key),
      ['kept']
    )
  })
})
