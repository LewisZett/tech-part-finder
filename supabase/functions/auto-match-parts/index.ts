import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting automatic matching process...");

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing authorization header" }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    // Create client with service role for operations
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Invalid authentication:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid or expired token" }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    console.log(`Auto-match triggered by user: ${user.id}`);

    // Rate limiting: Allow max 5 calls per hour per user
    const rateLimitWindow = 60 * 60 * 1000; // 1 hour in milliseconds
    const maxCallsPerWindow = 5;
    const functionName = 'auto-match-parts';

    // Check current rate limit status
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('user_id', user.id)
      .eq('function_name', functionName)
      .gte('last_call_at', new Date(Date.now() - rateLimitWindow).toISOString())
      .single();

    if (rateLimitError && rateLimitError.code !== 'PGRST116') {
      console.error("Rate limit check error:", rateLimitError);
    }

    if (rateLimitData) {
      // User has made calls within the time window
      if (rateLimitData.call_count >= maxCallsPerWindow) {
        const timeRemaining = Math.ceil((new Date(rateLimitData.last_call_at).getTime() + rateLimitWindow - Date.now()) / 60000);
        console.log(`Rate limit exceeded for user ${user.id}. Calls: ${rateLimitData.call_count}`);
        
        // Log rate limit violation
        await supabase.from('security_events').insert({
          user_id: user.id,
          event_type: 'rate_limit_exceeded',
          event_category: 'security',
          severity: 'medium',
          details: {
            function: functionName,
            attempts: rateLimitData.call_count,
            max_allowed: maxCallsPerWindow,
            time_remaining_minutes: timeRemaining,
          },
        });
        
        return new Response(
          JSON.stringify({ 
            error: "Rate limit exceeded", 
            message: `You can only trigger auto-matching ${maxCallsPerWindow} times per hour. Please try again in ${timeRemaining} minutes.`,
            retryAfter: timeRemaining
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429,
          }
        );
      }

      // Increment call count
      await supabase
        .from('rate_limits')
        .update({ 
          call_count: rateLimitData.call_count + 1,
          last_call_at: new Date().toISOString()
        })
        .eq('id', rateLimitData.id);
    } else {
      // First call in this window, create new rate limit entry
      await supabase
        .from('rate_limits')
        .insert({
          user_id: user.id,
          function_name: functionName,
          call_count: 1
        });
    }

    console.log(`Rate limit check passed for user ${user.id}`);

    // Fetch all active part requests
    const { data: requests, error: requestsError } = await supabase
      .from('part_requests')
      .select('*')
      .eq('status', 'active');

    if (requestsError) {
      console.error("Error fetching requests:", requestsError);
      throw requestsError;
    }

    console.log(`Found ${requests?.length || 0} active part requests`);

    let totalMatchesCreated = 0;
    const maxMatchesPerRun = 20; // Limit to prevent spam

    // Process each request
    for (const request of requests || []) {
      if (totalMatchesCreated >= maxMatchesPerRun) {
        console.log(`Reached max matches limit (${maxMatchesPerRun}), stopping...`);
        break;
      }

      console.log(`Processing request: ${request.part_name}`);

      // Fetch all available parts
      const { data: parts, error: partsError } = await supabase
        .from('parts')
        .select('*')
        .eq('status', 'available')
        .neq('supplier_id', request.requester_id); // Don't match with own parts

      if (partsError) {
        console.error("Error fetching parts:", partsError);
        continue;
      }

      if (!parts || parts.length === 0) {
        console.log("No available parts found");
        continue;
      }

      // Check for existing matches to avoid duplicates
      const { data: existingMatches } = await supabase
        .from('matches')
        .select('part_id, supplier_id')
        .eq('request_id', request.id);

      const existingMatchSet = new Set(
        existingMatches?.map(m => `${m.part_id}-${m.supplier_id}`) || []
      );

      // Use Lovable AI to find matching parts
      const prompt = `You are a parts matching expert. Analyze this part request and find the best matching available parts.

PART REQUEST:
Name: ${request.part_name}
Category: ${request.category}
Condition Preference: ${request.condition_preference || 'any'}
Description: ${request.description || 'N/A'}
Max Price: ${request.max_price ? `$${request.max_price}` : 'Not specified'}

AVAILABLE PARTS:
${parts.map((p, i) => `
${i + 1}. ID: ${p.id}
   Name: ${p.part_name}
   Category: ${p.category}
   Condition: ${p.condition}
   Price: $${p.price || 'N/A'}
   Description: ${p.description || 'N/A'}
`).join('\n')}

Return the top 3 best matches as a JSON array with format:
[{"id": "part_id", "score": 0.0-1.0, "reason": "why this matches"}]

Only include matches with score >= 0.7. If no good matches exist, return an empty array.`;

      try {
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
                content: 'You are a parts matching expert. Return only valid JSON arrays with matches.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI API error: ${aiResponse.status}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content;

        if (!aiContent) {
          console.log("No AI response content");
          continue;
        }

        // Extract JSON from AI response
        const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.log("No JSON found in AI response");
          continue;
        }

        const matches = JSON.parse(jsonMatch[0]);
        console.log(`AI found ${matches.length} potential matches`);

        // Create matches for high-scoring results
        for (const match of matches) {
          if (totalMatchesCreated >= maxMatchesPerRun) break;
          
          const part = parts.find(p => p.id === match.id);
          if (!part) continue;

          const matchKey = `${part.id}-${part.supplier_id}`;
          if (existingMatchSet.has(matchKey)) {
            console.log(`Match already exists for part ${part.part_name}`);
            continue;
          }

          // Create the match
          const { data: newMatch, error: matchError } = await supabase
            .from('matches')
            .insert({
              request_id: request.id,
              part_id: part.id,
              requester_id: request.requester_id,
              supplier_id: part.supplier_id,
              status: 'pending'
            })
            .select()
            .single();

          if (matchError) {
            console.error("Error creating match:", matchError);
            continue;
          }

          console.log(`Created match between request "${request.part_name}" and part "${part.part_name}" (score: ${match.score})`);
          totalMatchesCreated++;

          // Send notifications in background (don't await)
          supabase.functions.invoke("send-match-notification", {
            body: {
              matchId: newMatch.id,
              supplierId: part.supplier_id,
              requesterId: request.requester_id,
              itemName: request.part_name,
              itemType: 'request',
            },
          }).then(({ error: notifError }) => {
            if (notifError) {
              console.error("Error sending notification:", notifError);
            }
          });
        }
      } catch (aiError) {
        console.error("Error with AI matching:", aiError);
        continue;
      }
    }

    console.log(`Auto-matching completed. Created ${totalMatchesCreated} matches.`);

    return new Response(
      JSON.stringify({
        success: true,
        matchesCreated: totalMatchesCreated,
        message: `Successfully created ${totalMatchesCreated} automatic matches`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Auto-match error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
