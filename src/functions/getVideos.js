const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

// GET /api/getVideos?uploadedBy=Matthew&title=cloud&id=video1&limit=20
app.http("getVideos", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // --- Env vars (set these in local.settings.json + Azure App Settings) ---
      const COSMOS_CONN = process.env.COSMOS_CONN;
      const COSMOS_DB = process.env.COSMOS_DB;
      const COSMOS_CONTAINER = process.env.COSMOS_CONTAINER;

      if (!COSMOS_CONN || !COSMOS_DB || !COSMOS_CONTAINER) {
        return {
          status: 500,
          jsonBody: {
            error:
              "Missing COSMOS_CONN / COSMOS_DB / COSMOS_CONTAINER in environment variables.",
          },
        };
      }

      // --- Read filters from query string ---
      const uploadedBy = request.query.get("uploadedBy"); // exact match
      const title = request.query.get("title"); // contains (case-insensitive)
      const id = request.query.get("id"); // exact match
      const limitRaw = request.query.get("limit");

      let limit = 50;
      if (limitRaw) {
        const n = parseInt(limitRaw, 10);
        if (!Number.isNaN(n) && n > 0 && n <= 200) limit = n; // cap at 200
      }
// CI/CD test

      
      const where = [];
      const parameters = [];

      if (uploadedBy) {
        where.push("c.uploadedBy = @uploadedBy");
        parameters.push({ name: "@uploadedBy", value: uploadedBy });
      }

      if (title) {
        // case-insensitive contains
        where.push("CONTAINS(c.title, @title, true)");
        parameters.push({ name: "@title", value: title });
      }

      if (id) {
        where.push("c.id = @id");
        parameters.push({ name: "@id", value: id });
      }

      let query = "SELECT * FROM c";
      if (where.length) query += " WHERE " + where.join(" AND ");
      query += " ORDER BY c.createdAt DESC";

      const client = new CosmosClient(COSMOS_CONN);
      const container = client.database(COSMOS_DB).container(COSMOS_CONTAINER);

      
      const iterator = container.items.query(
        { query, parameters },
        { maxItemCount: limit }
      );

      const { resources } = await iterator.fetchNext();

      return {
        status: 200,
        jsonBody: resources ?? [],
      };
    } catch (err) {
      context.log("getVideos error:", err);
      return { status: 500, jsonBody: { error: err.message || String(err) } };
    }
  },
});
