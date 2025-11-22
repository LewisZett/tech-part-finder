import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const PdfUpload = () => {
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
        description: 'Processing parts list...',
      });

      setUploading(false);
      setParsing(true);

      const { data, error } = await supabase.functions.invoke('parse-parts-pdf', {
        body: { filePath: fileName, userId: user.id },
      });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `Added ${data.count} parts to your listings`,
      });

      // Cleanup: delete the uploaded file
      await supabase.storage.from('part-documents').remove([fileName]);

      // Trigger a page refresh via React Router instead of hard reload
      setTimeout(() => window.location.reload(), 1000);
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
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-semibold">Bulk Upload from PDF</h3>
            <p className="text-sm text-muted-foreground">
              Upload a PDF with your parts list and AI will extract them automatically
            </p>
          </div>
        </div>
        <div>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading || parsing}
            className="hidden"
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload">
            <Button
              disabled={uploading || parsing}
              className="cursor-pointer"
              asChild
            >
              <span>
                {uploading || parsing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {uploading ? 'Uploading...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload PDF
                  </>
                )}
              </span>
            </Button>
          </label>
        </div>
      </div>
    </Card>
  );
};