import { createE2EContext } from 'nexus/dist/lib/e2e-testing'
import { getTmpDir } from 'nexus/dist/lib/fs'
import * as Path from 'path'
import { refCount } from 'rxjs/operators'
import { e2eTestPlugin } from '../__helpers/e2e/testing'
import { bufferOutput, takeUntilServerListening } from '../__helpers/e2e/utils'

const tmpDir = getTmpDir()
const ctx = createE2EContext({
  dir: Path.join(tmpDir, 'postgres'),
  localNexus: null,
  serverPort: 4000,
})

test('e2e', async () => {
  console.log(ctx.dir)

  let nexusVersion = process.env.NEXUS_VERSION ?? 'next'

  // Run npx nexus from local path
  const initResult = await ctx
    .npxNexusCreateApp({
      packageManagerType: 'npm',
      databaseType: 'PostgreSQL',
      nexusVersion,
    })
    .pipe(refCount(), takeUntilServerListening, bufferOutput)
    .toPromise()

  expect(initResult).toContain('Run `npm run -s dev` to start working')

  await e2eTestPlugin(ctx)
})
