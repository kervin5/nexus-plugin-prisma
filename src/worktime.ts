import * as Prisma from '@prisma/sdk'
import chalk from 'chalk'
import { stripIndent } from 'common-tags'
import * as dotenv from 'dotenv'
import * as fs from 'fs-jetpack'
import { WorktimeLens, WorktimePlugin } from 'nexus/plugin'
import * as os from 'os'
import * as Path from 'path'

if (process.env.LINK) {
  process.env.NEXUS_PRISMA_LINK = process.env.LINK
}

/**
 * Pinned query-engine version. Calculated at build time and based on `@prisma/cli` version
 */
export const PRISMA_QUERY_ENGINE_VERSION: string = require('@prisma/cli/package.json')
  .prisma.version

export const plugin: WorktimePlugin = p => {
  let elapsedMsSinceRestart = Date.now()

  p.log.trace('start')

  p.hooks.build.onStart = async () => {
    await runPrismaGenerators(p)
  }

  p.hooks.create.onAfterBaseSetup = async hctx => {
    if (hctx.database === undefined) {
      throw new Error(
        'Should never happen. Prisma plugin should not be installed if no database were chosen in the create workflow'
      )
    }
    const datasource = renderDatasource(hctx.database)
    await Promise.all([
      fs.appendAsync(
        '.gitignore',
        os.EOL +
          stripIndent`
                # Prisma
                failed-inferMigrationSteps*
              `
      ),
      fs.writeAsync(
        'prisma/schema.prisma',
        datasource +
          os.EOL +
          stripIndent`
              generator prisma_client {
                provider = "prisma-client-js"
              }
     
              model World {
                id         Int    @id @default(autoincrement())
                name       String @unique
                population Float
              }
            `
      ),
      fs.writeAsync(
        'prisma/.env',
        stripIndent`
          DATABASE_URL="${renderConnectionURI(
            { database: hctx.database, connectionURI: hctx.connectionURI },
            p.layout.project.name
          )}"
        `
      ),
      fs.writeAsync(
        'prisma/seed.ts',
        stripIndent`
              import { PrismaClient } from '@prisma/client'
  
              const db = new PrismaClient()
              
              main()
              
              async function main() {
                const results = await Promise.all(
                  [
                    {
                      name: 'Earth',
                      population: 6_000_000_000,
                    },
                    {
                      name: 'Mars',
                      population: 0,
                    },
                  ].map(data => db.world.create({ data })),
                )
              
                console.log('Seeded: %j', results)
              
                db.disconnect()
              }
            `
      ),
      fs.writeAsync(
        p.layout.sourcePath('graphql.ts'),
        stripIndent`
              import { schema } from "nexus"
      
              schema.objectType({
                name: "World",
                definition(t) {
                  t.model.id()
                  t.model.name()
                  t.model.population()
                }
              })
      
              schema.queryType({
                definition(t) {
                  t.field("hello", {
                    type: "World",
                    args: {
                      world: schema.stringArg({ required: false })
                    },
                    async resolve(_root, args, ctx) {
                      const worldToFindByName = args.world ?? 'Earth'
                      const world = await ctx.db.world.findOne({
                        where: {
                          name: worldToFindByName
                        }
                      })
      
                      if (!world) throw new Error(\`No such world named "\${args.world}"\`)
      
                      return world
                    }
                  })
  
                  t.list.field('worlds', {
                    type: 'World',
                    resolve(_root, _args, ctx) { 
                      return ctx.db.world.findMany()
                    }
                  })
                }
              })
            `
      ),
    ])
    if (hctx.connectionURI || hctx.database === 'SQLite') {
      p.log.info('Initializing development database...')
      // TODO expose run on nexus
      await p.packageManager.runBin(
        'prisma migrate save --create-db --name init --experimental',
        {
          require: true,
        }
      )
      await p.packageManager.runBin('prisma migrate up -c --experimental', {
        require: true,
      })
      p.log.info('Generating Prisma Client JS...')
      await p.packageManager.runBin('prisma generate', { require: true })
      p.log.info('Seeding development database...')
      await p.packageManager.runBin('ts-node prisma/seed', {
        require: true,
      })
    } else {
      p.log.info(stripIndent`
            1. Please setup your ${
              hctx.database
            } and fill in the connection uri in your \`${chalk.greenBright(
        'prisma/.env'
      )}\` file.
          `)
      p.log.info(stripIndent`
              2. Run \`${chalk.greenBright(
                p.packageManager.renderRunBin(
                  'prisma migrate save --experimental'
                )
              )}\` to create your first migration file.
          `)
      p.log.info(stripIndent`
            3. Run \`${chalk.greenBright(
              p.packageManager.renderRunBin('prisma migrate up --experimental')
            )}\` to migrate your database.
          `)
      p.log.info(stripIndent`
          4. Run \`${chalk.greenBright(
            p.packageManager.renderRunBin('prisma generate')
          )}\` to generate the Prisma Client.
        `)
      p.log.info(stripIndent`
            5. Run \`${chalk.greenBright(
              p.packageManager.renderRunBin('ts-node prisma/seed.ts')
            )}\` to seed your database.
          `)
      p.log.info(stripIndent`
            6. Run \`${chalk.greenBright(
              p.packageManager.renderRunScript('dev')
            )}\` to start working.
          `)
    }
  }
  // generate
  p.hooks.generate.onStart = async () => {
    await runPrismaGenerators(p)
  }
  // dev
  p.hooks.dev.onStart = async () => {
    await runPrismaGenerators(p)
  }

  p.hooks.dev.onAfterWatcherRestart = () => {
    elapsedMsSinceRestart = Date.now()
  }

  p.hooks.dev.onFileWatcherEvent = async (_event, file, _stats, watcher) => {
    if (file.match(/.*schema\.prisma$/)) {
      // Prevent from prompting twice when some updates to the schema are queued while the prompt is shown
      const elapsed = Date.now() - elapsedMsSinceRestart
      if (elapsed < 50) {
        return
      }

      await promptForMigration(p, watcher, file)
    }
  }
  p.hooks.dev.addToWatcherSettings = {
    // TODO preferably we allow schema.prisma to be anywhere but they show up in
    // migrations folder too and we don't know how to achieve semantic "anywhere
    // but migrations folder"
    watchFilePatterns: ['./schema.prisma', './prisma/schema.prisma'],
    listeners: {
      app: {
        ignoreFilePatterns: ['./prisma/**', './schema.prisma'],
      },
      plugin: {
        allowFilePatterns: ['./schema.prisma', './prisma/schema.prisma'],
      },
    },
  }
  return plugin
}

/**
 * Get the declared generator blocks in the user's PSL file
 */
async function getGenerators(schemaPath: string) {
  return await Prisma.getGenerators({
    schemaPath,
    printDownloadProgress: false,
    version: PRISMA_QUERY_ENGINE_VERSION,
  })
}

/**
 * Compute the resolved settings of a generator which has its baked in manifest
 * but also user-provided overrides. This computes the merger of the two.
 */
function getGeneratorResolvedSettings(
  g: Prisma.Generator
): {
  name: string
  instanceName: string
  output: string
} {
  return {
    name: g.manifest?.prettyName ?? '',
    instanceName: g.options?.generator.name ?? '',
    output: g.options?.generator.output ?? g.manifest?.defaultOutput ?? '',
  }
}

type Database = 'SQLite' | 'MySQL' | 'PostgreSQL'
type ConnectionURI = string | undefined

const DATABASE_TO_PRISMA_PROVIDER: Record<
  Database,
  'sqlite' | 'postgresql' | 'mysql'
> = {
  SQLite: 'sqlite',
  MySQL: 'mysql',
  PostgreSQL: 'postgresql',
}

function renderDatasource(database: Database): string {
  const provider = DATABASE_TO_PRISMA_PROVIDER[database]

  return (
    stripIndent`
      datasource db {
        provider = "${provider}"
        url      = env("DATABASE_URL")
      }
    ` + os.EOL
  )
}

const DATABASE_TO_CONNECTION_URI: Record<
  Database,
  (projectName: string) => string
> = {
  SQLite: _ => 'file:./dev.db',
  PostgreSQL: projectName =>
    `postgresql://postgres:postgres@localhost:5432/${projectName}`,
  MySQL: projectName => `mysql://root:<password>@localhost:3306/${projectName}`,
}

function renderConnectionURI(
  db: {
    database: Database
    connectionURI: ConnectionURI
  },
  projectName: string
): string {
  if (db.connectionURI) {
    return db.connectionURI
  }

  return DATABASE_TO_CONNECTION_URI[db.database](projectName)
}

/**
 * Execute all the generators in the user's PSL file.
 */
async function runPrismaGenerators(
  p: WorktimeLens,
  options: { silent: boolean } = { silent: false }
): Promise<void> {
  if (!options.silent) {
    p.log.info('Running Prisma generators ...')
  }

  const schemaPath = findPrismaSchema(p)

  loadEnv(p, schemaPath)

  p.log.trace('loading generators...')
  let generators = await getGenerators(schemaPath)
  p.log.trace('generators loaded.')

  if (
    !generators.find(g => g.options?.generator.provider === 'prisma-client-js')
  ) {
    await scaffoldPrismaClientGeneratorBlock(p, schemaPath)
    // TODO: Generate it programmatically instead for performance reason
    generators = await getGenerators(schemaPath)
  }

  for (const g of generators) {
    const resolvedSettings = getGeneratorResolvedSettings(g)
    p.log.trace('generating', resolvedSettings)
    await g.generate()
    g.stop()
    p.log.trace('done generating', resolvedSettings)
  }
}

export function loadEnv(p: WorktimeLens, schemaPath: string): void {
  const schemaDir = Path.dirname(schemaPath)
  let envPath: string | null = Path.join(schemaDir, '.env')

  // Look next to `schema.prisma`, other look in project root
  if (!fs.exists(envPath)) {
    envPath = Path.join(p.layout.projectRoot, '.env')
  }

  if (!fs.exists(envPath)) {
    p.log.trace(`No .env file found. Looked at: ${envPath}`)
    return
  }

  p.log.trace(`.env file found. Looked at: ${envPath}`)
  dotenv.config({ path: envPath })
}

/**
 * Find the PSL file in the project. If multiple are found a warning is logged.
 */
function findPrismaSchema(p: WorktimeLens): string {
  const projectRoot = p.layout.projectRoot
  let schemaPath = Path.join(projectRoot, 'schema.prisma')

  if (fs.exists(schemaPath)) {
    return schemaPath
  }

  schemaPath = Path.join(projectRoot, 'prisma', 'schema.prisma')

  if (fs.exists(schemaPath)) {
    return schemaPath
  }

  p.log.error(stripIndent`
    We could not find any \`schema.prisma\` file. We looked in:
      - ${Path.join(projectRoot, 'schema.prisma')}
      - ${schemaPath}
    Please create one or check out the docs to get started here: http://nxs.li/nexus-plugin-prisma
  `)
  process.exit(1)
}

async function scaffoldPrismaClientGeneratorBlock(
  p: WorktimeLens,
  schemaPath: string
) {
  const relativeSchemaPath = Path.relative(process.cwd(), schemaPath)
  p.log.warn(
    `A Prisma Client JS generator block is needed in your Prisma Schema at "${relativeSchemaPath}".`
  )
  p.log.warn('We scaffolded one for you.')
  const schemaContent = await fs.readAsync(schemaPath)!
  const generatorBlock = stripIndent`
      generator prisma_client {
        provider = "prisma-client-js"
      }
    `
  await fs.writeAsync(schemaPath, `${generatorBlock}${os.EOL}${schemaContent}`)
}

async function promptForMigration(
  p: WorktimeLens,
  watcher: {
    restart: (file: string) => void
    pause: () => void
    resume: () => void
  },
  file: string
) {
  watcher.pause()
  p.log.info('We detected a change in your Prisma Schema file.')
  p.log.info("If you're using Prisma Migrate, follow the step below:")
  p.log.info(
    `1. Run ${chalk.greenBright(
      p.packageManager.renderRunBin('prisma migrate save --experimental')
    )} to create a migration file.`
  )
  p.log.info(
    `2. Run ${chalk.greenBright(
      p.packageManager.renderRunBin('prisma migrate up --experimental')
    )} to apply your migration.`
  )
  await p.prompt({
    type: 'confirm',
    name: 'confirm',
    message: 'Press Y to restart once your migration is applied',
    initial: true,
    yesOption: '(Y)',
    noOption: '(Y)',
    yes: 'Restarting...',
    no: 'Restarting...',
  } as any)

  await runPrismaGenerators(p)
  watcher.restart(file)
}
