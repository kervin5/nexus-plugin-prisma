import * as FS from 'fs-jetpack'
import { createE2EContext } from 'nexus/dist/lib/e2e-testing'
import { getTmpDir } from 'nexus/dist/lib/fs'
import * as Path from 'path'
import { refCount } from 'rxjs/operators'
import { e2eTestPlugin } from '../__helpers/e2e/testing'
import { bufferOutput, takeUntilServerListening } from '../__helpers/e2e/utils'

const tmpDir = getTmpDir()
const testProjectDir = Path.join(tmpDir, 'mysql')
const envPath = Path.join(testProjectDir, 'prisma', '.env')
const ctx = createE2EContext({
  dir: testProjectDir,
  localNexus: null,
  serverPort: 4000,
})

test('e2e with mysql', async () => {
  console.log(ctx.dir)

  let nexusVersion = process.env.NEXUS_VERSION ?? 'next'
  // Run npx nexus from local path
  const initResult = await ctx
    .npxNexusCreateApp({
      packageManagerType: 'npm',
      databaseType: 'MySQL',
      nexusVersion,
    })
    .pipe(refCount(), takeUntilServerListening, bufferOutput)
    .toPromise()

  expect(initResult).toContain('Run `npm run -s dev` to start working')

  // Update database credentials
  const prismaSchemaContent = FS.read(envPath)!.replace(
    'mysql://root:<password>@localhost:3306/mysql',
    'mysql://root:mysql@localhost:4567/mysql'
  )

  FS.write(envPath, prismaSchemaContent)

  await e2eTestPlugin(ctx)
})
