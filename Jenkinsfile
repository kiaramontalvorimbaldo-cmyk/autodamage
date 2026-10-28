// Pipeline de verificación. No despliega, aplica migraciones ni necesita claves reales.
def projectDirectory() {
    def value = params.PROJECT_DIR?.trim() ?: '.'
    if (!value.matches('[A-Za-z0-9_./-]+') || value.startsWith('/') || value.tokenize('/').contains('..')) {
        error('PROJECT_DIR debe ser una carpeta relativa del repositorio, sin .. ni rutas absolutas.')
    }
    return value
}

def inProject(Closure body) {
    dir(projectDirectory()) { body() }
}

def projectCommand(String command) {
    inProject {
        if (isUnix()) {
            sh(label: command, script: command)
        } else {
            bat(label: command, script: "@echo off\r\ncall ${command}")
        }
    }
}

pipeline {
    agent any
    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    }
    parameters {
        string(name: 'PROJECT_DIR', defaultValue: '.', description: 'Carpeta que contiene package.json. Usa . si el proyecto es la raíz del repositorio.')
        booleanParam(name: 'INSTALL_BROWSER_SYSTEM_DEPS', defaultValue: false, description: 'Solo Linux: instalar dependencias del sistema de Chromium. Requiere permisos para instalar paquetes.')
    }
    environment {
        CI = 'true'
        HUSKY = '0'
        NEXT_TELEMETRY_DISABLED = '1'
    }
    stages {
        stage('Checkout y preparación') {
            steps {
                script {
                    env.REPORTS_READY = 'false'
                    env.UNIT_STARTED = 'false'
                    env.E2E_STARTED = 'false'
                    env.APP_BUILD_OK = 'false'
                }
                checkout scm
                script {
                    inProject {
                        if (!fileExists('package.json') || !fileExists('package-lock.json')) {
                            error('PROJECT_DIR no contiene el proyecto Node.js. Revisa la carpeta configurada.')
                        }
                        // Solo salidas generadas: evita publicar resultados de un build anterior.
                        ['coverage', 'playwright-report', 'junit-results', 'test-results'].each { folder ->
                            dir(folder) { deleteDir() }
                        }
                        env.REPORTS_READY = 'true'
                    }
                    projectCommand('node scripts/ci/preflight.mjs')
                    projectCommand('npm --version')
                }
            }
        }
        stage('Instalar dependencias') {
            steps { script { projectCommand('npm ci') } }
        }
        stage('Lint y tipos') {
            steps {
                script {
                    catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                        projectCommand('node scripts/ci/run.mjs lint')
                    }
                    catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                        projectCommand('node scripts/ci/run.mjs typecheck')
                    }
                }
            }
        }
        stage('Pruebas unitarias y cobertura') {
            steps {
                script {
                    env.UNIT_STARTED = 'true'
                    catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                        projectCommand('npm run test:ci')
                    }
                }
            }
        }
        stage('Compilar aplicación de prueba') {
            steps {
                script {
                    catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                        projectCommand('npm run build:ci')
                        env.APP_BUILD_OK = 'true'
                    }
                }
            }
        }
        stage('Preparar Chromium') {
            when { expression { env.APP_BUILD_OK == 'true' } }
            steps {
                script {
                    projectCommand(isUnix() && params.INSTALL_BROWSER_SYSTEM_DEPS
                        ? 'node scripts/ci/run.mjs browsers-with-deps'
                        : 'node scripts/ci/run.mjs browsers')
                }
            }
        }
        stage('Pruebas de navegador') {
            when { expression { env.APP_BUILD_OK == 'true' } }
            steps {
                script {
                    env.E2E_STARTED = 'true'
                    catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                        projectCommand('npm run test:e2e:ci')
                    }
                }
            }
        }
    }
    post {
        always {
            script {
                if (env.REPORTS_READY == 'true') {
                    inProject {
                        // Una publicación fallida no impide archivar los demás resultados.
                        ['UNIT_STARTED': 'junit-results/vitest.xml', 'E2E_STARTED': 'junit-results/playwright.xml'].each { flag, report ->
                            if (env[flag] == 'true') {
                                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                                    junit(testResults: report, allowEmptyResults: false)
                                }
                            }
                        }
                        ['Cobertura Vitest': 'coverage', 'Pruebas de navegador': 'playwright-report'].each { title, folder ->
                            if (fileExists("${folder}/index.html")) {
                                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                                    publishHTML(target: [reportName: title, reportDir: folder, reportFiles: 'index.html', includes: '**/*', keepAll: true, alwaysLinkToLastBuild: true, allowMissing: false])
                                }
                            }
                        }
                        archiveArtifacts(artifacts: 'junit-results/*.xml,coverage/**,playwright-report/**,test-results/**', allowEmptyArchive: true)
                    }
                }
            }
        }
    }
}
