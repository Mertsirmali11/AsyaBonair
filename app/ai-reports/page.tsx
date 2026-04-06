"use client";

import { useState } from "react";
import { FileText, Zap, AlertTriangle, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type AnalysisType = "summary" | "anomaly" | "report";

const analysisOptions = [
  {
    type: "summary" as AnalysisType,
    icon: FileText,
    title: "Doküman Özeti",
    description: "Metni havacılık perspektifinden özetle",
    border: "border-primary/30 hover:border-primary/60",
    active: "border-primary bg-primary/5",
    iconColor: "text-primary",
  },
  {
    type: "anomaly" as AnalysisType,
    icon: AlertTriangle,
    title: "Anomali Tespiti",
    description: "FDM verisinde sapma ve risk analizi",
    border: "border-orange-300 hover:border-orange-500",
    active: "border-orange-500 bg-orange-50",
    iconColor: "text-orange-600",
  },
  {
    type: "report" as AnalysisType,
    icon: Zap,
    title: "Rapor Oluştur",
    description: "SHGM standartlarında otomatik rapor",
    border: "border-green-300 hover:border-green-500",
    active: "border-green-500 bg-green-50",
    iconColor: "text-green-600",
  },
];

export default function AiReportsPage() {
  const [selectedType, setSelectedType] = useState<AnalysisType>("summary");
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      toast.error("Lütfen analiz edilecek metni girin.");
      return;
    }
    setIsLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, analysisType: selectedType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.content);
    } catch {
      toast.error("Analiz sırasında bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Kopyalandı!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Report Creator</h1>
        <p className="mt-1 text-muted-foreground">
          Havacılık dokümanlarınızı analiz edin, anomali tespiti yapın veya otomatik rapor oluşturun.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {analysisOptions.map((opt) => {
          const Icon = opt.icon;
          const isActive = selectedType === opt.type;
          return (
            <button
              key={opt.type}
              onClick={() => setSelectedType(opt.type)}
              className={`rounded-xl border-2 p-4 text-left transition-colors ${
                isActive ? opt.active : `border-border bg-card ${opt.border}`
              }`}
            >
              <Icon className={`mb-2 ${opt.iconColor}`} size={24} />
              <p className="font-semibold text-foreground">{opt.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Analiz Edilecek Metin</label>
        <Textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Metni buraya yapıştırın..."
          className="min-h-[160px] text-sm"
        />
      </div>

      <Button
        onClick={handleAnalyze}
        disabled={isLoading || !inputText.trim()}
      >
        {isLoading ? (
          <><Loader2 size={16} className="mr-2 animate-spin" />Analiz ediliyor...</>
        ) : (
          <><Zap size={16} className="mr-2" />Analiz Et</>
        )}
      </Button>

      {result && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">AI Analiz Sonucu</p>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{result}</div>
        </div>
      )}
    </div>
  );
}
