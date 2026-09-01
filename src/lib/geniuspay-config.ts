/**
 * Constantes GeniusPay partagées entre le client (page admin) et le serveur.
 * Ce module ne doit contenir AUCUN import serveur : il est chargé dans le bundle
 * navigateur par `src/routes/admin.geniuspay.tsx`.
 *
 * Une seule source de vérité pour l'URL de l'API marchand, afin que la page
 * admin ne puisse plus réécrire en base une ancienne URL de checkout.
 */
export const GENIUSPAY_PROVIDER = "geniuspay";

/** Base de l'API marchand GeniusPay (sans slash final). */
export const GENIUSPAY_DEFAULT_API_URL = "https://pay.genius.ci/api/v1/merchant";

/** Site public GeniusPay (liens d'aide dans l'admin). */
export const GENIUSPAY_SITE_URL = "https://pay.genius.ci";
