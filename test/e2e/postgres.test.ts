import { createE2EContext } from 'nexus/dist/lib/e2e-testing'
import { getTmpDir } from 'nexus/dist/lib/fs'
import * as Path from 'path'
import stripAnsi from 'strip-ansi'
import { e2eTestPlugin } from './helpers'

const tmpDir = getTmpDir()
const ctx = createE2EContext({
  dir: Path.join(tmpDir, 'postgres'),
})

test('e2e with postgres', async () => {
  console.log(ctx.dir)

  let nexusVersion = process.env.NEXUS_VERSION ?? 'next'

  // Run npx nexus from local path
  const initResult = await ctx.npxNexusCreateApp(
    {
      packageManagerType: 'npm',
      databaseType: 'PostgreSQL',
      nexusVersion,
    },
    () => {}
  )

  expect(stripAnsi(initResult.data)).toContain(
    'Run `npm run -s dev` to start working'
  )
  expect(initResult.exitCode).toStrictEqual(0)

  await e2eTestPlugin(ctx)
})
