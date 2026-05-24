import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useExtractPatientFromId,
  useCreatePatient,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ScanFace,
  Wand2,
  CheckCircle2,
  Loader2,
  User,
  Camera,
  CameraOff,
  RefreshCw,
  FileText,
} from "lucide-react";
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

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const extractMutation = useExtractPatientFromId();
  const createPatientMutation = useCreatePatient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", age: 0, gender: "", phone: "", insuranceId: "" },
  });

  // ── Camera helpers ───────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setCameraError(msg);
      toast({ title: "Camera unavailable", description: msg, variant: "destructive" });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  // Extract base64 from data URL (strip "data:image/jpeg;base64,")
  const getBase64 = (dataUrl: string) => dataUrl.split(",")[1] ?? "";

  // ── AI extraction ────────────────────────────────────────────────────────────

  const handleExtractText = () => {
    if (!idText.trim()) {
      toast({ title: "Error", description: "Please enter some ID text first", variant: "destructive" });
      return;
    }
    extractMutation.mutate(
      { data: { idText } },
      {
        onSuccess: applyExtracted,
        onError: () =>
          toast({ title: "Error", description: "Failed to extract details.", variant: "destructive" }),
      },
    );
  };

  const handleExtractImage = () => {
    if (!capturedImage) {
      toast({ title: "Error", description: "No image captured yet.", variant: "destructive" });
      return;
    }
    extractMutation.mutate(
      { data: { idImage: getBase64(capturedImage) } },
      {
        onSuccess: applyExtracted,
        onError: () =>
          toast({ title: "Error", description: "Failed to extract from image.", variant: "destructive" }),
      },
    );
  };

  const applyExtracted = (data: {
    name: string;
    age: number | null;
    gender: string | null;
    phone: string | null;
    insuranceId: string | null;
  }) => {
    form.reset({
      name: data.name || "",
      age: data.age || 0,
      gender: data.gender || "",
      phone: data.phone || "",
      insuranceId: data.insuranceId || "",
    });
    setIsExtracted(true);
    toast({ title: "Success", description: "ID details extracted successfully." });
  };

  const onSubmit = (values: FormValues) => {
    createPatientMutation.mutate(
      { data: values },
      {
        onSuccess: (patient) => {
          toast({ title: "Patient Registered", description: "Redirecting to chat..." });
          setLocation(`/chat?patientId=${patient.id}`);
        },
        onError: () =>
          toast({ title: "Registration Failed", description: "Could not register patient.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col space-y-8 pb-12">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Patient Check-In</h1>
        <p className="text-xl text-muted-foreground">Scan your ID card or enter details manually.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Left: ID Input ──────────────────────────────────────────────── */}
        <Card className={`border-2 transition-colors ${!isExtracted ? "border-primary/50 shadow-md" : "border-border/50"}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ScanFace className="h-6 w-6 text-primary" />
              Scan ID
            </CardTitle>
            <CardDescription className="text-base">
              Use your camera or paste the text from your ID card.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="camera" className="w-full">
              <TabsList className="w-full mb-6 h-12">
                <TabsTrigger value="camera" className="flex-1 gap-2 text-base" data-testid="tab-camera">
                  <Camera className="h-4 w-4" /> Camera
                </TabsTrigger>
                <TabsTrigger value="text" className="flex-1 gap-2 text-base" data-testid="tab-text">
                  <FileText className="h-4 w-4" /> Paste Text
                </TabsTrigger>
              </TabsList>

              {/* ── Camera Tab ── */}
              <TabsContent value="camera" className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video w-full flex items-center justify-center">
                  {/* Live viewfinder */}
                  <video
                    ref={videoRef}
                    className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
                    playsInline
                    muted
                    data-testid="camera-viewfinder"
                  />

                  {/* Captured preview */}
                  {capturedImage && !cameraActive && (
                    <img
                      src={capturedImage}
                      alt="Captured ID"
                      className="w-full h-full object-cover"
                      data-testid="img-captured"
                    />
                  )}

                  {/* Idle placeholder */}
                  {!cameraActive && !capturedImage && (
                    <div className="flex flex-col items-center gap-3 text-white/60 p-8 text-center">
                      <Camera className="h-12 w-12" />
                      <p className="text-sm">Camera preview will appear here</p>
                    </div>
                  )}

                  {/* Viewfinder overlay when active */}
                  {cameraActive && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-6 border-2 border-white/50 rounded-lg" />
                      <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl" />
                      <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr" />
                      <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl" />
                      <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br" />
                    </div>
                  )}
                </div>

                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} className="hidden" />

                {cameraError && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <CameraOff className="h-4 w-4 shrink-0" /> {cameraError}
                  </p>
                )}

                {/* Camera controls */}
                <div className="flex gap-3">
                  {!cameraActive && !capturedImage && (
                    <Button
                      size="lg"
                      className="flex-1 h-12 text-base gap-2"
                      onClick={startCamera}
                      data-testid="button-start-camera"
                    >
                      <Camera className="h-5 w-5" /> Start Camera
                    </Button>
                  )}

                  {cameraActive && (
                    <>
                      <Button
                        size="lg"
                        className="flex-1 h-12 text-base gap-2"
                        onClick={capturePhoto}
                        data-testid="button-capture"
                      >
                        <Camera className="h-5 w-5" /> Capture
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-12 px-5"
                        onClick={stopCamera}
                        data-testid="button-stop-camera"
                      >
                        <CameraOff className="h-5 w-5" />
                      </Button>
                    </>
                  )}

                  {capturedImage && !cameraActive && (
                    <>
                      <Button
                        size="lg"
                        className="flex-1 h-12 text-base gap-2"
                        onClick={handleExtractImage}
                        disabled={extractMutation.isPending}
                        data-testid="button-extract-image"
                      >
                        {extractMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Wand2 className="h-5 w-5" />
                        )}
                        {extractMutation.isPending ? "Extracting..." : "Extract with AI"}
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-12 px-5"
                        onClick={retakePhoto}
                        disabled={extractMutation.isPending}
                        data-testid="button-retake"
                      >
                        <RefreshCw className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Position your ID card within the frame, then tap Capture.
                </p>
              </TabsContent>

              {/* ── Text Tab ── */}
              <TabsContent value="text" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="id-text">ID Content</Label>
                  <Textarea
                    id="id-text"
                    placeholder={`MR JOHN DOE\nDOB 01/01/1980\nSEX M\nPHONE 555-1234\nINSURANCE BLUESHIELD-999`}
                    className="min-h-[200px] font-mono text-sm resize-none bg-muted/50"
                    value={idText}
                    onChange={(e) => setIdText(e.target.value)}
                    disabled={extractMutation.isPending}
                    data-testid="input-id-text"
                  />
                </div>
                <Button
                  size="lg"
                  className="w-full h-14 text-lg gap-2"
                  onClick={handleExtractText}
                  disabled={extractMutation.isPending || !idText.trim()}
                  data-testid="button-extract-text"
                >
                  {extractMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Wand2 className="h-5 w-5" />
                  )}
                  {extractMutation.isPending ? "Extracting..." : "Extract with AI"}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Right: Verified Details Form ───────────────────────────────── */}
        <Card
          className={`border-2 transition-all ${
            isExtracted
              ? "border-primary shadow-lg ring-4 ring-primary/10"
              : "border-border/50 opacity-50"
          }`}
        >
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
                        <Input className="h-12 text-lg" {...field} disabled={!isExtracted} data-testid="input-name" />
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
                          <Input type="number" className="h-12 text-lg" {...field} disabled={!isExtracted} data-testid="input-age" />
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
                          <Input className="h-12 text-lg" {...field} disabled={!isExtracted} data-testid="input-gender" />
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
                        <Input type="tel" className="h-12 text-lg" {...field} disabled={!isExtracted} data-testid="input-phone" />
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
                        <Input
                          className="h-12 text-lg"
                          {...field}
                          value={field.value || ""}
                          disabled={!isExtracted}
                          data-testid="input-insurance-id"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pt-4">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-14 text-lg gap-2"
                    disabled={!isExtracted || createPatientMutation.isPending}
                    data-testid="button-confirm"
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
