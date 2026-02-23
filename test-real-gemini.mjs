import "dotenv/config";

async function run() {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) throw new Error("No key")

    const systemPrompt = `
    You are Kintsu, a social AI that helps people connect.
    Generate exactly 2 reply suggestions for the current user, in their own texting style.
    `

    const userPrompt = `Generate 2 natural icebreaker opening messages.`

    const body = JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    suggestions: {
                        type: "ARRAY",
                        description: "Exactly 2 text message suggestions",
                        items: {
                            type: "STRING"
                        }
                    }
                },
                required: ["suggestions"]
            }
        },
    })

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    )

    const data = await res.json()
    console.log("RAW TEXT PAYLOAD: \n", data.candidates?.[0]?.content?.parts?.[0]?.text)
    console.log("FINISH REASON: ", data.candidates?.[0]?.finishReason)
}

run()
