import { TesttimePlugin } from 'nexus/plugin'
import { getPrismaClientInstance } from './lib/prisma-client'
import { Settings } from './settings'

if (process.env.LINK) {
  process.env.NEXUS_PRISMA_LINK = process.env.LINK
}

export const plugin: TesttimePlugin<Settings> = (settings) => () => {
  const plugin = () => {
    return {
      app: {
        db: {
          client: getPrismaClientInstance(settings?.clientOptions),
        },
      },
    }
  }

  return plugin
}
