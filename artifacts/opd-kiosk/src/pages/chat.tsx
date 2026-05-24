import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { 
  useCreateOpenaiConversation, 
  useCreateVisit,
  useGetPatient
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Save, ArrowRight, Activity, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Chat() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const patientId = searchParams.get("patientId");
  const { toast } = useToast();

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestedDepartment, setSuggestedDepartment] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const createConvMutation = useCreateOpenaiConversation();
  const createVisitMutation = useCreateVisit();
  
  const { data: patient } = useGetPatient(Number(patientId), {
    query: { enabled: !!patientId }
  });

  useEffect(() => {
    if (!patientId) {
      toast({ title: "Error", description: "No patient ID found. Redirecting.", variant: "destructive" });
      setLocation("/scan-id");
      return;
    }

    if (!conversationId && !createConvMutation.isPending && !createConvMutation.isSuccess) {
      createConvMutation.mutate({ data: { title: `Triage - Patient ${patientId}` } }, {
        onSuccess: (data) => {
          setConversationId(data.id);
          setMessages([
            { role: "assistant", content: "Hello! I'm the AI triage assistant. Please describe your symptoms in detail." }
          ]);
        }
      });
    }
  }, [patientId, conversationId, createConvMutation, setLocation, toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !conversationId || isStreaming) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsStreaming(true);

    try {
      const response = await fetch(`/api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      let fullAssistantMessage = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.startsWith("data: "));
        
        for (const line of lines) {
          const dataStr = line.replace("data: ", "").trim();
          if (!dataStr) continue;
          
          try {
            const data = JSON.parse(dataStr);
            if (data.done) break;
            
            if (data.content) {
              fullAssistantMessage += data.content;
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content = fullAssistantMessage;
                return newMsgs;
              });
            }
          } catch (e) {
            console.error("Error parsing SSE data", e);
          }
        }
      }

      // Very simple mock logic to extract department for demo purposes:
      const textUpper = fullAssistantMessage.toUpperCase();
      const depts = ["CARDIOLOGY", "NEUROLOGY", "ORTHOPEDICS", "PEDIATRICS", "GENERAL MEDICINE", "EMERGENCY"];
      for (const dept of depts) {
        if (textUpper.includes(dept)) {
          setSuggestedDepartment(dept);
          break;
        }
      }

    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSaveVisit = () => {
    if (!patientId) return;

    const symptoms = messages.filter(m => m.role === "user").map(m => m.content).join("\n");
    const chatSummary = "AI Triage Completed.";

    createVisitMutation.mutate({
      data: {
        patientId: Number(patientId),
        symptoms: symptoms || "No symptoms recorded.",
        suggestedDepartment: suggestedDepartment || "GENERAL MEDICINE",
        insuranceStatus: "PENDING",
        chatSummary
      }
    }, {
      onSuccess: (visit) => {
        setLocation(`/confirmation?visitId=${visit.id}`);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save visit.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Symptom Triage</h1>
          <p className="text-muted-foreground">Describe your symptoms so we can route you to the correct department.</p>
        </div>
        {patient && (
          <div className="text-right hidden md:block">
            <p className="font-medium text-lg">{patient.name}</p>
            <p className="text-sm text-muted-foreground">ID: {patient.id} • {patient.age}y {patient.gender}</p>
          </div>
        )}
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Chat Window */}
        <Card className="flex-1 flex flex-col shadow-md border-border/50 overflow-hidden">
          <ScrollArea className="flex-1 p-6" viewportRef={scrollRef}>
            <div className="space-y-6 pb-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-5 py-4 text-base leading-relaxed shadow-sm ${
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-br-none" 
                      : "bg-muted text-foreground border border-border/50 rounded-bl-none"
                  }`}>
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-border/50 bg-card">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-3"
            >
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your symptoms here..."
                className="flex-1 h-14 text-lg px-6 rounded-full bg-muted/50 border-border/50 focus-visible:ring-primary/20"
                disabled={isStreaming}
              />
              <Button 
                type="submit" 
                size="icon" 
                className="h-14 w-14 rounded-full shrink-0 shadow-sm"
                disabled={isStreaming || !input.trim()}
              >
                <Send className="h-6 w-6" />
              </Button>
            </form>
          </div>
        </Card>

        {/* Sidebar Status Window */}
        <div className="w-80 flex flex-col gap-6 hidden lg:flex">
          {suggestedDepartment && (
            <Card className="bg-primary/5 border-primary/20 shadow-sm animate-in fade-in slide-in-from-right-8 duration-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-primary uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Suggested Department
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{suggestedDepartment}</p>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm border-border/50 flex-1 flex flex-col justify-end bg-card">
            <CardContent className="p-6 pt-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <ShieldCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">Ready to proceed?</h3>
              <p className="text-sm text-muted-foreground">
                Once the AI has determined your department, you can complete the registration.
              </p>
              <Button 
                className="w-full h-14 text-lg rounded-xl mt-4" 
                size="lg"
                onClick={handleSaveVisit}
                disabled={createVisitMutation.isPending || isStreaming || messages.length < 3}
              >
                <Save className="mr-2 h-5 w-5" />
                Save & Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Mobile Action Button */}
      <div className="lg:hidden">
        <Button 
          className="w-full h-14 text-lg rounded-xl" 
          size="lg"
          onClick={handleSaveVisit}
          disabled={createVisitMutation.isPending || isStreaming || messages.length < 3}
        >
          Save & Continue <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}