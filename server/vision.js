import dotenv from 'dotenv';
dotenv.config();

/**
 * Uses Gemini 1.5 Flash Vision to identify the precise optical center of the
 * artistic portal in the hoodie asset.
 * 
 * Directly uses fetch to avoid SDK path issues.
 */
export async function detectOpticalCenter(imageBuffer, editionName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️  GEMINI_API_KEY not set. Falling back to manual coordinates.");
    return null;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const payload = {
      contents: [{
        parts: [
          { text: "Identify the exact visual center of the circular artistic portal located between the hands on the BACK VIEW (left half) of this image. Return ONLY a JSON object: {\"x_percent\": number, \"y_percent\": number} where percentages are relative to the whole image width and height." },
          {
            inline_data: {
              mime_type: "image/png",
              data: imageBuffer.toString("base64")
            }
          }
        ]
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errData = await response.json();
        console.error(`❌ Gemini API Error (${response.status}):`, JSON.stringify(errData, null, 2));
        throw new Error(errData.error?.message || "Gemini API request failed");
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    const jsonMatch = text.match(/\{.*\}/);
    if (jsonMatch) {
      const coords = JSON.parse(jsonMatch[0]);
      // Precision normalization check
      if (coords.x_percent > 50) coords.x_percent = coords.x_percent / 2; // AI might think relative to the frame
      
      console.log(`🧠 Vision-AI detected center for ${editionName}:`, coords);
      return coords;
    }
    
    return null;
  } catch (error) {
    console.error("❌ Gemini Vision API Failed:", error.message);
    return null;
  }
}
