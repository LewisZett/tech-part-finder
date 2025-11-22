import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Match {
  id: string;
  score: number;
  reason: string;
}

interface AiMatchSuggestionsProps {
  itemId: string;
  itemType: 'part' | 'request';
  itemData: any;
}

export const AiMatchSuggestions = ({ itemId, itemType, itemData }: AiMatchSuggestionsProps) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-match-parts', {
        body: {
          [itemType === 'request' ? 'requestId' : 'partId']: itemId,
          type: itemType,
        },
      });

      if (error) throw error;
      setMatches(data.matches || []);
    } catch (error: any) {
      console.error('Error fetching AI matches:', error);
      toast({
        title: 'Failed to get AI suggestions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-primary';
    if (score >= 60) return 'bg-accent';
    return 'bg-muted-foreground';
  };

  if (!expanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setExpanded(true);
          if (matches.length === 0) fetchMatches();
        }}
        className="w-full"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        AI Match Suggestions
      </Button>
    );
  }

  return (
    <Card className="p-4 mt-2 border-primary/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h4 className="font-semibold">AI-Powered Matches</h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(false)}
        >
          Hide
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : matches.length > 0 ? (
        <div className="space-y-3">
          {matches.slice(0, 3).map((match, idx) => (
            <div
              key={match.id}
              className="p-3 rounded-lg bg-muted/50 border border-border"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <Badge variant="secondary" className="shrink-0">
                  #{idx + 1}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{match.score}% match</span>
                  <div className={`w-2 h-2 rounded-full ${getScoreColor(match.score)}`} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{match.reason}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          No strong matches found
        </p>
      )}

      {matches.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMatches}
          className="w-full mt-3"
        >
          Refresh Suggestions
        </Button>
      )}
    </Card>
  );
};