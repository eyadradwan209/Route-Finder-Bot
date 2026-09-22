import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRoutes,
  getGetRoutesQueryKey,
  useDeleteRoutes,
  usePostRoutes,
  useSendMessage,
  useListAirports,
  getListAirportsQueryKey,
  useAddAirports,
  useRemoveAirport,
  useUpdateRoute,
} from "@workspace/api-client-react";
import type { Route } from "@workspace/api-client-react";
import {
  Upload, Download, Trash2, Database, AlertCircle, RefreshCw, Send,
  MessageSquare, CalendarDays, Plane, Plus, X, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type EditForm = {
  origin: string;
  originCity: string;
  originFlag: string;
  destination: string;
  destinationCity: string;
  destinationFlag: string;
  airline: string;
  airlineEmoji: string;
  flightNumber: string;
  aircraft: string;
  duration: string;
};

function routeToForm(route: Route): EditForm {
  return {
    origin: route.origin ?? "",
    originCity: route.originCity ?? "",
    originFlag: route.originFlag ?? "",
    destination: route.destination ?? "",
    destinationCity: route.destinationCity ?? "",
    destinationFlag: route.destinationFlag ?? "",
    airline: route.airline ?? "",
    airlineEmoji: route.airlineEmoji ?? "",
    flightNumber: route.flightNumber ?? "",
    aircraft: route.aircraft ?? "",
    duration: route.duration ?? "",
  };
}

export default function Home() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dayOverride, setDayOverride] = useState("");
  const [includePilotPing, setIncludePilotPing] = useState(true);
  const [customMessage, setCustomMessage] = useState("");
  const [newAirports, setNewAirports] = useState("");

  // Edit state
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  // Queries & Mutations
  const { data: routeData, isLoading: isLoadingRoutes, isError: isRoutesError } = useGetRoutes();
  const { data: airportData, isLoading: isLoadingAirports } = useListAirports();

  const deleteRoutes = useDeleteRoutes();
  const postRoutes = usePostRoutes();
  const sendMessage = useSendMessage();
  const addAirportsMutation = useAddAirports();
  const removeAirportMutation = useRemoveAirport();
  const updateRoute = useUpdateRoute();

  const openEdit = (route: Route) => {
    setEditingRoute(route);
    setEditForm(routeToForm(route));
  };

  const closeEdit = () => {
    setEditingRoute(null);
    setEditForm(null);
  };

  const handleEditField = (field: keyof EditForm, value: string) => {
    setEditForm((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const handleSaveEdit = () => {
    if (!editingRoute || !editForm) return;
    updateRoute.mutate(
      {
        id: editingRoute.id,
        data: {
          origin: editForm.origin || undefined,
          originCity: editForm.originCity || null,
          originFlag: editForm.originFlag || null,
          destination: editForm.destination || undefined,
          destinationCity: editForm.destinationCity || null,
          destinationFlag: editForm.destinationFlag || null,
          airline: editForm.airline || null,
          airlineEmoji: editForm.airlineEmoji || null,
          flightNumber: editForm.flightNumber || null,
          aircraft: editForm.aircraft || null,
          duration: editForm.duration || null,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Route Updated",
            description: `Route #${editingRoute.id} saved successfully.`,
          });
          queryClient.invalidateQueries({ queryKey: getGetRoutesQueryKey() });
          closeEdit();
        },
        onError: (error: any) => {
          toast({
            title: "Update Failed",
            description: error?.message || "There was an error saving the route.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleAddAirports = () => {
    if (!newAirports.trim()) return;
    addAirportsMutation.mutate(
      { data: { codes: newAirports.trim() } },
      {
        onSuccess: (data) => {
          let message = "";
          if (data.added && data.added.length > 0) message += `Added: ${data.added.join(", ")}. `;
          if (data.existing && data.existing.length > 0) message += `Already present: ${data.existing.join(", ")}.`;
          toast({ title: "Airports Updated", description: message || "Airports updated successfully." });
          setNewAirports("");
          queryClient.invalidateQueries({ queryKey: getListAirportsQueryKey() });
        },
        onError: (error: any) => {
          toast({ title: "Add Failed", description: error?.message || "There was an error adding airports.", variant: "destructive" });
        },
      }
    );
  };

  const handleRemoveAirport = (code: string) => {
    removeAirportMutation.mutate(
      { code },
      {
        onSuccess: (data) => {
          toast({ title: "Airport Removed", description: `Successfully removed ${data.removed}.` });
          queryClient.invalidateQueries({ queryKey: getListAirportsQueryKey() });
        },
        onError: (error: any) => {
          toast({ title: "Remove Failed", description: error?.message || "There was an error removing the airport.", variant: "destructive" });
        },
      }
    );
  };

  const handlePostRoutes = () => {
    postRoutes.mutate(
      {
        data: {
          ...(dayOverride.trim() ? { day: dayOverride.trim() } : {}),
          includePilotPing,
        },
      },
      {
        onSuccess: (data) => {
          toast({ title: "Routes Posted", description: `Successfully posted ${data.count} routes for ${data.day}.` });
          setDayOverride("");
        },
        onError: (error: any) => {
          toast({ title: "Post Failed", description: error?.message || "There was an error posting the routes.", variant: "destructive" });
        },
      }
    );
  };

  const handleSendMessage = () => {
    if (!customMessage.trim()) return;
    sendMessage.mutate(
      { data: { message: customMessage.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Message Sent", description: "Custom message successfully sent to Discord." });
          setCustomMessage("");
        },
        onError: (error: any) => {
          toast({ title: "Send Failed", description: error?.message || "There was an error sending the message.", variant: "destructive" });
        },
      }
    );
  };

  const handleUploadClick = () => { fileInputRef.current?.click(); };

  const handleDownloadCsv = () => {
    const headers = [
      "origin",
      "origin_city",
      "origin_flag",
      "destination",
      "destination_city",
      "destination_flag",
      "airline",
      "airline_emoji",
      "flight_number",
      "aircraft",
      "duration",
    ];

    const escapeCsv = (value: string | null | undefined) => {
      const text = value ?? "";
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const rows = routes.map((route) => [
      route.origin,
      route.originCity,
      route.originFlag,
      route.destination,
      route.destinationCity,
      route.destinationFlag,
      route.airline,
      route.airlineEmoji,
      route.flightNumber,
      route.aircraft,
      route.duration,
    ].map(escapeCsv).join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rotw-routes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/routes/upload", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Failed to upload routes");
      toast({ title: "Upload Successful", description: "Successfully imported route data." });
      queryClient.invalidateQueries({ queryKey: getGetRoutesQueryKey() });
    } catch {
      toast({ title: "Upload Failed", description: "There was an error uploading the CSV file.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAll = () => {
    deleteRoutes.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Data Cleared", description: "All routes have been successfully removed from the database." });
        queryClient.invalidateQueries({ queryKey: getGetRoutesQueryKey() });
      },
      onError: () => {
        toast({ title: "Delete Failed", description: "There was an error clearing the routes.", variant: "destructive" });
      },
    });
  };

  const routes = routeData?.routes || [];
  const total = routeData?.total || 0;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col p-6 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            EAVG ROTW Datastore
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Internal Flight Route Administration Tool</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            data-testid="input-csv-upload"
          />
          <Button
            onClick={handleDownloadCsv}
            disabled={isLoadingRoutes || routes.length === 0}
            variant="outline"
            className="font-mono"
            data-testid="button-download-csv"
          >
            <Download className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
          <Button onClick={handleUploadClick} disabled={isUploading} className="font-mono" data-testid="button-upload-csv">
            {isUploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {isUploading ? "Uploading..." : "Upload CSV"}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isUploading || deleteRoutes.isPending || total === 0} className="font-mono" data-testid="button-delete-all">
                <Trash2 className="w-4 h-4 mr-2" />
                Purge Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all {total} routes from the active database.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">
                  Confirm Purge
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 shadow-sm border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="font-mono font-bold text-lg">ONLINE</span>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 shadow-sm border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold" data-testid="text-total-routes">
                {isLoadingRoutes ? "-" : total.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 shadow-sm border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Data Version</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-mono text-muted-foreground truncate">
                {total > 0 && routes.length > 0
                  ? new Date(routes[0].createdAt || Date.now()).toISOString()
                  : "NO DATA"}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="col-span-1 shadow-sm border-border bg-card flex flex-col">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                Post Daily Routes
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                Trigger the bot to post today's route selection to the configured Discord channel.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="dayOverride" className="font-mono text-xs uppercase tracking-wider">Day Override (Optional)</Label>
                <Input
                  id="dayOverride"
                  placeholder="e.g. Monday"
                  value={dayOverride}
                  onChange={(e) => setDayOverride(e.target.value)}
                  className="font-mono"
                  data-testid="input-day-override"
                />
                <p className="text-xs text-muted-foreground">Leave blank to use current UTC day automatically.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={includePilotPing}
                  onCheckedChange={(checked) => setIncludePilotPing(checked === true)}
                  data-testid="checkbox-pilot-ping"
                />
                <span className="font-mono text-xs uppercase tracking-wider">
                  Include pilot ping / mention
                </span>
              </label>
              <div className="mt-auto pt-2">
                <Button onClick={handlePostRoutes} disabled={postRoutes.isPending || total === 0} className="w-full font-mono" data-testid="button-post-routes">
                  {postRoutes.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {postRoutes.isPending ? "Posting..." : "Post Routes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 shadow-sm border-border bg-card flex flex-col">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Broadcast Custom Message
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                Send a custom announcement to the Discord channel as the bot. Supports Markdown.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col gap-4">
              <div className="space-y-2 flex-1 flex flex-col min-h-[100px]">
                <Label htmlFor="customMessage" className="sr-only">Message Body</Label>
                <Textarea
                  id="customMessage"
                  placeholder="Enter message body here..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="font-mono flex-1 resize-none min-h-[100px]"
                  data-testid="textarea-custom-message"
                />
              </div>
              <div className="mt-auto pt-2">
                <Button onClick={handleSendMessage} disabled={sendMessage.isPending || !customMessage.trim()} className="w-full font-mono" data-testid="button-send-message">
                  {sendMessage.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {sendMessage.isPending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 shadow-sm border-border bg-card flex flex-col">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider flex items-center gap-2">
                <Plane className="w-4 h-4 text-primary" />
                Featured Airports
              </CardTitle>
              <CardDescription className="font-mono text-xs">Manage the list of high-priority airports.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="newAirports" className="font-mono text-xs uppercase tracking-wider">Add Airports</Label>
                <div className="flex gap-2">
                  <Input
                    id="newAirports"
                    placeholder="e.g. EGLL, KJFK"
                    value={newAirports}
                    onChange={(e) => setNewAirports(e.target.value)}
                    className="font-mono"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAirports(); } }}
                  />
                  <Button onClick={handleAddAirports} disabled={addAirportsMutation.isPending || !newAirports.trim()} className="font-mono px-3">
                    {addAirportsMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 flex-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Current List</Label>
                <div className="bg-muted/30 border rounded-md p-3 min-h-[100px] flex flex-wrap gap-2 content-start">
                  {isLoadingAirports ? (
                    <div className="w-full flex justify-center py-4">
                      <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : !airportData?.airports || airportData.airports.length === 0 ? (
                    <span className="text-xs text-muted-foreground font-mono">No featured airports configured.</span>
                  ) : (
                    airportData.airports.map((code) => (
                      <Badge key={code} variant="secondary" className="font-mono text-xs py-1 px-2 flex items-center gap-1 group">
                        {code}
                        <button
                          onClick={() => handleRemoveAirport(code)}
                          disabled={removeAirportMutation.isPending}
                          className="text-muted-foreground hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring rounded-sm opacity-50 group-hover:opacity-100 transition-opacity ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isRoutesError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>Failed to retrieve route data from the server. Check your connection or server status.</AlertDescription>
          </Alert>
        ) : (
          <Card className="flex-1 shadow-sm border-border bg-card flex flex-col min-h-0">
            <CardHeader className="border-b bg-muted/20 py-3">
              <CardTitle className="text-sm font-medium text-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Route Registry</span>
                <span className="text-muted-foreground text-xs font-normal font-mono">
                  Showing {routes.length} / {total} records
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
              {isLoadingRoutes ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mr-3" />
                  <span className="font-mono text-sm">Querying datastore...</span>
                </div>
              ) : routes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Database className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-mono text-sm uppercase tracking-widest">Datastore is empty</p>
                  <p className="text-sm mt-2">Upload a CSV file to populate the registry.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-sm shadow-sm z-10">
                    <TableRow>
                      <TableHead className="font-mono text-xs w-[60px]">ID</TableHead>
                      <TableHead className="font-mono text-xs">Origin</TableHead>
                      <TableHead className="font-mono text-xs">Destination</TableHead>
                      <TableHead className="font-mono text-xs">Airline</TableHead>
                      <TableHead className="font-mono text-xs">Flight No.</TableHead>
                      <TableHead className="font-mono text-xs">Aircraft</TableHead>
                      <TableHead className="font-mono text-xs text-right">Duration</TableHead>
                      <TableHead className="font-mono text-xs w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routes.map((route) => (
                      <TableRow key={route.id} className="group border-b/50">
                        <TableCell className="font-mono text-xs text-muted-foreground">{route.id}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono font-bold">{route.origin}</span>
                            <span className="text-xs text-muted-foreground">{route.originCity}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-primary">{route.destination}</span>
                            <span className="text-xs text-muted-foreground">{route.destinationCity}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{route.airline}</TableCell>
                        <TableCell className="font-mono text-sm">{route.flightNumber}</TableCell>
                        <TableCell className="font-mono text-sm">{route.aircraft}</TableCell>
                        <TableCell className="font-mono text-sm text-right">{route.duration}</TableCell>
                        <TableCell className="text-right pr-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => openEdit(route)}
                            title="Edit route"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Edit Route Dialog */}
      <Dialog open={!!editingRoute} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">Edit Route #{editingRoute?.id}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {editingRoute?.origin} → {editingRoute?.destination}
            </DialogDescription>
          </DialogHeader>

          {editForm && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Origin</Label>
                <Input className="font-mono" value={editForm.origin} onChange={(e) => handleEditField("origin", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Destination</Label>
                <Input className="font-mono" value={editForm.destination} onChange={(e) => handleEditField("destination", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Origin City</Label>
                <Input className="font-mono" value={editForm.originCity} onChange={(e) => handleEditField("originCity", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Destination City</Label>
                <Input className="font-mono" value={editForm.destinationCity} onChange={(e) => handleEditField("destinationCity", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Origin Flag</Label>
                <Input className="font-mono" placeholder="e.g. flag_gb" value={editForm.originFlag} onChange={(e) => handleEditField("originFlag", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Destination Flag</Label>
                <Input className="font-mono" placeholder="e.g. flag_us" value={editForm.destinationFlag} onChange={(e) => handleEditField("destinationFlag", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Airline</Label>
                <Input className="font-mono" value={editForm.airline} onChange={(e) => handleEditField("airline", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Airline Emoji</Label>
                <Input className="font-mono" placeholder="e.g. :british_airways:" value={editForm.airlineEmoji} onChange={(e) => handleEditField("airlineEmoji", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Flight Number</Label>
                <Input className="font-mono" value={editForm.flightNumber} onChange={(e) => handleEditField("flightNumber", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Duration</Label>
                <Input className="font-mono" placeholder="e.g. 7h30m" value={editForm.duration} onChange={(e) => handleEditField("duration", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Aircraft</Label>
                <Input className="font-mono" placeholder="e.g. Boeing 737-800" value={editForm.aircraft} onChange={(e) => handleEditField("aircraft", e.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeEdit} className="font-mono">Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateRoute.isPending} className="font-mono">
              {updateRoute.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              {updateRoute.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
