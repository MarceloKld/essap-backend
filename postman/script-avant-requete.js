// À coller dans : collection > Scripts > Pre-request
// Avant CHAQUE requête : rafraîchit le jeton d'accès s'il est expiré (ou proche de l'être).
var sansJeton = ['/auth/connexion', '/auth/connexion-etudiant', '/auth/rafraichir', '/auth/deconnexion', '/sante'];
var chemin = pm.request.url.getPath();
var ignorer = sansJeton.some(function (c) { return chemin.endsWith(c); });
var expire = Number(pm.environment.get('accessExpireAt') || 0);

if (!ignorer && Date.now() > expire - 30000) {
  pm.sendRequest({ url: pm.environment.get('baseUrl') + '/api/v1/auth/rafraichir', method: 'POST' }, function (err, res) {
    if (!err && res.code === 200) {
      var j = res.json();
      pm.environment.set('accessToken', j.jetonAcces);
      pm.environment.set('accessExpireAt', String(Date.now() + j.expireDansSecondes * 1000));
    }
  });
}