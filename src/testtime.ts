import { TesttimePlugin } from 'nexus-future/plugin'
import { getPrismaClientInstance } from './lib/prisma-client'

if (process.env.LINK) {
  process.env.NEXUS_PRISMA_LINK = process.env.LINK
}

export const plugin: TesttimePlugin = () => {
  const plugin = () => {
    return {
      app: {
        db: {
          client: getPrismaClientInstance(),
        },
      },
    }
  }

  return plugin
}
