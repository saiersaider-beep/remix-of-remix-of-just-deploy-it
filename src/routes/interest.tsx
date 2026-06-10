import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ToggleRight } from "lucide-react";
import { DashboardSidebar, DashboardTopbar } from "@/components/DashboardSidebar";

export const Route = createFileRoute("/interest")({
  component: InterestPage,
  head: () => ({
    meta: [
      { title: "Interest — VinaSound" },
      { name: "description", content: "Select your music preferences to personalize your VinaSound experience." },
    ],
  }),
});

const tags = ["Mix", "Classic", "Rock", "Jazz", "Other"];

function InterestPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (t: string) =>
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  const handleNext = () => {
    if (selected.length === 0) {
      toast.error("Sélectionne au moins un genre");
      return;
    }
    try {
      localStorage.setItem("gs:interests", JSON.stringify(selected));
    } catch {}
    toast.success("Préférences enregistrées");
    navigate({ to: "/discover" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <DashboardTopbar />
      <div className="flex flex-1">
        <DashboardSidebar />
        <main className="flex-1 relative overflow-hidden">
          {/* Glow background */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/30 blur-3xl" />
            <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/40 blur-3xl" />
          </div>

          <div className="relative min-h-[calc(100vh-65px)] grid place-items-center px-6 py-16">
            <div className="w-full max-w-3xl">
              {/* Card header */}
              <div className="relative bg-surface border border-border rounded-md p-10 overflow-hidden">
                <div
                  className="absolute inset-0 opacity-[0.07] pointer-events-none"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 20% 30%, currentColor 1px, transparent 1px), radial-gradient(circle at 70% 60%, currentColor 1px, transparent 1px)",
                    backgroundSize: "40px 40px, 60px 60px",
                  }}
                />
                <div className="relative flex items-start justify-between gap-6">
                  <div>
                    <p className="text-primary text-sm font-bold uppercase tracking-[0.3em] mb-4">Interest</p>
                    <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight">
                      Select your music<br />preference
                    </h1>
                  </div>
                  <div className="hidden sm:flex flex-col gap-3 text-primary">
                    <ToggleRight className="w-14 h-14" strokeWidth={1.5} />
                    <ToggleRight className="w-14 h-14" strokeWidth={1.5} />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap justify-center gap-4 mt-10">
                {tags.map((t) => {
                  const active = selected.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggle(t)}
                      className={`px-8 py-3 rounded-full border-2 text-base font-bold tracking-wide transition-all duration-200 ease-out active:scale-[0.97] ${
                        active
                          ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/40 scale-105"
                          : "bg-background/80 backdrop-blur border-border text-foreground hover:border-primary hover:text-primary hover:shadow-md hover:-translate-y-0.5"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              {/* Next */}
              <div className="flex justify-center mt-10">
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={selected.length === 0}
                  className="bg-primary text-primary-foreground font-bold text-base tracking-wide px-16 py-3.5 rounded-full shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/50 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
