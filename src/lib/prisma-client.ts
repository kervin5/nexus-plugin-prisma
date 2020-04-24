import * as Path from 'path'
import { linkableRequire, linkableResolve } from './linkable'
import { Settings } from '../settings'
/**
 * Makes sure `@prisma/client` is copied to ZEIT Now by statically requiring `@prisma/client`
 * We do not use this import because we need to require the Prisma Client using `linkableRequire`.
 */
require('@prisma/client')

let prismaClientInstance: object | null = null

export function getPrismaClientInstance(clientOptions: Settings['clientOptions']) {
  if (!prismaClientInstance) {
    const { PrismaClient } = linkableRequire('@prisma/client')

    prismaClientInstance = clientOptions ? new PrismaClient(clientOptions) : new PrismaClient()
  }

  return prismaClientInstance
}

// HACK
// 1. https://prisma-company.slack.com/archives/C8AKVD5HU/p1574267904197600
// 2. https://prisma-company.slack.com/archives/CEYCG2MCN/p1574267824465700
export function getPrismaClientDir() {
  return Path.dirname(linkableResolve('@prisma/client'))
}
