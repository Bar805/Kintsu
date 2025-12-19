const apiKey = process.env.GOOGLE_API_KEY || "PASTE_YOUR_KEY_HERE_IF_ENV_FAILS";
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function listModels() {
    console.log("Querying Google for available models...");
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("API Error:", data.error);
        } else {
            console.log("✅ SUCCESS! Here are the models you can use:");
            console.log(data.models?.map(m => m.name)); // Lists names like 'models/gemini-pro'
        }
    } catch (error) {
        console.error("Network Error:", error);
    }
}

listModels();