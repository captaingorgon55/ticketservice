import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export function getGemini() {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

export function getModel(modelName = "gemini-2.5-flash") {
  return getGemini().getGenerativeModel({ model: modelName });
}

export function getJsonModel(modelName = "gemini-2.5-flash") {
  return getGemini().getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });
}
