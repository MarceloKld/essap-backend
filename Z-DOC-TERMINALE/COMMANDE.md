# 1. Lancer les serveur
R) npm run start:dev

# 2. Pour Creé des dossier est fichier dans le terminale
R) # 1) Crée le fichier de profil s'il n'existe pas
if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force | Out-Null }

# 2) Y ajoute la fonction
Add-Content $PROFILE @'

function Ecrire-Fichier {
    param(
        [Parameter(Mandatory)][string]$Chemin,
        [Parameter(Mandatory)][string]$Contenu
    )
    $complet = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Chemin)
    $dossier = Split-Path $complet -Parent
    if (-not (Test-Path $dossier)) { New-Item -ItemType Directory -Path $dossier -Force | Out-Null }
    $utf8SansBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($complet, $Contenu, $utf8SansBom)
    Write-Host "OK  $Chemin" -ForegroundColor Green
}
'@

# 3) La charge tout de suite dans ce terminal
. $PROFILE
Get-Command Ecrire-Fichier     # doit afficher la fonction


# 3. 