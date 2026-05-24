import { useState } from "react";
import { useCheckInsurance } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Search } from "lucide-react";

export default function Insurance() {
  const [insuranceId, setInsuranceId] = useState("");
  const checkMutation = useCheckInsurance();

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!insuranceId.trim()) return;
    checkMutation.mutate({ data: { insuranceId } });
  };

  return (
    <div className="max-w-3xl mx-auto py-12 flex flex-col space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Insurance Verification</h1>
        <p className="text-xl text-muted-foreground">Quickly verify active coverage before your appointment.</p>
      </div>

      <Card className="border-2 border-border/50 shadow-lg">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-2xl">Enter Insurance ID</CardTitle>
          <CardDescription className="text-base">Found on the front of your insurance card.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <form onSubmit={handleCheck} className="flex gap-4 max-w-xl mx-auto">
            <Input 
              placeholder="e.g. BLUESHIELD-999" 
              className="h-16 text-xl px-6 rounded-2xl bg-muted/50 border-border/50"
              value={insuranceId}
              onChange={(e) => setInsuranceId(e.target.value)}
            />
            <Button 
              type="submit" 
              className="h-16 px-8 text-lg rounded-2xl gap-2"
              disabled={checkMutation.isPending || !insuranceId.trim()}
            >
              {checkMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              Check
            </Button>
          </form>

          {checkMutation.isSuccess && checkMutation.data && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
              <StatusBadge status={checkMutation.data.status} details={checkMutation.data.details} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status, details }: { status: string, details: string }) {
  const isOk = status.toUpperCase() === "ACTIVE";
  const isErr = status.toUpperCase() === "INACTIVE";
  
  let Icon = ShieldQuestion;
  let colorClass = "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400";
  
  if (isOk) {
    Icon = ShieldCheck;
    colorClass = "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400";
  } else if (isErr) {
    Icon = ShieldAlert;
    colorClass = "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400";
  }

  return (
    <div className={`p-8 rounded-3xl border-2 flex flex-col items-center text-center space-y-4 ${colorClass}`}>
      <Icon className="h-16 w-16" />
      <div>
        <h3 className="text-3xl font-bold mb-2 uppercase tracking-wide">{status}</h3>
        <p className="text-lg opacity-90">{details}</p>
      </div>
    </div>
  );
}