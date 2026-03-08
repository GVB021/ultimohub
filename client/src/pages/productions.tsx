import { useState, useEffect, memo } from "react";
import {
  useProductions, useCreateProduction, useUpdateProduction
} from "@/hooks/use-productions";
import { useCharacters, useCreateCharacter, useUpdateCharacter } from "@/hooks/use-characters";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Film, Search, MoreVertical, Upload, UserPlus,
  Settings2, FileJson, Download, Loader2, Trash2, Save,
  Clock, MessageSquare
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  PageSection, PageHeader, EmptyState, StatusBadge, FieldGroup, GridSkeleton
} from "@/components/ui/design-system";
import { useStudioRole } from "@/hooks/use-studio-role";
import { pt } from "@/lib/i18n";

interface ScriptLine {
  character: string;
  start: string;
  text: string;
  notes?: string;
}

const Productions = memo(function Productions({ studioId }: { studioId: string }) {
  const { data: productions, isLoading } = useProductions(studioId);
  const createProd = useCreateProduction(studioId);
  const { toast } = useToast();
  const { canCreateProductions } = useStudioRole(studioId);

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsOpen] = useState(false);
  const [selectedProdId, setSelectedProdId] = useState<string | null>(null);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", videoUrl: "" });

  const filtered = productions?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!formData.name) return;
    await createProd.mutateAsync({ ...formData, status: "planned", scriptJson: undefined });
    setIsOpen(false);
    setFormData({ name: "", description: "", videoUrl: "" });
    toast({ title: "Producao criada" });
  };

  return (
    <PageSection>
      <PageHeader
        title={pt.productions.title}
        subtitle="Gerencie seus projetos de dublagem"
        action={canCreateProductions ? (
          <Dialog open={isCreateOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 press-effect">
                <Plus className="w-3.5 h-3.5" />
                {pt.productions.newProduction}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Producao</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <FieldGroup label={pt.productions.name}>
                  <Input
                    placeholder="ex: Episodio 1 — Dragao"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-production-name"
                  />
                </FieldGroup>
                <FieldGroup label={pt.productions.description}>
                  <Textarea
                    placeholder="Detalhes da producao..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="resize-none"
                    rows={3}
                    data-testid="input-production-description"
                  />
                </FieldGroup>
                <FieldGroup label={pt.productions.videoUrl}>
                  <Input
                    placeholder="https://..."
                    value={formData.videoUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
                    data-testid="input-production-url"
                  />
                </FieldGroup>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={!formData.name || createProd.isPending}
                  className="press-effect"
                  data-testid="button-create-production"
                >
                  {createProd.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {createProd.isPending ? pt.productions.creating : pt.productions.create}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-10 h-10"
          placeholder={pt.productions.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-productions"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <GridSkeleton count={6} />
        ) : filtered?.map(prod => (
          <div
            key={prod.id}
            className="vhub-card-clickable p-5 group"
            data-testid={`card-production-${prod.id}`}
            role="button"
            tabIndex={0}
            onClick={() => { setSelectedProdId(prod.id); setIsManageOpen(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedProdId(prod.id); setIsManageOpen(true); } }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                <Film className="w-4 h-4 text-primary" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity relative z-10"
                    data-testid={`button-menu-production-${prod.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canCreateProductions && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedProdId(prod.id); setIsManageOpen(true); }}>
                      <Settings2 className="w-4 h-4 mr-2" /> Gerenciar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const token = localStorage.getItem("vhub_token");
                      const res = await fetch(`/api/productions/${prod.id}/export`, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (!res.ok) throw new Error("Falha na exportacao");
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${prod.name.replace(/\s+/g, "_")}_exportacao.zip`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } catch {
                      toast({ title: "Falha na exportacao", variant: "destructive" });
                    }
                  }}>
                    <Download className="w-4 h-4 mr-2" /> {pt.productions.export}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <h3 className="font-semibold text-foreground text-base mb-1 truncate">{prod.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
              {prod.description || "Sem descricao."}
            </p>

            <div className="mt-4">
              <StatusBadge status={prod.status} />
            </div>
          </div>
        ))}

        {!isLoading && filtered?.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={<Film className="w-5 h-5" />}
              title={search ? "Nenhum resultado encontrado" : pt.productions.noProductions}
              description={search ? "Tente um termo de busca diferente." : pt.productions.noProductionsDesc}
            />
          </div>
        )}
      </div>

      {selectedProdId && (
        <ManageProductionDialog
          studioId={studioId}
          productionId={selectedProdId}
          open={isManageOpen}
          onOpenChange={setIsManageOpen}
        />
      )}
    </PageSection>
  );
});

export default Productions;

function ManageProductionDialog({ productionId, studioId, open, onOpenChange }: {
  productionId: string;
  studioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: allProductions } = useProductions(studioId);
  const production = allProductions?.find(p => p.id === productionId);
  const updateProd = useUpdateProduction(studioId, productionId);
  const { data: characters } = useCharacters(productionId);
  const createChar = useCreateCharacter(productionId);
  const updateChar = useUpdateCharacter();
  const { toast } = useToast();

  const { data: members } = useQuery({
    queryKey: ["/api/studios", studioId, "members"],
    queryFn: () => authFetch(`/api/studios/${studioId}/members`) as Promise<any[]>,
    enabled: !!studioId && open,
  });

  const approvedDubladores = (members || []).filter(
    (m: any) => m.status === "approved" && m.role === "dublador"
  );

  const [newCharName, setNewCharName] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [detailsDirty, setDetailsDirty] = useState(false);

  const [scriptLines, setScriptLines] = useState<ScriptLine[]>([]);
  const [scriptDirty, setScriptDirty] = useState(false);
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "script" | "characters">("details");

  useEffect(() => {
    if (!production) return;
    setEditName(production.name || "");
    setEditDesc(production.description || "");
    setEditVideoUrl(production.videoUrl || "");
    setDetailsDirty(false);

    if (production.scriptJson) {
      try {
        const parsed = JSON.parse(production.scriptJson);
        let rawLines: any[];
        if (Array.isArray(parsed)) {
          rawLines = parsed;
        } else if (parsed.lines && Array.isArray(parsed.lines)) {
          rawLines = parsed.lines;
        } else {
          rawLines = [];
        }
        const normalized = rawLines.map((line: any) => ({
          character: line.character || line.personagem || line.char || "",
          start: line.start || line.tempo || line.timecode || line.tc || "00:00:00",
          text: line.text || line.fala || line.dialogue || line.dialog || "",
          notes: line.notes || line.notas || "",
        }));
        setScriptLines(normalized);
      } catch {
        setScriptLines([]);
      }
    } else {
      setScriptLines([]);
    }
    setScriptDirty(false);
  }, [production]);

  const handleSaveDetails = async () => {
    if (!editName.trim()) {
      toast({ title: "Nome da producao e obrigatorio", variant: "destructive" });
      return;
    }
    await updateProd.mutateAsync({
      name: editName.trim(),
      description: editDesc,
      videoUrl: editVideoUrl,
    });
    setDetailsDirty(false);
    toast({ title: "Producao atualizada" });
  };

  const handleScriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        let rawLines: any[];
        if (Array.isArray(json)) {
          rawLines = json;
        } else if (json.lines && Array.isArray(json.lines)) {
          rawLines = json.lines;
        } else {
          rawLines = [];
        }
        const normalized = rawLines.map((line: any) => ({
          character: line.character || line.personagem || line.char || "",
          start: line.start || line.tempo || line.timecode || line.tc || "00:00:00",
          text: line.text || line.fala || line.dialogue || line.dialog || "",
          notes: line.notes || line.notas || "",
        }));
        setScriptLines(normalized);
        setScriptDirty(true);
        toast({ title: `${normalized.length} linhas carregadas do arquivo` });
      } catch {
        toast({ title: "Formato JSON invalido", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveScript = async () => {
    const json = JSON.stringify({ lines: scriptLines });
    await updateProd.mutateAsync({ scriptJson: json });
    setScriptDirty(false);
    toast({ title: `Roteiro salvo (${scriptLines.length} linhas)` });
  };

  const addScriptLine = () => {
    const newLine: ScriptLine = { character: "", start: "00:00:00", text: "", notes: "" };
    setScriptLines(prev => [...prev, newLine]);
    setEditingLineIdx(scriptLines.length);
    setScriptDirty(true);
  };

  const updateScriptLine = (idx: number, field: keyof ScriptLine, value: string) => {
    setScriptLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
    setScriptDirty(true);
  };

  const removeScriptLine = (idx: number) => {
    setScriptLines(prev => prev.filter((_, i) => i !== idx));
    setScriptDirty(true);
    if (editingLineIdx === idx) setEditingLineIdx(null);
  };

  const handleAddChar = async () => {
    if (!newCharName.trim()) return;
    await createChar.mutateAsync({ name: newCharName.trim(), voiceActorId: null });
    setNewCharName("");
    toast({ title: "Personagem adicionado" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" />
            {production?.name || "Producao"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border/60 -mx-6 px-6">
          {(["details", "script", "characters"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab}`}
            >
              {tab === "details" ? "Detalhes" : tab === "script" ? "Roteiro" : "Personagens"}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
              {tab === "script" && scriptDirty && (
                <span className="ml-1.5 w-2 h-2 bg-amber-500 rounded-full inline-block" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6 min-h-0">
          {activeTab === "details" && (
            <div className="space-y-4">
              <FieldGroup label="Nome da Producao">
                <Input
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setDetailsDirty(true); }}
                  data-testid="input-edit-production-name"
                />
              </FieldGroup>
              <FieldGroup label="Descricao">
                <Textarea
                  value={editDesc}
                  onChange={(e) => { setEditDesc(e.target.value); setDetailsDirty(true); }}
                  className="resize-none"
                  rows={3}
                  data-testid="input-edit-production-description"
                />
              </FieldGroup>
              <FieldGroup label="URL do Video">
                <Input
                  value={editVideoUrl}
                  onChange={(e) => { setEditVideoUrl(e.target.value); setDetailsDirty(true); }}
                  placeholder="https://..."
                  data-testid="input-edit-production-url"
                />
              </FieldGroup>
              <FieldGroup label="Status">
                <Select
                  value={production?.status || "planned"}
                  onValueChange={async (val) => {
                    await updateProd.mutateAsync({ status: val });
                    toast({ title: "Status atualizado" });
                  }}
                >
                  <SelectTrigger data-testid="select-production-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planejado</SelectItem>
                    <SelectItem value="in_progress">Em Progresso</SelectItem>
                    <SelectItem value="completed">Concluido</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>
              {detailsDirty && (
                <Button
                  onClick={handleSaveDetails}
                  disabled={updateProd.isPending}
                  className="gap-1.5"
                  data-testid="button-save-production-details"
                >
                  {updateProd.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Alteracoes
                </Button>
              )}
            </div>
          )}

          {activeTab === "script" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {scriptLines.length} linha{scriptLines.length !== 1 ? "s" : ""}
                  </span>
                  {scriptDirty && (
                    <span className="text-xs text-amber-400 bg-amber-500/12 px-2 py-0.5 rounded-full border border-amber-500/25">
                      Nao salvo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="relative gap-1.5" data-testid="button-upload-script">
                    <Upload className="w-3.5 h-3.5" /> Importar JSON
                    <input
                      type="file"
                      accept=".json"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleScriptUpload}
                    />
                  </Button>
                  <Button size="sm" onClick={addScriptLine} className="gap-1.5" data-testid="button-add-script-line">
                    <Plus className="w-3.5 h-3.5" /> Adicionar Linha
                  </Button>
                </div>
              </div>

              {scriptLines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileJson className="w-8 h-8 mb-3 opacity-40" />
                  <p className="text-sm font-medium">Nenhuma linha no roteiro</p>
                  <p className="text-xs mt-1">Adicione linhas manualmente ou importe um arquivo JSON</p>
                </div>
              ) : (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[80px_120px_1fr_1fr_40px] gap-0 bg-white/3 border-b border-white/8 px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> TC
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Personagem</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dialogo</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Notas
                    </span>
                    <span />
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {scriptLines.map((line, idx) => (
                      <div
                        key={idx}
                        className={`grid grid-cols-[80px_120px_1fr_1fr_40px] gap-0 px-3 py-1.5 border-b border-border/30 items-center hover:bg-muted/30 transition-colors ${
                          editingLineIdx === idx ? "bg-blue-500/10 ring-1 ring-blue-500/25 ring-inset" : ""
                        }`}
                        data-testid={`script-row-${idx}`}
                      >
                        <input
                          type="text"
                          value={line.start}
                          onChange={(e) => updateScriptLine(idx, "start", e.target.value)}
                          onFocus={() => setEditingLineIdx(idx)}
                          className="w-full bg-transparent text-xs font-mono text-foreground outline-none px-1 py-1 rounded hover:bg-white/5 focus:bg-white/8 focus:ring-1 focus:ring-primary/30"
                          placeholder="00:00:00"
                          data-testid={`input-tc-${idx}`}
                        />
                        <input
                          type="text"
                          value={line.character}
                          onChange={(e) => updateScriptLine(idx, "character", e.target.value)}
                          onFocus={() => setEditingLineIdx(idx)}
                          className="w-full bg-transparent text-xs font-semibold text-foreground outline-none px-1 py-1 rounded hover:bg-white/5 focus:bg-white/8 focus:ring-1 focus:ring-primary/30 uppercase"
                          placeholder="Personagem"
                          data-testid={`input-char-${idx}`}
                        />
                        <input
                          type="text"
                          value={line.text}
                          onChange={(e) => updateScriptLine(idx, "text", e.target.value)}
                          onFocus={() => setEditingLineIdx(idx)}
                          className="w-full bg-transparent text-xs text-foreground outline-none px-1 py-1 rounded hover:bg-white/5 focus:bg-white/8 focus:ring-1 focus:ring-primary/30"
                          placeholder="Texto do dialogo..."
                          data-testid={`input-text-${idx}`}
                        />
                        <input
                          type="text"
                          value={line.notes || ""}
                          onChange={(e) => updateScriptLine(idx, "notes", e.target.value)}
                          onFocus={() => setEditingLineIdx(idx)}
                          className="w-full bg-transparent text-xs text-muted-foreground outline-none px-1 py-1 rounded hover:bg-white/5 focus:bg-white/8 focus:ring-1 focus:ring-primary/30 italic"
                          placeholder="Notas..."
                          data-testid={`input-notes-${idx}`}
                        />
                        <button
                          onClick={() => removeScriptLine(idx)}
                          className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/12 transition-colors"
                          data-testid={`button-remove-line-${idx}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scriptDirty && (
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSaveScript}
                    disabled={updateProd.isPending}
                    className="gap-1.5"
                    data-testid="button-save-script"
                  >
                    {updateProd.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Roteiro
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {scriptLines.length} linha{scriptLines.length !== 1 ? "s" : ""} no roteiro
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === "characters" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do personagem..."
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddChar()}
                  data-testid="input-character-name"
                />
                <Button onClick={handleAddChar} disabled={createChar.isPending} className="press-effect shrink-0 gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  {pt.productions.addCharacter}
                </Button>
              </div>

              <div className="vhub-card divide-y divide-border/40 overflow-hidden">
                {characters?.map((char: { id: string; name: string; voiceActorId: string | null }) => (
                  <div key={char.id} className="flex items-center justify-between p-3 gap-4" data-testid={`character-row-${char.id}`}>
                    <span className="text-sm font-medium text-foreground truncate">{char.name}</span>
                    <Select
                      value={char.voiceActorId || "unassigned"}
                      onValueChange={async (val) => {
                        await updateChar.mutateAsync({
                          id: char.id,
                          voiceActorId: val === "unassigned" ? null : val
                        });
                        toast({ title: "Dublador atribuido" });
                      }}
                    >
                      <SelectTrigger className="w-[200px] h-8 text-xs" data-testid={`select-actor-${char.id}`}>
                        <SelectValue placeholder={pt.productions.assignActor} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Nao atribuido</SelectItem>
                        {approvedDubladores.map((m: any) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.user?.displayName || m.user?.artistName || m.user?.fullName || m.user?.email || "Dublador"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {(!characters || characters.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <UserPlus className="w-6 h-6 mb-2 opacity-40" />
                    <p className="text-sm">Nenhum personagem adicionado</p>
                    <p className="text-xs mt-1">Adicione personagens e atribua dubladores</p>
                  </div>
                )}
              </div>

              {approvedDubladores.length === 0 && (characters?.length ?? 0) > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/12 border border-amber-500/25 text-xs text-amber-400">
                  Nenhum membro com o papel "Dublador" encontrado neste estudio. Aprove membros na pagina de Membros primeiro.
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
