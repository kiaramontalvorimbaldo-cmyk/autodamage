import process from 'node:process';
import console from 'node:console';
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error('Este pipeline necesita Node.js 22 o superior; se recomienda Node.js 24.');
  process.exitCode = 1;
} else {
  console.log(`Node.js ${process.versions.node}: listo para ejecutar CI.`);
}
