import { useLocation } from "wouter";
import { useGetVisit } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { CheckCircle, MapPin, UserCircle, Activity, ShieldCheck, Clock, Home } from "lucide-react";

export default function Confirmation() {
  const [_, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const visitId = searchParams.get("visitId");

  const { data: visit, isLoading } = useGetVisit(Number(visitId), {
    query: { enabled: !!visitId }
  });

  if (!visitId || (!isLoading && !visit)) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-2xl font-bold">No visit found</h2>
        <Button onClick={() => setLocation("/")}>Go Home</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Finalizing your visit details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center space-y-4">
        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">You're All Set!</h1>
        <p className="text-xl text-muted-foreground">Please proceed to your assigned department.</p>
      </div>

      <Card className="border-2 border-border/50 shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
        <div className="bg-primary p-6 text-primary-foreground text-center border-b border-primary-foreground/10">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
            <MapPin className="h-6 w-6 opacity-80" />
            Proceed to: {visit?.suggestedDepartment}
          </h2>
        </div>
        <CardContent className="p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm flex items-center gap-2">
                <UserCircle className="h-4 w-4" /> Patient Details
              </h3>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">{visit?.patient?.name}</p>
                <p className="text-lg text-muted-foreground">ID: {visit?.patient?.id} • {visit?.patient?.age}y {visit?.patient?.gender}</p>
                <p className="text-base text-muted-foreground">{visit?.patient?.phone}</p>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Visit Info
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Activity className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Symptoms</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{visit?.symptoms}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Insurance Status</p>
                    <p className="text-sm text-muted-foreground">{visit?.insuranceStatus}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Time</p>
                    <p className="text-sm text-muted-foreground">{visit?.createdAt ? format(new Date(visit.createdAt), "h:mm a, MMM do yyyy") : "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <div className="flex justify-center pt-8">
        <Button 
          size="lg" 
          className="h-16 px-12 text-xl rounded-2xl shadow-md gap-3"
          onClick={() => setLocation("/")}
        >
          <Home className="h-6 w-6" />
          Done — Start New Visit
        </Button>
      </div>
    </div>
  );
}