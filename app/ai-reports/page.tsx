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
    border: "border-blue-300 hover:border-blue-500",
    active: "border-blue-500 bg-blue-50",
    iconColor: "text-blue-600",
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Report Creator</h1>
        <p className="text-gray-500 mt-1">
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
              className={`p-4 border-2 rounded-xl text-left transition-all ${
                isActive ? opt.active : "border-gray-200 " + opt.border
              }`}
            >
              <Icon className={`mb-2 ${opt.iconColor}`} size={24} />
              <p className="font-semibold text-gray-800">{opt.title}</p>
              <p className="text-xs text-gray-500 mt-1">{opt.description}</p>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Analiz Edilecek Metin</label>
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
        className="bg-black hover:bg-gray-800 text-white"
      >
        {isLoading ? (
          <><Loader2 size={16} className="mr-2 animate-spin" />Analiz ediliyor...</>
        ) : (
          <><Zap size={16} className="mr-2" />Analiz Et</>
        )}
      </Button>

      {result && (
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">AI Analiz Sonucu</p>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{result}</div>
        </div>
      )}
    </div>
  );
}
