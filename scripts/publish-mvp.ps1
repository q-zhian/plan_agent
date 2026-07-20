param(
    [Parameter(Mandatory = $true)]
    [string]$Message
)

$ErrorActionPreference = 'Stop'

npm test
if ($LASTEXITCODE -ne 0) {
    throw 'npm test failed; publish aborted.'
}

npm run build
if ($LASTEXITCODE -ne 0) {
    throw 'npm run build failed; publish aborted.'
}

git status --short
if ($LASTEXITCODE -ne 0) {
    throw 'git status failed; publish aborted.'
}

git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
    throw 'Pre-existing staged changes detected; publish aborted.'
}
if ($LASTEXITCODE -ne 0) {
    throw 'git diff --cached --quiet failed; publish aborted.'
}

$confirmation = Read-Host 'Stage the deployment allowlist, commit, and push? [y/N]'
if ($confirmation -notmatch '^[Yy]$') {
    Write-Host 'Publish cancelled.'
    return
}

git add '--' index.html src server server.mjs dist package.json package-lock.json tsconfig.app.json tsconfig.json tsconfig.node.json vite.config.ts README.md .gitignore scripts/publish-mvp.ps1
if ($LASTEXITCODE -ne 0) {
    throw 'git add failed; publish aborted.'
}

git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    throw 'git commit failed; publish aborted.'
}

git push
if ($LASTEXITCODE -ne 0) {
    throw 'git push failed.'
}
