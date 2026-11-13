# ============================================================
#  Générateur de collections Postman de TEST
#  Utilisation : . .\postman\generer.ps1   (le point au début est important)
# ============================================================

# --- Petits assistants qui écrivent le JavaScript des tests à ta place ---
function T-Statut([int]$code) {
    "pm.test('Statut HTTP $code', function () { pm.response.to.have.status($code); });"
}
function T-Verif([string]$titre, [string]$js) {
    "pm.test('$titre', function () { $js });"
}
function T-Garder([string]$variable, [string]$expression) {
    "if (j) { pm.environment.set('$variable', String($expression)); }"
}

# --- Décrit UNE requête de test ---
#  -Corps    : objet JSON envoyé
#  -Fichier  : fichier envoyé en multipart, ex. @{ champ = 'fichier'; chemin = 'fichiers-test/logo-test.png' }
#  -Entetes  : en-têtes supplémentaires
#  -Avant    : JavaScript exécuté AVANT l'envoi
#  -Tests    : JavaScript de vérification APRÈS la réponse
#  -SansAuth : ne pas envoyer de jeton
function Req {
    param(
        [Parameter(Mandatory)][string]$Dossier,
        [Parameter(Mandatory)][string]$Nom,
        [Parameter(Mandatory)][string]$Methode,
        [Parameter(Mandatory)][string]$Chemin,
        $Corps = $null,
        $Fichier = $null,
        $Entetes = $null,
        $Avant = $null,
        $Tests = $null,
        [switch]$SansAuth
    )
    return @{ dossier = $Dossier; nom = $Nom; methode = $Methode; chemin = $Chemin; corps = $Corps; fichier = $Fichier
              entetes = $Entetes; avant = $Avant; tests = $Tests; sansAuth = [bool]$SansAuth }
}

# --- Construit le fichier de collection Postman ---
function Nouvelle-CollectionPostman {
    param(
        [Parameter(Mandatory)][string]$Nom,
        [Parameter(Mandatory)][object[]]$Requetes,
        [Parameter(Mandatory)][string]$Sortie
    )
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $avant = @([System.IO.File]::ReadAllText((Resolve-Path 'postman/script-avant-requete.js').Path, $utf8) -split "\r?\n")
    $apres = @([System.IO.File]::ReadAllText((Resolve-Path 'postman/script-apres-reponse.js').Path, $utf8) -split "\r?\n")

    $dossiers = [ordered]@{}
    foreach ($r in $Requetes) {
        $entetes = @()
        if ($r.corps) { $entetes += @{ key = 'Content-Type'; value = 'application/json' } }
        if ($r.entetes) { foreach ($cle in $r.entetes.Keys) { $entetes += @{ key = $cle; value = $r.entetes[$cle] } } }

        $morceaux = $r.chemin -split '\?', 2
        $url = [ordered]@{
            raw  = '{{baseUrl}}' + $r.chemin
            host = @('{{baseUrl}}')
            path = @($morceaux[0].Trim('/') -split '/')
        }
        if ($morceaux.Count -gt 1) {
            $url['query'] = @($morceaux[1] -split '&' | ForEach-Object { $kv = $_ -split '=', 2; @{ key = $kv[0]; value = $kv[1] } })
        }

        $requete = [ordered]@{ method = $r.methode; header = $entetes; url = $url }
        if ($r.corps) {
            $requete['body'] = [ordered]@{
                mode = 'raw'; raw = ($r.corps | ConvertTo-Json -Depth 10); options = @{ raw = @{ language = 'json' } }
            }
        }
        if ($r.fichier) {
            # Pas d'en-tête Content-Type ici : Postman le fabrique tout seul (multipart + séparateur)
            $requete['body'] = [ordered]@{
                mode = 'formdata'
                formdata = @(@{ key = $r.fichier.champ; type = 'file'; src = $r.fichier.chemin })
            }
        }
        if ($r.sansAuth) { $requete['auth'] = @{ type = 'noauth' } }

        $evenements = @()
        if ($r.avant) { $evenements += @{ listen = 'prerequest'; script = @{ type = 'text/javascript'; exec = @($r.avant) } } }
        if ($r.tests) {
            $lignes = @('var j = null; try { j = pm.response.json(); } catch (e) { }') + @($r.tests)
            $evenements += @{ listen = 'test'; script = @{ type = 'text/javascript'; exec = $lignes } }
        }

        $item = [ordered]@{ name = $r.nom; event = $evenements; request = $requete }
        if (-not $dossiers.Contains($r.dossier)) { $dossiers[$r.dossier] = New-Object System.Collections.ArrayList }
        [void]$dossiers[$r.dossier].Add($item)
    }

    $items = New-Object System.Collections.ArrayList
    foreach ($nomDossier in $dossiers.Keys) {
        [void]$items.Add([ordered]@{ name = $nomDossier; item = [object[]]$dossiers[$nomDossier].ToArray() })
    }

    $collection = [ordered]@{
        info  = [ordered]@{ name = $Nom; schema = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }
        auth  = @{ type = 'bearer'; bearer = @(@{ key = 'token'; value = '{{accessToken}}'; type = 'string' }) }
        event = @(
            @{ listen = 'prerequest'; script = @{ type = 'text/javascript'; exec = $avant } },
            @{ listen = 'test'; script = @{ type = 'text/javascript'; exec = $apres } }
        )
        item  = [object[]]$items.ToArray()
    }
    Ecrire-Fichier $Sortie ($collection | ConvertTo-Json -Depth 20)
}