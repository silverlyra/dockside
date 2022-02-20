const esbuild = require('esbuild')
const package = require('./package.json')

const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'lib',
  platform: 'node',
  target: 'node14',
  external: Object.keys(package.dependencies),
  sourcemap: true,
  sourcesContent: false,
}

const main = () => {
  esbuild.buildSync({
    format: 'cjs',
    ...config,
  })

  esbuild.buildSync({
    format: 'esm',
    outExtension: {'.js': '.mjs'},
    ...config,
  })
}

if (require.main === module) {
  main()
}
