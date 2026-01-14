const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");

app.http("getVideoById", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "videos/{id}",
  handler: async (request, context) => {
    try {
      const id = request.params.id;
      const COSMOS_CONN = process.env.COSMOS_CONN;
      const COSMOS_DB = process.env.COSMOS_DB;
      const COSMOS_CONTAINER = process.env.COSMOS_CONTAINER;

      const client = new CosmosClient(COSMOS_CONN);
      const container = client.database(COSMOS_DB).container(COSMOS_CONTAINER);

      // partition key 
      const { resource } = await container.item(id, id).read();

      if (!resource) return { status: 404, jsonBody: { error: "Not found" } };

      return { status: 200, jsonBody: resource };
    } catch (err) {
      context.log("getVideoById error:", err);
      return { status: 500, jsonBody: { error: err.message || String(err) } };
    }
  },
});
