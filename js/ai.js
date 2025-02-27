"use strict";
import theme from "./theme.js";
import { sourceEditor } from "./ide.js";

const THREAD = [
    {
        role: "system",
        content: `
You are an AI assistant integrated into an online code editor.
Your main job is to help users with their code by suggesting and applying fixes or explaining specific lines or concepts.

**Guidelines:**
1. If the user's code has issues (e.g., incorrect types, syntax errors, bad practices), provide a **corrected version**.
2. If a change is needed, return the **entire modified code** inside:
   \`\`\`fixed
   (modified code here)
   \`\`\`
3. If the user asks about specific lines or concepts, provide a **clear explanation**.
4. Do **not** make unnecessary changes. Only modify what’s needed.
5. If no fixes are needed, just explain why.

Example:
User's input: "Fix my code"
User's code: \`auto x = 5;\`
Your response:
\`\`\`fixed
int x = 5;
\`\`\`


If the user asks for explanation:
User's input: "Explain line 20"
User's code snippet: \`const auto kInfiniteCost = std::numeric_limits<uint64_t>::max();\`
Your response:
"Line 20 is defining a constant that represents an 'infinite' cost in the Dijkstra algorithm to initial consider all nodes as unreachable."
`.trim()
    }
];

document.addEventListener("DOMContentLoaded", function () {
    // Create the delete chat history button
    const deleteChatButton = document.createElement("button");
    deleteChatButton.innerText = "Delete Chat History 🗑️";
    deleteChatButton.title = "Delete Chat History";
    deleteChatButton.classList.add("ui", "button", "tiny", "white");
    deleteChatButton.style.display = "block";
    deleteChatButton.style.margin = "10px";

    const chatContainer = document.getElementById("judge0-chat-container");
    chatContainer.insertBefore(deleteChatButton, chatContainer.firstChild);

    deleteChatButton.addEventListener("click", function () {
        document.getElementById("judge0-chat-messages").innerHTML = "";
        THREAD.length = 1; // Reset to initial system message
    });

    // Create an input field for the API key
    const apiKeyInput = document.createElement("input");
    apiKeyInput.type = "password";
    apiKeyInput.placeholder = "Enter OpenRouter API Key";
    apiKeyInput.style.margin = "5px";
    apiKeyInput.value = localStorage.getItem("openrouter_api_key") || ""; // Load saved key

    const saveApiKeyButton = document.createElement("button");
    saveApiKeyButton.innerText = "Save Key";
    saveApiKeyButton.classList.add("ui", "button", "tiny", "blue");

    chatContainer.insertBefore(apiKeyInput, chatContainer.firstChild);
    chatContainer.insertBefore(saveApiKeyButton, chatContainer.firstChild);

    saveApiKeyButton.addEventListener("click", function () {
        localStorage.setItem("openrouter_api_key", apiKeyInput.value.trim());
        alert("API Key saved!");
    });

    function getApiKey() {
        return localStorage.getItem("openrouter_api_key") || "";
    }

    document.getElementById("judge0-chat-form").addEventListener("submit", async function (event) {
        event.preventDefault();

        const userInput = document.getElementById("judge0-chat-user-input");
        const userInputValue = userInput.value.trim();
        if (userInputValue === "") {
            return;
        }

        const sendButton = document.getElementById("judge0-chat-send-button");
        sendButton.classList.add("loading");
        userInput.disabled = true;

        const userMessage = document.createElement("div");
        userMessage.innerText = userInputValue;
        userMessage.classList.add("ui", "message", "judge0-message", "judge0-user-message");
        if (!theme.isLight()) {
            userMessage.classList.add("inverted");
        }

        const messages = document.getElementById("judge0-chat-messages");
        messages.appendChild(userMessage);

        userInput.value = "";
        messages.scrollTop = messages.scrollHeight;

        let userCode = sourceEditor.getValue();
        let lineNumber = extractLineNumber(userInputValue);
        let codeSnippet = extractCodeSnippet(userCode, lineNumber);

        THREAD.push({
            role: "user",
            content: `
User's code:
${userCode}

User's message:
${userInputValue}

${
                lineNumber !== null ? `Focus on line: ${lineNumber + 1}
Snippet: \n${codeSnippet}\n` : ''
            }
`.trim()
        });

        const aiMessage = document.createElement("div");
        aiMessage.classList.add("ui", "basic", "segment", "judge0-message", "loading");
        if (!theme.isLight()) {
            aiMessage.classList.add("inverted");
        }
        messages.appendChild(aiMessage);
        messages.scrollTop = messages.scrollHeight;

        const apiKey = getApiKey();
        if (!apiKey) {
            aiMessage.innerText = "Please enter your API key.";
            aiMessage.classList.remove("loading");
            userInput.disabled = false;
            sendButton.classList.remove("loading");
            return;
        }

        const SITE_URL = "<YOUR_SITE_URL>";
        const SITE_NAME = "<YOUR_SITE_NAME>";

        const selectedModel = document.getElementById("judge0-chat-model-select").value || "qwen/qwen-turbo";

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                extra_headers: {
                    "HTTP-Referer": SITE_URL,
                    "X-Title": SITE_NAME,
                },
                model: selectedModel,
                messages: THREAD
            })
        });

        const data = await response.json();
        let aiResponseValue = data.choices[0].message.content;

        THREAD.push({
            role: "assistant",
            content: aiResponseValue
        });

        aiMessage.innerHTML = DOMPurify.sanitize(aiResponseValue);
        aiMessage.innerHTML = marked.parse(aiMessage.innerHTML);
        aiMessage.classList.remove("loading");
        messages.scrollTop = messages.scrollHeight;

        const fixedCodeMatch = aiResponseValue.match(/```fixed\s([\s\S]*?)```/);
        if (fixedCodeMatch) {
            const fixedCode = fixedCodeMatch[1].trim();
            const applyFixButton = document.createElement("button");
            applyFixButton.innerText = "Apply Fix";
            applyFixButton.classList.add("ui", "button", "tiny", "green");

            applyFixButton.addEventListener("click", function () {
                sourceEditor.setValue(fixedCode);
                messages.removeChild(applyFixButton);
            });

            messages.appendChild(applyFixButton);
        }

        userInput.disabled = false;
        sendButton.classList.remove("loading");
        userInput.focus();
    });

    document.getElementById("judge0-chat-model-select").addEventListener("change", function () {
        const userInput = document.getElementById("judge0-chat-user-input");
        userInput.placeholder = `Message ${this.value}`;
    });
});

// Extract the line number from user input
function extractLineNumber(userInput) {
    const match = userInput.match(/line (\d+)/i);
    return match ? parseInt(match[1], 10) - 1 : null;
}

// Extract code snippet based on the line number
function extractCodeSnippet(code, lineNumber) {
    if (lineNumber === null) return "";
    const lines = code.split('\n');
    return lines[lineNumber] || "";
}

document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
            case "p":
                e.preventDefault();
                document.getElementById("judge0-chat-user-input").focus();
                break;
        }
    }
});

