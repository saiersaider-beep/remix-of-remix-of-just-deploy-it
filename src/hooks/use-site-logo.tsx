import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import fallbackLogo from "@/assets/brand-logo.png";

export function useSiteLogo() {
  const { data } = useQuery({
    queryKey: ["site-logo"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings" as never)
        .select("logo_url")
        .eq("id", "default")
        .maybeSingle();
      return (data as { logo_url: string | null } | null)?.logo_url ?? null;
    },
  });
  return { logoUrl: data || fallbackLogo, isCustom: !!data };
}

export { fallbackLogo };
