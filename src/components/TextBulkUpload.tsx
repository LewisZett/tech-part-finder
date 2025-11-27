import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, ImagePlus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TextBulkUploadProps {
  onSuccess?: () => void;
}

export const TextBulkUpload = ({ onSuccess }: TextBulkUploadProps) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
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
        description: 'Please paste your spare parts list or upload images',
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
        description: `Added ${data.count} spare parts to your listings`,
      });

      setText('');
      setImages([]);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error: any) {
      console.error('Error parsing text:', error);
      toast({
        title: 'Parsing failed',
        description: error.message || 'Failed to parse spare parts list. Please check your format and try again.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Textarea
          placeholder="Example:&#10;- Samsung A15 LCD Screen, $25, new condition&#10;- Used iPhone 13 battery, $15&#10;- Toyota Hilux alternator, like new, $80&#10;&#10;Or just paste your list in any format..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[150px] font-mono text-sm"
          disabled={processing}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Tip: Include prices, conditions, and descriptions for better results
        </p>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <ImagePlus className="w-4 h-4" />
          Upload Spare Part Images (AI will identify them)
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
          Upload images of spare parts you don't know the name of - AI will identify them
        </p>
      </div>
      
      <Button
        type="submit"
        disabled={processing || (!text.trim() && images.length === 0)}
        className="w-full bg-teal hover:bg-teal/90"
      >
        {processing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Parse & Add Spare Parts
          </>
        )}
      </Button>
    </form>
  );
};
