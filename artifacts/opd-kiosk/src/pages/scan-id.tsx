import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useExtractPatientFromId, 
  useCreatePatient 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ScanFace, Wand2, CheckCircle2, Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  age: z.coerce.number().min(1, "Age must be valid"),
  gender: z.string().min(1, "Gender is required"),
  phone: z.string().min(5, "Phone number is required"),
  insuranceId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ScanId() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [idText, setIdText] = useState("");
  const [isExtracted, setIsExtracted] = useState(false);

  const extractMutation = useExtractPatientFromId();
  const createPatientMutation = useCreatePatient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      age: 0,
      gender: "",
      phone: "",
      insuranceId: "",
    },
  });

  const handleExtract = () => {
    if (!idText.trim()) {
      toast({ title: "Error", description: "Please enter some ID text first", variant: "destructive" });
      return;
    }

    extractMutation.mutate({ data: { idText } }, {
      onSuccess: (data) => {
        form.reset({
          name: data.name || "",
          age: data.age || 0,
          gender: data.gender || "",
          phone: data.phone || "",
          insuranceId: data.insuranceId || "",
        });
        setIsExtracted(true);
        toast({ title: "Success", description: "ID details extracted successfully." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to extract details.", variant: "destructive" });
      }
    });
  };

  const onSubmit = (values: FormValues) => {
    createPatientMutation.mutate({ data: values }, {
      onSuccess: (patient) => {
        toast({ title: "Patient Registered", description: "Redirecting to chat..." });
        setLocation(`/chat?patientId=${patient.id}`);
      },
      onError: () => {
        toast({ title: "Registration Failed", description: "Could not register patient.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto w-full h-full flex flex-col space-y-8 pb-12">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Patient Check-In</h1>
        <p className="text-xl text-muted-foreground">Scan your ID or enter details manually.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: ID Scan */}
        <Card className={`border-2 transition-colors ${!isExtracted ? 'border-primary/50 shadow-md' : 'border-border/50'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ScanFace className="h-6 w-6 text-primary" />
              Scan ID
            </CardTitle>
            <CardDescription className="text-base">
              Hold your ID card to the scanner, or paste the text below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="id-text">ID Content</Label>
              <Textarea 
                id="id-text"
                placeholder="MR JOHN DOE
DOB 01/01/1980
SEX M
PHONE 555-1234
INSURANCE BLUESHIELD-999"
                className="min-h-[200px] font-mono text-sm resize-none bg-muted/50"
                value={idText}
                onChange={(e) => setIdText(e.target.value)}
                disabled={extractMutation.isPending}
              />
            </div>
            <Button 
              size="lg" 
              className="w-full h-14 text-lg rounded-xl gap-2"
              onClick={handleExtract}
              disabled={extractMutation.isPending || !idText.trim()}
            >
              {extractMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wand2 className="h-5 w-5" />
              )}
              {extractMutation.isPending ? "Extracting..." : "Extract with AI"}
            </Button>
          </CardContent>
        </Card>

        {/* Right Column: Extracted Form */}
        <Card className={`border-2 transition-colors ${isExtracted ? 'border-primary shadow-lg ring-4 ring-primary/10' : 'border-border/50 opacity-50'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <User className="h-6 w-6 text-primary" />
              Verify Details
            </CardTitle>
            <CardDescription className="text-base">
              Please confirm your information before proceeding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input className="h-12 text-lg" {...field} disabled={!isExtracted} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age</FormLabel>
                        <FormControl>
                          <Input type="number" className="h-12 text-lg" {...field} disabled={!isExtracted} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-lg" {...field} disabled={!isExtracted} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" className="h-12 text-lg" {...field} disabled={!isExtracted} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="insuranceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurance ID (Optional)</FormLabel>
                      <FormControl>
                        <Input className="h-12 text-lg" {...field} value={field.value || ""} disabled={!isExtracted} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="pt-4">
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full h-14 text-lg rounded-xl gap-2"
                    disabled={!isExtracted || createPatientMutation.isPending}
                  >
                    {createPatientMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    Confirm & Continue
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}