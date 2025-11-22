import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requestId, partId, type } = await req.json();
    console.log('AI matching request:', { requestId, partId, type });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let sourceData, candidateData, prompt;

    if (type === 'request') {
      // Find matches for a part request
      const { data: request } = await supabase
        .from('part_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      const { data: parts } = await supabase
        .from('parts')
        .select('*, profiles:supplier_id(*)')
        .eq('status', 'available');

      sourceData = request;
      candidateData = parts;

      // Build messages with potential images
      const messages: any[] = [
        { 
          role: 'system', 
          content: 'You are an expert parts matching assistant. Analyze text descriptions and images to find the best matches.' 
        }
      ];

      const userContent: any[] = [{
        type: 'text',
        text: `You are an expert at matching construction part requests with available parts.

Request Details:
- Part Name: ${request.part_name}
- Category: ${request.category}
- Description: ${request.description || 'None'}
- Max Price: $${request.max_price || 'Not specified'}
- Condition Preference: ${request.condition_preference || 'Any'}
- Location: ${request.location || 'Not specified'}

Available Parts:
${parts?.map((p: any, i: number) => `
${i + 1}. ${p.part_name} (ID: ${p.id})
   - Category: ${p.category}
   - Condition: ${p.condition}
   - Price: $${p.price || 'Not listed'}
   - Location: ${p.location || 'Not specified'}
   - Description: ${p.description || 'None'}
   - Has Image: ${p.image_url ? 'Yes' : 'No'}
   - Supplier: ${p.profiles?.full_name || 'Unknown'} (${p.profiles?.trade_type || 'general'})
`).join('\n')}

Analyze these parts and return the top 5 best matches. Consider:
1. Part name similarity (exact, partial, or semantic matches)
2. Category match
3. Price compatibility
4. Condition match
5. Location proximity
6. Description relevance
7. Visual similarity if images are available
8. Supplier reputation`
      }];

      // Add images of available parts for visual matching
      const partsWithImages = parts?.filter((p: any) => p.image_url) || [];
      if (partsWithImages.length > 0) {
        userContent.push({
          type: 'text',
          text: `\n\nHere are images of the available parts for visual comparison:`
        });
        
        for (const part of partsWithImages.slice(0, 5)) {
          userContent.push({
            type: 'text',
            text: `\nPart: ${part.part_name} (ID: ${part.id})`
          });
          userContent.push({
            type: 'image_url',
            image_url: { url: part.image_url }
          });
        }
      }

      messages.push({ role: 'user', content: userContent });
      prompt = messages;
    } else {
      // Find matches for an available part
      const { data: part } = await supabase
        .from('parts')
        .select('*')
        .eq('id', partId)
        .single();

      const { data: requests } = await supabase
        .from('part_requests')
        .select('*, profiles:requester_id(*)')
        .eq('status', 'active');

      sourceData = part;
      candidateData = requests;

      // Build messages with potential images
      const messages: any[] = [
        { 
          role: 'system', 
          content: 'You are an expert parts matching assistant. Analyze text descriptions and images to find the best matches.' 
        }
      ];

      const userContent: any[] = [{
        type: 'text',
        text: `You are an expert at matching available construction parts with part requests.

Available Part:
- Part Name: ${part.part_name}
- Category: ${part.category}
- Condition: ${part.condition}
- Price: $${part.price || 'Not listed'}
- Location: ${part.location || 'Not specified'}
- Description: ${part.description || 'None'}
- Has Image: ${part.image_url ? 'Yes' : 'No'}

Part Requests:
${requests?.map((r: any, i: number) => `
${i + 1}. ${r.part_name} (ID: ${r.id})
   - Category: ${r.category}
   - Max Price: $${r.max_price || 'Not specified'}
   - Condition Preference: ${r.condition_preference || 'Any'}
   - Location: ${r.location || 'Not specified'}
   - Description: ${r.description || 'None'}
   - Requester: ${r.profiles?.full_name || 'Unknown'} (${r.profiles?.trade_type || 'general'})
`).join('\n')}

Analyze these requests and return the top 5 best matches. Consider:
1. Part name similarity (exact, partial, or semantic matches)
2. Category match
3. Price compatibility
4. Condition match
5. Location proximity
6. Description relevance
7. Visual appearance if image is available
8. Buyer seriousness`
      }];

      // Add image of the part for visual matching
      if (part.image_url) {
        userContent.push({
          type: 'text',
          text: `\n\nHere is an image of the available part for visual reference:`
        });
        userContent.push({
          type: 'image_url',
          image_url: { url: part.image_url }
        });
      }

      messages.push({ role: 'user', content: userContent });
      prompt = messages;
    }

    console.log('Calling Lovable AI for matching...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: Array.isArray(prompt) ? prompt : [
          { role: 'system', content: 'You are an expert parts matching assistant.' },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_matches',
              description: 'Return the top matches for parts or requests with scores and reasons',
              parameters: {
                type: 'object',
                properties: {
                  matches: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'UUID of the matched part or request' },
                        score: { type: 'number', description: 'Match quality score from 0-100' },
                        reason: { type: 'string', description: 'Brief explanation of why this is a good match' }
                      },
                      required: ['id', 'score', 'reason'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['matches'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'return_matches' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');
    
    const toolCall = aiData.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }
    
    const matchesResult = JSON.parse(toolCall.function.arguments);
    const matches = matchesResult.matches;
    console.log('Parsed matches:', matches);

    return new Response(
      JSON.stringify({ matches }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-match-parts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});