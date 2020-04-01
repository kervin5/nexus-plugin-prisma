import { createE2EContext } from 'nexus/dist/lib/e2e-testing'
import { getTmpDir } from 'nexus/dist/lib/fs'
import * as Path from 'path'
import { e2eTestPlugin } from './helpers'

const tmpDir = getTmpDir()
const ctx = createE2EContext({
  dir: Path.join(tmpDir, 'sqlite'),
})

test('e2e with sqlite', async () => {
  console.log(ctx.dir)

  let nexusVersion = process.env.NEXUS_VERSION ?? 'next'

  // Run npx nexus
  const createAppResult = await ctx.npxNexusCreateApp(
    {
      packageManagerType: 'npm',
      databaseType: 'SQLite',
      nexusVersion,
    },
    (data, proc) => {
      if (data.includes('server listening')) {
        proc.kill()
      }
    }
  )

  expect(createAppResult.data).toContain('server listening')
  expect(createAppResult.exitCode).toStrictEqual(0)

  // Do not run migration or seed because `nexus init` does it already for sqlite
  await e2eTestPlugin(ctx, { withoutMigration: true, withoutSeed: true })
})
