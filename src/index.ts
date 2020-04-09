import { PluginEntrypoint } from 'nexus/plugin'

export const prisma: PluginEntrypoint = () => ({
  packageJsonPath: require.resolve('../package.json'),
  runtime: {
    module: require.resolve('./runtime'),
    export: 'plugin',
  },
  worktime: {
    module: require.resolve('./worktime'),
    export: 'plugin',
  },
  testtime: {
    module: require.resolve('./testtime'),
    export: 'plugin',
  },
})

export default prisma
