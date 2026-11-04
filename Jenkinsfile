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
    }
    environment {
        CI = 'true'
        HUSKY = '0'
        NEXT_TELEMETRY_DISABLED = '1'
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
    }
    stages {
        stage('Checkout y preparación') {
            steps {
                script {
                    env.REPORTS_READY = 'false'
                    env.UNIT_STARTED = 'false'
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
        stage('Calidad del código') {
            steps {
                script {
                    catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                        projectCommand('node scripts/ci/run.mjs lint')
                    }
                }
            }
        }
        stage('Verificar tipos') {
            steps {
                script {
                    catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                        projectCommand('node scripts/ci/run.mjs typecheck')
                    }
                }
            }
        }
        stage('Pruebas unitarias, integración y cobertura') {
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
                        // Acceso directo: env[flag] requiere una firma bloqueada por Jenkins.
                        if (env.UNIT_STARTED == 'true') {
                            catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                                junit(testResults: 'junit-results/vitest.xml', allowEmptyResults: false)
                            }
                        }
                        if (fileExists('coverage/index.html')) {
                            catchError(buildResult: 'FAILURE', stageResult: 'FAILURE', catchInterruptions: false) {
                                publishHTML(target: [reportName: 'Cobertura Vitest', reportDir: 'coverage', reportFiles: 'index.html', includes: '**/*', keepAll: true, alwaysLinkToLastBuild: true, allowMissing: false])
                            }
                        }
                        archiveArtifacts(artifacts: 'junit-results/vitest.xml,coverage/**', allowEmptyArchive: true)
                    }
                }
            }
        }
    }
}
