const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const axios = require("axios");
const { z } = require("zod");

// 2. Initialisation du Serveur
const server = new McpServer({
  name: "ecommerce-backend-server",
  version: "1.0.0",
});

server.tool(
  "getListUsers",
  "Get all users from the ecommerce database",
  {}, // Pas de paramètres
  async () => {
    const response = await axios.get(
      "http://localhost:3001/api/users/getallusers"
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.data),
        },
      ],
    };
  }
);

server.tool(
  "list-users",
  "List users optionally filtered by firstname",
  { firstname: z.string().optional().describe("Filter by firstname") },
  async ({ firstname }) => {
    console.error("MCP list-users appelé avec:", firstname);
    const response = await axios.post(
      "http://localhost:3001/api/users/getuserbyname",
      { firstname }
    );
    const users = await response.data;
    if (users.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `Client de la firstname ${firstname ?? ""} not found.`,
          },
        ],
      };
    }
    console.error(users);
    return { content: [{ type: "text", text: JSON.stringify(users) }] };
  }
);
// ===== OUTILS POUR ARTICLES, CATÉGORIES, SOUS-CATÉGORIES =====

server.tool(
  "get-all-articles",
  "Récupère tous les articles de la base de données avec leurs sous-catégories",
  {},
  async () => {
    const response = await axios.get("http://localhost:3001/api/articles");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.data),
        },
      ],
    };
  }
);

server.tool(
  "get-all-categories",
  "Récupère toutes les catégories de la base de données",
  {},
  async () => {
    const response = await axios.get("http://localhost:3001/api/categories");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.data),
        },
      ],
    };
  }
);

server.tool(
  "get-all-scategories",
  "Récupère toutes les sous-catégories de la base de données avec leurs catégories parentes",
  {},
  async () => {
    const response = await axios.get("http://localhost:3001/api/scategories");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.data),
        },
      ],
    };
  }
);

server.tool(
  "get-articles-by-category",
  "Récupère les articles d'une catégorie en donnant son NOM exact (ex: 'Informatique')",
  { categoryName: z.string().describe("Le nom exact de la catégorie") },
  async ({ categoryName }) => {
    try {
      const catResponse = await axios.get(
        "http://localhost:3001/api/categories"
      );
      const categories = catResponse.data;
      const matchedCat = categories.find(
        (cat) =>
          cat.nomcategorie &&
          cat.nomcategorie.trim().toLowerCase() ===
            categoryName.trim().toLowerCase()
      );

      if (!matchedCat) {
        return { content: [{ type: "text", text: "[]" }] };
      }

      const artResponse = await axios.get(
        `http://localhost:3001/api/articles/cat/${matchedCat._id}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(artResponse.data) }],
      };
    } catch (err) {
      console.error("Erreur dans get-articles-by-category:", err.message);
      return { content: [{ type: "text", text: "[]" }] };
    }
  }
);

// 4. Lancement avec Transport STDIO
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server is running on STDIO...");
}
main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
