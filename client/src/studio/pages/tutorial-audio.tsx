import { Link } from "wouter";
import { BookOpen, Mic, SlidersHorizontal, Waves, Wind } from "lucide-react";
import { PageSection } from "@studio/components/ui/design-system";
import { Button } from "@studio/components/ui/button";

export default function TutorialAudio({ studioId }: { studioId: string }) {
  const blocks = [
    {
      id: "ambiente",
      title: "Configuração de microfone e ambiente",
      icon: Mic,
      items: [
        "Prefira ambiente silencioso com superfícies absorventes simples.",
        "Use pop filter e shock mount para reduzir plosivas e vibração.",
        "Mantenha fonte de ruído distante do ponto de captação.",
      ],
    },
    {
      id: "ganho",
      title: "Ganho e nível de áudio",
      icon: SlidersHorizontal,
      items: [
        "Ajuste ganho para picos médios entre -12 dB e -6 dB.",
        "Evite normalização agressiva antes da revisão técnica.",
        "Faça teste de frase curta antes de iniciar a tomada oficial.",
      ],
    },
    {
      id: "posicionamento",
      title: "Posicionamento em relação ao microfone",
      icon: Waves,
      items: [
        "Distância recomendada de 12 a 20 cm com leve ângulo lateral.",
        "Evite movimentação brusca entre frases para manter consistência.",
        "Mantenha altura do microfone alinhada ao centro da boca.",
      ],
    },
    {
      id: "diccao",
      title: "Respiração e dicção",
      icon: Wind,
      items: [
        "Respire antes da frase e faça pausas naturais entre sentenças.",
        "Articule consoantes sem exagero para preservar naturalidade.",
        "Repita trechos críticos para garantir clareza de interpretação.",
      ],
    },
  ];

  return (
    <PageSection className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-2">Guia de Qualidade</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Tutorial Completo de Gravação</h1>
          <p className="text-muted-foreground mt-2">
            Checklist rápido para gravações limpas, inteligíveis e consistentes no fluxo do estúdio.
          </p>
        </div>
        <Link href={`/hub-dub/studio/${studioId}/dashboard`}>
          <Button variant="outline" className="border-border/70 hover:bg-muted/40">
            Ir para painel
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {blocks.map((block) => {
          const Icon = block.icon;
          return (
            <article key={block.id} className="rounded-xl border border-border/70 bg-card/70 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="font-semibold text-foreground">{block.title}</h2>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {block.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <BookOpen className="h-4 w-4 mt-0.5 text-primary/80 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </PageSection>
  );
}
