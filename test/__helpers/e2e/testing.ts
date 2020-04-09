import { introspectionQuery } from 'graphql'
import { createE2EContext } from 'nexus/dist/lib/e2e-testing'
import stripAnsi from 'strip-ansi'
import * as Path from 'path'
import * as fs from 'fs-jetpack'
import { bufferOutput, takeUntilServerListening } from './utils'
import { Subscription, ConnectableObservable } from 'rxjs'
import { refCount } from 'rxjs/operators'

export async function e2eTestPlugin(
  ctx: ReturnType<typeof createE2EContext>,
  opts?: { withoutMigration?: boolean; withoutSeed?: boolean }
) {
  if (!opts?.withoutMigration) {
    console.log('Create migration file...')
    const dbMigrateSaveResult = await ctx
      .spawn([
        'yarn',
        'prisma',
        'migrate',
        'save',
        '--create-db',
        '--name="init"',
        '--experimental',
      ])
      .refCount()
      .pipe(bufferOutput)
      .toPromise()

    expect(stripAnsi(dbMigrateSaveResult)).toContain(
      'Prisma Migrate just created your migration'
    )

    console.log('Apply migration...')
    const dbMigrateUpResult = await ctx
      .spawn([
        'yarn',
        'prisma',
        'migrate',
        'up',
        '--auto-approve',
        '--experimental',
      ])
      .refCount()
      .pipe(bufferOutput)
      .toPromise()

    expect(stripAnsi(dbMigrateUpResult)).toContain('Done with 1 migration')
  }

  await ctx
    .spawn(['yarn', 'prisma', 'generate'])
    .refCount()
    .pipe(bufferOutput)
    .toPromise()

  if (!opts?.withoutSeed) {
    const seedResult = await ctx
      .spawn(['yarn', '-s', 'ts-node', 'prisma/seed.ts'], { cwd: ctx.dir })
      .refCount()
      .pipe(bufferOutput)
      .toPromise()

    expect(seedResult).toContain('Seeded: ')
  }

  let proc: ConnectableObservable<string> = ctx.nexus(['dev'])
  let sub: Subscription = proc.connect()

  // Run nexus dev and query graphql api
  await proc
    .pipe(takeUntilServerListening)
    .toPromise()

  const queryResult: { worlds: any[] } = await ctx.client.request(`{
    worlds {
      id
      name
      population
    }
  }`)
  const introspectionResult = await ctx.client.request(introspectionQuery)

  expect(queryResult.worlds.length).toStrictEqual(2)
  queryResult.worlds.forEach(r => {
    expect(r).toHaveProperty('id')
    expect(r).toHaveProperty('name')
    expect(r).toHaveProperty('population')
  })

  expect(introspectionResult).toMatchSnapshot('introspection')

  sub.unsubscribe()

  const nexusPrismaTypegenPath = Path.join(
    ctx.dir,
    'node_modules',
    '@types',
    'typegen-nexus-prisma',
    'index.d.ts'
  )

  // Assert that nexus-prisma typegen was created
  expect(fs.exists(nexusPrismaTypegenPath)).toStrictEqual('file')

  // Run nexus build
  const buildOutput = await ctx
    .nexus(['build'])
    .pipe(refCount(), bufferOutput)
    .toPromise()

  expect(buildOutput).toContain('success')
}
