import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { PdfUpload } from "@/components/PdfUpload";
import { TextBulkUpload } from "@/components/TextBulkUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Upload, X } from "lucide-react";
import { z } from "zod";

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
      supabase.from("parts").select("*").eq("supplier_id", userId),
      supabase.from("part_requests").select("*").eq("requester_id", userId),
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
      
      if (file.size > 5242880) { // 5MB limit
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

        // Upload image if selected
        if (selectedImage) {
          const fileExt = selectedImage.name.split('.').pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError, data } = await supabase.storage
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
        }

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
          return;
        }

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

      setDialogOpen(false);
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">My Listings</h1>
              <p className="text-muted-foreground">Manage your parts and requests</p>
            </div>
          </div>

          <PdfUpload />
          <TextBulkUpload />

          <Tabs defaultValue="parts" className="space-y-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="parts">My Parts ({myParts.length})</TabsTrigger>
              <TabsTrigger value="requests">My Requests ({myRequests.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="parts" className="space-y-4">
              <Dialog open={dialogOpen && dialogType === "part"} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setDialogType("part"); setDialogOpen(true); }} className="mb-4">
                    <Plus className="mr-2 h-4 w-4" />
                    List a Part
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>List a Part</DialogTitle>
                    <DialogDescription>Add a part you want to sell</DialogDescription>
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
                      {uploading ? "Uploading..." : "List Part"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myParts.map((part) => (
                  <Card key={part.id}>
                    {part.image_url && (
                      <div className="w-full h-48 overflow-hidden rounded-t-lg">
                        <img 
                          src={part.image_url} 
                          alt={part.part_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-lg">{part.part_name}</CardTitle>
                      <CardDescription>{part.category} - {part.condition}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {part.description && <p className="text-sm mb-2">{part.description}</p>}
                      {part.price && <p className="text-xl font-bold text-primary mb-2">${part.price}</p>}
                      {part.location && <p className="text-xs text-muted-foreground mb-2">📍 {part.location}</p>}
                      <p className="text-xs text-muted-foreground mb-3">Status: {part.status}</p>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDelete("part", part.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {myParts.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">You haven't listed any parts yet</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="requests" className="space-y-4">
              <Dialog open={dialogOpen && dialogType === "request"} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setDialogType("request"); setDialogOpen(true); }} className="mb-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create a Request
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create a Part Request</DialogTitle>
                    <DialogDescription>Tell us what part you're looking for</DialogDescription>
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
                    <Button type="submit" className="w-full">Create Request</Button>
                  </form>
                </DialogContent>
              </Dialog>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myRequests.map((request) => (
                  <Card key={request.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{request.part_name}</CardTitle>
                      <CardDescription>{request.category}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {request.description && <p className="text-sm mb-2">{request.description}</p>}
                      {request.max_price && <p className="text-lg font-semibold text-accent mb-2">
                        Budget: Up to ${request.max_price}
                      </p>}
                      <p className="text-xs text-muted-foreground mb-3">Status: {request.status}</p>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => handleDelete("request", request.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {myRequests.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">You haven't created any requests yet</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default MyListings;