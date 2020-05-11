import { PrismaClientOptions as ClientOptions } from '@prisma/client/runtime/getPrismaClient'
import { PrismaClient } from '@prisma/client'

export type PrismaClientOptions = {
  /**
   * Options to pass to the Prisma Client instantiated by the plugin.
   * If you want to instantiate your own Prisma Client, use `instance` instead.
   */
  options: ClientOptions
}

export type PrismaClientInstance = {
  /**
   * Instance of your own Prisma Client. You can import it from 'nexus-plugin-prisma/client'.
   * If you just want to pass some settings to the Prisma Client, use `options` instead.
   */
  instance: PrismaClient
}

export type Settings = {
  /**
   * Use this to pass some settings to the Prisma Client instantiated by the plugin or to pass your own Prisma Client
   */
  client?: PrismaClientOptions | PrismaClientInstance
  /**
   * Enable or disable migrations run by the plugin when editing your schema.prisma file
   * 
   * @default true
   */
  migrations?: boolean
}
