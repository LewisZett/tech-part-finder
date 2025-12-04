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
    const { text, images, userId } = await req.json();
    console.log('Parsing parts list for user:', userId, { hasText: !!text, imageCount: images?.length || 0 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build messages for AI
    const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      {
        role: 'system',
        content: `You are an expert at identifying spare parts from text descriptions and images. For images, carefully analyze what part is shown and provide its technical name. Parse the data and return valid JSON only.

IMPORTANT: Categories MUST be exactly one of these values:
- "Phone Spare Parts" (for mobile phone components: screens, batteries, charging ports, etc.)
- "TV Spare Parts" (for television components: panels, power boards, remote sensors, etc.)
- "Computer Spare Parts" (for computer components: RAM, CPUs, GPUs, motherboards, SSDs, etc.)
- "Car Spare Parts" (for automotive parts: bumpers, engines, transmissions, brake pads, etc.)

Classify each part into the most appropriate category based on its typical use.`
      }
    ];

    // Build user message content
    const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    
    if (text) {
      userContent.push({
        type: 'text',
        text: `Extract all parts from this text. For each part, identify:
- part_name (the name/model of the part)
- category (MUST be exactly one of: "Phone Spare Parts", "TV Spare Parts", "Computer Spare Parts", "Car Spare Parts")
- condition (MUST be exactly one of: "new", "used", or "refurbished")
- price (numeric value only, extract from text if mentioned)
- description (any additional details)
- color_variant (color or variant info, e.g., "Black", "Silver", "128GB", "Blue - slightly scratched")
- vehicle_make (for car parts only, e.g., "Toyota", "Honda")
- vehicle_model (for car parts only, e.g., "Corolla", "Civic")
- vehicle_year_from (for car parts only, starting year of compatibility)
- vehicle_year_to (for car parts only, ending year of compatibility)

Be flexible with text formats:
- Handle bullet points, numbered lists, comma-separated, or paragraph format
- Extract prices from various formats ($100, 100 USD, "one hundred dollars")
- Infer condition from context:
  * "brand new", "new", "unused" → "new"
  * "like new", "refurbished", "renewed" → "refurbished"
  * "used", "pre-owned", "second hand" → "used"
- If multiple parts are on one line separated by commas or semicolons, split them

Return ONLY a JSON array in this exact format:
[{"part_name": "string", "category": "string", "condition": "new|used|refurbished", "price": number, "description": "string", "color_variant": "string|null", "vehicle_make": "string|null", "vehicle_model": "string|null", "vehicle_year_from": number|null, "vehicle_year_to": number|null}]

Use defaults when fields aren't specified:
- condition: "used"
- description: ""
- price: 0
- vehicle fields: null (if not car parts)

Text to parse:
${text}`
      });
    }

    if (images && images.length > 0) {
      userContent.push({
        type: 'text',
        text: `\n\nAnalyze these ${images.length} image(s) of spare parts. For each image:
1. Identify the part shown (be specific - include type, material, size if visible)
2. Suggest a technical part_name based on what you see
3. Classify the category (MUST be one of: "Phone Spare Parts", "TV Spare Parts", "Computer Spare Parts", "Car Spare Parts")
4. Assess the condition from the image (new/used/refurbished)
5. Note any visible details for the description

Return parts from images in the same JSON format.`
      });

      // Add images
      for (const imageData of images) {
        userContent.push({
          type: 'image_url',
          image_url: { url: imageData }
        });
      }
    }

    messages.push({
      role: 'user',
      content: userContent
    });

    console.log('Calling Lovable AI for parsing...');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
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

    if (!Array.isArray(parts) || parts.length === 0) {
      throw new Error('No parts could be extracted');
    }

    // Validate and normalize categories
    const normalizeCategory = (cat: string): string => {
      const lower = cat.toLowerCase();
      if (lower.includes('phone') || lower.includes('mobile')) return "Phone Spare Parts";
      if (lower.includes('tv') || lower.includes('television')) return "TV Spare Parts";
      if (lower.includes('computer') || lower.includes('pc') || lower.includes('laptop')) return "Computer Spare Parts";
      if (lower.includes('car') || lower.includes('auto') || lower.includes('vehicle')) return "Car Spare Parts";
      return "Computer Spare Parts";
    };

    // Upload images to storage if provided
    const uploadedImageUrls: string[] = [];
    if (images && images.length > 0) {
      console.log('Uploading', images.length, 'images to storage...');
      
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        const base64Data = imageData.split(',')[1];
        const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        const fileName = `${userId}/${Date.now()}-${i}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('part-images')
          .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('part-images')
            .getPublicUrl(fileName);
          uploadedImageUrls.push(urlData.publicUrl);
        }
      }
      console.log('Uploaded', uploadedImageUrls.length, 'images');
    }

    // Insert parts into database
    const partsToInsert = parts.map((part: Record<string, unknown>, index: number) => ({
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
      image_url: uploadedImageUrls[index] || null,
      status: 'available'
    }));

    const { data: insertedParts, error: insertError } = await supabase
      .from('parts')
      .insert(partsToInsert)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      console.error('Failed parts data:', JSON.stringify(partsToInsert.slice(0, 3), null, 2));
      throw new Error(`Failed to insert parts: ${insertError.message}. Please check that all parts have valid condition values (new, used, or refurbished).`);
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
    console.error('Error in parse-parts-text:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});