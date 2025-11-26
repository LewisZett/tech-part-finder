import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Upload, X, FileText, Clipboard, Search, MapPin, Package } from "lucide-react";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";

const partSchema = z.object({
  part_name: z.string().min(2, "Part name must be at least 2 characters").max(100),
  category: z.string().min(1, "Category is required"),
  condition: z.enum(["new", "used", "refurbished"]),
  price: z.number().min(0).optional(),
  description: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
});

const requestSchema = z.object({
  part_name: z.string().min(2, "Part name must be at least 2 characters").max(100),
  category: z.string().min(1, "Category is required"),
  condition_preference: z.string().optional(),
  max_price: z.number().min(0).optional(),
  description: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
});

const MyListings = () => {
  const [user, setUser] = useState<any>(null);
  const [myParts, setMyParts] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"part" | "request">("part");
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    part_name: "",
    category: "",
    condition: "new",
    price: "",
    max_price: "",
    description: "",
    location: "",
    condition_preference: "",
  });
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchMyData(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchMyData = async (userId: string) => {
    setLoading(true);
    const [partsResult, requestsResult] = await Promise.all([
      supabase.from("parts").select("*").eq("supplier_id", userId).order('updated_at', { ascending: false }),
      supabase.from("part_requests").select("*").eq("requester_id", userId).order('updated_at', { ascending: false }),
    ]);

    if (partsResult.data) setMyParts(partsResult.data);
    if (requestsResult.data) setMyRequests(requestsResult.data);
    setLoading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please select an image file (JPEG, PNG, or WebP)",
        });
        return;
      }
      
      if (file.size > 5242880) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Image must be less than 5MB",
        });
        return;
      }
      
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleEdit = (type: "part" | "request", item: any) => {
    setEditingItem(item);
    setDialogType(type);
    setFormData({
      part_name: item.part_name,
      category: item.category,
      condition: item.condition || "new",
      price: item.price?.toString() || "",
      max_price: item.max_price?.toString() || "",
      description: item.description || "",
      location: item.location || "",
      condition_preference: item.condition_preference || "",
    });
    if (item.image_url) {
      setImagePreview(item.image_url);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      if (dialogType === "part") {
        const validation = partSchema.safeParse({
          ...formData,
          price: formData.price ? parseFloat(formData.price) : undefined,
        });

        if (!validation.success) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: validation.error.errors[0].message,
          });
          setUploading(false);
          return;
        }

        let imageUrl: string | null = null;

        if (selectedImage) {
          const fileExt = selectedImage.name.split('.').pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('part-images')
            .upload(filePath, selectedImage, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('part-images')
            .getPublicUrl(filePath);

          imageUrl = publicUrl;
        } else if (editingItem?.image_url) {
          imageUrl = editingItem.image_url;
        }

        if (editingItem) {
          const { error } = await supabase.from("parts").update({
            part_name: formData.part_name,
            category: formData.category,
            condition: formData.condition,
            price: formData.price ? parseFloat(formData.price) : null,
            description: formData.description || null,
            location: formData.location || null,
            image_url: imageUrl,
          }).eq("id", editingItem.id);

          if (error) throw error;
          toast({ title: "Part updated successfully!" });
        } else {
          const { error } = await supabase.from("parts").insert({
            supplier_id: user.id,
            part_name: formData.part_name,
            category: formData.category,
            condition: formData.condition,
            price: formData.price ? parseFloat(formData.price) : null,
            description: formData.description || null,
            location: formData.location || null,
            image_url: imageUrl,
          });

          if (error) throw error;
          toast({ title: "Part listed successfully!" });
        }
      } else {
        const validation = requestSchema.safeParse({
          ...formData,
          max_price: formData.max_price ? parseFloat(formData.max_price) : undefined,
        });

        if (!validation.success) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: validation.error.errors[0].message,
          });
          setUploading(false);
          return;
        }

        if (editingItem) {
          const { error } = await supabase.from("part_requests").update({
            part_name: formData.part_name,
            category: formData.category,
            condition_preference: formData.condition_preference || null,
            max_price: formData.max_price ? parseFloat(formData.max_price) : null,
            description: formData.description || null,
            location: formData.location || null,
          }).eq("id", editingItem.id);

          if (error) throw error;
          toast({ title: "Request updated successfully!" });
        } else {
          const { error } = await supabase.from("part_requests").insert({
            requester_id: user.id,
            part_name: formData.part_name,
            category: formData.category,
            condition_preference: formData.condition_preference || null,
            max_price: formData.max_price ? parseFloat(formData.max_price) : null,
            description: formData.description || null,
            location: formData.location || null,
          });

          if (error) throw error;
          toast({ title: "Request created successfully!" });
        }
      }

      setDialogOpen(false);
      setEditingItem(null);
      setFormData({
        part_name: "",
        category: "",
        condition: "new",
        price: "",
        max_price: "",
        description: "",
        location: "",
        condition_preference: "",
      });
      setSelectedImage(null);
      setImagePreview(null);
      fetchMyData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (type: "part" | "request", id: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${type}? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      const table = type === "part" ? "parts" : "part_requests";
      const { error } = await supabase.from(table).delete().eq("id", id);

      if (error) throw error;
      toast({ title: `${type === "part" ? "Part" : "Request"} deleted successfully!` });
      fetchMyData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const filteredParts = myParts.filter(part =>
    part.part_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    part.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRequests = myRequests.filter(request =>
    request.part_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout user={user}>
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-3xl mx-auto space-y-12 md:space-y-16">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-[38px] font-bold">My Listings</h1>
            <p className="text-[17px]" style={{ color: '#666' }}>Manage your parts and requests</p>
          </div>

          {/* Bulk Upload Section */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.06)] p-6">
              <CardContent className="p-0 flex flex-col items-center text-center space-y-4">
                <FileText className="h-12 w-12 text-primary" />
                <div>
                  <h3 className="font-semibold text-lg mb-1">Bulk Upload from PDF</h3>
                  <p className="text-sm text-muted-foreground">Upload your parts inventory</p>
                </div>
                <Button 
                  className="w-full h-12 bg-primary hover:bg-primary/90"
                  onClick={() => setPdfDialogOpen(true)}
                >
                  UPLOAD PDF
                </Button>
                <a href="#" className="text-xs text-primary hover:underline">
                  Download sample PDF format
                </a>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.06)] p-6">
              <CardContent className="p-0 flex flex-col items-center text-center space-y-4">
                <Clipboard className="h-12 w-12 text-primary" />
                <div>
                  <h3 className="font-semibold text-lg mb-1">Bulk Paste Parts List</h3>
                  <p className="text-sm text-muted-foreground">Paste from spreadsheet</p>
                </div>
                <Button 
                  className="w-full h-12 bg-primary hover:bg-primary/90"
                  onClick={() => setTextDialogOpen(true)}
                >
                  PASTE LIST
                </Button>
                <a href="#" className="text-xs text-primary hover:underline">
                  See paste format example
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="parts" className="space-y-8">
            <TabsList className="grid w-full grid-cols-2 h-14 bg-muted/50">
              <TabsTrigger 
                value="parts" 
                className="font-bold text-base data-[state=active]:border-b-[3px] data-[state=active]:border-primary rounded-none"
              >
                My Parts ({myParts.length})
              </TabsTrigger>
              <TabsTrigger 
                value="requests"
                className="font-bold text-base data-[state=active]:border-b-[3px] data-[state=active]:border-primary rounded-none"
              >
                My Requests ({myRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="parts" className="space-y-8 mt-8">
              {/* Main Action Button */}
              <Button 
                onClick={() => { setDialogType("part"); setDialogOpen(true); }}
                className="w-full h-14 text-lg font-bold bg-teal hover:bg-teal/90 text-teal-foreground"
              >
                <Plus className="mr-2 h-5 w-5" />
                LIST A PART
              </Button>

              {myParts.length > 0 && (
                <>
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="Search my parts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>

                  {/* Parts List */}
                  <div className="space-y-4">
                    {filteredParts.map((part) => (
                      <Card key={part.id} className="rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.06)] p-6">
                        <div className="flex gap-4">
                          {/* Image */}
                          <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                            {part.image_url ? (
                              <img src={part.image_url} alt={part.part_name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="h-10 w-10 text-muted-foreground/50" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div>
                              <h3 className="font-bold text-lg leading-tight">{part.part_name}</h3>
                              <div className="flex gap-2 mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                  {part.condition}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                  Qty: 1
                                </span>
                              </div>
                            </div>
                            
                            {part.price && (
                              <p className="text-2xl font-bold">${parseFloat(part.price).toFixed(2)}</p>
                            )}
                            
                            {part.location && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {part.location}
                              </p>
                            )}

                            <p className="text-xs text-muted-foreground">
                              Last updated {formatDistanceToNow(new Date(part.updated_at))} ago
                            </p>

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-2">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit("part", part)}
                                  className="h-9"
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete("part", part.id)}
                                  className="h-9 text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                                >
                                  Delete
                                </Button>
                              </div>
                              <Badge className="bg-[#10B981] hover:bg-[#10B981] text-white">
                                ● In Stock
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* Empty State */}
              {myParts.length === 0 && (
                <Card className="rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.06)] p-12">
                  <div className="text-center space-y-6">
                    <Package className="h-24 w-24 mx-auto text-muted-foreground/30" />
                    <div>
                      <h3 className="text-xl font-semibold mb-2">No parts listed yet</h3>
                      <p className="text-muted-foreground">Start selling by listing your first part</p>
                    </div>
                    <Button 
                      onClick={() => { setDialogType("part"); setDialogOpen(true); }}
                      className="bg-teal hover:bg-teal/90 text-teal-foreground h-14 px-8 text-lg font-bold"
                    >
                      LIST YOUR FIRST PART
                    </Button>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="requests" className="space-y-8 mt-8">
              {/* Main Action Button */}
              <Button 
                onClick={() => { setDialogType("request"); setDialogOpen(true); }}
                className="w-full h-14 text-lg font-bold bg-teal hover:bg-teal/90 text-teal-foreground"
              >
                <Plus className="mr-2 h-5 w-5" />
                CREATE REQUEST
              </Button>

              {myRequests.length > 0 && (
                <>
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="Search my requests..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>

                  {/* Requests List */}
                  <div className="space-y-4">
                    {filteredRequests.map((request) => (
                      <Card key={request.id} className="rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.06)] p-6">
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-bold text-lg leading-tight">{request.part_name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{request.category}</p>
                          </div>

                          {request.description && (
                            <p className="text-sm">{request.description}</p>
                          )}
                          
                          {request.max_price && (
                            <p className="text-xl font-bold">Budget: ${parseFloat(request.max_price).toFixed(2)}</p>
                          )}

                          {request.location && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {request.location}
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground">
                            Last updated {formatDistanceToNow(new Date(request.updated_at))} ago
                          </p>

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit("request", request)}
                                className="h-9"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete("request", request.id)}
                                className="h-9 text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                              >
                                Delete
                              </Button>
                            </div>
                            <Badge className="bg-[#10B981] hover:bg-[#10B981] text-white">
                              ● Active
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {/* Empty State */}
              {myRequests.length === 0 && (
                <Card className="rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.06)] p-12">
                  <div className="text-center space-y-6">
                    <Search className="h-24 w-24 mx-auto text-muted-foreground/30" />
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Need a part? Get quotes fast</h3>
                      <p className="text-muted-foreground">Create a request and let suppliers come to you</p>
                    </div>
                    <Button 
                      onClick={() => { setDialogType("request"); setDialogOpen(true); }}
                      className="bg-teal hover:bg-teal/90 text-teal-foreground h-14 px-8 text-lg font-bold"
                    >
                      CREATE REQUEST
                    </Button>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Part Dialog */}
      <Dialog open={dialogOpen && dialogType === "part"} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingItem(null);
          setSelectedImage(null);
          setImagePreview(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Part" : "List a Part"}</DialogTitle>
            <DialogDescription>{editingItem ? "Update your part listing" : "Add a part you want to sell"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="part_name">Part Name *</Label>
              <Input
                id="part_name"
                value={formData.part_name}
                onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="condition">Condition *</Label>
              <Select value={formData.condition} onValueChange={(value) => setFormData({ ...formData, condition: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="refurbished">Refurbished</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="image">Part Photo</Label>
              <div className="mt-2">
                {imagePreview ? (
                  <div className="relative">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
                    <input
                      id="image"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <label htmlFor="image" className="cursor-pointer flex flex-col items-center">
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Click to upload part image
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        JPEG, PNG, WebP (max 5MB)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={uploading}>
              {uploading ? (editingItem ? "Updating..." : "Uploading...") : (editingItem ? "Update Part" : "List Part")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Request Dialog */}
      <Dialog open={dialogOpen && dialogType === "request"} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setEditingItem(null);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Request" : "Create a Part Request"}</DialogTitle>
            <DialogDescription>{editingItem ? "Update your part request" : "Tell us what part you're looking for"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="part_name_req">Part Name *</Label>
              <Input
                id="part_name_req"
                value={formData.part_name}
                onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="category_req">Category *</Label>
              <Input
                id="category_req"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="condition_preference">Condition Preference</Label>
              <Input
                id="condition_preference"
                value={formData.condition_preference}
                onChange={(e) => setFormData({ ...formData, condition_preference: e.target.value })}
                placeholder="e.g., new, used"
              />
            </div>
            <div>
              <Label htmlFor="max_price">Max Price ($)</Label>
              <Input
                id="max_price"
                type="number"
                step="0.01"
                value={formData.max_price}
                onChange={(e) => setFormData({ ...formData, max_price: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="location_req">Location</Label>
              <Input
                id="location_req"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="description_req">Description</Label>
              <Textarea
                id="description_req"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={uploading}>
              {uploading ? (editingItem ? "Updating..." : "Creating...") : (editingItem ? "Update Request" : "Create Request")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default MyListings;
