import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FileText, Loader2, Sparkles, ImagePlus, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const TextBulkUpload = () => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validImages = files.filter(file => file.type.startsWith('image/'));
    
    if (validImages.length !== files.length) {
      toast({
        title: 'Invalid files',
        description: 'Only image files are allowed',
        variant: 'destructive',
      });
    }
    
    setImages(prev => [...prev, ...validImages]);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim() && images.length === 0) {
      toast({
        title: 'Empty input',
        description: 'Please paste your parts list or upload images',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Convert images to base64
      const imageData = await Promise.all(
        images.map(async (file) => {
          const reader = new FileReader();
          return new Promise<string>((resolve) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        })
      );

      const { data, error } = await supabase.functions.invoke('parse-parts-text', {
        body: { 
          text: text.trim() || undefined, 
          images: imageData.length > 0 ? imageData : undefined,
          userId: user.id 
        },
      });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Added ${data.count} parts to your listings`,
      });

      setText('');
      setImages([]);
      setOpen(false);
      
      // Refresh the page after a brief delay to show success message
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      console.error('Error parsing text:', error);
      toast({
        title: 'Parsing failed',
        description: error.message || 'Failed to parse parts list. Please check your format and try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="p-6 mb-6 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <div>
                <h3 className="font-semibold">Bulk Paste Parts List</h3>
                <p className="text-sm text-muted-foreground">
                  Paste your parts list and AI will automatically organize them
                </p>
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Parts with Text or Images</DialogTitle>
          <DialogDescription>
            Paste your parts list or upload images. AI will identify parts from pictures and suggest names.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Textarea
              placeholder="Example:&#10;- 2x4 lumber, $5 each, new condition&#10;- Used copper pipes, 10ft, $50&#10;- Drywall sheets (4x8), like new, $15/sheet&#10;&#10;Or just paste your list in any format..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              disabled={processing}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Tip: Include prices, conditions, and descriptions for better results
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <ImagePlus className="w-4 h-4" />
              Upload Part Images (AI will identify them)
            </label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              disabled={processing}
              className="cursor-pointer"
            />
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Part ${index + 1}`}
                      className="w-full h-24 object-cover rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Upload images of parts you don't know the name of - AI will identify them
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setText('');
                setImages([]);
                setOpen(false);
              }}
              disabled={processing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={processing || (!text.trim() && images.length === 0)}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Parse & Add Parts
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};