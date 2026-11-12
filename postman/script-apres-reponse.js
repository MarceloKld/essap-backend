// À coller dans : collection > Scripts > Post-response
// Après CHAQUE requête : si la réponse contient un jeton d'accès, on le range dans l'environnement.
if (pm.response.code === 200) {
  try {
    var j = pm.response.json();
    if (j && j.jetonAcces) {
      pm.environment.set('accessToken', j.jetonAcces);
      pm.environment.set('accessExpireAt', String(Date.now() + j.expireDansSecondes * 1000));
    }
  } catch (e) { /* la réponse n'est pas du JSON : on ignore */ }
}