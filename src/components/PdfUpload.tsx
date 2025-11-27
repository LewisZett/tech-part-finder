import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2 } from 'lucide-react';

interface PdfUploadProps {
  onSuccess?: () => void;
}

export const PdfUpload = ({ onSuccess }: PdfUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'File size must be less than 10MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = 'pdf';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('part-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      toast({
        title: 'File uploaded',
        description: 'Processing spare parts list...',
      });

      setUploading(false);
      setParsing(true);

      const { data, error } = await supabase.functions.invoke('parse-parts-pdf', {
        body: { filePath: fileName, userId: user.id },
      });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Added ${data.count} spare parts to your listings`,
      });

      // Cleanup: delete the uploaded file
      await supabase.storage.from('part-documents').remove([fileName]);

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setParsing(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        disabled={uploading || parsing}
        className="hidden"
        id="pdf-upload"
      />
      <label htmlFor="pdf-upload" className="block">
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
          {uploading || parsing ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
              <span className="text-sm text-muted-foreground">
                {uploading ? 'Uploading...' : 'Processing spare parts...'}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <span className="text-sm font-medium">Click to upload PDF</span>
              <span className="text-xs text-muted-foreground mt-1">
                PDF files up to 10MB
              </span>
            </div>
          )}
        </div>
      </label>
    </div>
  );
};
