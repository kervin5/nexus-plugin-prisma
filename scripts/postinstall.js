const chalk = require('chalk')
const jetpack = require('fs-jetpack');
const path = require('path');

const destDir = path.join(__dirname, '..', '..', '@types', 'nexus-plugin-prisma')

jetpack.copy(path.join(__dirname, '..', 'global-type.d.ts'), path.join(destDir, 'index.d.ts'), { overwrite: true })

console.log(chalk.bold.yellowBright('----------------------------------'))
console.log(
  chalk.bold.yellowBright(
    `If you want to learn more about the ${chalk.reset.greenBright(
      `\`nexus-plugin-prisma\``
    )}`
  )
)
console.log(
  chalk.bold.yellowBright(
    `Follow this link: ${chalk.reset.greenBright(`http://nxs.li/nexus-plugin-prisma`)}`
  )
)
console.log(chalk.bold.yellowBright('----------------------------------'))
