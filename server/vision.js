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
    // Using gemini-1.5-flash for speed and vision capabilities
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Look at this hoodie design. It shows a back view on the left and a front view on the right.
      
      Your task: Find the exact horizontal and vertical center of the 'glowing circle' or 'portal' 
      located between the hands on the BACK VIEW (the left half of the image).
      
      Return ONLY a JSON object with the percentages relative to the TOTAL image width and height.
      Format: {"x_percent": number, "y_percent": number}
    `;

    const parts = [
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/png",
          data: imageBuffer.toString("base64")
        }
      }
    ];

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{.*\}/);
    if (jsonMatch) {
      const coords = JSON.parse(jsonMatch[0]);
      // Safety check: ensure x is in the left half (back view)
      if (coords.x_percent > 50) {
          console.warn("⚠️  Gemini detected center in right half. Adjusting to left half.");
          coords.x_percent = coords.x_percent - 50; 
      }
      console.log(`🧠 Gemini Vision detected optical center for ${editionName}:`, coords);
      return coords;
    }
    
    return null;
  } catch (error) {
    console.error("❌ Gemini Vision Detection Failed:", error.message);
    return null;
  }
}
