// Bundles each functions/lambda/*.ts entry (plus its _lib + npm deps, e.g. nodemailer) into a single
// CJS file, then zips it — the shape Floci's (and real AWS) Lambda CreateFunction expects.
// Usage: node scripts/build-lambda.mjs  (run from functions/)
import { build } from 'esbuild';
import { createWriteStream, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

const root = path.resolve(import.meta.dirname, '..');
const lambdaDir = path.join(root, 'lambda');
const outDir = path.join(root, 'dist');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

function zipFile(filePath, zipPath, entryName) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(filePath, { name: entryName });
    archive.finalize();
  });
}

const entries = readdirSync(lambdaDir).filter((f) => f.endsWith('.ts'));

for (const entry of entries) {
  const name = entry.replace(/\.ts$/, '');
  const fnDir = path.join(outDir, name);
  mkdirSync(fnDir, { recursive: true });

  await build({
    entryPoints: [path.join(lambdaDir, entry)],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: path.join(fnDir, 'index.js'),
    // Lambda Node runtime provides these; bundling them in would be dead weight at best.
    external: ['aws-sdk', '@aws-sdk/*'],
  });

  const zipPath = path.join(outDir, `${name}.zip`);
  await zipFile(path.join(fnDir, 'index.js'), zipPath, 'index.js');
  console.log(`built ${name} -> dist/${name}.zip`);
}
