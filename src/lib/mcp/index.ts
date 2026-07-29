import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchTracks from "./tools/search-tracks";
import listMyTracks from "./tools/list-my-tracks";
import getMyWallet from "./tools/get-my-wallet";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "vinasound-mcp",
  title: "VinaSound",
  version: "0.1.0",
  instructions:
    "Outils pour VinaSound, la plateforme musicale togolaise. `search_tracks` explore le catalogue public. `list_my_tracks` liste les morceaux de l'artiste connecté. `get_my_wallet` retourne le solde et les points de l'utilisateur connecté.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchTracks, listMyTracks, getMyWallet],
});
