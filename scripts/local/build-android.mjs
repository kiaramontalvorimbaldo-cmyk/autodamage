import { createHash } from 'node:crypto';
import { createReport } from '../ci/report.mjs';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import process from 'node:process';
import console from 'node:console';
const report = createReport(
  'Compilación Android',
  process.env.AUTODAMAGE_ANDROID_REPORT_DIR || 'reports/android-local',
);
report.begin('Comprobar JDK y herramientas Android SDK');
try {
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    join(homedir(), 'AppData/Local/Android/Sdk');
  const java = process.env.JAVA_HOME || 'C:/Program Files/Android/Android Studio/jbr';
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const tool = join(sdk, 'build-tools', '36.0.0');
  const candidates = ['android-36', 'android-37.0'].map((name) =>
    join(sdk, 'platforms', name, 'android.jar'),
  );
  const platform = candidates.find(existsSync) || candidates[0];
  for (const file of [join(java, 'bin/javac' + suffix), platform, join(tool, 'aapt2' + suffix)])
    if (!existsSync(file)) throw new Error('Falta una herramienta Android: ' + file);
  const output = resolve('.local/android-build-' + Date.now());
  mkdirSync(output, { recursive: true });
  const classes = join(output, 'classes'),
    dex = join(output, 'dex');
  mkdirSync(classes);
  mkdirSync(dex);
  function run(binary, args) {
    const result = spawnSync(binary, args, { stdio: 'inherit', windowsHide: true });
    if (result.error || result.status !== 0)
      throw new Error('Falló la compilación Android: ' + binary);
  }
  const source = resolve('android/app/src/main/java/bo/autodamage/cliente');
  report.begin('Compilar código Java del cliente Android');
  run(join(java, 'bin/javac' + suffix), [
    '-encoding',
    'UTF-8',
    '--release',
    '17',
    '-classpath',
    platform,
    '-d',
    classes,
    ...readdirSync(source)
      .filter((f) => f.endsWith('.java'))
      .map((f) => join(source, f)),
  ]);
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
    .replaceAll('${applicationId}', 'bo.autodamage.cliente')
    .replace('<manifest ', '<manifest package="bo.autodamage.cliente" ');
  writeFileSync(join(output, 'AndroidManifest.xml'), manifest);
  report.begin('Compilar recursos de Android');
  run(join(tool, 'aapt2' + suffix), [
    'compile',
    '--dir',
    resolve('android/app/src/main/res'),
    '-o',
    join(output, 'resources.zip'),
  ]);
  report.begin('Empaquetar manifiesto y recursos');
  run(join(tool, 'aapt2' + suffix), [
    'link',
    '-o',
    join(output, 'unsigned.apk'),
    '-I',
    platform,
    '--manifest',
    join(output, 'AndroidManifest.xml'),
    '--min-sdk-version',
    '30',
    '--target-sdk-version',
    '36',
    '--version-code',
    '1',
    '--version-name',
    '1.0-local',
    join(output, 'resources.zip'),
  ]);
  report.begin('Crear clases para el empaquetado');
  run(join(java, 'bin/jar' + suffix), [
    '--create',
    '--file',
    join(output, 'classes.jar'),
    '-C',
    classes,
    '.',
  ]);
  report.begin('Convertir clases a DEX para Android');
  run(join(java, 'bin/java' + suffix), [
    '-cp',
    join(tool, 'lib/d8.jar'),
    'com.android.tools.r8.D8',
    '--lib',
    platform,
    '--min-api',
    '30',
    '--output',
    dex,
    join(output, 'classes.jar'),
  ]);
  run(join(java, 'bin/jar' + suffix), [
    '--update',
    '--file',
    join(output, 'unsigned.apk'),
    '-C',
    dex,
    'classes.dex',
  ]);
  report.begin('Alinear el paquete APK');
  run(join(tool, 'zipalign' + suffix), [
    '-p',
    '-f',
    '4',
    join(output, 'unsigned.apk'),
    join(output, 'aligned.apk'),
  ]);
  const key = resolve('.local/android-debug.keystore');
  if (!existsSync(key))
    run(join(java, 'bin/keytool' + suffix), [
      '-genkeypair',
      '-keystore',
      key,
      '-storepass',
      'android',
      '-keypass',
      'android',
      '-alias',
      'androiddebugkey',
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '10000',
      '-dname',
      'CN=Android Debug,O=AutoDamage,C=BO',
    ]);
  const deliver = resolve(process.env.AUTODAMAGE_APK_DIR || '.local/entregables');
  mkdirSync(deliver, { recursive: true });
  const apk = join(deliver, 'AutoDamage-Cliente.apk');
  report.begin('Firmar APK de demostración');
  run(join(java, 'bin/java' + suffix), [
    '-jar',
    join(tool, 'lib/apksigner.jar'),
    'sign',
    '--ks',
    key,
    '--ks-key-alias',
    'androiddebugkey',
    '--ks-pass',
    'pass:android',
    '--out',
    apk,
    join(output, 'aligned.apk'),
  ]);
  report.begin('Verificar la firma del APK');
  run(join(java, 'bin/java' + suffix), [
    '-jar',
    join(tool, 'lib/apksigner.jar'),
    'verify',
    '--verbose',
    apk,
  ]);
  console.log('APK de demostración generado:', apk);

  report.begin('Guardar información del artefacto');
  writeFileSync(
    join(deliver, 'metadata.json'),
    JSON.stringify(
      {
        package: 'bo.autodamage.cliente',
        version: '1.0-local',
        minAndroid: 11,
        targetSdk: 36,
        build: process.env.BUILD_NUMBER || null,
        commit: process.env.GIT_COMMIT || null,
        sha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
        signature: 'depuración; no apta para publicación en Play Store',
        deviceTests: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  report.fail(error);
  console.error('Falló la compilación Android. Consulta el reporte de fases.');
  process.exitCode = 1;
} finally {
  report.write();
}
