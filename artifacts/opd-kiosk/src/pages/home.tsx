import { useGetKioskStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, Stethoscope, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: stats, isLoading } = useGetKioskStats();

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-full justify-center space-y-12">
      
      <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h1 className="text-5xl md:text-7xl font-extrabold text-foreground tracking-tight">
          Welcome to <span className="text-primary">Zero-Wait OPD</span>
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Check in quickly, describe your symptoms, and get routed to the right department without waiting in line.
        </p>
      </div>

      <div className="flex justify-center animate-in fade-in slide-in-from-bottom-10 duration-700 delay-150 fill-mode-both">
        <Link href="/scan-id">
          <Button size="lg" className="h-24 px-12 text-2xl rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
            Start New Visit
            <ArrowRight className="ml-4 h-8 w-8" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-300 fill-mode-both">
        <StatCard 
          title="Patients Today" 
          value={isLoading ? <Skeleton className="h-10 w-24" /> : stats?.visitsToday} 
          icon={Users} 
        />
        <StatCard 
          title="Total Registered" 
          value={isLoading ? <Skeleton className="h-10 w-24" /> : stats?.totalPatients} 
          icon={Activity} 
        />
        <StatCard 
          title="Top Department" 
          value={
            isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              stats?.departmentBreakdown?.[0]?.department || "N/A"
            )
          } 
          icon={Stethoscope} 
        />
      </div>

    </div>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string, value: React.ReactNode, icon: any }) {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-primary opacity-80" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}