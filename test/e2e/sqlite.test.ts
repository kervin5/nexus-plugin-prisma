import { createE2EContext } from 'nexus/dist/lib/e2e-testing'
import { getTmpDir } from 'nexus/dist/lib/fs'
import * as Path from 'path'
import { e2eTestPlugin } from '../__helpers/e2e/testing'
import { takeUntilServerListening } from '../__helpers/e2e/utils'

const tmpDir = getTmpDir()
const ctx = createE2EContext({
  dir: Path.join(tmpDir, 'sqlite'),
  localNexus: null,
  serverPort: 4000,
})

test('e2e', async () => {
  console.log(ctx.dir)

  let nexusVersion = process.env.NEXUS_VERSION ?? 'next'

  // Run npx nexus
  await ctx
    .npxNexusCreateApp({
      packageManagerType: 'npm',
      databaseType: 'SQLite',
      nexusVersion,
    })
    .refCount()
    .pipe(takeUntilServerListening)
    .toPromise()

  // Do not run migration or seed because `nexus init` does it already for sqlite
  await e2eTestPlugin(ctx, { withoutMigration: true, withoutSeed: true })
})
