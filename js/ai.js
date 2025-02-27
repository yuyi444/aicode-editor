"use strict";
import theme from "./theme.js";
import { sourceEditor } from "./ide.js";

//// Initial chat thread containing a system message
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

//Delete button logic
document.addEventListener("DOMContentLoaded", function () {
    // Create the delete chat history button
    const deleteChatButton = document.createElement("button");
    deleteChatButton.innerText = "Delete Chat History 🗑️";
    deleteChatButton.title = "Delete Chat History";
    deleteChatButton.classList.add("ui", "button", "tiny", "white");
    deleteChatButton.style.display = "block";
    deleteChatButton.style.margin = "10px";

    const chatContainer = document.getElementById("judge0-chat-container");// Get the chat container element
    chatContainer.insertBefore(deleteChatButton, chatContainer.firstChild);// Insert the delete button at the top of the chat container

  // Event listener for delete button click
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
    
    //save API key
    const saveApiKeyButton = document.createElement("button");
    saveApiKeyButton.innerText = "Save Key";
    saveApiKeyButton.classList.add("ui", "button", "tiny", "blue");

    chatContainer.insertBefore(apiKeyInput, chatContainer.firstChild);
    chatContainer.insertBefore(saveApiKeyButton, chatContainer.firstChild);

    saveApiKeyButton.addEventListener("click", function () {
        localStorage.setItem("openrouter_api_key", apiKeyInput.value.trim());
        alert("API Key saved!");
    });
// Retrieve the OpenRouter API key from local storage; return an empty string if it doesn't exist
    function getApiKey() {
        return localStorage.getItem("openrouter_api_key") || "";
    }
// Add an event listener for the chat form's submit event
    document.getElementById("judge0-chat-form").addEventListener("submit", async function (event) {
        event.preventDefault();
        
//Get user input
        const userInput = document.getElementById("judge0-chat-user-input");
        const userInputValue = userInput.value.trim();
        if (userInputValue === "") {
            return;
        }

        const sendButton = document.getElementById("judge0-chat-send-button");//// Get the send button element
        sendButton.classList.add("loading");//// Add a loading class to the button for visual feedback
        userInput.disabled = true;//// Disable the user input field to prevent further input

        const userMessage = document.createElement("div");//// Create a new div element for the user's message
        userMessage.innerText = userInputValue;//// Set the text of the message to the user's input
        userMessage.classList.add("ui", "message", "judge0-message", "judge0-user-message");//// Add CSS classes for styling
        if (!theme.isLight()) { //// Check if the current theme is not light
            userMessage.classList.add("inverted");//// Add an inverted class for dark theme styling
    }
        }

        const messages = document.getElementById("judge0-chat-messages");//// Get the chat messages display area
        messages.appendChild(userMessage);//// Append the user's message to the chat

        userInput.value = "";//// Clear the input field after sending the message
        messages.scrollTop = messages.scrollHeight;//// Scroll to the bottom of the chat to show the latest message


        let userCode = sourceEditor.getValue();//// Get the current code from the source editor
        let lineNumber = extractLineNumber(userInputValue); //// Extract the line number from the user's input
        let codeSnippet = extractCodeSnippet(userCode, lineNumber);//// Extract the specific code snippet based on the line number
        
// Push user message and code snippet to THREAD
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
        
 // Create loading message for AI response
        const aiMessage = document.createElement("div");
        aiMessage.classList.add("ui", "basic", "segment", "judge0-message", "loading");
        if (!theme.isLight()) {
            aiMessage.classList.add("inverted");
        }
        messages.appendChild(aiMessage);
        messages.scrollTop = messages.scrollHeight;
        
// Retrieve API key
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
        
// Make API request to chatbot
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
//Parse, extract, store AI Response in THREAD
        const data = await response.json();/
        let aiResponseValue = data.choices[0].message.content;

        THREAD.push({
            role: "assistant",
            content: aiResponseValue
        });
//Sanitize AI response, parse markdown in response, remove loading state, scroll to bottom of chat
        aiMessage.innerHTML = DOMPurify.sanitize(aiResponseValue);
        aiMessage.innerHTML = marked.parse(aiMessage.innerHTML);
        aiMessage.classList.remove("loading");
        messages.scrollTop = messages.scrollHeight;

        
//// This block of code checks if the AI response contains a fixed code snippet formatted with '```fixed ...```'. 
//If it finds such a snippet, it extracts the code and creates a button labeled "Apply Fix". 
//When the button is clicked, it sets the code editor's content to the extracted fixed code and removes the button from the chat. 
//After handling the response, the code re-enables the user input field, removes any loading state from the send button, and sets focus back to the user input field. 
//Additionally, an event listener is attached to the model selection dropdown, updating the user input field's placeholder to indicate the currently selected model.
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

//This code adds an event listener for keydown events in the document, allowing for keyboard shortcuts. 
//Specifically, it checks if the user is holding down the 'meta' key (on Mac) or 'control' key (on Windows) while pressing the 'p' key. 
//If this combination is detected, it prevents the default action associated with the 'p' key and sets focus to the user input field of the chat interface, 
//allowing the user to quickly type a message without needing to click on the input field.
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

