import { introspectionQuery } from 'graphql'
import { ptySpawn, createE2EContext } from 'nexus/dist/lib/e2e-testing'
import stripAnsi from 'strip-ansi'
import * as Path from 'path'
import * as fs from 'fs-jetpack'

export async function e2eTestPlugin(
  ctx: ReturnType<typeof createE2EContext>,
  opts?: { withoutMigration?: boolean; withoutSeed?: boolean }
) {
  if (!opts?.withoutMigration) {
    console.log('Create migration file...')
    const dbMigrateSaveResult = await ctx.spawn([
      'yarn',
      'prisma',
      'migrate',
      'save',
      '--create-db',
      '--name="init"',
      '--experimental',
    ])

    expect(stripAnsi(dbMigrateSaveResult.data)).toContain(
      'Prisma Migrate just created your migration'
    )
    expect(dbMigrateSaveResult.exitCode).toStrictEqual(0)

    console.log('Apply migration...')
    const dbMigrateUpResult = await ctx.spawn([
      'yarn',
      'prisma',
      'migrate',
      'up',
      '--auto-approve',
      '--experimental',
    ])

    expect(stripAnsi(dbMigrateUpResult.data)).toContain('Done with 1 migration')
    expect(dbMigrateUpResult.exitCode).toStrictEqual(0)
  }

  await ctx.spawn(['yarn', 'prisma', 'generate'])

  if (!opts?.withoutSeed) {
    const seedResult = await ptySpawn(
      'yarn',
      ['-s', 'ts-node', 'prisma/seed.ts'],
      { cwd: ctx.dir },
      () => {}
    )

    expect(seedResult.data).toContain('Seeded: ')
    expect(seedResult.exitCode).toStrictEqual(0)
  }

  // Run nexus dev and query graphql api
  await ctx.nexus(['dev'], async (data, proc) => {
    if (data.includes('server listening')) {
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
      proc.kill()
    }
  })

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
  const res = await ctx.nexus(['build'], () => {})

  expect(res.data).toContain('success')
  expect(res.exitCode).toStrictEqual(0)
}
