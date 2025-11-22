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
    const { filePath, userId } = await req.json();
    console.log('Parsing PDF:', { filePath, userId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the PDF from storage
    console.log('Downloading PDF from storage...');
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('part-documents')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log('Calling Lovable AI for PDF parsing...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting structured data from construction parts documents. Extract part information and return it as valid JSON only.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract all parts from this document. For each part, identify:
- part_name (the name/model of the part)
- category (classify as: electrical, plumbing, hvac, structural, roofing, flooring, doors, windows, or other)
- condition (new, like-new, used-good, used-fair, or for-parts)
- price (numeric value only, no currency symbols)
- description (any additional details)

Return ONLY a JSON array of parts in this exact format:
[{"part_name": "string", "category": "string", "condition": "string", "price": number, "description": "string"}]

If a field is not found, use reasonable defaults:
- condition: "used-good"
- description: ""
- price: 0 (if not specified)

Be lenient with formats and extract as much as possible.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');
    
    const content = aiData.choices[0].message.content;
    
    // Extract JSON from the response
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7, -3).trim();
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3, -3).trim();
    }
    
    const parts = JSON.parse(jsonStr);
    console.log('Parsed parts:', parts.length);

    // Insert parts into database
    const partsToInsert = parts.map((part: any) => ({
      supplier_id: userId,
      part_name: part.part_name,
      category: part.category,
      condition: part.condition,
      price: part.price || null,
      description: part.description || '',
      status: 'available'
    }));

    const { data: insertedParts, error: insertError } = await supabase
      .from('parts')
      .insert(partsToInsert)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to insert parts: ${insertError.message}`);
    }

    console.log('Successfully inserted', insertedParts.length, 'parts');

    return new Response(
      JSON.stringify({ 
        success: true, 
        parts: insertedParts,
        count: insertedParts.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in parse-parts-pdf:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});