# Development

## `@nexus/schema` & `graphql`

- Dependend upon because `nexus-prisma` has them as peer deps
- While `nexus` brings them, relying on that would be relying on their being hoisting, which we should not
- For more detail see https://github.com/graphql-nexus/nexus/issues/514#issuecomment-604668904

## Running e2e tests locally

- have docker running on your machine
- `docker-compose up -d`
- `yarn test:e2e:<name>`
