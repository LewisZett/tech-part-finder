import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid categories for the marketplace
const VALID_CATEGORIES = [
  "Phone Spare Parts",
  "TV Spare Parts", 
  "Computer Spare Parts",
  "Car Spare Parts"
];

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
            content: `You are an expert at extracting structured data from spare parts documents. Extract part information and return it as valid JSON only.

IMPORTANT: Categories MUST be exactly one of these values:
- "Phone Spare Parts" (for mobile phone components: screens, batteries, charging ports, etc.)
- "TV Spare Parts" (for television components: panels, power boards, remote sensors, etc.)
- "Computer Spare Parts" (for computer components: RAM, CPUs, GPUs, motherboards, SSDs, etc.)
- "Car Spare Parts" (for automotive parts: bumpers, engines, transmissions, brake pads, etc.)

Classify each part into the most appropriate category based on its typical use.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract all parts from this document. For each part, identify:
- part_name (the name/model of the part)
- category (MUST be exactly one of: "Phone Spare Parts", "TV Spare Parts", "Computer Spare Parts", "Car Spare Parts")
- condition (MUST be exactly one of: "new", "used", or "refurbished")
- price (numeric value only, no currency symbols)
- description (any additional details)
- color_variant (color or variant info, e.g., "Black", "Silver", "128GB", "Blue - slightly scratched")
- vehicle_make (for car parts only, e.g., "Toyota", "Honda")
- vehicle_model (for car parts only, e.g., "Corolla", "Civic")
- vehicle_year_from (for car parts only, starting year of compatibility)
- vehicle_year_to (for car parts only, ending year of compatibility)

Return ONLY a JSON array of parts in this exact format:
[{"part_name": "string", "category": "string", "condition": "string", "price": number, "description": "string", "color_variant": "string|null", "vehicle_make": "string|null", "vehicle_model": "string|null", "vehicle_year_from": number|null, "vehicle_year_to": number|null}]

If a field is not found, use reasonable defaults:
- condition: "used"
- description: ""
- price: 0 (if not specified)
- vehicle fields: null (if not car parts)

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

    // Validate and normalize categories
    const normalizeCategory = (cat: string): string => {
      const lower = cat.toLowerCase();
      if (lower.includes('phone') || lower.includes('mobile')) return "Phone Spare Parts";
      if (lower.includes('tv') || lower.includes('television')) return "TV Spare Parts";
      if (lower.includes('computer') || lower.includes('pc') || lower.includes('laptop')) return "Computer Spare Parts";
      if (lower.includes('car') || lower.includes('auto') || lower.includes('vehicle')) return "Car Spare Parts";
      // Default to computer if unclear
      return "Computer Spare Parts";
    };

    // Insert parts into database
    const partsToInsert = parts.map((part: Record<string, unknown>) => ({
      supplier_id: userId,
      part_name: String(part.part_name || 'Unknown Part'),
      category: VALID_CATEGORIES.includes(String(part.category)) 
        ? String(part.category) 
        : normalizeCategory(String(part.category || '')),
      condition: ['new', 'used', 'refurbished'].includes(String(part.condition)) 
        ? String(part.condition) 
        : 'used',
      price: typeof part.price === 'number' ? part.price : null,
      description: String(part.description || ''),
      color_variant: part.color_variant ? String(part.color_variant) : null,
      vehicle_make: part.vehicle_make ? String(part.vehicle_make) : null,
      vehicle_model: part.vehicle_model ? String(part.vehicle_model) : null,
      vehicle_year_from: typeof part.vehicle_year_from === 'number' ? part.vehicle_year_from : null,
      vehicle_year_to: typeof part.vehicle_year_to === 'number' ? part.vehicle_year_to : null,
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