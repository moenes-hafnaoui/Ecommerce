var express = require("express");
var router = express.Router();
const dotenv = require("dotenv");
var fetch = require("node-fetch");
var path = require("path");
var { Client } = require("@modelcontextprotocol/sdk/client/index.js");
var {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
dotenv.config();

/* =========================================
MCP CLIENT
========================================= */
let mcpClient;
let availableTools = [];
async function initializeMCP() {
  mcpClient = new Client({ name: "ollama-mcp-client", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: "node",
    args: [path.resolve(__dirname, "../server.js")],
  });
  await mcpClient.connect(transport);
  const toolsList = await mcpClient.listTools();
  availableTools = toolsList.tools || [];
  console.log(`✅ MCP connecté – ${availableTools.length} outil(s)`);
  availableTools.forEach((t) => console.log(` • ${t.name}: ${t.description}`));
}
initializeMCP().catch((err) => {
  console.error("❌ Erreur MCP", err);
  process.exit(1);
});

/* =========================================
MCP TOOL EXEC
========================================= */
async function executeToolViaMCP(toolName, args) {
  console.log(`🔧 MCP call → ${toolName}`, args);
  const result = await mcpClient.callTool({
    name: toolName,
    arguments: args,
  });
  const text = result?.content?.find((c) => c.type === "text")?.text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/* =========================================
FORMATTING FUNCTIONS (HUMAN-READABLE FRENCH)
========================================= */
function formatArticles(articles) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return "Aucun article trouvé.";
  }
  const lines = articles.map((a) => {
    const designation = a.designation || "Non spécifié";
    const marque = a.marque || "Non spécifiée";
    const prix = a.prix != null ? `${a.prix} DT` : "Prix non spécifié";
    const stock = a.qtestock != null ? `${a.qtestock} unités` : "Stock inconnu";
    return `• ${designation} (Marque: ${marque}, Prix: ${prix}, Stock: ${stock})`;
  });
  return "Voici les articles disponibles :\n" + lines.join("\n");
}

function formatCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return "Aucune catégorie trouvée.";
  }
  const lines = categories.map(
    (c) => `• ${c.nomcategorie || "Catégorie sans nom"}`
  );
  return "Voici les catégories disponibles :\n" + lines.join("\n");
}

function formatSCategories(scats) {
  if (!Array.isArray(scats) || scats.length === 0) {
    return "Aucune sous-catégorie trouvée.";
  }
  const lines = scats.map((s) => {
    const nom = s.nomscategorie || "Sous-catégorie inconnue";
    const cat = s.categorieID?.nomcategorie || "Catégorie non spécifiée";
    return `• ${nom} (Catégorie: ${cat})`;
  });
  return "Voici les sous-catégories disponibles :\n" + lines.join("\n");
}

function formatUsers(users) {
  if (
    users &&
    typeof users === "object" &&
    !Array.isArray(users) &&
    users._id
  ) {
    const u = users;
    const name =
      `${u.firstname || ""} ${u.lastname || ""}`.trim() || "Nom inconnu";
    const email = u.email || "email non spécifié";
    const role = u.role === "admin" ? "administrateur" : "utilisateur";
    const status = u.isActive ? "actif" : "inactif";
    return `Utilisateur trouvé : ${name} (${email}) – ${role}, ${status}`;
  }
  if (!Array.isArray(users) || users.length === 0) {
    return "Aucun utilisateur trouvé.";
  }
  const lines = users.map((u) => {
    const name =
      `${u.firstname || ""} ${u.lastname || ""}`.trim() || "Nom inconnu";
    const email = u.email || "email non spécifié";
    const role = u.role === "admin" ? "administrateur" : "utilisateur";
    const status = u.isActive ? "actif" : "inactif";
    return `• ${name} (${email}) – ${role}, ${status}`;
  });
  return "Voici la liste des utilisateurs :\n" + lines.join("\n");
}

/* =========================================
OLLAMA CALL
========================================= */
async function callOllama(messages) {
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.1",
      messages,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });
  const data = await res.json();
  return data.message.content;
}

/* =========================================
ROUTE PRINCIPALE
========================================= */
router.post("/", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message manquant" });
  }

  const msg = message.toLowerCase().trim();

  // === Articles par NOM de catégorie (ROBUSTE – gère & , accents, espaces, etc.) ===
  if (
    (msg.includes("article") || msg.includes("produit")) &&
    (msg.includes("categorie") || msg.includes("catégorie"))
  ) {
    // Extract everything after "categorie" or "catégorie", even with & , accents, spaces
    const match = message.match(
      /(?:catégorie|categorie)(?:\s+(?:de|la|le|du|des))?\s+(.+)/i
    );
    let categoryName = match ? match[1].trim() : null;

    // Remove trailing punctuation (.,;:!?)
    if (categoryName) {
      categoryName = categoryName.replace(/[.,;:!?]+$/, "").trim();
    }

    if (!categoryName) {
      return res.json({
        success: true,
        message:
          'Veuillez spécifier le nom de la catégorie. Exemple : "trouve les articles de la catégorie Informatique"',
      });
    }

    try {
      const data = await executeToolViaMCP("get-articles-by-category", {
        categoryName,
      });
      if (!Array.isArray(data) || data.length === 0) {
        return res.json({
          success: true,
          message: `Aucun article trouvé dans la catégorie "${categoryName}".`,
        });
      }
      const formatted = formatArticles(data);
      const messageWithCategory = formatted.replace(
        "Voici les articles disponibles :",
        `Voici les articles dans la catégorie "${categoryName}" :`
      );
      return res.json({ success: true, message: messageWithCategory });
    } catch (err) {
      console.error("Erreur articles par catégorie:", err);
      return res.status(500).json({
        error: "Impossible de récupérer les articles pour cette catégorie.",
      });
    }
  }

  // === TOUS les articles ===
  else if (
    msg.includes("article") ||
    msg.includes("produit") ||
    msg.includes("stock")
  ) {
    try {
      const data = await executeToolViaMCP("get-all-articles", {});
      return res.json({ success: true, message: formatArticles(data) });
    } catch (err) {
      console.error("Erreur articles:", err);
      return res
        .status(500)
        .json({ error: "Impossible de récupérer les articles." });
    }
  }

  // === Sous-catégories ===
  else if (
    msg.includes("sous") &&
    (msg.includes("cat") || msg.includes("scat") || msg.includes("sous-cat"))
  ) {
    try {
      const data = await executeToolViaMCP("get-all-scategories", {});
      return res.json({ success: true, message: formatSCategories(data) });
    } catch (err) {
      console.error("Erreur sous-catégories:", err);
      return res
        .status(500)
        .json({ error: "Impossible de récupérer les sous-catégories." });
    }
  }

  // === Catégories ===
  else if (msg.includes("cat") && !msg.includes("sous")) {
    try {
      const data = await executeToolViaMCP("get-all-categories", {});
      return res.json({ success: true, message: formatCategories(data) });
    } catch (err) {
      console.error("Erreur catégories:", err);
      return res
        .status(500)
        .json({ error: "Impossible de récupérer les catégories." });
    }
  }

  // === OLLAMA PATH (users, greetings, etc.) ===
  const systemPrompt = `
Tu es un assistant technique strict qui gère des données e-commerce.
RÈGLES :
- Réponds UNIQUEMENT en JSON valide.
- Si un tool est nécessaire : { "tool": "nom", "arguments": { ... } }
- Sinon : { "final": "message court en français" }

TOOLS DISPONIBLES :
- getListUsers() : Récupère tous les utilisateurs
- list-users(firstname?) : Recherche un utilisateur par prénom

EXEMPLES :
- "trouve les utilisateurs nommés ahmed" → { "tool": "list-users", "arguments": { "firstname": "ahmed" } }
- "donne-moi tous les utilisateurs" → { "tool": "getListUsers", "arguments": {} }
- "bonjour" → { "final": "Bonjour ! Je gère les données e-commerce." }
`.trim();

  let messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ];

  try {
    const raw = await callOllama(messages);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.json({ success: true, message: raw });
    }

    if (parsed.final) {
      return res.json({ success: true, message: parsed.final });
    }

    if (parsed.tool) {
      const toolResult = await executeToolViaMCP(
        parsed.tool,
        parsed.arguments || {}
      );
      let formattedMessage = "Réponse reçue.";
      if (parsed.tool === "getListUsers" || parsed.tool === "list-users") {
        formattedMessage = formatUsers(toolResult);
      }
      return res.json({
        success: true,
        message: formattedMessage,
        toolsCalled: [
          { tool: parsed.tool, args: parsed.arguments, result: toolResult },
        ],
      });
    }

    return res.json({ success: true, message: raw });
  } catch (err) {
    console.error("Erreur globale:", err);
    return res
      .status(500)
      .json({ error: "Erreur serveur", message: err.message });
  }
});

module.exports = router;
