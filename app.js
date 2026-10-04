// OpenAI SDK: we use it to talk to Groq, because Groq's API works the same way
import OpenAI from "openai";
// Loads secret values (like your API key) from the .env file into process.env
import "dotenv/config";
import { tavily } from "@tavily/core";
// readline lets us read what the user types in the terminal.
// The "/promises" version lets us use "await" with it.
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// Create the client. The baseURL points the OpenAI SDK at Groq instead of OpenAI
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, // read from .env, never hardcode keys in code
  baseURL: "https://api.groq.com/openai/v1",
});
const tavilyTool = tavily({
  apiKey: process.env.Tool_Call_API_KEY,
  baseURL: "https://api.tavily.com",
});

// This is the real function that runs on YOUR computer when the model asks for it.
// The model can't search the web itself, so it asks us to run this.
// It searches the web with Tavily and joins the text of all results into one string.
async function webSearch({ query }) {
  const response = await tavilyTool.search(query);
  const finalResponse = response.results
    .map((result) => result.content)
    .join(" \n\n ");
  return finalResponse;
}

// The conversation history. The model has no memory, so we send the
// whole history every time we call it.
// Now it starts with ONLY the system message. User messages are added
// later, one by one, as the user types them.
const messages = [
  {
    role: "system", // instructions that set the assistant's behavior
    content: `You are a smart personal assistant that helps users with their questions and tasks
        You have access to following tools:
        1. webSearch: Search the latest information on the web for a given query.
        `,
  },
];

// The list of tools the model is ALLOWED to ask for.
// This is only a description (name, purpose, inputs). It is not the code.
// The model reads it to decide when and how to use the tool.
const tools = [
  {
    type: "function",
    function: {
      name: "webSearch", // must match the function name in our code
      description: "Search the latest information on the web for a given query.",
      parameters: {
        // describes the inputs the tool needs, in JSON Schema format
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for the web search.",
          },
        },
        required: ["query"], // the model must always provide "query"
      },
    },
  },
];

// This function handles ONE user question from start to finish.
// It was the old main(). The messages array is shared, so the model
// remembers earlier questions in the same session.
async function askModel() {
  // The model may need several rounds: ask for a tool, get the result,
  // maybe ask for another tool, and finally answer. So we loop until
  // the model answers without asking for a tool.
  while (true) {
    // STEP 1: Send the conversation and tool list to the model
    const chatCompletion = await groq.chat.completions.create({
      messages,
      tools,
      tool_choice: "auto", // the model decides itself whether to use a tool
      model: "openai/gpt-oss-120b",
      temperature: 0, // 0 = least random, most consistent answers
      max_completion_tokens: 2048, // maximum length of the reply
      top_p: 1,
      stream: true, // get the reply in small pieces (chunks) as it is generated
      reasoning_effort: "medium", // how much the model "thinks" before answering
      stop: null,
    });

    let content = ""; // collects normal text the model writes
    const toolCalls = []; // collects tool requests from the model

    // STEP 2: Read the stream chunk by chunk
    for await (const chunk of chatCompletion) {
      // "delta" is the small new piece of the reply in this chunk
      const delta = chunk.choices[0]?.delta;

      if (!delta) continue; // skip empty chunks

      // If this chunk has normal text, save it and print it live
      if (delta.content) {
        content += delta.content;
        process.stdout.write(delta.content); // print without a new line
      }

      // If this chunk is part of a tool request:
      // tool call arrives in pieces, so join them by index
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          // On the first piece, create an empty slot for this tool call.
          // "??=" means "only create it if it doesn't exist yet"
          toolCalls[tc.index] ??= {
            id: "",
            type: "function",
            function: { name: "", arguments: "" },
          };
          // Each piece may carry a bit of the id, name, or arguments.
          // We keep adding them together until the full call is built.
          if (tc.id) toolCalls[tc.index].id = tc.id;
          if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
          if (tc.function?.arguments)
            toolCalls[tc.index].function.arguments += tc.function.arguments;
        }
      }
    }

    // If the model did not ask for any tool, this was the final answer.
    if (toolCalls.length === 0) {
      // Save the answer in the history so the model remembers it next time
      messages.push({ role: "assistant", content });
      // console.log("\n"); // blank line after the answer
      return; // go back and wait for the next user question
    }

    // STEP 3: Save the model's tool request in the history.
    // The model must see its own request before it sees the tool's result.
    messages.push({ role: "assistant", content: content || null, tool_calls: toolCalls });

    // STEP 4: Run each requested tool and save its result
    for (const call of toolCalls) {
      let result;
      try {
        // The arguments come as a JSON string like '{"query":"Pune weather"}'.
        // JSON.parse turns it into a real object we can use.
        const args = JSON.parse(call.function.arguments);
        // console.log(`\n[Searching the web for: ${args.query}]`);
        // Run our real function with those arguments
        result = await webSearch(args);
      } catch (err) {
        // If the tool fails, tell the model instead of crashing the program
        result = `Error: ${err.message}`;
      }
      messages.push({
        role: "tool", // marks this message as a tool's output
        tool_call_id: call.id, // links the result to the request that asked for it
        content: result, // must be a string
      });
    }
    // The while loop now runs again: the model sees the tool result
    // and writes the final answer (STEP 5).
  }
}

// This function keeps asking the user for input until they type "bye"
async function main() {
  // Create the object that reads from the keyboard and writes to the screen
  const rl = readline.createInterface({ input, output });
  // console.log('Assistant ready. Type your question, or type "bye" to exit.\n');

  while (true) {
    // Wait here until the user types something and presses Enter
    const userInput = (await rl.question("You: ")).trim();

    if (!userInput) continue; // ignore empty input and ask again

    // Stop the program if the user says bye (any capital/small letters work)
    if (userInput.toLowerCase() === "bye") {
      // console.log("Assistant: Goodbye!");
      break; // leave the loop
    }

    // Add the user's question to the history
    messages.push({ role: "user", content: userInput });

    process.stdout.write("Assistant: ");
    try {
      await askModel(); // get and print the answer
    } catch (err) {
      // Show API/network errors without crashing the whole program
      console.error("\nError:", err.message);
      messages.pop(); // remove the question that failed so history stays valid
    }
  }

  rl.close(); // close the keyboard reader so the program can exit
}

// Start the program
main();