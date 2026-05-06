import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Uses Gemini 1.5 Flash Vision to identify the precise optical center of the
 * artistic portal in the hoodie asset.
 */
export async function detectOpticalCenter(imageBuffer, editionName) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  GEMINI_API_KEY not set. Falling back to manual coordinates.");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are a high-end technical design assistant for an atelier. 
      I am uploading an image of a hoodie design (back view on the left, front view on the right).
      
      Look at the BACK VIEW (the left half of the image). 
      Identify the exact visual center of the circular artistic portal or "glow" located between the two hands.
      
      Return ONLY a JSON object with the coordinates normalized from 0 to 1000 for the WHOLE image.
      Format: {"x_percent": 0-100, "y_percent": 0-100}
      
      Example: If the center is in the middle of the left frame, x_percent might be 25.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: "image/png",
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{.*\}/);
    if (jsonMatch) {
      const coords = JSON.parse(jsonMatch[0]);
      console.log(`🧠 Gemini Vision detected optical center for ${editionName}:`, coords);
      return coords;
    }
    
    throw new Error("Could not parse coordinates from Gemini response.");
  } catch (error) {
    console.error("❌ Gemini Vision Detection Failed:", error.message);
    return null;
  }
}
