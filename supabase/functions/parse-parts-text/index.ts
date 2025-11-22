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
    const messages: any[] = [
      {
        role: 'system',
        content: 'You are an expert at identifying construction parts from text descriptions and images. For images, carefully analyze what part is shown and provide its technical name. Parse the data and return valid JSON only.'
      }
    ];

    // Build user message content
    const userContent: any[] = [];
    
    if (text) {
      userContent.push({
        type: 'text',
        text: `Extract all parts from this text. For each part, identify:
- part_name (the name/model of the part)
- category (classify as: electrical, plumbing, hvac, structural, roofing, flooring, doors, windows, or other)
- condition (MUST be exactly one of: "new", "used", or "refurbished")
- price (numeric value only, extract from text if mentioned)
- description (any additional details)

Be flexible with text formats:
- Handle bullet points, numbered lists, comma-separated, or paragraph format
- Extract prices from various formats ($100, 100 USD, "one hundred dollars")
- Infer condition from context:
  * "brand new", "new", "unused" → "new"
  * "like new", "refurbished", "renewed" → "refurbished"
  * "used", "pre-owned", "second hand" → "used"
- If multiple parts are on one line separated by commas or semicolons, split them

Return ONLY a JSON array in this exact format:
[{"part_name": "string", "category": "string", "condition": "new|used|refurbished", "price": number, "description": "string"}]

Use defaults when fields aren't specified:
- condition: "used"
- description: ""
- price: 0

Text to parse:
${text}`
      });
    }

    if (images && images.length > 0) {
      userContent.push({
        type: 'text',
        text: `\n\nAnalyze these ${images.length} image(s) of construction parts. For each image:
1. Identify the part shown (be specific - include type, material, size if visible)
2. Suggest a technical part_name based on what you see
3. Classify the category
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

    // Upload images to storage if provided
    let uploadedImageUrls: string[] = [];
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
    const partsToInsert = parts.map((part: any, index: number) => ({
      supplier_id: userId,
      part_name: part.part_name,
      category: part.category,
      condition: part.condition,
      price: part.price || null,
      description: part.description || '',
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